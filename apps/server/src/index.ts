import app from "./app";
import { initializeRssCronJobs } from "./modules/rss/rss.cron";
import { createLogger } from "./utils/logger";

const logger = createLogger("Server");

// Initialize cron jobs
initializeRssCronJobs();

app.listen(3000, () => {
  logger.info("Server is running on http://localhost:3000");
});

export default app;