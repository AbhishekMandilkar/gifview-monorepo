# GIF Module Implementation

This document describes the GIF search and selection module implementation in the Gifview monorepo backend. The module supports multiple GIF providers (Giphy, Tenor) with intelligent provider selection based on content categories.

---

## Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Database Schema](#database-schema)
4. [Core Implementation](#core-implementation)
5. [API Endpoints](#api-endpoints)
6. [Smart GIF Selection Algorithm](#smart-gif-selection-algorithm)
7. [Environment Variables](#environment-variables)
8. [Usage Examples](#usage-examples)

---

## Overview

The GIF Module provides:

1. **Multi-provider support** - Search GIFs from Giphy and Tenor
2. **Smart provider selection** - Automatically choose the best provider based on content category (e.g., use Tenor for brands, Giphy for emotions)
3. **Deduplication** - Avoid selecting GIFs already used in the database
4. **Pagination support** - For building GIF picker UIs
5. **Trending GIFs** - Fetch popular/viral GIFs
6. **Database CRUD** - Store and manage GIFs linked to posts

### Key Features

- **Category-aware routing** - Routes searches to optimal providers based on content type
- **Fallback handling** - If one provider fails, results can fall back to another
- **Database deduplication** - Ensures unique GIFs across posts
- **Flexible API** - Single GIF for post enrichment, multiple GIFs for UI grids

---

## Project Structure

```
apps/server/src/
├── controllers/
│   └── gifController.ts      # API request handlers
├── modules/
│   └── gif/
│       ├── index.ts          # Module exports
│       ├── gif.constants.ts  # Types, enums, provider mappings
│       ├── gif.interfaces.ts # TypeScript interfaces
│       └── gif.service.ts    # Provider search logic
├── routes/
│   └── gifRoutes.ts          # API route definitions
└── services/
    └── gifService.ts         # Database operations

packages/
├── db/src/schema/
│   └── schema.ts             # Drizzle schema (gifs table)
└── env/src/
    └── server.ts             # Environment variables
```

---

## Database Schema

The `gifs` table is defined in `packages/db/src/schema/schema.ts`:

```typescript
export const gifs = pgTable("gifs", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  postId: uuid("post_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  url: text().notNull(),
  provider: text().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.postId],
    foreignColumns: [posts.id],
    name: "gifs_post_id_fkey"
  }).onUpdate("restrict").onDelete("set null"),
  unique("gifs_post_id_key").on(table.postId),
  unique("gifs_url_key").on(table.url),
]);
```

### Type Exports

```typescript
// packages/db/src/schema/index.ts
export type Gif = typeof gifs.$inferSelect;
export type GifInsert = typeof gifs.$inferInsert;
```

---

## Core Implementation

### 1. Constants & Types (`modules/gif/gif.constants.ts`)

```typescript
// Providers enum
export enum GifSearchProviders {
  Tenor = "Tenor",
  Giphy = "Giphy",
}

// Content area categories
export type Area =
  | "Brand"
  | "Product"
  | "Event"
  | "Action"
  | "Sports team"
  | "Celebrity"
  | "Location"
  | "Emotion"
  | "Weather"
  | "Other";

// Smart provider mapping - routes categories to optimal providers
export const SEARCH_MAPPINGS: SearchMapping = {
  Brand: { priority: 1, provider: GifSearchProviders.Tenor },
  Product: { priority: 2, provider: GifSearchProviders.Tenor },
  Event: { priority: 3, provider: GifSearchProviders.Giphy },
  Action: { priority: 4, provider: GifSearchProviders.Giphy },
  "Sports team": { priority: 5, provider: GifSearchProviders.Giphy },
  Celebrity: { priority: 6, provider: GifSearchProviders.Tenor },
  Location: { priority: 7, provider: GifSearchProviders.Tenor },
  Emotion: { priority: 8, provider: GifSearchProviders.Giphy },
  Weather: { priority: 9, provider: GifSearchProviders.Giphy },
  Other: { priority: 10, provider: GifSearchProviders.Tenor },
} as const;
```

### 2. Interfaces (`modules/gif/gif.interfaces.ts`)

```typescript
export interface GifResult {
  url: string;
  provider: GifSearchProviders;
}

export interface GifWithMetadata {
  id: string;
  url: string;
  title: string;
  provider: GifSearchProviders;
  thumbnail?: string;
}

export interface GifsSearchResult {
  gifs: GifWithMetadata[];
  totalCount: number;
  hasMore: boolean;
  nextOffset?: number;
}

export interface GifSearchOptions {
  limit?: number;
  offset?: number;
  provider?: GifSearchProviders;
}
```

### 3. Database Service (`services/gifService.ts`)

Handles all database operations:

```typescript
import { db, gifs, type Gif, type GifInsert } from "@gifview-monorepo/db";
import { eq, count, inArray } from "drizzle-orm";

// Get all GIFs with pagination
export const getAllGifs = async (limit = 50, offset = 0): Promise<{ data: Gif[]; total: number }>;

// Get GIF by ID
export const getGifById = async (id: string): Promise<Gif | undefined>;

// Get GIF by post ID
export const getGifByPostId = async (postId: string): Promise<Gif | undefined>;

// Check for existing GIF URLs (for deduplication)
export const getExistingGifUrls = async (urls: string[]): Promise<Set<string>>;

// Create a new GIF
export const createGif = async (data: GifInsert): Promise<Gif>;

// Update a GIF
export const updateGif = async (id: string, data: Partial<GifInsert>): Promise<Gif | undefined>;
```

### 4. Provider Service (`modules/gif/gif.service.ts`)

Handles GIF provider API interactions:

```typescript
import axios from "axios";
import { env } from "@gifview-monorepo/env/server";
import * as gifDbService from "../../services/gifService";

// Get single GIF for post enrichment (with deduplication)
export async function getGif(topic: string): Promise<GifResult>;

// Get multiple GIFs with pagination
export async function getGifs(query: string, options?: GifSearchOptions): Promise<GifsSearchResult>;

// Build provider-specific URL and params
export function getURL(provider: GifSearchProviders, searchTerm: string, limit?: number);

// Parse topic and compute priority-sorted searches
export function computeGifSearches(topicSuggestion: string): GifSearch[];
```

---

## API Endpoints

All routes are prefixed with `/api/v1/gifs`.

### Provider Search Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/search?q=&limit=&offset=&provider=` | Search GIFs with pagination |
| `POST` | `/search` | Single GIF for topic (post enrichment) |
| `POST` | `/search/:provider` | Get search URL for specific provider |
| `GET` | `/trending` | Get trending GIFs |
| `GET` | `/providers` | List available providers |

### Database CRUD Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Get all GIFs from database |
| `GET` | `/:id` | Get GIF by ID |
| `POST` | `/` | Create GIF in database |
| `PUT` | `/:id` | Update GIF in database |

### Request/Response Examples

**POST /api/v1/gifs/search** (Single GIF for post enrichment)

Request:
```json
{
  "topic": "Brand: Apple, iPhone\nEmotion: excited\nAction: unboxing"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "url": "https://media.tenor.com/...",
    "provider": "Tenor"
  }
}
```

**GET /api/v1/gifs/search** (Multiple GIFs for UI)

Request:
```
GET /api/v1/gifs/search?q=happy&limit=10&offset=0&provider=Giphy
```

Response:
```json
{
  "success": true,
  "data": {
    "gifs": [
      {
        "id": "abc123",
        "url": "https://media.giphy.com/...",
        "title": "Happy Dance",
        "provider": "Giphy",
        "thumbnail": "https://media.giphy.com/.../200.gif"
      }
    ],
    "totalCount": 10,
    "hasMore": true,
    "nextOffset": 10
  }
}
```

**GET /api/v1/gifs/trending**

Response:
```json
{
  "success": true,
  "data": {
    "gifs": [...],
    "totalCount": 20,
    "hasMore": true,
    "nextOffset": 20,
    "category": "trending",
    "query": "viral"
  }
}
```

**GET /api/v1/gifs/providers**

Response:
```json
{
  "success": true,
  "data": {
    "providers": ["Tenor", "Giphy"],
    "default": "Giphy"
  }
}
```

---

## Smart GIF Selection Algorithm

The algorithm parses topic suggestions and routes searches to optimal providers based on content category.

### Input Format

```
Area1: keyword1, keyword2
Area2: keyword3, keyword4
```

### Example

```
Brand: Apple, MacBook
Emotion: excited, happy
Action: typing, working
```

### Algorithm Steps

1. **Parse Input**: Split by newlines, extract area and keywords
2. **Map to Providers**: Use `SEARCH_MAPPINGS` to get provider and priority
3. **Sort by Priority**: Lower number = higher priority (Brand=1, Product=2, etc.)
4. **Search Sequentially**: Try each search until a valid GIF is found
5. **Deduplicate**: Check database to avoid using same GIF twice

### Provider Selection Logic

| Content Category | Preferred Provider | Reason |
|------------------|-------------------|--------|
| Brand | Tenor | Better brand/logo GIF coverage |
| Product | Tenor | More product-related content |
| Event | Giphy | Wider event coverage |
| Action | Giphy | Better action/verb GIFs |
| Sports team | Giphy | Official sports partnerships |
| Celebrity | Tenor | Better celebrity content |
| Location | Tenor | More location-based GIFs |
| Emotion | Giphy | Superior reaction GIFs |
| Weather | Giphy | Better weather animations |
| Other | Tenor | Default fallback |

---

## Environment Variables

Add these to your `.env` file in the server package:

```env
# GIF Providers
GIPHY_API_KEY=your_giphy_api_key_here
TENOR_API_KEY=your_tenor_api_key_here
```

These are validated in `packages/env/src/server.ts`:

```typescript
const envSchema = z.object({
  // ... other env vars
  GIPHY_API_KEY: z.string().min(1),
  TENOR_API_KEY: z.string().min(1),
});
```

### Getting API Keys

**Giphy**:
1. Go to [Giphy Developers](https://developers.giphy.com/)
2. Create an app
3. Copy the API Key

**Tenor**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Tenor API
3. Create API credentials

---

## Usage Examples

### 1. Enriching a Post with a GIF

```typescript
import { getGif } from "../modules/gif";
import { createGif } from "../services/gifService";

async function enrichPostWithGif(post: Post) {
  // Generate topic suggestion (could be from AI)
  const topicSuggestion = `Brand: ${post.title}
Emotion: informative
Action: reading`;

  const gif = await getGif(topicSuggestion);

  if (gif.url) {
    // Save GIF to database
    await createGif({
      postId: post.id,
      url: gif.url,
      provider: gif.provider,
    });
  }

  return gif;
}
```

### 2. Building a GIF Picker UI

```typescript
import { getGifs } from "../modules/gif";

// Frontend calls
const page1 = await getGifs("happy", { limit: 20, offset: 0 });
// { gifs: [...20 gifs], hasMore: true, nextOffset: 20 }

const page2 = await getGifs("happy", { limit: 20, offset: 20 });
// { gifs: [...20 gifs], hasMore: true, nextOffset: 40 }
```

### 3. Provider-Specific Search

```typescript
import { getGifs, GifSearchProviders } from "../modules/gif";

// Only search Tenor for brand content
const brandGifs = await getGifs("Apple", {
  limit: 10,
  provider: GifSearchProviders.Tenor,
});
```

---

## Testing

### Manual Testing with cURL

```bash
# Single GIF search
curl -X POST http://localhost:3000/api/v1/gifs/search \
  -H "Content-Type: application/json" \
  -d '{"topic": "Brand: Apple\nEmotion: excited"}'

# Multiple GIFs search
curl "http://localhost:3000/api/v1/gifs/search?q=happy&limit=5"

# Trending GIFs
curl "http://localhost:3000/api/v1/gifs/trending?limit=10"

# List providers
curl "http://localhost:3000/api/v1/gifs/providers"

# Get all GIFs from database
curl "http://localhost:3000/api/v1/gifs?pageSize=10&offset=0"
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Empty results | Check API keys are valid |
| Rate limit errors | Implement caching or reduce request frequency |
| Wrong provider selected | Verify SEARCH_MAPPINGS configuration |
| Duplicate GIFs | Ensure `gifs.url` has unique constraint |
| Slow responses | Add timeout to axios requests |
