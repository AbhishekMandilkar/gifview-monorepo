import cron from "node-cron";
import { syncRssMainFunc } from "./rss.service";
import { rssCronLogger } from "../../utils/logger";

// ============================================
// CRON JOB CONFIGURATION
// ============================================

// Run RSS sync every 2 hours
// Cron expression: "0 */2 * * *" = At minute 0 of every 2nd hour
const CRON_SCHEDULE = "0 */2 * * *";

// ============================================
// CRON JOB SETUP
// ============================================

export function initializeRssCronJobs(): void {
  rssCronLogger.info(`Initializing RSS cron job with schedule: ${CRON_SCHEDULE}`);

  cron.schedule(CRON_SCHEDULE, async () => {
    // Skip in local/development environment
    if (process.env.NODE_ENV === "local" || process.env.NODE_ENV === "development") {
      rssCronLogger.info(`Skipped - running in ${process.env.NODE_ENV} environment`);
      return;
    }

    rssCronLogger.info("Running scheduled RSS sync cron job");

    try {
      const result = await syncRssMainFunc(async (queued, processed, totalItems) => {
        rssCronLogger.info(
          `RSS sync completed - Queued: ${queued}, Processed: ${processed}, Total items in feed: ${totalItems}`
        );
      });

      rssCronLogger.info("Cron job completed successfully", {
        queued: result.queued,
        totalItems: result.totalItems,
        queueSize: result.queueSize,
      });

      if (result.queued > 0) {
        rssCronLogger.info(`${result.queued} items queued for background processing`);
      } else {
        rssCronLogger.info("No new items to process");
      }
    } catch (error) {
      rssCronLogger.error("Cron job failed:", error);
    }
  });

  rssCronLogger.info("RSS cron job scheduled successfully");
}

// Common cron schedules for reference:
// "0 * * * *"     - Every hour
// "0 */2 * * *"   - Every 2 hours
// "0 */6 * * *"   - Every 6 hours
// "0 0 * * *"     - Every day at midnight
// "0 6 * * *"     - Every day at 6am
// "0 9 * * 1"     - Every Monday at 9am
