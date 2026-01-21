import type { ConnectorHandler, QueueStatus } from "./sync.interfaces";
import { createLogger } from "../../utils/logger";

const logger = createLogger("Connector Registry");

/**
 * Central registry for all connector handlers.
 * Connectors register themselves here to be discovered by the sync scheduler.
 */
const connectorRegistry = new Map<string, ConnectorHandler>();

/**
 * Register a new connector handler.
 * Call this during application startup for each connector type.
 * 
 * @param handler - The connector handler to register
 * @throws Error if a handler with the same type is already registered
 * 
 * @example
 * ```typescript
 * registerConnector({
 *   type: "RssJsonLd",
 *   name: "RSS Feed",
 *   sync: syncRssConnector,
 *   getQueueStatus: getRssQueueStatus,
 * });
 * ```
 */
export function registerConnector(handler: ConnectorHandler): void {
  if (connectorRegistry.has(handler.type)) {
    logger.warn(`Connector "${handler.type}" is already registered. Overwriting.`);
  }
  
  connectorRegistry.set(handler.type, handler);
  logger.info(`Registered connector: ${handler.name} (${handler.type})`);
}

/**
 * Get a connector handler by type.
 * 
 * @param type - The connector type identifier
 * @returns The handler or undefined if not found
 */
export function getConnectorHandler(type: string): ConnectorHandler | undefined {
  return connectorRegistry.get(type);
}

/**
 * Get all registered connector handlers.
 * 
 * @returns Array of all registered handlers
 */
export function getAllConnectorHandlers(): ConnectorHandler[] {
  return Array.from(connectorRegistry.values());
}

/**
 * Get all registered connector types.
 * 
 * @returns Array of type identifiers
 */
export function getRegisteredConnectorTypes(): string[] {
  return Array.from(connectorRegistry.keys());
}

/**
 * Check if a connector type is registered.
 * 
 * @param type - The connector type to check
 * @returns true if registered
 */
export function isConnectorRegistered(type: string): boolean {
  return connectorRegistry.has(type);
}

/**
 * Get queue status for all registered connectors.
 * Useful for monitoring dashboards.
 * 
 * @returns Map of connector type to queue status
 */
export function getAllQueueStatuses(): Map<string, QueueStatus> {
  const statuses = new Map<string, QueueStatus>();
  
  for (const [type, handler] of connectorRegistry) {
    try {
      statuses.set(type, handler.getQueueStatus());
    } catch (error) {
      logger.error(`Failed to get queue status for ${type}:`, error);
    }
  }
  
  return statuses;
}

/**
 * Parse connector type from the connector_type JSON string.
 * Returns the first key found in the JSON object.
 * 
 * @param connectorTypeJson - The JSON string from connector_type column
 * @returns The connector type or null if invalid
 * 
 * @example
 * ```typescript
 * // Input: '{"RssJsonLd": {"url": "..."}}'
 * // Output: "RssJsonLd"
 * 
 * // Input: 'spotify'
 * // Output: "spotify"
 * ```
 */
export function parseConnectorType(connectorTypeJson: string | null): string | null {
  if (!connectorTypeJson) return null;
  
  // Handle simple string types (e.g., "spotify")
  if (!connectorTypeJson.startsWith("{")) {
    return connectorTypeJson;
  }
  
  try {
    const parsed = JSON.parse(connectorTypeJson);
    const keys = Object.keys(parsed);
    return keys.length > 0 ? keys[0] : null;
  } catch {
    logger.error(`Failed to parse connector type: ${connectorTypeJson}`);
    return null;
  }
}
