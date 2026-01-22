# RSS Sync Cron Job Implementation Guide

This document provides a comprehensive guide for implementing an RSS feed synchronization cron job in a Node.js/TypeScript backend using **Drizzle ORM**.

---

## Table of Contents

1. [Overview](#overview)
2. [Database Schema (Drizzle)](#database-schema-drizzle)
3. [Project Structure](#project-structure)
4. [Core Implementation](#core-implementation)
5. [Queue System](#queue-system)
6. [Cron Job Setup](#cron-job-setup)
7. [API Endpoints](#api-endpoints)
8. [Notifications (Optional)](#notifications-optional)
9. [Environment Variables](#environment-variables)
10. [Error Handling & Logging](#error-handling--logging)
11. [Performance Considerations](#performance-considerations)

---

## Overview

The RSS Sync Cron Job is responsible for:

1. **Fetching RSS feeds** from configured connector URLs
2. **Parsing XML** to extract post items
3. **Deduplicating** posts (skip already-processed items)
4. **Extracting content** from each post's source URL
5. **Saving new posts** to the database
6. **Running on a schedule** (e.g., every 2 hours)
7. **Supporting manual triggers** via API endpoints

### Key Features

- **Queue-based processing** to prevent CPU/memory overload
- **Configurable delays** between processing items
- **Slack/webhook notifications** for monitoring
- **Graceful error handling** (one failed post doesn't stop the entire sync)
- **Skip duplicates** based on `source_link`

---

## Database Schema (Drizzle)

### Required Tables

Create these tables using Drizzle ORM schema definitions:

```typescript
// src/db/schema/connectors.ts
import { pgTable, uuid, text, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';

export const languageEnum = pgEnum('language', ['en', 'es', 'fr', 'ukr']);

export const connectors = pgTable('connectors', {
  id: uuid('id').defaultRandom().primaryKey(),
  connectorType: text('connector_type'), // JSON string containing RSS config
  tempoSecs: integer('tempo_secs'),
  fetchPeriodMinutes: integer('fetch_period_minutes'),
  language: languageEnum('language'),
  active: boolean('active').default(false),
});

export type Connector = typeof connectors.$inferSelect;
export type NewConnector = typeof connectors.$inferInsert;
```

```typescript
// src/db/schema/posts.ts
import { pgTable, uuid, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { connectors, languageEnum } from './connectors';

export const posts = pgTable('posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title'),
  description: text('description'),
  topic: text('topic'),
  tags: text('tags').array(),
  connectorId: uuid('connector_id').notNull().references(() => connectors.id),
  sourceKey: text('source_key'),
  sourceLink: text('source_link'),
  language: languageEnum('language'),
  publishingDate: timestamp('publishing_date'),
  aiChecked: timestamp('ai_checked'),
  content: text('content'),
  isDeleted: boolean('is_deleted').default(false),
  createdDate: timestamp('created_date').defaultNow(),
}, (table) => ({
  sourceKeyIdx: index('idx_posts_source_key').on(table.sourceKey),
  sourceLinkIdx: index('idx_posts_source_link').on(table.sourceLink),
  titleIdx: index('idx_posts_title').on(table.title),
}));

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
```

```typescript
// src/db/schema/index.ts
export * from './connectors';
export * from './posts';
```

### Connector Type JSON Structure

The `connector_type` field stores RSS configuration as JSON:

```json
{
  "RssJsonLd": {
    "url": "https://example.com/rss.xml",
    "text_css_selector": "article p, article .content"
  }
}
```

---

## Project Structure

```
src/
├── db/
│   ├── index.ts              # Drizzle client initialization
│   └── schema/
│       ├── index.ts          # Schema exports
│       ├── connectors.ts     # Connectors table
│       └── posts.ts          # Posts table
├── lib/
│   ├── notifications.ts      # Slack/webhook notifications
│   └── queue.ts              # Queue utility (optional)
├── modules/
│   └── rss/
│       ├── rss.controller.ts # API routes + cron setup
│       ├── rss.service.ts    # Core sync logic
│       ├── rss.interfaces.ts # TypeScript interfaces
│       └── rss.utils.ts      # HTML extraction utilities
├── utils/
│   └── html-utils.ts         # HTML content extraction
└── server.ts                 # Express server entry
```

---

## Core Implementation

### 1. RSS Interfaces

```typescript
// src/modules/rss/rss.interfaces.ts

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
      item: IRSSPost[];
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
```

### 2. HTML Content Extraction Utility

```typescript
// src/utils/html-utils.ts
import axios from 'axios';
import { JSDOM } from 'jsdom';

export async function extractContentFromHTML(
  url: string,
  selector?: string
): Promise<string | null> {
  try {
    const response = await axios.get(url, {
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSSBot/1.0)',
      },
    });

    if (response.status !== 200) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    const dom = new JSDOM(response.data);
    const document = dom.window.document;

    if (!selector) {
      // Fallback: try common content selectors
      const fallbackSelectors = [
        'article',
        '.post-content',
        '.entry-content',
        '.content',
        'main',
      ];
      
      for (const fallback of fallbackSelectors) {
        const element = document.querySelector(fallback);
        if (element?.textContent?.trim()) {
          return element.textContent.trim();
        }
      }
      return null;
    }

    const elements = document.querySelectorAll(selector);
    let content = '';

    elements.forEach((element) => {
      const text = element.textContent?.trim();
      if (text) {
        content += text + '\n';
      }
    });

    return content.trim() || null;
  } catch (error) {
    console.error(`[HTML Utils] Error extracting content from ${url}:`, error);
    return null;
  }
}
```

### 3. RSS Service (Core Logic)

```typescript
// src/modules/rss/rss.service.ts
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { connectors, posts, NewPost } from '../../db/schema';
import { IRSSPost, RSSPostToProcess, SyncResult, QueueStatus } from './rss.interfaces';
import { extractContentFromHTML } from '../../utils/html-utils';
import { Queuer } from '@tanstack/pacer'; // or implement your own queue
import { toJson } from 'xml2json';

// ============================================
// QUEUE CONFIGURATION
// ============================================

const QUEUE_CONFIG = {
  WAIT_MS: 10000,        // 10 seconds between items (adjust based on server capacity)
  MAX_SIZE: 50,          // Maximum queue size
  MAX_RSS_ITEMS: 5,      // Max items to process per sync (prevents overload)
};

// ============================================
// QUEUE INSTANCE
// ============================================

let rssPostQueue: Queuer<RSSPostToProcess> | null = null;

interface ActiveSyncJob {
  queuedCount: number;
  totalItems: number;
  startExecutionCount: number;
  onComplete: (queued: number, processed: number, totalItems: number) => Promise<void>;
}

let activeSyncJob: ActiveSyncJob | null = null;

function getRssPostQueue(): Queuer<RSSPostToProcess> {
  if (!rssPostQueue) {
    rssPostQueue = new Queuer<RSSPostToProcess>(
      async (rssPostData) => {
        try {
          const { post, connectorSelector, connectorId } = rssPostData;
          console.log(`[RSS Queue] Processing: ${post.link}`);

          const processedPost = await processSingleRssPost({
            post,
            connectorSelector,
            connectorId,
          });

          if (processedPost) {
            await db.insert(posts).values(processedPost).onConflictDoNothing();
            console.log(`[RSS Queue] Saved: ${post.link}`);
          } else {
            console.log(`[RSS Queue] Skipped (exists/no content): ${post.link}`);
          }
        } catch (error) {
          console.error(`[RSS Queue] Error processing ${rssPostData.post.link}:`, error);
          // Don't throw - let queue continue
        }
      },
      {
        wait: QUEUE_CONFIG.WAIT_MS,
        maxSize: QUEUE_CONFIG.MAX_SIZE,
        started: true,
        onItemsChange: (queuer) => {
          console.log(`[RSS Queue] Size: ${queuer.store.state.size}, Processed: ${queuer.store.state.executionCount}`);

          // Check if queue finished processing
          if (activeSyncJob && queuer.store.state.size === 0) {
            const processedForThisJob = queuer.store.state.executionCount - activeSyncJob.startExecutionCount;

            if (processedForThisJob > 0) {
              const job = activeSyncJob;
              activeSyncJob = null;

              job.onComplete(job.queuedCount, processedForThisJob, job.totalItems).catch((error) => {
                console.error(`[RSS Queue] Completion callback error:`, error);
              });
            }
          }
        },
        onReject: (item, queuer) => {
          console.warn(`[RSS Queue] Queue full! Rejected: ${item.post.link}`);
        },
      }
    );
  }
  return rssPostQueue;
}

// ============================================
// MAIN SYNC FUNCTION
// ============================================

export async function syncRssMainFunc(
  onQueueComplete?: (queued: number, processed: number, totalItems: number) => Promise<void>
): Promise<SyncResult> {
  const startTime = Date.now();
  console.log(`[RSS Sync] Starting at ${new Date().toISOString()}`);

  try {
    // 1. Get active connector
    console.log('[RSS Sync] Fetching active connector...');
    const connector = await db.query.connectors.findFirst({
      where: eq(connectors.active, true),
    });

    if (!connector) {
      throw new Error('No active RSS connector found');
    }

    console.log(`[RSS Sync] Found connector: ${connector.id}`);

    // 2. Parse connector config
    const connectorType = JSON.parse(connector.connectorType || '{}');
    const rssUrl = connectorType?.RssJsonLd?.url;
    const connectorSelector = connectorType?.RssJsonLd?.text_css_selector;

    if (!rssUrl) {
      throw new Error('No RSS URL found in connector');
    }

    // 3. Fetch RSS feed
    console.log(`[RSS Sync] Fetching RSS feed from: ${rssUrl}`);
    const rssResponse = await fetch(rssUrl);
    const rssText = await rssResponse.text();
    console.log(`[RSS Sync] RSS feed fetched in ${Date.now() - startTime}ms`);

    // 4. Parse XML to JSON
    console.log('[RSS Sync] Parsing RSS XML...');
    const rssJson = toJson(rssText, { object: true }) as {
      rss: {
        channel: {
          item: IRSSPost[];
        };
      };
    };

    const rssList = rssJson?.rss?.channel?.item || [];
    const totalItems = rssList.length;
    console.log(`[RSS Sync] Found ${totalItems} items in RSS feed`);

    // 5. Limit items to prevent overload
    const limitedRssList = rssList.slice(0, QUEUE_CONFIG.MAX_RSS_ITEMS);

    if (totalItems > QUEUE_CONFIG.MAX_RSS_ITEMS) {
      console.log(`[RSS Sync] Limiting to ${QUEUE_CONFIG.MAX_RSS_ITEMS} items (from ${totalItems} total)`);
    }

    if (!limitedRssList.length) {
      console.log('[RSS Sync] No RSS items to process');
      return {
        totalItems,
        queued: 0,
        queueSize: 0,
        processed: 0,
        message: 'No RSS items to process',
      };
    }

    // 6. Add items to queue
    const queue = getRssPostQueue();

    if (onQueueComplete) {
      activeSyncJob = {
        queuedCount: limitedRssList.length,
        totalItems,
        startExecutionCount: queue.store.state.executionCount,
        onComplete: onQueueComplete,
      };
    }

    let queuedCount = 0;
    for (const post of limitedRssList) {
      queue.addItem({
        post,
        connectorSelector,
        connectorId: connector.id,
      });
      queuedCount++;
    }

    console.log(`[RSS Sync] Queued ${queuedCount} posts. Queue size: ${queue.store.state.size}`);

    return {
      totalItems,
      queued: queuedCount,
      queueSize: queue.store.state.size,
      processed: queue.store.state.executionCount,
      message: `Queued ${queuedCount} RSS posts for processing`,
    };
  } catch (error) {
    console.error(`[RSS Sync] Error after ${Date.now() - startTime}ms:`, error);
    activeSyncJob = null;
    throw error;
  }
}

// ============================================
// PROCESS SINGLE POST
// ============================================

async function processSingleRssPost(params: {
  post: IRSSPost;
  connectorSelector: string;
  connectorId: string;
}): Promise<NewPost | null> {
  const { post, connectorSelector, connectorId } = params;
  const url = post.link;

  try {
    // 1. Check if post already exists (deduplication)
    const existingPost = await db.query.posts.findFirst({
      where: eq(posts.sourceLink, url),
    });

    if (existingPost) {
      console.log(`[RSS Queue] Post already exists: ${url}`);
      return null;
    }

    // 2. Extract content from source URL
    console.log(`[RSS Queue] Extracting content from: ${url}`);
    const content = await extractContentFromHTML(url, connectorSelector);

    if (!content) {
      console.log(`[RSS Queue] No content found for: ${url}`);
      return null;
    }

    // 3. Build post data
    const newPostData: NewPost = {
      content,
      title: post.title,
      description: post.description,
      topic: post.title, // Can be enhanced with AI topic suggestion
      tags: [],
      sourceKey: post.link,
      sourceLink: post.link,
      publishingDate: new Date(post.pubDate),
      language: 'en', // Or parse from post.language
      connectorId,
      isDeleted: false,
      createdDate: new Date(),
    };

    return newPostData;
  } catch (error) {
    console.error(`[RSS Queue] Error processing post ${url}:`, error);
    return null;
  }
}

// ============================================
// QUEUE STATUS
// ============================================

export function getRssQueueStatus(): QueueStatus {
  const queue = getRssPostQueue();
  return {
    size: queue.store.state.size,
    isRunning: queue.store.state.isRunning,
    executionCount: queue.store.state.executionCount,
    rejectionCount: queue.store.state.rejectionCount,
    isEmpty: queue.store.state.isEmpty,
    isFull: queue.store.state.isFull,
  };
}
```

---

## Queue System

### Option A: Using @tanstack/pacer (Recommended)

Install the package:

```bash
npm install @tanstack/pacer
# or
yarn add @tanstack/pacer
```

This provides a robust queue with:
- Configurable delays between items
- Max queue size limits
- Event callbacks for monitoring
- Rejection handling for overflow

### Option B: Simple Custom Queue

If you prefer not to use an external package:

```typescript
// src/lib/queue.ts

type QueueHandler<T> = (item: T) => Promise<void>;

interface QueueOptions {
  waitMs: number;
  maxSize: number;
}

export class SimpleQueue<T> {
  private queue: T[] = [];
  private isProcessing = false;
  private executionCount = 0;
  private handler: QueueHandler<T>;
  private options: QueueOptions;

  constructor(handler: QueueHandler<T>, options: QueueOptions) {
    this.handler = handler;
    this.options = options;
  }

  addItem(item: T): boolean {
    if (this.queue.length >= this.options.maxSize) {
      console.warn('[Queue] Queue full, rejecting item');
      return false;
    }
    this.queue.push(item);
    this.processQueue();
    return true;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      try {
        await this.handler(item);
        this.executionCount++;
      } catch (error) {
        console.error('[Queue] Error processing item:', error);
      }
      // Wait before processing next item
      await new Promise((resolve) => setTimeout(resolve, this.options.waitMs));
    }

    this.isProcessing = false;
  }

  getStatus() {
    return {
      size: this.queue.length,
      isProcessing: this.isProcessing,
      executionCount: this.executionCount,
    };
  }
}
```

---

## Cron Job Setup

### Controller with Cron Schedule

```typescript
// src/modules/rss/rss.controller.ts
import { Router } from 'express';
import cron from 'node-cron';
import { syncRssMainFunc, getRssQueueStatus } from './rss.service';
import { notifySlack } from '../../lib/notifications'; // Optional

const rssController = Router();

// ============================================
// API ENDPOINTS
// ============================================

// Manual trigger endpoint
rssController.post('/sync', async (req, res) => {
  try {
    await notifySlack?.('Manual - RSS Sync', 'start');

    const result = await syncRssMainFunc(async (queued, processed, totalItems) => {
      await notifySlack?.('Manual - RSS Sync', 'success', { processed });
    });

    console.log('[RSS Controller] RSS posts queued via API');

    if (result.queued > 0) {
      await notifySlack?.('Manual - RSS Sync', 'in-progress', { queued: result.queued });
    } else {
      await notifySlack?.('Manual - RSS Sync', 'success', { processed: 0 });
    }

    res.json({
      status: 'queued',
      ...result,
      message: 'RSS posts queued for processing. Processing happens in background.',
    });
  } catch (error) {
    console.error('[RSS Controller] Error queuing RSS posts:', error);
    await notifySlack?.('Manual - RSS Sync', 'failure', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'RSS sync failed' });
  }
});

// Queue status endpoint
rssController.get('/sync/status', async (req, res) => {
  try {
    const status = getRssQueueStatus();
    res.json(status);
  } catch (error) {
    console.error('[RSS Controller] Error getting queue status:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ============================================
// CRON JOB SETUP
// ============================================

// Run RSS sync every 2 hours
// Cron expression: "0 */2 * * *" = At minute 0 of every 2nd hour
const CRON_SCHEDULE = '0 */2 * * *';

cron.schedule(CRON_SCHEDULE, async () => {
  // Skip in local/development environment
  if (process.env.NODE_ENV === 'local' || process.env.NODE_ENV === 'development') {
    console.log(`[RSS Cron] Skipped - running in ${process.env.NODE_ENV} environment`);
    return;
  }

  console.log(`[RSS Cron] [${new Date().toISOString()}] Running RSS sync cron job`);
  await notifySlack?.('Auto - RSS Sync', 'start');

  try {
    const result = await syncRssMainFunc(async (queued, processed, totalItems) => {
      await notifySlack?.('Auto - RSS Sync', 'success', { processed });
    });

    console.log(`[RSS Cron] Queued posts:`, result);

    if (result.queued > 0) {
      await notifySlack?.('Auto - RSS Sync', 'in-progress', { queued: result.queued });
    } else {
      await notifySlack?.('Auto - RSS Sync', 'success', { processed: 0 });
    }
  } catch (error) {
    console.error(`[RSS Cron] Error:`, error);
    await notifySlack?.('Auto - RSS Sync', 'failure', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

console.log(`[RSS Cron] Scheduled to run: ${CRON_SCHEDULE}`);

export default rssController;
```

### Common Cron Schedules

| Schedule | Cron Expression |
|----------|-----------------|
| Every hour | `0 * * * *` |
| Every 2 hours | `0 */2 * * *` |
| Every 6 hours | `0 */6 * * *` |
| Every day at midnight | `0 0 * * *` |
| Every day at 6am | `0 6 * * *` |
| Every Monday at 9am | `0 9 * * 1` |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/rss/sync` | Manually trigger RSS sync |
| `GET` | `/rss/sync/status` | Get current queue status |

### Example Responses

**POST /rss/sync**
```json
{
  "status": "queued",
  "totalItems": 25,
  "queued": 5,
  "queueSize": 5,
  "processed": 0,
  "message": "Queued 5 RSS posts for processing"
}
```

**GET /rss/sync/status**
```json
{
  "size": 3,
  "isRunning": true,
  "executionCount": 2,
  "rejectionCount": 0,
  "isEmpty": false,
  "isFull": false
}
```

---

## Notifications (Optional)

### Slack Notification Service

```typescript
// src/lib/notifications.ts
import axios from 'axios';

export type NotificationStatus = 'start' | 'success' | 'failure' | 'in-progress';

export interface NotificationMetadata {
  [key: string]: any;
}

export async function notifySlack(
  jobName: string,
  status: NotificationStatus,
  metadata?: NotificationMetadata
): Promise<void> {
  // Skip in local environment
  if (process.env.NODE_ENV === 'local' || process.env.NODE_ENV === 'development') {
    return;
  }

  const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
  const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID;

  if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL_ID) {
    console.log(`[Slack] Not configured, skipping notification`);
    return;
  }

  const emoji = {
    start: '🚀',
    success: '✅',
    failure: '❌',
    'in-progress': '🔄',
  }[status];

  const message = buildMessage(jobName, status, emoji, metadata);

  try {
    await axios.post(
      'https://slack.com/api/chat.postMessage',
      {
        channel: SLACK_CHANNEL_ID,
        text: message,
      },
      {
        headers: {
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`[Slack] Notification sent: ${jobName} - ${status}`);
  } catch (error) {
    console.error(`[Slack] Error sending notification:`, error);
  }
}

function buildMessage(
  jobName: string,
  status: NotificationStatus,
  emoji: string,
  metadata?: NotificationMetadata
): string {
  const timestamp = new Date().toISOString();

  switch (status) {
    case 'start':
      return `${emoji} Started ${jobName} at ${timestamp}`;
    case 'success':
      const processed = metadata?.processed ?? 'unknown';
      return `${emoji} Finished ${jobName} - ${processed} items processed`;
    case 'failure':
      return `${emoji} ${jobName} failed - ${metadata?.error || 'Unknown error'}`;
    case 'in-progress':
      return `${emoji} ${jobName} in progress - ${metadata?.queued || 0} items queued`;
    default:
      return `${jobName} - ${status}`;
  }
}
```

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Environment
NODE_ENV=production  # or 'local', 'development'

# Slack Notifications (Optional)
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_CHANNEL_ID=C0123456789

# RSS Sync Configuration (Optional - can be hardcoded)
RSS_SYNC_INTERVAL_MS=10000
RSS_MAX_ITEMS_PER_SYNC=5
RSS_QUEUE_MAX_SIZE=50
```

---

## Error Handling & Logging

### Logging Best Practices

1. **Use prefixes** for easy filtering: `[RSS Sync]`, `[RSS Queue]`, `[RSS Cron]`
2. **Include timestamps** in cron logs
3. **Log performance metrics**: duration, item counts
4. **Don't expose sensitive data** in logs

### Error Handling Strategy

```typescript
// Individual post errors don't stop the queue
try {
  await processPost(post);
} catch (error) {
  console.error(`[RSS Queue] Error processing ${post.link}:`, error);
  // Continue processing other posts
}

// Main function errors are caught and reported
try {
  await syncRssMainFunc();
} catch (error) {
  await notifySlack('RSS Sync', 'failure', { error: error.message });
  // Don't throw in cron - just log
}
```

---

## Performance Considerations

### For Small Servers (T2 Micro, 1GB RAM)

```typescript
const QUEUE_CONFIG = {
  WAIT_MS: 10000,      // 10 seconds between items
  MAX_SIZE: 50,        // Max queue size
  MAX_RSS_ITEMS: 5,    // Process only 5 items per sync
};
```

### For Larger Servers (4GB+ RAM)

```typescript
const QUEUE_CONFIG = {
  WAIT_MS: 2000,       // 2 seconds between items
  MAX_SIZE: 200,       // Larger queue
  MAX_RSS_ITEMS: 25,   // Process more items per sync
};
```

### Memory Management

- **Limit concurrent processing** to prevent memory spikes
- **Process items sequentially** within the queue
- **Set timeouts** on HTTP requests
- **Log memory usage** if experiencing issues

---

## Dependencies

```json
{
  "dependencies": {
    "drizzle-orm": "^0.29.0",
    "postgres": "^3.4.0",
    "@tanstack/pacer": "^0.1.0",
    "xml2json": "^0.12.0",
    "node-cron": "^3.0.3",
    "axios": "^1.6.0",
    "jsdom": "^24.0.0",
    "express": "^4.18.0"
  },
  "devDependencies": {
    "@types/node-cron": "^3.0.11",
    "@types/jsdom": "^21.1.6",
    "drizzle-kit": "^0.20.0"
  }
}
```

---

## Quick Start Checklist

- [ ] Create database schema with Drizzle
- [ ] Run migrations (`npx drizzle-kit push`)
- [ ] Create a connector record with RSS URL config
- [ ] Implement `rss.service.ts` with sync logic
- [ ] Implement `rss.controller.ts` with routes + cron
- [ ] Add routes to Express app
- [ ] Set environment variables
- [ ] Test manual sync endpoint
- [ ] Verify cron runs on schedule
- [ ] (Optional) Configure Slack notifications

---

## Testing

### Manual Testing

```bash
# Trigger manual sync
curl -X POST http://localhost:3000/rss/sync

# Check queue status
curl http://localhost:3000/rss/sync/status
```

### Creating Test Data

```sql
-- Insert a test connector
INSERT INTO connectors (connector_type, active)
VALUES (
  '{"RssJsonLd": {"url": "https://example.com/feed.xml", "text_css_selector": "article p"}}',
  true
);
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No posts being saved | Check if connector is `active: true` |
| Duplicate posts | Verify `source_link` index exists |
| Memory issues | Reduce `MAX_RSS_ITEMS` and increase `WAIT_MS` |
| Content extraction fails | Check CSS selector in connector config |
| Cron not running | Verify `NODE_ENV` is not 'local' |
