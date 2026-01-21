import { registerConnector } from "../sync/connector.registry";
import { rssConnectorHandler } from "./rss.handler";

/**
 * Register the RSS connector handler.
 * Call this during application startup.
 */
export function registerRssConnector(): void {
  registerConnector(rssConnectorHandler);
}

// Re-export for direct access if needed
export { rssConnectorHandler } from "./rss.handler";
