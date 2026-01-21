import { Router } from "express";
import {
  syncConnectorById,
  syncConnectorsByType,
  getSyncStatus,
} from "./sync.scheduler";
import {
  getAllQueueStatuses,
  getRegisteredConnectorTypes,
  getConnectorHandler,
} from "./connector.registry";
import { createLogger } from "../../utils/logger";

const syncController: Router = Router();
const logger = createLogger("Sync Controller");

// ============================================
// SYNC ENDPOINTS
// ============================================

/**
 * POST /sync/:connectorId
 * Manually trigger sync for a specific connector by ID.
 */
syncController.post("/:connectorId", async (req, res) => {
  const { connectorId } = req.params;

  try {
    logger.info(`Manual sync triggered for connector: ${connectorId}`);
    const result = await syncConnectorById(connectorId);

    res.json({
      status: "success",
      connectorId,
      ...result,
    });
  } catch (error) {
    logger.error(`Sync failed for connector ${connectorId}:`, error);
    res.status(500).json({
      status: "error",
      connectorId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /sync/type/:connectorType
 * Manually trigger sync for all active connectors of a specific type.
 */
syncController.post("/type/:connectorType", async (req, res) => {
  const { connectorType } = req.params;

  try {
    logger.info(`Manual sync triggered for type: ${connectorType}`);
    const results = await syncConnectorsByType(connectorType);

    const response: Record<string, unknown> = {
      status: "success",
      connectorType,
      syncedCount: results.size,
      results: Object.fromEntries(results),
    };

    res.json(response);
  } catch (error) {
    logger.error(`Sync failed for type ${connectorType}:`, error);
    res.status(500).json({
      status: "error",
      connectorType,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// ============================================
// STATUS ENDPOINTS
// ============================================

/**
 * GET /sync/status
 * Get overall sync status including registered types and last sync times.
 */
syncController.get("/status", async (_req, res) => {
  try {
    const status = getSyncStatus();
    res.json(status);
  } catch (error) {
    logger.error("Failed to get sync status:", error);
    res.status(500).json({ error: "Failed to get sync status" });
  }
});

/**
 * GET /sync/queues
 * Get queue status for all registered connector types.
 */
syncController.get("/queues", async (_req, res) => {
  try {
    const queues = getAllQueueStatuses();
    res.json(Object.fromEntries(queues));
  } catch (error) {
    logger.error("Failed to get queue statuses:", error);
    res.status(500).json({ error: "Failed to get queue statuses" });
  }
});

/**
 * GET /sync/queues/:connectorType
 * Get queue status for a specific connector type.
 */
syncController.get("/queues/:connectorType", async (req, res) => {
  const { connectorType } = req.params;

  try {
    const handler = getConnectorHandler(connectorType);
    if (!handler) {
      res.status(404).json({ error: `Connector type not found: ${connectorType}` });
      return;
    }

    const status = handler.getQueueStatus();
    res.json({
      connectorType,
      name: handler.name,
      ...status,
    });
  } catch (error) {
    logger.error(`Failed to get queue status for ${connectorType}:`, error);
    res.status(500).json({ error: "Failed to get queue status" });
  }
});

/**
 * GET /sync/types
 * List all registered connector types.
 */
syncController.get("/types", async (_req, res) => {
  try {
    const types = getRegisteredConnectorTypes();
    res.json({ types });
  } catch (error) {
    logger.error("Failed to get connector types:", error);
    res.status(500).json({ error: "Failed to get connector types" });
  }
});

export default syncController;
