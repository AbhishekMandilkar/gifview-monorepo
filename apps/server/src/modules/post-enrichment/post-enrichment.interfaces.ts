import type { QueueStatus } from "../sync/sync.interfaces";

// ============================================
// INTEREST DEPTH ENUM
// ============================================

export enum InterestsDepth {
  Main = "1",
  Sub = "2",
  SubSub = "3",
}

// ============================================
// POST TO ENRICH
// ============================================

export interface PostToEnrich {
  id: string;
  title: string | null;
  description: string | null;
  content: string | null;
}

// ============================================
// ENRICHMENT RESULT
// ============================================

export interface EnrichmentResult {
  postId: string;
  interests: { interestId: string }[];
  gif: {
    url: string;
    provider: string;
  };
}

// ============================================
// ENRICHMENT QUEUE STATUS
// ============================================

export type EnrichmentQueueStatus = QueueStatus;

// ============================================
// ENRICHMENT RESULT
// ============================================

export interface EnrichPostsResult {
  message: string;
  queued: number;
  queueSize?: number;
  processed?: number;
}

// ============================================
// SUGGEST INTERESTS PARAMS
// ============================================

export interface SuggestInterestsParams {
  title: string;
  description: string;
  content: string;
}
