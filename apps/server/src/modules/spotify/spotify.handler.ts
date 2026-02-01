import type { PostInsert, Connector } from "@gifview-monorepo/db";
import { Queuer } from "@tanstack/pacer";
import { createLogger } from "../../utils/logger";
import * as postService from "../../services/postService";
import * as postMediaService from "../../services/postMediaService";
import { PostSource } from "../../types/postSource";
import type {
  ConnectorHandler,
  SyncResult,
  QueueStatus,
  OnSyncComplete,
} from "../sync/sync.interfaces";
import type {
  SpotifyAlbum,
  SpotifyAlbumToProcess,
  SpotifyTokenResponse,
  SpotifyNewReleasesResponse,
  ActiveSyncJob,
} from "./spotify.interfaces";
import { QUEUE_CONFIG, SPOTIFY_API } from "./spotify.constants";
import { PostMetadataKeys, createPostMetadata } from "./post-metadata-keys";

// ============================================
// CONFIGURATION
// ============================================

const logger = createLogger("Spotify Connector");
const queueLogger = createLogger("Spotify Queue");

// Environment variables for Spotify API credentials
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// ============================================
// QUEUE INSTANCE
// ============================================

let spotifyAlbumQueue: Queuer<SpotifyAlbumToProcess> | null = null;
let activeSyncJob: ActiveSyncJob | null = null;

function getQueue(): Queuer<SpotifyAlbumToProcess> {
  if (!spotifyAlbumQueue) {
    spotifyAlbumQueue = new Queuer<SpotifyAlbumToProcess>(
      async (albumData) => {
        try {
          const { album, connectorId } = albumData;
          queueLogger.info(`Processing album: ${album.name}`);

          await processAlbum(album, connectorId);
        } catch (error) {
          queueLogger.error(`Error processing album ${albumData.album.name}:`, error);
        }
      },
      {
        wait: QUEUE_CONFIG.WAIT_MS,
        maxSize: QUEUE_CONFIG.MAX_SIZE,
        started: true,
        onItemsChange: (queuer) => {
          queueLogger.info(
            `Queue status - Size: ${queuer.store.state.size}, Processed: ${queuer.store.state.executionCount}`
          );

          if (activeSyncJob && queuer.store.state.size === 0) {
            const processedForThisJob =
              queuer.store.state.executionCount - activeSyncJob.startExecutionCount;

            if (processedForThisJob > 0) {
              const job = activeSyncJob;
              activeSyncJob = null;

              job.onComplete(job.queuedCount, processedForThisJob, job.totalItems).catch((error) => {
                queueLogger.error("Completion callback error:", error);
              });
            }
          }
        },
        onReject: (item) => {
          queueLogger.warn(`Queue full! Rejected album: ${item.album.name}`);
        },
      }
    );
  }
  return spotifyAlbumQueue;
}

// ============================================
// AUTHENTICATION
// ============================================

/**
 * Get Spotify access token using Client Credentials flow.
 */
async function getSpotifyToken(): Promise<string> {
  logger.info("Requesting Spotify access token...");

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error("Spotify credentials not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.");
  }

  const credentials = Buffer.from(
    `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(SPOTIFY_API.TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Spotify auth failed: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as SpotifyTokenResponse;
  logger.info("Spotify access token obtained successfully");
  return data.access_token;
}

// ============================================
// SPOTIFY API CALLS
// ============================================

/**
 * Fetch new releases from Spotify.
 */
async function fetchNewReleases(
  token: string,
  limit: number = QUEUE_CONFIG.DEFAULT_MAX_ITEMS
): Promise<SpotifyAlbum[]> {
  logger.info(`Fetching ${limit} new releases from Spotify...`);

  const url = new URL(SPOTIFY_API.NEW_RELEASES_URL);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("country", SPOTIFY_API.DEFAULT_MARKET);

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Spotify API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as SpotifyNewReleasesResponse;
  const albums = data.albums.items;
  logger.info(`Fetched ${albums.length} new releases`);
  return albums;
}

// ============================================
// ALBUM PROCESSING
// ============================================

/**
 * Process and save a single album as a post with media.
 */
async function processAlbum(album: SpotifyAlbum, connectorId: string): Promise<void> {
  const sourceLink = album.external_urls.spotify;
  const sourceKey = album.id;

  // Check for duplicates
  const exists = await postService.checkPostExists(sourceLink, sourceKey);
  if (exists) {
    queueLogger.info(`Album already exists, skipping: ${album.name}`);
    return;
  }

  // Parse release date
  let publishingDate: string | null = null;
  try {
    const date = new Date(album.release_date);
    if (!isNaN(date.getTime())) {
      publishingDate = date.toISOString();
    }
  } catch {
    queueLogger.warn(`Invalid release date: ${album.release_date}`);
  }

  // Build description
  const primaryArtist = album.artists[0]?.name || "Unknown Artist";
  const artistNames = album.artists.map((a) => a.name).join(", ");
  const description = album.label
    ? `${album.label} • ${album.total_tracks} tracks • ${primaryArtist}`
    : `${album.total_tracks} tracks • ${primaryArtist}`;

  // Generate content (simple template)
  const content = generateAlbumContent(album);

  // Build post data
  const postData: PostInsert = {
    title: album.name,
    description,
    topic: album.album_type,
    tags: album.genres || [],
    sourceLink,
    sourceKey,
    sourceName: PostSource.SPOTIFY,
    publishingDate,
    content,
    connectorId,
    language: "en",
    isDeleted: false,
    createdDate: new Date().toISOString(),
  };

  try {
    // Create post
    const post = await postService.createPostIfNotExists(postData);

    if (!post) {
      queueLogger.info(`Post already exists (race condition), skipping: ${album.name}`);
      return;
    }

    queueLogger.info(`Created post: ${post.id} for album: ${album.name}`);

    // Add album art as media
    if (album.images && album.images.length > 0) {
      const albumArt = album.images[0]; // Highest quality

      const metadata = createPostMetadata({
        // Dimensions
        [PostMetadataKeys.HEIGHT]: albumArt.height,
        [PostMetadataKeys.WIDTH]: albumArt.width,
        [PostMetadataKeys.SOURCE_URL]: albumArt.url,
        [PostMetadataKeys.FILE_TYPE]: "image",
        [PostMetadataKeys.MIME_TYPE]: "image/jpeg",
        [PostMetadataKeys.QUALITY]: "high",
        [PostMetadataKeys.ORIENTATION]:
          albumArt.width > albumArt.height ? "landscape" : "portrait",
        [PostMetadataKeys.ASPECT_RATIO]: (albumArt.width / albumArt.height).toFixed(2),

        // Spotify specific
        [PostMetadataKeys.SPOTIFY_ID]: album.id,
        [PostMetadataKeys.SPOTIFY_URI]: `spotify:album:${album.id}`,
        [PostMetadataKeys.SPOTIFY_EXTERNAL_URL]: album.external_urls.spotify,
        [PostMetadataKeys.SPOTIFY_POPULARITY]: album.popularity || 0,
        [PostMetadataKeys.SPOTIFY_AVAILABLE_MARKETS]: album.available_markets || [],

        // Album information
        [PostMetadataKeys.TITLE]: album.name,
        [PostMetadataKeys.ARTIST]: artistNames,
        [PostMetadataKeys.ALBUM]: album.name,
        [PostMetadataKeys.GENRE]: album.genres || [],
        [PostMetadataKeys.LABEL]: album.label,
        [PostMetadataKeys.RELEASE_DATE]: album.release_date,
        [PostMetadataKeys.TRACK_COUNT]: album.total_tracks,

        // Processing
        [PostMetadataKeys.PROCESSED_AT]: new Date().toISOString(),
        [PostMetadataKeys.PROCESSING_VERSION]: "1.0.0",

        // Copyright
        [PostMetadataKeys.COPYRIGHT]: album.copyrights || [],

        // Additional Spotify data
        spotify_artists: album.artists,
        spotify_images: album.images,
        spotify_album_type: album.album_type,
      });

      await postMediaService.createMedia({
        postId: post.id,
        mediaType: "album_art",
        mediaUrl: albumArt.url,
        metadata,
        isDeleted: false,
      });

      queueLogger.info(`Added album art for: ${album.name}`);
    }

    queueLogger.info(`Successfully saved album: ${album.name}`);
  } catch (error) {
    queueLogger.error(`Error saving album ${album.name}:`, error);
    throw error;
  }
}

/**
 * Generate content text from album data.
 */
function generateAlbumContent(album: SpotifyAlbum): string {
  const artists = album.artists.map((a) => a.name).join(", ");
  const genreText = album.genres?.length ? `Genre: ${album.genres.join(", ")}` : "";
  const labelText = album.label ? `Label: ${album.label}` : "";

  const lines = [
    `Album: ${album.name}`,
    `Artists: ${artists}`,
    `Type: ${album.album_type}`,
    `Release Date: ${album.release_date}`,
    `Total Tracks: ${album.total_tracks}`,
  ];

  if (genreText) lines.push(genreText);
  if (labelText) lines.push(labelText);
  if (album.popularity) lines.push(`Popularity: ${album.popularity}/100`);

  return lines.join("\n");
}

// ============================================
// SYNC FUNCTION
// ============================================

/**
 * Main sync function for Spotify new releases.
 */
async function syncSpotify(
  connector: Connector,
  onComplete?: OnSyncComplete
): Promise<SyncResult> {
  const startTime = Date.now();
  logger.info(`Starting Spotify sync for connector: ${connector.id}`);

  try {
    // Check credentials
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
      throw new Error("Spotify credentials not configured");
    }

    // Get access token
    const token = await getSpotifyToken();

    // Fetch new releases
    logger.info("Fetching new releases...");
    const albums = await fetchNewReleases(token, QUEUE_CONFIG.DEFAULT_MAX_ITEMS);
    const totalItems = albums.length;

    if (totalItems === 0) {
      logger.info("No new releases found");
      return {
        totalItems: 0,
        queued: 0,
        queueSize: 0,
        processed: 0,
        message: "No new releases found",
      };
    }

    // Add items to queue
    const queue = getQueue();

    if (onComplete) {
      activeSyncJob = {
        queuedCount: albums.length,
        totalItems,
        startExecutionCount: queue.store.state.executionCount,
        onComplete,
      };
    }

    let queuedCount = 0;
    for (const album of albums) {
      queue.addItem({
        album,
        connectorId: connector.id,
      });
      queuedCount++;
    }

    logger.info(`Queued ${queuedCount} albums. Queue size: ${queue.store.state.size}`);
    logger.info(`Sync setup completed in ${Date.now() - startTime}ms`);

    return {
      totalItems,
      queued: queuedCount,
      queueSize: queue.store.state.size,
      processed: queue.store.state.executionCount,
      message: `Queued ${queuedCount} albums for processing`,
    };
  } catch (error) {
    logger.error(`Error after ${Date.now() - startTime}ms:`, error);
    activeSyncJob = null;
    throw error;
  }
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

/**
 * Validate Spotify connector config.
 * For simple "spotify" string config, always valid.
 */
function validateConfig(configJson: string): boolean {
  // Accept simple string "spotify"
  if (configJson === "spotify") {
    return true;
  }

  // Accept JSON config with spotify key
  try {
    const config = JSON.parse(configJson);
    return Boolean(config?.spotify);
  } catch {
    return false;
  }
}

// ============================================
// CONNECTOR HANDLER EXPORT
// ============================================

/**
 * Spotify Connector Handler
 *
 * Handles syncing new album releases from Spotify.
 *
 * Config format:
 * - Simple: "spotify"
 * - JSON: {"spotify": {"market": "US", "max_size": 5}}
 *
 * Environment variables required:
 * - SPOTIFY_CLIENT_ID
 * - SPOTIFY_CLIENT_SECRET
 */
export const spotifyConnectorHandler: ConnectorHandler = {
  type: "spotify",
  name: "Spotify New Releases",
  sync: syncSpotify,
  getQueueStatus,
  validateConfig,
};
