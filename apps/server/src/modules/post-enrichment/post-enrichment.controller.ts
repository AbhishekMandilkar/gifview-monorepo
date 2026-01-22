import { Router } from "express";
import { createLogger } from "../../utils/logger";
import {
  triggerManualEnrichment,
  getEnrichmentStatus,
} from "./post-enrichment.scheduler";

const logger = createLogger("Post Enrichment Controller");
const postEnrichmentController: Router = Router();

// ============================================
// POST /post-enrichment/enrich - Manual trigger
// ============================================

postEnrichmentController.post("/enrich", async (_req, res) => {
  try {
    logger.info("Manual enrichment requested");

    const result = await triggerManualEnrichment();

    res.status(200).json({
      success: true,
      ...result,
      message: result.queued > 0
        ? "Posts queued for enrichment. Processing happens in background."
        : result.message,
    });
  } catch (error) {
    logger.error("Manual enrichment error:", error);
    res.status(500).json({
      success: false,
      error: "Something went wrong",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// ============================================
// GET /post-enrichment/status - Get status
// ============================================

postEnrichmentController.get("/status", async (_req, res) => {
  try {
    const status = getEnrichmentStatus();
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error("Error getting enrichment status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get enrichment status",
    });
  }
});

export default postEnrichmentController;
