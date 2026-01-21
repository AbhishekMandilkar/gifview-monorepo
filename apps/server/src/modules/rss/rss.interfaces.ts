export interface IRSSPost {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  language?: string;
}

export interface IRSSFeed {
  rss: {
    channel: {
      title?: string;
      description?: string;
      item: IRSSPost[] | IRSSPost;
    };
  };
}

export interface RSSPostToProcess {
  post: IRSSPost;
  connectorSelector: string;
  connectorId: string;
}

export interface SyncResult {
  totalItems: number;
  queued: number;
  queueSize: number;
  processed: number;
  message: string;
}

export interface QueueStatus {
  size: number;
  isRunning: boolean;
  executionCount: number;
  rejectionCount: number;
  isEmpty: boolean;
  isFull: boolean;
}

export interface ConnectorConfig {
  RssJsonLd?: {
    url: string;
    text_css_selector?: string;
  };
}

export interface ActiveSyncJob {
  queuedCount: number;
  totalItems: number;
  startExecutionCount: number;
  onComplete: (queued: number, processed: number, totalItems: number) => Promise<void>;
}
