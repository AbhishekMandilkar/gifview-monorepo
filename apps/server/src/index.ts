import app from "./app";
import { registerRssConnector } from "./modules/rss";
import { registerSpotifyConnector } from "./modules/spotify";
import { initializeSyncScheduler } from "./modules/sync";
import { initializeEnrichmentScheduler } from "./modules/post-enrichment";
import { createLogger } from "./utils/logger";

const logger = createLogger("Server");

// ============================================
// REGISTER CONNECTORS
// ============================================
// Add new connector registrations here
registerRssConnector();
registerSpotifyConnector();
// registerRedditConnector();
// registerAppleMusicConnector();

// ============================================
// INITIALIZE SCHEDULERS
// ============================================
// Sync scheduler - runs every minute to check for due connectors
initializeSyncScheduler();

// Enrichment scheduler - runs at minute 30 of every 2 hours
initializeEnrichmentScheduler();

app.listen(3000, () => {
  logger.info("Server is running on http://localhost:3000");
});

export default app;