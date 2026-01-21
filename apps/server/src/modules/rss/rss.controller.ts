import { Router } from "express";
import { syncRssMainFunc, getRssQueueStatus } from "./rss.service";
import { createLogger } from "../../utils/logger";

const rssController = Router();
const logger = createLogger("RSS Controller");

// ============================================
// API ENDPOINTS
// ============================================

// Manual trigger endpoint
rssController.post("/sync", async (_req, res) => {
  try {
    logger.info("Manual RSS sync triggered via API");

    const result = await syncRssMainFunc(async (queued, processed, totalItems) => {
      logger.info(`RSS sync completed - Queued: ${queued}, Processed: ${processed}, Total: ${totalItems}`);
    });

    logger.info("RSS posts queued via API", { result });

    res.json({
      status: "queued",
      ...result,
      message: "RSS posts queued for processing. Processing happens in background.",
    });
  } catch (error) {
    logger.error("Error queuing RSS posts:", error);
    res.status(500).json({
      error: "RSS sync failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Queue status endpoint
rssController.get("/sync/status", async (_req, res) => {
  try {
    const status = getRssQueueStatus();
    logger.info("Queue status requested", { status });
    res.json(status);
  } catch (error) {
    logger.error("Error getting queue status:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

export default rssController;
