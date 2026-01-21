import cron from "node-cron";
import { eq } from "drizzle-orm";
import { db, connectors } from "@gifview-monorepo/db";
import {
  getConnectorHandler,
  parseConnectorType,
  getRegisteredConnectorTypes,
} from "./connector.registry";
import { createLogger } from "../../utils/logger";
import type { SyncResult } from "./sync.interfaces";

const logger = createLogger("Sync Scheduler");

// ============================================
// CONFIGURATION
// ============================================

/**
 * Main cron schedule - runs every minute to check for connectors that need syncing.
 * Individual connector timing is controlled by fetch_period_minutes in the database.
 */
const SCHEDULER_CRON = "* * * * *"; // Every minute

/**
 * Track last sync time for each connector to respect fetch_period_minutes.
 */
const lastSyncTimes = new Map<string, Date>();

// ============================================
// SYNC FUNCTIONS
// ============================================

/**
 * Sync a single connector by ID.
 * Used for manual triggers via API.
 */
export async function syncConnectorById(
  connectorId: string
): Promise<SyncResult> {
  logger.info(`Manual sync requested for connector: ${connectorId}`);

  const connector = await db.query.connectors.findFirst({
    where: eq(connectors.id, connectorId),
  });

  if (!connector) {
    throw new Error(`Connector not found: ${connectorId}`);
  }

  const connectorType = parseConnectorType(connector.connectorType);
  if (!connectorType) {
    throw new Error(`Invalid connector type for: ${connectorId}`);
  }

  const handler = getConnectorHandler(connectorType);
  if (!handler) {
    throw new Error(`No handler registered for connector type: ${connectorType}`);
  }

  logger.info(`Syncing ${handler.name} connector: ${connectorId}`);

  const result = await handler.sync(connector, async (queued, processed, totalItems) => {
    logger.info(
      `${handler.name} sync completed - Queued: ${queued}, Processed: ${processed}, Total: ${totalItems}`
    );
  });

  // Update last sync time
  lastSyncTimes.set(connectorId, new Date());

  return result;
}

/**
 * Sync all active connectors of a specific type.
 * Used for manual triggers via API.
 */
export async function syncConnectorsByType(
  connectorType: string
): Promise<Map<string, SyncResult>> {
  logger.info(`Syncing all connectors of type: ${connectorType}`);

  const handler = getConnectorHandler(connectorType);
  if (!handler) {
    throw new Error(`No handler registered for connector type: ${connectorType}`);
  }

  const activeConnectors = await db.query.connectors.findMany({
    where: eq(connectors.active, true),
  });

  const results = new Map<string, SyncResult>();

  for (const connector of activeConnectors) {
    const type = parseConnectorType(connector.connectorType);
    if (type !== connectorType) continue;

    try {
      const result = await handler.sync(connector);
      results.set(connector.id, result);
      lastSyncTimes.set(connector.id, new Date());
    } catch (error) {
      logger.error(`Failed to sync connector ${connector.id}:`, error);
      results.set(connector.id, {
        totalItems: 0,
        queued: 0,
        queueSize: 0,
        processed: 0,
        message: `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  return results;
}

/**
 * Main scheduler tick - checks all active connectors and syncs those that are due.
 */
async function schedulerTick(): Promise<void> {
  // Skip in development
  if (process.env.NODE_ENV === "local" || process.env.NODE_ENV === "development") {
    return;
  }

  const now = new Date();

  try {
    // Get all active connectors
    const activeConnectors = await db.query.connectors.findMany({
      where: eq(connectors.active, true),
    });

    for (const connector of activeConnectors) {
      const connectorType = parseConnectorType(connector.connectorType);
      if (!connectorType) {
        logger.warn(`Skipping connector ${connector.id}: invalid type`);
        continue;
      }

      const handler = getConnectorHandler(connectorType);
      if (!handler) {
        // No handler for this type - might be a different service's connector
        continue;
      }

      // Check if enough time has passed since last sync
      const lastSync = lastSyncTimes.get(connector.id);
      const fetchPeriodMs = (connector.fetchPeriodMinutes || 60) * 60 * 1000;

      if (lastSync) {
        const timeSinceLastSync = now.getTime() - lastSync.getTime();
        if (timeSinceLastSync < fetchPeriodMs) {
          // Not time yet
          continue;
        }
      }

      // Time to sync this connector
      logger.info(`Scheduled sync for ${handler.name} connector: ${connector.id}`);

      try {
        await handler.sync(connector, async (queued, processed, totalItems) => {
          logger.info(
            `${handler.name} scheduled sync completed - Queued: ${queued}, Processed: ${processed}, Total: ${totalItems}`
          );
        });

        lastSyncTimes.set(connector.id, now);
      } catch (error) {
        logger.error(`Scheduled sync failed for ${connector.id}:`, error);
      }
    }
  } catch (error) {
    logger.error("Scheduler tick failed:", error);
  }
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the sync scheduler.
 * Call this once during application startup AFTER all connectors are registered.
 */
export function initializeSyncScheduler(): void {
  const registeredTypes = getRegisteredConnectorTypes();
  
  logger.info(`Initializing sync scheduler with ${registeredTypes.length} connector types`);
  logger.info(`Registered types: ${registeredTypes.join(", ")}`);
  logger.info(`Schedule: ${SCHEDULER_CRON} (every minute)`);

  cron.schedule(SCHEDULER_CRON, schedulerTick);

  logger.info("Sync scheduler initialized successfully");
}

/**
 * Get sync status for monitoring.
 */
export function getSyncStatus(): {
  registeredTypes: string[];
  lastSyncTimes: Record<string, string>;
} {
  const times: Record<string, string> = {};
  for (const [id, date] of lastSyncTimes) {
    times[id] = date.toISOString();
  }

  return {
    registeredTypes: getRegisteredConnectorTypes(),
    lastSyncTimes: times,
  };
}
