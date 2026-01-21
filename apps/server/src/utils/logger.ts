type LogLevel = "info" | "warn" | "error" | "debug";

interface LoggerOptions {
  prefix: string;
}

class Logger {
  private prefix: string;

  constructor(options: LoggerOptions) {
    this.prefix = options.prefix;
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [${this.prefix}] ${message}`;
  }

  info(message: string, meta?: Record<string, unknown>): void {
    const formatted = this.formatMessage("info", message);
    if (meta) {
      console.log(formatted, meta);
    } else {
      console.log(formatted);
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    const formatted = this.formatMessage("warn", message);
    if (meta) {
      console.warn(formatted, meta);
    } else {
      console.warn(formatted);
    }
  }

  error(message: string, error?: unknown): void {
    const formatted = this.formatMessage("error", message);
    if (error) {
      console.error(formatted, error);
    } else {
      console.error(formatted);
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === "development" || process.env.DEBUG === "true") {
      const formatted = this.formatMessage("debug", message);
      if (meta) {
        console.log(formatted, meta);
      } else {
        console.log(formatted);
      }
    }
  }
}

export const createLogger = (prefix: string): Logger => {
  return new Logger({ prefix });
};

// Pre-configured loggers for RSS module
export const rssSyncLogger = createLogger("RSS Sync");
export const rssQueueLogger = createLogger("RSS Queue");
export const rssCronLogger = createLogger("RSS Cron");
