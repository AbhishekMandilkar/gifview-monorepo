import cron from "node-cron";
import { createLogger } from "../../utils/logger";
import { enrichPostsList, getEnrichmentQueueStatus } from "./post-enrichment.service";

const logger = createLogger("Post Enrichment Scheduler");

// ============================================
// CONFIGURATION
// ============================================

/**
 * Cron schedule - runs at minute 30 of every 2 hours.
 * This is offset from RSS sync (which runs at minute 0) to prevent overlap.
 */
const CRON_SCHEDULE = "30 */2 * * *";

// Track if scheduler is initialized
let isInitialized = false;

// ============================================
// SCHEDULER FUNCTIONS
// ============================================

/**
 * Initialize the post enrichment scheduler.
 * Call this once during application startup.
 */
export function initializeEnrichmentScheduler(): void {
  if (isInitialized) {
    logger.warn("Enrichment scheduler already initialized");
    return;
  }

  logger.info(`Initializing enrichment scheduler with schedule: ${CRON_SCHEDULE}`);

  cron.schedule(CRON_SCHEDULE, async () => {
    // Skip in development
    if (process.env.NODE_ENV === "local" || process.env.NODE_ENV === "development") {
      logger.info("Skipped - running in development environment");
      return;
    }

    logger.info(`[${new Date().toISOString()}] Running scheduled enrichment job`);

    try {
      const result = await enrichPostsList(async (queued, processed) => {
        logger.info(`Scheduled enrichment completed - Queued: ${queued}, Processed: ${processed}`);
      });

      logger.info(`Scheduled enrichment result: ${JSON.stringify(result)}`);
    } catch (error) {
      logger.error("Scheduled enrichment failed:", error);
    }
  });

  isInitialized = true;
  logger.info("Enrichment scheduler initialized successfully");
}

/**
 * Manually trigger enrichment (for API endpoint).
 */
export async function triggerManualEnrichment(): Promise<{
  message: string;
  queued: number;
  queueSize?: number;
  processed?: number;
}> {
  logger.info("Manual enrichment triggered");

  const result = await enrichPostsList(async (queued, processed) => {
    logger.info(`Manual enrichment completed - Queued: ${queued}, Processed: ${processed}`);
  });

  return result;
}

/**
 * Get enrichment status for monitoring.
 */
export function getEnrichmentStatus(): {
  scheduler: {
    isInitialized: boolean;
    schedule: string;
  };
  queue: ReturnType<typeof getEnrichmentQueueStatus>;
} {
  return {
    scheduler: {
      isInitialized,
      schedule: CRON_SCHEDULE,
    },
    queue: getEnrichmentQueueStatus(),
  };
}
