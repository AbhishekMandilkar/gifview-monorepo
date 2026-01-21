import type { Connector } from "@gifview-monorepo/db";

/**
 * Result returned by all connector sync operations.
 * This is the standardized output that all connectors must return.
 */
export interface SyncResult {
  /** Total items found in the source (e.g., RSS feed, API response) */
  totalItems: number;
  /** Number of items queued for processing */
  queued: number;
  /** Current queue size after adding items */
  queueSize: number;
  /** Number of items already processed */
  processed: number;
  /** Human-readable status message */
  message: string;
}

/**
 * Queue status information for monitoring.
 */
export interface QueueStatus {
  /** Current number of items in queue */
  size: number;
  /** Whether the queue is actively processing */
  isRunning: boolean;
  /** Total items processed since queue creation */
  executionCount: number;
  /** Total items rejected (queue full) */
  rejectionCount: number;
  /** Whether queue is empty */
  isEmpty: boolean;
  /** Whether queue is at max capacity */
  isFull: boolean;
}

/**
 * Callback function called when sync operation completes.
 */
export type OnSyncComplete = (
  queued: number,
  processed: number,
  totalItems: number
) => Promise<void>;

/**
 * Main interface that all connectors must implement.
 * This is the contract between the sync scheduler and individual connectors.
 */
export interface ConnectorHandler {
  /**
   * Unique identifier for this connector type.
   * This should match the key in the connector_type JSON field.
   * Examples: "RssJsonLd", "spotify", "reddit", "apple_music"
   */
  type: string;

  /**
   * Human-readable name for logging and UI.
   */
  name: string;

  /**
   * Main sync function that fetches and processes data from the source.
   * 
   * @param connector - The connector record from the database
   * @param onComplete - Optional callback when processing completes
   * @returns SyncResult with operation statistics
   */
  sync: (connector: Connector, onComplete?: OnSyncComplete) => Promise<SyncResult>;

  /**
   * Get the current queue status for this connector.
   * Used for monitoring and API endpoints.
   */
  getQueueStatus: () => QueueStatus;

  /**
   * Optional: Validate the connector configuration before syncing.
   * Return true if config is valid, false otherwise.
   */
  validateConfig?: (config: string) => boolean;

  /**
   * Optional: Perform any authentication needed before syncing.
   * For OAuth-based connectors like Spotify.
   */
  authenticate?: (connector: Connector) => Promise<void>;
}

/**
 * Configuration stored in connector_type JSON field.
 * Each connector type has its own config structure.
 */
export interface BaseConnectorConfig {
  [key: string]: unknown;
}

/**
 * Extended connector type with parsed config for type safety.
 */
export interface ConnectorWithConfig<T extends BaseConnectorConfig = BaseConnectorConfig> extends Connector {
  parsedConfig: T;
}
