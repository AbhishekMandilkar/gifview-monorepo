# Connector Implementation Guide

This guide explains how to add new content connectors (e.g., Spotify, Reddit, Apple Music) to the sync system.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Quick Start](#quick-start)
3. [Step-by-Step Implementation](#step-by-step-implementation)
4. [Connector Handler Interface](#connector-handler-interface)
5. [Database Configuration](#database-configuration)
6. [API Endpoints](#api-endpoints)
7. [Best Practices](#best-practices)
8. [Example: Spotify Connector](#example-spotify-connector)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

The sync system uses a **Registry Pattern** where each connector registers itself with a central scheduler:

```
┌─────────────────────────────────────────────────────────────┐
│                     Sync Scheduler                          │
│         (runs every minute, checks fetch_period)            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Connector Registry                         │
│     ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│     │   RSS    │  │ Spotify  │  │  Reddit  │  ...          │
│     │ Handler  │  │ Handler  │  │ Handler  │               │
│     └──────────┘  └──────────┘  └──────────┘               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Database                                │
│     ┌──────────────┐        ┌──────────────┐               │
│     │  connectors  │───────▶│    posts     │               │
│     └──────────────┘        └──────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

### Key Concepts

- **ConnectorHandler**: Interface that all connectors must implement
- **Connector Registry**: Central map of type → handler
- **Sync Scheduler**: Cron job that orchestrates syncing based on `fetch_period_minutes`
- **Queue**: Each connector manages its own queue for rate limiting

---

## Quick Start

To add a new connector:

1. Create a handler file: `src/modules/{connector-name}/{connector-name}.handler.ts`
2. Create an index file: `src/modules/{connector-name}/index.ts`
3. Register in `src/index.ts`
4. Add connector record to database

---

## Step-by-Step Implementation

### Step 1: Create the Handler File

Create `src/modules/spotify/spotify.handler.ts`:

```typescript
import type { PostInsert, Connector } from "@gifview-monorepo/db";
import { Queuer } from "@tanstack/pacer";
import { createLogger } from "../../utils/logger";
import * as postService from "../../services/postService";  // Use service layer!
import type {
  ConnectorHandler,
  SyncResult,
  QueueStatus,
  OnSyncComplete,
} from "../sync/sync.interfaces";

// ============================================
// TYPES
// ============================================

interface SpotifyConfig {
  spotify: {
    playlist_id?: string;
    artist_id?: string;
    // Add your config fields here
  };
}

interface SpotifyTrack {
  id: string;
  name: string;
  // ... other fields from Spotify API
}

interface TrackToProcess {
  track: SpotifyTrack;
  connectorId: string;
}

// ============================================
// CONFIGURATION
// ============================================

const logger = createLogger("Spotify Connector");
const queueLogger = createLogger("Spotify Queue");

const QUEUE_CONFIG = {
  WAIT_MS: 5000,  // 5 seconds between items (respect rate limits)
  MAX_SIZE: 100,
  DEFAULT_MAX_ITEMS: 20,
};

// ============================================
// QUEUE INSTANCE
// ============================================

let spotifyQueue: Queuer<TrackToProcess> | null = null;

function getQueue(): Queuer<TrackToProcess> {
  if (!spotifyQueue) {
    spotifyQueue = new Queuer<TrackToProcess>(
      async (data) => {
        // Process single item
        try {
          const postData = await buildPostData(data);
          if (postData) {
            // Use service layer - never db directly!
            const created = await postService.createPostIfNotExists(postData);
            if (created) {
              queueLogger.info(`Saved: ${data.track.name}`);
            } else {
              queueLogger.info(`Skipped (duplicate): ${data.track.name}`);
            }
          }
        } catch (error) {
          queueLogger.error(`Error processing ${data.track.name}:`, error);
        }
      },
      {
        wait: QUEUE_CONFIG.WAIT_MS,
        maxSize: QUEUE_CONFIG.MAX_SIZE,
        started: true,
        onItemsChange: (queuer) => {
          queueLogger.info(`Queue size: ${queuer.store.state.size}`);
        },
        onReject: (item) => {
          queueLogger.warn(`Queue full! Rejected: ${item.track.name}`);
        },
      }
    );
  }
  return spotifyQueue;
}

// ============================================
// AUTHENTICATION (if needed)
// ============================================

async function authenticate(connector: Connector): Promise<string> {
  // Implement OAuth flow or use stored credentials
  // Return access token
  logger.info("Authenticating with Spotify...");
  
  // Example: Get token from environment or database
  const token = process.env.SPOTIFY_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Spotify access token not configured");
  }
  
  return token;
}

// ============================================
// SYNC FUNCTION
// ============================================

async function syncSpotify(
  connector: Connector,
  onComplete?: OnSyncComplete
): Promise<SyncResult> {
  const startTime = Date.now();
  logger.info(`Starting Spotify sync for connector: ${connector.id}`);

  try {
    // 1. Parse config
    const config: SpotifyConfig = JSON.parse(connector.connectorType || "{}");
    const playlistId = config?.spotify?.playlist_id;

    if (!playlistId) {
      throw new Error("No playlist_id found in connector config");
    }

    // 2. Authenticate
    const token = await authenticate(connector);

    // 3. Fetch data from API
    logger.info(`Fetching playlist: ${playlistId}`);
    const response = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.statusText}`);
    }

    const data = await response.json();
    const tracks: SpotifyTrack[] = data.items.map((item: any) => item.track);
    const totalItems = tracks.length;

    logger.info(`Found ${totalItems} tracks`);

    // 4. Add to queue
    const queue = getQueue();
    let queuedCount = 0;

    for (const track of tracks.slice(0, QUEUE_CONFIG.DEFAULT_MAX_ITEMS)) {
      queue.addItem({ track, connectorId: connector.id });
      queuedCount++;
    }

    logger.info(`Queued ${queuedCount} tracks`);

    return {
      totalItems,
      queued: queuedCount,
      queueSize: queue.store.state.size,
      processed: queue.store.state.executionCount,
      message: `Queued ${queuedCount} Spotify tracks for processing`,
    };
  } catch (error) {
    logger.error(`Sync failed after ${Date.now() - startTime}ms:`, error);
    throw error;
  }
}

// ============================================
// BUILD POST DATA
// ============================================

async function buildPostData(data: TrackToProcess): Promise<PostInsert | null> {
  const { track, connectorId } = data;
  const sourceKey = track.id;
  const sourceLink = `https://open.spotify.com/track/${track.id}`;

  // Check for duplicates using service layer
  const exists = await postService.checkPostExists(sourceLink, sourceKey);
  if (exists) {
    queueLogger.info(`Track already exists: ${track.name}`);
    return null;
  }

  // Map to post schema
  return {
    title: track.name,
    description: `Track by ${track.name}`, // customize as needed
    content: JSON.stringify(track), // or extract relevant content
    topic: "music",
    tags: ["spotify", "music"],
    sourceKey,
    sourceLink,
    language: "en",
    connectorId,
    isDeleted: false,
    createdDate: new Date().toISOString(),
  };
}

// ============================================
// QUEUE STATUS
// ============================================

function getQueueStatus(): QueueStatus {
  const queue = getQueue();
  return {
    size: queue.store.state.size,
    isRunning: queue.store.state.isRunning,
    executionCount: queue.store.state.executionCount,
    rejectionCount: queue.store.state.rejectionCount,
    isEmpty: queue.store.state.isEmpty,
    isFull: queue.store.state.isFull,
  };
}

// ============================================
// VALIDATE CONFIG
// ============================================

function validateConfig(configJson: string): boolean {
  try {
    const config: SpotifyConfig = JSON.parse(configJson);
    return Boolean(config?.spotify?.playlist_id || config?.spotify?.artist_id);
  } catch {
    return false;
  }
}

// ============================================
// EXPORT HANDLER
// ============================================

export const spotifyConnectorHandler: ConnectorHandler = {
  type: "spotify",
  name: "Spotify",
  sync: syncSpotify,
  getQueueStatus,
  validateConfig,
};
```

### Step 2: Create Index File

Create `src/modules/spotify/index.ts`:

```typescript
import { registerConnector } from "../sync/connector.registry";
import { spotifyConnectorHandler } from "./spotify.handler";

export function registerSpotifyConnector(): void {
  registerConnector(spotifyConnectorHandler);
}

export { spotifyConnectorHandler } from "./spotify.handler";
```

### Step 3: Register in Main Index

Update `src/index.ts`:

```typescript
import { registerRssConnector } from "./modules/rss";
import { registerSpotifyConnector } from "./modules/spotify";
import { initializeSyncScheduler } from "./modules/sync";

// Register all connectors
registerRssConnector();
registerSpotifyConnector();  // Add this line

// Initialize scheduler (must be after registrations)
initializeSyncScheduler();
```

### Step 4: Add Database Record

Insert a connector record:

```sql
INSERT INTO connectors (connector_type, fetch_period_minutes, language, active)
VALUES (
  '{"spotify": {"playlist_id": "37i9dQZF1DXcBWIGoYBM5M"}}',
  60,  -- Sync every 60 minutes
  'en',
  true
);
```

---

## Connector Handler Interface

Every connector must implement the `ConnectorHandler` interface:

```typescript
interface ConnectorHandler {
  /**
   * Unique type identifier (matches key in connector_type JSON)
   */
  type: string;

  /**
   * Human-readable name for logs and UI
   */
  name: string;

  /**
   * Main sync function
   * @param connector - Database record with config
   * @param onComplete - Optional callback when done
   */
  sync: (connector: Connector, onComplete?: OnSyncComplete) => Promise<SyncResult>;

  /**
   * Get current queue status
   */
  getQueueStatus: () => QueueStatus;

  /**
   * Optional: Validate config before syncing
   */
  validateConfig?: (config: string) => boolean;

  /**
   * Optional: Handle authentication (OAuth, etc.)
   */
  authenticate?: (connector: Connector) => Promise<void>;
}
```

---

## Database Configuration

### Connectors Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `connector_type` | TEXT | JSON config string |
| `tempo_secs` | INT | Delay between items (optional) |
| `fetch_period_minutes` | INT | How often to sync |
| `language` | ENUM | Content language |
| `active` | BOOL | Enable/disable syncing |

### Config Format Examples

**RSS:**
```json
{
  "RssJsonLd": {
    "url": "https://feeds.example.com/rss.xml",
    "text_css_selector": "article p",
    "max_size": 10
  }
}
```

**Spotify:**
```json
{
  "spotify": {
    "playlist_id": "37i9dQZF1DXcBWIGoYBM5M",
    "include_podcasts": false
  }
}
```

**Reddit:**
```json
{
  "reddit": {
    "subreddit": "technology",
    "sort": "hot",
    "limit": 25
  }
}
```

---

## API Endpoints

All endpoints are under `/api/v1/sync`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/sync/:connectorId` | Trigger sync for specific connector |
| `POST` | `/sync/type/:connectorType` | Sync all connectors of a type |
| `GET` | `/sync/status` | Get scheduler status |
| `GET` | `/sync/queues` | Get all queue statuses |
| `GET` | `/sync/queues/:type` | Get queue status for a type |
| `GET` | `/sync/types` | List registered connector types |

### Example Requests

```bash
# Trigger sync for a specific connector
curl -X POST http://localhost:3000/api/v1/sync/71c684d5-6fbb-4c76-adbc-49fe3bc6fc34

# Sync all RSS connectors
curl -X POST http://localhost:3000/api/v1/sync/type/RssJsonLd

# Get queue status
curl http://localhost:3000/api/v1/sync/queues/RssJsonLd

# List registered types
curl http://localhost:3000/api/v1/sync/types
```

---

## Best Practices

### 1. Use Services - Never Access DB Directly

**IMPORTANT:** Connector handlers should NEVER import or use `db` directly. Always use the service layer.

```typescript
// BAD - Don't do this
import { db, posts } from "@gifview-monorepo/db";
await db.insert(posts).values(postData);

// GOOD - Use the service layer
import * as postService from "../../services/postService";
await postService.createPostIfNotExists(postData);
```

**Available Post Service Methods:**

| Method | Description |
|--------|-------------|
| `checkPostExists(sourceLink?, sourceKey?)` | Check if post already exists (deduplication) |
| `createPostIfNotExists(data)` | Create post if not duplicate, returns null if exists |
| `createPostsBatch(dataArray)` | Batch insert, skips duplicates |
| `getPostBySourceLink(link)` | Find post by source link |
| `getPostBySourceKey(key)` | Find post by source key |

**Why use services?**
- Centralized business logic
- Easier to test and mock
- Consistent error handling
- Single source of truth for data operations

If a service method doesn't exist for what you need, **create one** in the appropriate service file rather than accessing the database directly.

### 2. Rate Limiting

Always use queues with appropriate delays:

```typescript
const QUEUE_CONFIG = {
  WAIT_MS: 5000,  // Respect API rate limits
  MAX_SIZE: 100,  // Prevent memory issues
};
```

### 3. Error Handling

- Don't throw from queue processor - log and continue
- Always catch errors in sync function
- Return meaningful error messages

```typescript
try {
  await processItem(item);
} catch (error) {
  logger.error(`Failed to process ${item.id}:`, error);
  // Don't throw - let queue continue
}
```

### 4. Deduplication

Always check for existing posts using the service before inserting:

```typescript
// Check if post exists
const exists = await postService.checkPostExists(item.link, item.id);
if (exists) {
  return null;  // Skip duplicate
}

// Or use createPostIfNotExists which handles it automatically
const created = await postService.createPostIfNotExists(postData);
if (!created) {
  logger.info("Post already exists, skipped");
}
```

### 5. Logging

Use structured logging with consistent prefixes:

```typescript
const logger = createLogger("MyConnector Connector");
const queueLogger = createLogger("MyConnector Queue");
```

### 6. Configuration Validation

Always validate config before syncing:

```typescript
function validateConfig(configJson: string): boolean {
  try {
    const config = JSON.parse(configJson);
    return Boolean(config?.myConnector?.requiredField);
  } catch {
    return false;
  }
}
```

---

## Example: Spotify Connector

See the full implementation above in [Step-by-Step Implementation](#step-by-step-implementation).

---

## Testing

### Manual Testing

```bash
# 1. Start the server
bun run dev

# 2. Check registered types
curl http://localhost:3000/api/v1/sync/types

# 3. Trigger a sync
curl -X POST http://localhost:3000/api/v1/sync/{connector-id}

# 4. Check queue status
curl http://localhost:3000/api/v1/sync/queues
```

### Unit Testing

```typescript
import { spotifyConnectorHandler } from "./spotify.handler";

describe("Spotify Connector", () => {
  it("should validate config correctly", () => {
    const validConfig = '{"spotify": {"playlist_id": "123"}}';
    expect(spotifyConnectorHandler.validateConfig!(validConfig)).toBe(true);

    const invalidConfig = '{"spotify": {}}';
    expect(spotifyConnectorHandler.validateConfig!(invalidConfig)).toBe(false);
  });
});
```

---

## Troubleshooting

### Connector Not Syncing

1. Check if registered: `GET /api/v1/sync/types`
2. Check if active in database: `SELECT * FROM connectors WHERE active = true`
3. Check `fetch_period_minutes` - scheduler respects this interval
4. Check logs for errors

### Queue Not Processing

1. Check queue status: `GET /api/v1/sync/queues/{type}`
2. Verify `isRunning` is true
3. Check for rejected items (`rejectionCount`)

### Duplicate Posts

1. Ensure unique `sourceKey` for each item
2. Use `onConflictDoNothing()` on insert

### Rate Limiting Issues

1. Increase `WAIT_MS` in queue config
2. Reduce `MAX_SIZE` and batch sizes
3. Check API documentation for limits

---

## File Structure

```
src/modules/
├── sync/
│   ├── index.ts              # Module exports
│   ├── sync.interfaces.ts    # Shared types
│   ├── connector.registry.ts # Central registry
│   ├── sync.scheduler.ts     # Cron scheduler
│   └── sync.controller.ts    # API routes
├── rss/
│   ├── index.ts              # Registration
│   └── rss.handler.ts        # RSS implementation
├── spotify/
│   ├── index.ts              # Registration
│   └── spotify.handler.ts    # Spotify implementation
└── reddit/
    ├── index.ts              # Registration
    └── reddit.handler.ts     # Reddit implementation
```

---

## Summary

1. **Create handler** implementing `ConnectorHandler` interface
2. **Create index** with registration function
3. **Register** in `src/index.ts` before scheduler init
4. **Add database record** with JSON config
5. **Test** via API endpoints
