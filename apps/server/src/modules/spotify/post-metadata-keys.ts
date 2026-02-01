/**
 * Post Metadata Keys Enum
 *
 * Defines standard keys for the metadata JSON column in post_media.
 * Use these keys consistently to ensure data integrity
 * and make it easier for UI to access specific fields.
 */
export enum PostMetadataKeys {
  // ============================================
  // MEDIA DIMENSIONS
  // ============================================
  HEIGHT = "height",
  WIDTH = "width",

  // ============================================
  // MEDIA FILE INFORMATION
  // ============================================
  FILE_TYPE = "file_type",
  MIME_TYPE = "mime_type",

  // ============================================
  // MEDIA QUALITY AND FORMAT
  // ============================================
  QUALITY = "quality",
  ORIENTATION = "orientation",
  ASPECT_RATIO = "aspect_ratio",

  // ============================================
  // MEDIA SOURCE INFORMATION
  // ============================================
  SOURCE_URL = "source_url",

  // ============================================
  // ALBUM/MEDIA SPECIFIC
  // ============================================
  ALBUM_ART_URL = "album_art_url",
  ALBUM_ART_DIMENSIONS = "album_art_dimensions",

  // ============================================
  // SPOTIFY SPECIFIC
  // ============================================
  SPOTIFY_ID = "spotify_id",
  SPOTIFY_URI = "spotify_uri",
  SPOTIFY_EXTERNAL_URL = "spotify_external_url",
  SPOTIFY_POPULARITY = "spotify_popularity",
  SPOTIFY_AVAILABLE_MARKETS = "spotify_available_markets",

  // ============================================
  // GENERAL MEDIA INFORMATION
  // ============================================
  TITLE = "title",
  ARTIST = "artist",
  ALBUM = "album",
  GENRE = "genre",
  LABEL = "label",
  RELEASE_DATE = "release_date",
  TRACK_COUNT = "track_count",

  // ============================================
  // PROCESSING INFORMATION
  // ============================================
  PROCESSED_AT = "processed_at",
  PROCESSING_VERSION = "processing_version",

  // ============================================
  // COPYRIGHT AND LICENSING
  // ============================================
  COPYRIGHT = "copyright",
}

/**
 * Type definition for post metadata.
 * Allows both enum keys and custom string keys.
 */
export type PostMetadata = {
  [K in PostMetadataKeys]?: unknown;
} & {
  [key: string]: unknown;
};

/**
 * Create metadata object with type safety.
 */
export function createPostMetadata(data: Partial<PostMetadata>): PostMetadata {
  return data as PostMetadata;
}

/**
 * Get metadata value with type safety.
 */
export function getMetadataValue<T = unknown>(
  metadata: PostMetadata | null | undefined,
  key: PostMetadataKeys
): T | undefined {
  return metadata?.[key] as T | undefined;
}

/**
 * Set metadata value with type safety.
 */
export function setMetadataValue(
  metadata: PostMetadata,
  key: PostMetadataKeys,
  value: unknown
): PostMetadata {
  return {
    ...metadata,
    [key]: value,
  };
}
