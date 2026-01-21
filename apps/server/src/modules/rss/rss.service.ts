import { eq } from "drizzle-orm";
import { db, connectors, posts, type PostInsert } from "@gifview-monorepo/db";
import { Queuer } from "@tanstack/pacer";
import { XMLParser } from "fast-xml-parser";
import { extractContentFromHTML } from "../../utils/html-utils";
import { rssSyncLogger, rssQueueLogger } from "../../utils/logger";
import type {
  IRSSPost,
  RSSPostToProcess,
  SyncResult,
  QueueStatus,
  ConnectorConfig,
  ActiveSyncJob,
} from "./rss.interfaces";

// ============================================
// XML PARSER CONFIGURATION
// ============================================

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

// ============================================
// QUEUE CONFIGURATION
// ============================================

const QUEUE_CONFIG = {
  WAIT_MS: 10000, // 10 seconds between items (adjust based on server capacity)
  MAX_SIZE: 50, // Maximum queue size
  MAX_RSS_ITEMS: 5, // Max items to process per sync (prevents overload)
};

// ============================================
// QUEUE INSTANCE
// ============================================

let rssPostQueue: Queuer<RSSPostToProcess> | null = null;
let activeSyncJob: ActiveSyncJob | null = null;

function getRssPostQueue(): Queuer<RSSPostToProcess> {
  if (!rssPostQueue) {
    rssPostQueue = new Queuer<RSSPostToProcess>(
      async (rssPostData) => {
        try {
          const { post, connectorSelector, connectorId } = rssPostData;
          rssQueueLogger.info(`Processing: ${post.link}`);

          const processedPost = await processSingleRssPost({
            post,
            connectorSelector,
            connectorId,
          });

          if (processedPost) {
            await db.insert(posts).values(processedPost).onConflictDoNothing();
            rssQueueLogger.info(`Saved: ${post.link}`);
          } else {
            rssQueueLogger.info(`Skipped (exists/no content): ${post.link}`);
          }
        } catch (error) {
          rssQueueLogger.error(`Error processing ${rssPostData.post.link}:`, error);
          // Don't throw - let queue continue
        }
      },
      {
        wait: QUEUE_CONFIG.WAIT_MS,
        maxSize: QUEUE_CONFIG.MAX_SIZE,
        started: true,
        onItemsChange: (queuer) => {
          rssQueueLogger.info(
            `Queue status - Size: ${queuer.store.state.size}, Processed: ${queuer.store.state.executionCount}`
          );

          // Check if queue finished processing
          if (activeSyncJob && queuer.store.state.size === 0) {
            const processedForThisJob =
              queuer.store.state.executionCount - activeSyncJob.startExecutionCount;

            if (processedForThisJob > 0) {
              const job = activeSyncJob;
              activeSyncJob = null;

              job.onComplete(job.queuedCount, processedForThisJob, job.totalItems).catch((error) => {
                rssQueueLogger.error("Completion callback error:", error);
              });
            }
          }
        },
        onReject: (item) => {
          rssQueueLogger.warn(`Queue full! Rejected: ${item.post.link}`);
        },
      }
    );
  }
  return rssPostQueue;
}

// ============================================
// MAIN SYNC FUNCTION
// ============================================

export async function syncRssMainFunc(
  onQueueComplete?: (queued: number, processed: number, totalItems: number) => Promise<void>
): Promise<SyncResult> {
  const startTime = Date.now();
  rssSyncLogger.info(`Starting RSS sync`);

  try {
    // 1. Get active connector
    rssSyncLogger.info("Fetching active connector...");
    const connector = await db.query.connectors.findFirst({
      where: eq(connectors.active, true),
    });

    if (!connector) {
      throw new Error("No active RSS connector found");
    }

    rssSyncLogger.info(`Found connector: ${connector.id}`);

    // 2. Parse connector config
    const connectorType: ConnectorConfig = JSON.parse(connector.connectorType || "{}");
    const rssUrl = connectorType?.RssJsonLd?.url;
    const connectorSelector = connectorType?.RssJsonLd?.text_css_selector || "";

    if (!rssUrl) {
      throw new Error("No RSS URL found in connector");
    }

    // 3. Fetch RSS feed
    rssSyncLogger.info(`Fetching RSS feed from: ${rssUrl}`);
    const rssResponse = await fetch(rssUrl);
    const rssText = await rssResponse.text();
    rssSyncLogger.info(`RSS feed fetched in ${Date.now() - startTime}ms`);

    // 4. Parse XML to JSON
    rssSyncLogger.info("Parsing RSS XML...");
    const rssJson = xmlParser.parse(rssText);

    // Handle both single item and array of items
    const rawItems = rssJson?.rss?.channel?.item;
    const rssList: IRSSPost[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
    const totalItems = rssList.length;
    rssSyncLogger.info(`Found ${totalItems} items in RSS feed`);

    // 5. Limit items to prevent overload
    const limitedRssList = rssList.slice(0, QUEUE_CONFIG.MAX_RSS_ITEMS);

    if (totalItems > QUEUE_CONFIG.MAX_RSS_ITEMS) {
      rssSyncLogger.info(
        `Limiting to ${QUEUE_CONFIG.MAX_RSS_ITEMS} items (from ${totalItems} total)`
      );
    }

    if (!limitedRssList.length) {
      rssSyncLogger.info("No RSS items to process");
      return {
        totalItems,
        queued: 0,
        queueSize: 0,
        processed: 0,
        message: "No RSS items to process",
      };
    }

    // 6. Add items to queue
    const queue = getRssPostQueue();

    if (onQueueComplete) {
      activeSyncJob = {
        queuedCount: limitedRssList.length,
        totalItems,
        startExecutionCount: queue.store.state.executionCount,
        onComplete: onQueueComplete,
      };
    }

    let queuedCount = 0;
    for (const post of limitedRssList) {
      queue.addItem({
        post,
        connectorSelector,
        connectorId: connector.id,
      });
      queuedCount++;
    }

    rssSyncLogger.info(`Queued ${queuedCount} posts. Queue size: ${queue.store.state.size}`);

    return {
      totalItems,
      queued: queuedCount,
      queueSize: queue.store.state.size,
      processed: queue.store.state.executionCount,
      message: `Queued ${queuedCount} RSS posts for processing`,
    };
  } catch (error) {
    rssSyncLogger.error(`Error after ${Date.now() - startTime}ms:`, error);
    activeSyncJob = null;
    throw error;
  }
}

// ============================================
// PROCESS SINGLE POST
// ============================================

async function processSingleRssPost(params: {
  post: IRSSPost;
  connectorSelector: string;
  connectorId: string;
}): Promise<PostInsert | null> {
  const { post, connectorSelector, connectorId } = params;
  const url = post.link;

  try {
    // 1. Check if post already exists (deduplication)
    const existingPost = await db.query.posts.findFirst({
      where: eq(posts.sourceLink, url),
    });

    if (existingPost) {
      rssQueueLogger.info(`Post already exists: ${url}`);
      return null;
    }

    // 2. Extract content from source URL
    rssQueueLogger.info(`Extracting content from: ${url}`);
    const content = await extractContentFromHTML(url, connectorSelector || undefined);

    if (!content) {
      rssQueueLogger.info(`No content found for: ${url}`);
      return null;
    }

    // 3. Build post data
    const newPostData: PostInsert = {
      content,
      title: post.title,
      description: post.description,
      topic: post.title, // Can be enhanced with AI topic suggestion
      tags: [],
      sourceKey: post.link,
      sourceLink: post.link,
      publishingDate: new Date(post.pubDate).toISOString(),
      language: "en", // Or parse from post.language
      connectorId,
      isDeleted: false,
      createdDate: new Date().toISOString(),
    };

    return newPostData;
  } catch (error) {
    rssQueueLogger.error(`Error processing post ${url}:`, error);
    return null;
  }
}

// ============================================
// QUEUE STATUS
// ============================================

export function getRssQueueStatus(): QueueStatus {
  const queue = getRssPostQueue();
  return {
    size: queue.store.state.size,
    isRunning: queue.store.state.isRunning,
    executionCount: queue.store.state.executionCount,
    rejectionCount: queue.store.state.rejectionCount,
    isEmpty: queue.store.state.isEmpty,
    isFull: queue.store.state.isFull,
  };
}
