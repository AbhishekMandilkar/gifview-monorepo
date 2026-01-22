# Post Enrichment Module

This document describes the Post Enrichment module implementation in the Gifview monorepo backend. The module uses AI to automatically categorize posts with interests and assign relevant GIFs.

---

## Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Business Logic Flow](#business-logic-flow)
4. [Core Implementation](#core-implementation)
5. [API Endpoints](#api-endpoints)
6. [Cron Scheduling](#cron-scheduling)
7. [Queue System](#queue-system)
8. [AI Prompts](#ai-prompts)
9. [Usage Examples](#usage-examples)

---

## Overview

The Post Enrichment Module automatically enhances posts with:

1. **Interest Categorization** - AI-powered tagging using a hierarchical interest taxonomy (Main → Sub → SubSub)
2. **Topic Extraction** - Identifies brands, products, emotions, celebrities, etc. from post content
3. **GIF Assignment** - Automatically selects a relevant GIF based on extracted topics
4. **Batch Processing** - Queue-based processing to handle multiple posts without overloading the server

### Key Features

- **Three-level interest hierarchy** - Main interests, sub-interests, and sub-sub-interests
- **Smart topic extraction** - Identifies 9 content categories (Brand, Product, Event, Action, Sports, Celebrity, Location, Emotion, Weather)
- **AI-powered analysis** - Uses OpenAI GPT models for content understanding
- **Queue-based processing** - Uses @tanstack/pacer for controlled processing with delays
- **Cron scheduling** - Runs automatically every 2 hours (offset from RSS sync)
- **Deduplication** - Only processes posts not yet enriched (`ai_checked IS NULL`)

---

## Project Structure

```
apps/server/src/
├── index.ts                          # Server entry - initializes scheduler
├── lib/
│   ├── ai/
│   │   ├── ai.service.ts             # OpenAI integration
│   │   └── ai.types.ts               # AI types
│   └── prompts/
│       └── index.ts                  # AI prompt templates
├── modules/
│   └── post-enrichment/
│       ├── index.ts                  # Module exports
│       ├── post-enrichment.interfaces.ts
│       ├── post-enrichment.service.ts  # Main enrichment logic + queue
│       ├── post-enrichment.scheduler.ts # Cron scheduler
│       ├── post-enrichment.controller.ts # API routes
│       ├── interest.service.ts       # Hierarchical interest suggestion
│       └── topic.service.ts          # Topic extraction for GIF
├── routes/
│   └── index.ts                      # Route registration
└── services/
    ├── postService.ts                # Post DB operations
    ├── interestService.ts            # Interest DB operations
    ├── post2InterestService.ts       # Post-Interest linking
    └── gifService.ts                 # GIF DB operations
```

---

## Business Logic Flow

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     POST ENRICHMENT FLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. FETCH UNENRICHED POSTS                                          │
│     └─> Query: WHERE ai_checked IS NULL AND is_deleted = FALSE      │
│     └─> Limit: 5 posts per run (configurable)                       │
│     └─> Order: Most recent first                                    │
│                                                                     │
│  2. QUEUE POSTS FOR PROCESSING                                      │
│     └─> Add to @tanstack/pacer queue with 15s delay between items   │
│     └─> Return immediately (non-blocking)                           │
│                                                                     │
│  3. FOR EACH POST (parallel within single post):                    │
│     ┌─────────────────────────────────────────────────────────────┐ │
│     │  SUGGEST INTERESTS          │  EXTRACT TOPIC & GET GIF      │ │
│     │  (AI Call #1-3)             │  (AI Call #4 + GIF API)       │ │
│     │                             │                               │ │
│     │  Main → Sub → SubSub        │  Topic → GIF Search           │ │
│     └─────────────────────────────┴───────────────────────────────┘ │
│                                                                     │
│  4. SAVE RESULTS:                                                   │
│     └─> Create GIF record via gifService                            │
│     └─> Create post2interest records via post2InterestService       │
│     └─> Update post.ai_checked via postService                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Interest Suggestion Flow (Hierarchical)

```
┌────────────────────────────────────────────────────────────────────┐
│                  INTEREST CATEGORIZATION FLOW                       │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  INPUT: Post Title + Description + Content                         │
│                                                                    │
│  STEP 1: Get Main Interests (depth='1')                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ DB Query via interestService.getActiveInterestsByDepth('1') │   │
│  │ AI Prompt: "Given these interests, select matches"          │   │
│  │ Output: ["tech-uuid", "sports-uuid"]                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                               │                                    │
│                               ▼                                    │
│  STEP 2: Get Sub Interests (depth='2', filtered by main IDs)      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ DB Query with parent_id IN [main_ids]                       │   │
│  │ AI Prompt: "Given these sub-interests, select..."           │   │
│  │ Output: ["mobile-uuid", "gaming-uuid"]                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                               │                                    │
│                               ▼                                    │
│  STEP 3: Get SubSub Interests (depth='3', filtered by sub IDs)    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ DB Query with parent_id IN [sub_ids]                        │   │
│  │ AI Prompt: "Given these specific interests, ..."            │   │
│  │ Output: ["iphone-uuid", "android-uuid"]                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                               │                                    │
│                               ▼                                    │
│  FINAL OUTPUT: Combined interest IDs from all levels               │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Core Implementation

### 1. Interfaces (`post-enrichment.interfaces.ts`)

```typescript
export enum InterestsDepth {
  Main = "1",
  Sub = "2",
  SubSub = "3",
}

export interface PostToEnrich {
  id: string;
  title: string | null;
  description: string | null;
  content: string | null;
}

export interface EnrichmentResult {
  postId: string;
  interests: { interestId: string }[];
  gif: {
    url: string;
    provider: string;
  };
}

export interface EnrichPostsResult {
  message: string;
  queued: number;
  queueSize?: number;
  processed?: number;
}
```

### 2. Post Enrichment Service (`post-enrichment.service.ts`)

Main orchestration service with queue:

```typescript
import { Queuer } from "@tanstack/pacer";
import * as postService from "../../services/postService";
import * as gifDbService from "../../services/gifService";
import * as post2InterestService from "../../services/post2InterestService";

const QUEUE_CONFIG = {
  WAIT_MS: 15000,        // 15 seconds between posts
  MAX_SIZE: 50,          // Maximum queue size
  MAX_POSTS_PER_RUN: 5,  // Posts per enrichment run
};

// Main function - queues posts for background processing
export async function enrichPostsList(
  onQueueComplete?: (queued: number, processed: number) => Promise<void>
): Promise<EnrichPostsResult>;

// Queue status for monitoring
export function getEnrichmentQueueStatus(): EnrichmentQueueStatus;
```

### 3. Interest Service (`interest.service.ts`)

Hierarchical interest suggestion:

```typescript
// Suggest interests across all three depth levels
export async function suggestInterests(params: SuggestInterestsParams): Promise<string[]>;
```

### 4. Topic Service (`topic.service.ts`)

Topic extraction for GIF search:

```typescript
// Extract topic categories for GIF matching
export async function suggestTopic(
  title: string,
  description: string,
  content?: string | null
): Promise<string>;
```

### 5. Database Services

All database operations go through services in `services/`:

- `postService.getUnenrichedPosts()` - Fetch posts needing enrichment
- `postService.markPostsAsEnriched()` - Update ai_checked timestamp
- `interestService.getActiveInterestsByDepth()` - Get interests by depth level
- `post2InterestService.linkPostToInterests()` - Create post-interest links
- `gifService.createGif()` - Save GIF record

---

## API Endpoints

All routes are prefixed with `/api/v1/post-enrichment`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/enrich` | Manually trigger enrichment |
| `GET` | `/status` | Get queue and scheduler status |

### Request/Response Examples

**POST /api/v1/post-enrichment/enrich**

Response (queued):
```json
{
  "success": true,
  "message": "Posts queued for enrichment. Processing happens in background.",
  "queued": 5,
  "queueSize": 5,
  "processed": 0
}
```

Response (nothing to enrich):
```json
{
  "success": true,
  "message": "No posts to enrich",
  "queued": 0
}
```

**GET /api/v1/post-enrichment/status**

```json
{
  "success": true,
  "data": {
    "scheduler": {
      "isInitialized": true,
      "schedule": "30 */2 * * *"
    },
    "queue": {
      "size": 2,
      "isRunning": true,
      "executionCount": 10,
      "rejectionCount": 0,
      "isEmpty": false,
      "isFull": false
    }
  }
}
```

---

## Cron Scheduling

The enrichment scheduler is initialized in `apps/server/src/index.ts`:

```typescript
import { initializeEnrichmentScheduler } from "./modules/post-enrichment";

// Runs at minute 30 of every 2 hours
initializeEnrichmentScheduler();
```

### Schedule Configuration

| Scheduler | Cron Expression | Description |
|-----------|-----------------|-------------|
| RSS Sync | `* * * * *` | Every minute (checks fetch_period) |
| Post Enrichment | `30 */2 * * *` | At :30 of every 2nd hour |

The 30-minute offset prevents overlap between RSS sync and enrichment.

### Environment Behavior

- **Production**: Cron runs automatically
- **Development/Local**: Cron is skipped (use manual trigger)

---

## Queue System

Uses `@tanstack/pacer` Queuer for controlled processing:

```typescript
const enrichmentQueue = new Queuer<PostToEnrich>(
  async (post) => {
    // Process single post
    const result = await enrichSinglePost(post);
    await saveEnrichmentResult(result);
  },
  {
    wait: 15000,      // 15s delay between items
    maxSize: 50,      // Max queue capacity
    started: true,    // Auto-start processing
    onItemsChange: (queuer) => { /* Track progress */ },
    onReject: (item) => { /* Handle queue full */ },
  }
);
```

### Queue Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| `WAIT_MS` | 15000 | Delay between posts (ms) |
| `MAX_SIZE` | 50 | Maximum queue capacity |
| `MAX_POSTS_PER_RUN` | 5 | Posts per enrichment run |

---

## AI Prompts

All prompts are stored in `lib/prompts/index.ts`:

### Interest Suggestion Prompt

```typescript
export const POST_TO_INTEREST_PROMPT = `
You are an AI assistant specializing in content analysis...
Select relevant interests from the provided list.
Return only the IDs, one per line.

Interests: @@{INTERESTS_LIST}@@
Text: @@{USER_INPUT}@@
`;
```

### Topic Extraction Prompt

```typescript
export const TOPIC_EXTRACTION_PROMPT = `
Analyze the text and extract:
- Brand: [brand name]
- Product: [product name]
- Event: [event name]
- Action: [action]
- Sports team: [team]
- Celebrity: [name]
- Location: [place]
- Emotion: [emotion]
- Weather: [condition]

Content: @@{USER_INPUT}@@
`;
```

---

## Usage Examples

### Manual Triggering via cURL

```bash
# Trigger manual enrichment
curl -X POST http://localhost:3000/api/v1/post-enrichment/enrich

# Check status
curl http://localhost:3000/api/v1/post-enrichment/status
```

### Programmatic Usage

```typescript
import { enrichPostsList, getEnrichmentQueueStatus } from "./modules/post-enrichment";

// Trigger enrichment with completion callback
const result = await enrichPostsList(async (queued, processed) => {
  console.log(`Enrichment complete: ${processed} posts processed`);
});

// Check queue status
const status = getEnrichmentQueueStatus();
console.log(`Queue size: ${status.size}, Running: ${status.isRunning}`);
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No posts being enriched | Check `ai_checked IS NULL` and `is_deleted = false` |
| AI calls failing | Verify `OPENAI_API_KEY` is valid |
| GIF not assigned | Check Giphy/Tenor API keys |
| Interests not assigned | Ensure interests table is populated with `active = true` |
| Queue not processing | Check queue status endpoint |
| Cron not running | Verify `NODE_ENV` is not 'local' or 'development' |

---

## Dependencies

The module uses:

- `@tanstack/pacer` - Queue management
- `@ai-sdk/openai` + `ai` - OpenAI integration
- `node-cron` - Cron scheduling
- `drizzle-orm` - Database operations

All dependencies are already installed in the monorepo.
