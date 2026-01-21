import app from "./app";
import {registerRssConnector} from "./modules/rss";
import {initializeSyncScheduler} from "./modules/sync";
import { createLogger } from "./utils/logger";



const logger = createLogger("Server");

// ============================================
// REGISTER CONNECTORS
// ============================================
// Add new connector registrations here
registerRssConnector();
// registerSpotifyConnector();
// registerRedditConnector();
// registerAppleMusicConnector();

// ============================================
// INITIALIZE SCHEDULER
// ============================================
// Must be called AFTER all connectors are registered
initializeSyncScheduler();

app.listen(3000, () => {
  logger.info("Server is running on http://localhost:3000");
});

export default app;