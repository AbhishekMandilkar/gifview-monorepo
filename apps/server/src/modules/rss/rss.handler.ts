import type { PostInsert, Connector } from "@gifview-monorepo/db";
import { Queuer } from "@tanstack/pacer";
import { XMLParser } from "fast-xml-parser";
import { extractContentFromHTML } from "../../utils/html-utils";
import { createLogger } from "../../utils/logger";
import * as postService from "../../services/postService";
import { PostSource } from "../../types/postSource";
import type {
  ConnectorHandler,
  SyncResult,
  QueueStatus,
  OnSyncComplete,
} from "../sync/sync.interfaces";

// ============================================
// TYPES
// ============================================

interface RssConfig {
  RssJsonLd: {
    url: string;
    text_css_selector?: string;
    max_size?: number;
    source?: PostSource;
  };
}

interface RSSPost {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  language?: string;
  sourceName?: PostSource;
}

interface RSSPostToProcess {
  post: RSSPost;
  connectorSelector: string;
  connectorId: string;
}

interface ActiveSyncJob {
  queuedCount: number;
  totalItems: number;
  startExecutionCount: number;
  onComplete: OnSyncComplete;
}

// ============================================
// CONFIGURATION
// ============================================

const logger = createLogger("RSS Connector");
const queueLogger = createLogger("RSS Queue");

const QUEUE_CONFIG = {
  WAIT_MS: 10000, // 10 seconds between items
  MAX_SIZE: 50, // Maximum queue size
  DEFAULT_MAX_ITEMS: 5, // Default max items per sync
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

// ============================================
// QUEUE INSTANCE
// ============================================

let rssPostQueue: Queuer<RSSPostToProcess> | null = null;
let activeSyncJob: ActiveSyncJob | null = null;

function getQueue(): Queuer<RSSPostToProcess> {
  if (!rssPostQueue) {
    rssPostQueue = new Queuer<RSSPostToProcess>(
      async (rssPostData) => {
        try {
          const { post, connectorSelector, connectorId } = rssPostData;
          queueLogger.info(`Processing: ${post.link}`);

          const postData = await buildPostData({
            post,
            connectorSelector,
            connectorId,
          });

          if (postData) {
            const created = await postService.createPostIfNotExists(postData);
            if (created) {
              queueLogger.info(`Saved: ${post.link}`);
            } else {
              queueLogger.info(`Skipped (duplicate): ${post.link}`);
            }
          } else {
            queueLogger.info(`Skipped (exists/no content): ${post.link}`);
          }
        } catch (error) {
          queueLogger.error(`Error processing ${rssPostData.post.link}:`, error);
        }
      },
      {
        wait: QUEUE_CONFIG.WAIT_MS,
        maxSize: QUEUE_CONFIG.MAX_SIZE,
        started: true,
        onItemsChange: (queuer) => {
          queueLogger.info(
            `Queue status - Size: ${queuer.store.state.size}, Processed: ${queuer.store.state.executionCount}`
          );

          if (activeSyncJob && queuer.store.state.size === 0) {
            const processedForThisJob =
              queuer.store.state.executionCount - activeSyncJob.startExecutionCount;

            if (processedForThisJob > 0) {
              const job = activeSyncJob;
              activeSyncJob = null;

              job.onComplete(job.queuedCount, processedForThisJob, job.totalItems).catch((error) => {
                queueLogger.error("Completion callback error:", error);
              });
            }
          }
        },
        onReject: (item) => {
          queueLogger.warn(`Queue full! Rejected: ${item.post.link}`);
        },
      }
    );
  }
  return rssPostQueue;
}

// ============================================
// SYNC FUNCTION
// ============================================

async function syncRss(
  connector: Connector,
  onComplete?: OnSyncComplete
): Promise<SyncResult> {
  const startTime = Date.now();
  logger.info(`Starting RSS sync for connector: ${connector.id}`);

  try {
    // Parse connector config
    const config: RssConfig = JSON.parse(connector.connectorType || "{}");
    const rssUrl = config?.RssJsonLd?.url;
    const connectorSelector = config?.RssJsonLd?.text_css_selector || "";
    const maxItems = config?.RssJsonLd?.max_size || QUEUE_CONFIG.DEFAULT_MAX_ITEMS;
    // for now, default to BBC
    const sourceName = config?.RssJsonLd?.source || PostSource.BBC;

    if (!rssUrl) {
      throw new Error("No RSS URL found in connector config");
    }

    // Fetch RSS feed
    logger.info(`Fetching RSS feed from: ${rssUrl}`);
    const rssResponse = await fetch(rssUrl);
    const rssText = await rssResponse.text();
    logger.info(`RSS feed fetched in ${Date.now() - startTime}ms`);

    // Parse XML
    logger.info("Parsing RSS XML...");
    const rssJson = xmlParser.parse(rssText);

    const rawItems = rssJson?.rss?.channel?.item;
    const rssList: RSSPost[] = (Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [])
      .map((item: RSSPost) => ({ ...item, sourceName }));
    const totalItems = rssList.length;
    logger.info(`Found ${totalItems} items in RSS feed`);

    // Limit items
    const limitedRssList = rssList.slice(0, maxItems);

    if (totalItems > maxItems) {
      logger.info(`Limiting to ${maxItems} items (from ${totalItems} total)`);
    }

    if (!limitedRssList.length) {
      logger.info("No RSS items to process");
      return {
        totalItems,
        queued: 0,
        queueSize: 0,
        processed: 0,
        message: "No RSS items to process",
      };
    }

    // Add items to queue
    const queue = getQueue();

    if (onComplete) {
      activeSyncJob = {
        queuedCount: limitedRssList.length,
        totalItems,
        startExecutionCount: queue.store.state.executionCount,
        onComplete,
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

    logger.info(`Queued ${queuedCount} posts. Queue size: ${queue.store.state.size}`);

    return {
      totalItems,
      queued: queuedCount,
      queueSize: queue.store.state.size,
      processed: queue.store.state.executionCount,
      message: `Queued ${queuedCount} RSS posts for processing`,
    };
  } catch (error) {
    logger.error(`Error after ${Date.now() - startTime}ms:`, error);
    activeSyncJob = null;
    throw error;
  }
}

// ============================================
// BUILD POST DATA
// ============================================

/**
 * Build post data from RSS item.
 * Checks for duplicates and extracts content from source URL.
 * Returns null if post already exists or content extraction fails.
 */
async function buildPostData(params: {
  post: RSSPost;
  connectorSelector: string;
  connectorId: string;
}): Promise<PostInsert | null> {
  const { post, connectorSelector, connectorId } = params;
  const url = post.link;

  try {
    // Check for duplicates using post service
    const exists = await postService.checkPostExists(url, url);

    if (exists) {
      queueLogger.info(`Post already exists: ${url}`);
      return null;
    }

    // Extract content
    queueLogger.info(`Extracting content from: ${url}`);
    const content = await extractContentFromHTML(url, connectorSelector || undefined);

    if (!content) {
      queueLogger.info(`No content found for: ${url}`);
      return null;
    }

    // Build post data
    const newPostData: PostInsert = {
      content,
      title: post.title,
      description: post.description,
      topic: post.title,
      tags: [],
      sourceKey: post.link,
      sourceLink: post.link,
      sourceName: post.sourceName,
      publishingDate: new Date(post.pubDate).toISOString(),
      language: "en",
      connectorId,
      isDeleted: false,
      createdDate: new Date().toISOString(),
    };

    return newPostData;
  } catch (error) {
    queueLogger.error(`Error building post data for ${url}:`, error);
    return null;
  }
}

// ============================================
// QUEUE STATUS
// ============================================

function getQueueStatus(): QueueStatus {
  const queue = getQueue();
  return {
    size: queue.store.state.size,
    isRunning: queue.store.state.isRunning,
    executionCount: queue.store.state.executionCount,
    rejectionCount: queue.store.state.rejectionCount,
    isEmpty: queue.store.state.isEmpty,
    isFull: queue.store.state.isFull,
  };
}

// ============================================
// VALIDATE CONFIG
// ============================================

function validateConfig(configJson: string): boolean {
  try {
    const config: RssConfig = JSON.parse(configJson);
    return Boolean(config?.RssJsonLd?.url);
  } catch {
    return false;
  }
}

// ============================================
// CONNECTOR HANDLER EXPORT
// ============================================

/**
 * RSS Connector Handler
 * 
 * Handles syncing RSS/Atom feeds from any source.
 * 
 * Config format:
 * ```json
 * {
 *   "RssJsonLd": {
 *     "url": "https://example.com/feed.xml",
 *     "text_css_selector": "#main-content p",
 *     "max_size": 10,
 *     "source": "bbc"
 *   }
 * }
 * ```
 * 
 * Valid source values: "bbc", "spotify", "reddit" (see PostSource enum)
 */
export const rssConnectorHandler: ConnectorHandler = {
  type: "RssJsonLd",
  name: "RSS Feed",
  sync: syncRss,
  getQueueStatus,
  validateConfig,
};
