// ============================================
// SPOTIFY API TYPES
// ============================================

/**
 * Spotify OAuth token response from Client Credentials flow.
 */
export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Spotify artist object (simplified).
 */
export interface SpotifyArtist {
  id: string;
  name: string;
  external_urls: {
    spotify: string;
  };
}

/**
 * Spotify image object.
 */
export interface SpotifyImage {
  url: string;
  height: number;
  width: number;
}

/**
 * Spotify copyright object.
 */
export interface SpotifyCopyright {
  text: string;
  type: string;
}

/**
 * Spotify album object from the new releases API.
 */
export interface SpotifyAlbum {
  id: string;
  name: string;
  album_type: string;
  artists: SpotifyArtist[];
  external_urls: {
    spotify: string;
  };
  release_date: string;
  release_date_precision: "year" | "month" | "day";
  total_tracks: number;
  images: SpotifyImage[];
  genres: string[];
  label?: string;
  popularity?: number;
  available_markets?: string[];
  copyrights?: SpotifyCopyright[];
}

/**
 * Spotify new releases API response.
 */
export interface SpotifyNewReleasesResponse {
  albums: {
    href: string;
    items: SpotifyAlbum[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
  };
}

// ============================================
// INTERNAL TYPES
// ============================================

/**
 * Album data prepared for queue processing.
 */
export interface SpotifyAlbumToProcess {
  album: SpotifyAlbum;
  connectorId: string;
}

/**
 * Active sync job tracking.
 */
export interface ActiveSyncJob {
  queuedCount: number;
  totalItems: number;
  startExecutionCount: number;
  onComplete: (queued: number, processed: number, totalItems: number) => Promise<void>;
}
