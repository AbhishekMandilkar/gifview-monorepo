// ============================================
// QUEUE CONFIGURATION
// ============================================

export const QUEUE_CONFIG = {
  /** Delay between processing items (ms) */
  WAIT_MS: 10000, // 10 seconds between items
  /** Maximum queue size */
  MAX_SIZE: 50,
  /** Default max items per sync */
  DEFAULT_MAX_ITEMS: 5,
} as const;

// ============================================
// SPOTIFY API CONFIGURATION
// ============================================

export const SPOTIFY_API = {
  /** Token endpoint for Client Credentials flow */
  TOKEN_URL: "https://accounts.spotify.com/api/token",
  /** New releases endpoint */
  NEW_RELEASES_URL: "https://api.spotify.com/v1/browse/new-releases",
  /** Default market for new releases */
  DEFAULT_MARKET: "US",
} as const;
