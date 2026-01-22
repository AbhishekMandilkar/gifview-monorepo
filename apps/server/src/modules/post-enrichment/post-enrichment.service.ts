import { Queuer } from "@tanstack/pacer";
import * as postService from "../../services/postService";
import * as gifDbService from "../../services/gifService";
import * as post2InterestService from "../../services/post2InterestService";
import { createLogger } from "../../utils/logger";
import { suggestInterests } from "./interest.service";
import { suggestTopic } from "./topic.service";
import { getGif } from "../gif/gif.service";
import type {
  PostToEnrich,
  EnrichmentResult,
  EnrichmentQueueStatus,
  EnrichPostsResult,
} from "./post-enrichment.interfaces";

// ============================================
// CONFIGURATION
// ============================================

const logger = createLogger("Post Enrichment Service");
const queueLogger = createLogger("Enrichment Queue");

const QUEUE_CONFIG = {
  WAIT_MS: 15000, // 15 seconds between posts (AI calls are heavy)
  MAX_SIZE: 50, // Maximum queue size
  MAX_POSTS_PER_RUN: 5, // Limit posts per enrichment run
};

// ============================================
// QUEUE INSTANCE
// ============================================

let enrichmentQueue: Queuer<PostToEnrich> | null = null;

interface ActiveEnrichmentJob {
  queuedCount: number;
  startExecutionCount: number;
  onComplete: (queued: number, processed: number) => Promise<void>;
}

let activeEnrichmentJob: ActiveEnrichmentJob | null = null;

/**
 * Get or create the enrichment queue.
 */
function getEnrichmentQueue(): Queuer<PostToEnrich> {
  if (!enrichmentQueue) {
    enrichmentQueue = new Queuer<PostToEnrich>(
      async (post) => {
        try {
          queueLogger.info(`Processing post: ${post.id}`);

          // Enrich the single post
          const enrichmentResult = await enrichSinglePost(post);

          // If no result (no GIF found), skip this post
          if (!enrichmentResult) {
            queueLogger.info(`Skipped post ${post.id}: No GIF found`);
            return;
          }

          // Save results immediately
          await saveEnrichmentResult(enrichmentResult);

          queueLogger.info(`Successfully processed: ${post.id}`);
        } catch (error) {
          queueLogger.error(`Error processing ${post.id}:`, error);
          // Don't throw - let queue continue
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

          // Check if queue finished processing
          if (activeEnrichmentJob && queuer.store.state.size === 0) {
            const processedForThisJob =
              queuer.store.state.executionCount - activeEnrichmentJob.startExecutionCount;

            if (processedForThisJob > 0) {
              const job = activeEnrichmentJob;
              activeEnrichmentJob = null;

              job.onComplete(job.queuedCount, processedForThisJob).catch((error) => {
                queueLogger.error("Completion callback error:", error);
              });
            }
          }
        },
        onReject: (item) => {
          queueLogger.warn(`Queue full! Rejected: ${item.id}`);
        },
      }
    );
  }
  return enrichmentQueue;
}

// ============================================
// MAIN ENRICHMENT FUNCTION
// ============================================

/**
 * Queue unenriched posts for processing.
 * Returns immediately - processing happens in background.
 */
export async function enrichPostsList(
  onQueueComplete?: (queued: number, processed: number) => Promise<void>
): Promise<EnrichPostsResult> {
  // Fetch posts that need enrichment
  const postsToEnrich = await postService.getUnenrichedPosts(QUEUE_CONFIG.MAX_POSTS_PER_RUN);

  logger.info(`Posts to enrich: ${postsToEnrich.map((p) => p.id).join(", ")}`);

  if (!postsToEnrich.length) {
    logger.info("No posts to enrich");
    return { message: "No posts to enrich", queued: 0 };
  }

  try {
    const queue = getEnrichmentQueue();

    // Set up completion callback
    if (onQueueComplete) {
      activeEnrichmentJob = {
        queuedCount: postsToEnrich.length,
        startExecutionCount: queue.store.state.executionCount,
        onComplete: onQueueComplete,
      };
    }

    // Add posts to queue
    let queuedCount = 0;
    for (const post of postsToEnrich) {
      queue.addItem({
        id: post.id,
        title: post.title,
        description: post.description,
        content: post.content,
      });
      queuedCount++;
    }

    logger.info(`Queued ${queuedCount} posts. Queue size: ${queue.store.state.size}`);

    return {
      message: `Queued ${queuedCount} posts for enrichment`,
      queued: queuedCount,
      queueSize: queue.store.state.size,
      processed: queue.store.state.executionCount,
    };
  } catch (error) {
    logger.error("Error queuing posts:", error);
    activeEnrichmentJob = null;
    throw error;
  }
}

/**
 * Get current queue status.
 */
export function getEnrichmentQueueStatus(): EnrichmentQueueStatus {
  const queue = getEnrichmentQueue();
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
// HELPER FUNCTIONS
// ============================================

/**
 * Enrich a single post with interests and GIF.
 * Returns null if no GIF is found (post should be skipped).
 */
async function enrichSinglePost(post: PostToEnrich): Promise<EnrichmentResult | null> {
  // First, try to get a GIF - this is required for enrichment
  const gif = await getTopicAndGif(post);

  // If no GIF found, skip this post entirely
  if (!gif.url) {
    logger.warn(`No GIF found for post ${post.id}, skipping enrichment`);
    return null;
  }

  // GIF found - now get interests (can proceed even if interests fail)
  const interests = await suggestInterestsForPost(post);

  return {
    postId: post.id,
    interests: interests.map((id) => ({ interestId: id })),
    gif,
  };
}

/**
 * Suggest interests for a post.
 */
async function suggestInterestsForPost(post: PostToEnrich): Promise<string[]> {
  try {
    return await suggestInterests({
      title: post.title ?? "",
      content: post.content ?? "",
      description: post.description ?? "",
    });
  } catch (error) {
    logger.error(`Failed to suggest interests for post ${post.id}:`, error);
    return [];
  }
}

/**
 * Extract topic and get matching GIF.
 */
async function getTopicAndGif(
  post: PostToEnrich
): Promise<{ url: string; provider: string }> {
  try {
    // Get topic suggestion from AI
    const topic = await suggestTopic(
      post.title ?? "",
      post.description ?? "",
      post.content
    );

    // Search for GIF based on topic
    const gif = await getGif(topic);

    return {
      url: gif.url,
      provider: gif.provider,
    };
  } catch (error) {
    logger.error(`Failed to get topic/GIF for post ${post.id}:`, error);
    return { url: "", provider: "" };
  }
}

/**
 * Save enrichment result to database.
 */
async function saveEnrichmentResult(result: EnrichmentResult): Promise<void> {
  try {
    // 1. Create GIF record (skip if URL is empty)
    if (result.gif.url) {
      await gifDbService.createGif({
        url: result.gif.url,
        provider: result.gif.provider,
        postId: result.postId,
      });
      logger.debug(`Saved GIF for post ${result.postId}`);
    }

    // 2. Create post2interest records
    if (result.interests.length > 0) {
      const interestIds = result.interests.map((i) => i.interestId);
      await post2InterestService.linkPostToInterests(result.postId, interestIds);
      logger.debug(`Linked ${interestIds.length} interests to post ${result.postId}`);
    }

    // 3. Mark post as enriched
    await postService.markPostsAsEnriched([result.postId]);
    logger.debug(`Marked post ${result.postId} as enriched`);

    logger.info(
      `Enrichment saved - Post: ${result.postId}, GIF: ${result.gif.url ? "Yes" : "No"}, Interests: ${result.interests.length}`
    );
  } catch (error) {
    logger.error(`Failed to save enrichment for post ${result.postId}:`, error);
    throw error;
  }
}
