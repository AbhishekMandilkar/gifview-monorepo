import axios from "axios";
import { env } from "@gifview-monorepo/env/server";
import * as gifDbService from "../../services/gifService";
import {
  type Area,
  getGifBaseURLByProvider,
  type GifSearch,
  GifSearchProviders,
  type GiphyResponse,
  SEARCH_MAPPINGS,
  type TenorResponse,
} from "./gif.constants";
import type {
  GifResult,
  GifWithMetadata,
  GifsSearchResult,
  GifSearchOptions,
} from "./gif.interfaces";

// ============================================
// SINGLE GIF SEARCH (For Post Enrichment)
// ============================================

/**
 * Get a single GIF for a topic, avoiding duplicates in database
 * Uses smart provider selection based on content category
 *
 * @param topic - Topic suggestion string in format "Area: keyword1, keyword2\nArea2: keyword3"
 * @returns GIF URL and provider (empty if no GIF found)
 */
export async function getGif(topic: string): Promise<GifResult> {
  // Parse topic and create priority-sorted search list
  const searches = computeGifSearches(topic);

  const defaultGif: GifResult = {
    url: "",
    provider: "" as GifSearchProviders,
  };

  // Try each search in priority order
  for (const search of searches) {
    const { provider, keyword } = search;

    try {
      const { url, params } = getURL(provider, keyword);
      const response = await axios.get(url, { params });
      const gifUrls = processPayload(response.data, provider);

      if (gifUrls.length > 0) {
        // Check which GIFs already exist in database
        const existingUrls = await gifDbService.getExistingGifUrls(gifUrls);

        // Find first GIF that doesn't exist in DB
        const firstNewGif = gifUrls.find((gifUrl) => !existingUrls.has(gifUrl));

        // Return first new GIF if found, otherwise return first GIF
        return {
          url: firstNewGif || gifUrls[0],
          provider,
        };
      }

      console.log(`[GIF] No results for: ${provider} - ${keyword}`);
    } catch (error) {
      console.error(`[GIF] Error fetching ${provider} - ${keyword}:`, error);
    }
  }

  return defaultGif;
}

// ============================================
// MULTIPLE GIFS SEARCH (For UI Grid)
// ============================================

/**
 * Get multiple GIFs for a search query with pagination
 *
 * @param query - Search query string
 * @param options - Pagination and provider options
 * @returns Paginated GIF results
 */
export async function getGifs(
  query: string,
  options: GifSearchOptions = {}
): Promise<GifsSearchResult> {
  const { limit = 20, offset = 0, provider } = options;

  try {
    // If specific provider is requested, use it directly
    if (provider) {
      const { url, params } = getURL(provider, query, limit);
      params.set("offset", offset.toString());

      const response = await axios.get(url, { params });
      const processedGifs = processPayloadWithMetadata(response.data, provider);

      return {
        gifs: processedGifs,
        totalCount: processedGifs.length,
        hasMore: processedGifs.length === limit,
        nextOffset: processedGifs.length === limit ? offset + limit : undefined,
      };
    }

    // Default: Use Giphy for general searches
    const giphyResult = await getGifsFromProvider(
      GifSearchProviders.Giphy,
      query,
      limit,
      offset
    );

    return {
      gifs: giphyResult,
      totalCount: giphyResult.length,
      hasMore: giphyResult.length === limit,
      nextOffset: giphyResult.length === limit ? offset + limit : undefined,
    };
  } catch (error) {
    console.error("[GIF] Error fetching multiple GIFs:", error);
    return {
      gifs: [],
      totalCount: 0,
      hasMore: false,
    };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get GIFs from a specific provider
 */
async function getGifsFromProvider(
  provider: GifSearchProviders,
  query: string,
  limit: number,
  offset: number
): Promise<GifWithMetadata[]> {
  try {
    const { url, params } = getURL(provider, query, limit);
    params.set("offset", offset.toString());

    const response = await axios.get(url, { params });
    return processPayloadWithMetadata(response.data, provider);
  } catch (error) {
    console.error(`[GIF] Error fetching from ${provider}:`, error);
    return [];
  }
}

/**
 * Build URL and params for provider API
 */
export function getURL(
  provider: GifSearchProviders,
  searchTerm: string,
  limit: number = 25
): { url: string; params: URLSearchParams } {
  const baseUrl = getGifBaseURLByProvider(provider);
  const params = new URLSearchParams();

  switch (provider) {
    case GifSearchProviders.Giphy:
      params.append("q", searchTerm);
      params.append("api_key", env.GIPHY_API_KEY);
      params.append("limit", limit.toString());
      params.append("rating", "pg-13"); // Content rating filter
      break;

    case GifSearchProviders.Tenor:
      params.append("q", searchTerm);
      params.append("key", env.TENOR_API_KEY);
      params.append("media_filter", "gif");
      params.append("limit", limit.toString());
      break;

    default:
      throw new Error(`Invalid provider: ${provider}`);
  }

  return { url: baseUrl, params };
}

/**
 * Extract GIF URLs from provider response
 */
function processPayload(payload: unknown, provider: GifSearchProviders): string[] {
  const data = payload as Record<string, unknown>;

  switch (provider) {
    case GifSearchProviders.Giphy:
      return (data.data as GiphyResponse[]).map(
        (item: GiphyResponse) => item.images?.downsized_medium?.url
      ).filter(Boolean);

    case GifSearchProviders.Tenor:
      return (data.results as TenorResponse[]).map(
        (item: TenorResponse) => item.media_formats.gif.url
      ).filter(Boolean);

    default:
      return [];
  }
}

/**
 * Extract GIF URLs with full metadata from provider response
 */
function processPayloadWithMetadata(
  payload: unknown,
  provider: GifSearchProviders
): GifWithMetadata[] {
  const data = payload as Record<string, unknown>;

  switch (provider) {
    case GifSearchProviders.Giphy:
      return (data.data as GiphyResponse[]).map((item: GiphyResponse) => ({
        id: item.id,
        url: item.images?.downsized_medium?.url,
        title: item.title || "GIF",
        provider: GifSearchProviders.Giphy,
        thumbnail: item.images?.downsized_medium?.url,
      }));

    case GifSearchProviders.Tenor:
      return (data.results as TenorResponse[]).map((item: TenorResponse) => ({
        id: item.id,
        url: item.media_formats.gif.url,
        title: item.content_description || "GIF",
        provider: GifSearchProviders.Tenor,
        thumbnail: item.media_formats.gif.preview || item.media_formats.gif.url,
      }));

    default:
      return [];
  }
}

// ============================================
// SMART GIF SELECTION ALGORITHM
// ============================================

/**
 * Parse a topic line in format "Area: keyword1, keyword2"
 */
function parseTopicLine(line: string): [Area, string[]] {
  const [area, keywordsStr] = line.split(":").map((s) => s.trim());
  const keywords =
    keywordsStr
      ?.split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0) ?? [];
  return [area as Area, keywords];
}

/**
 * Create a search object from an area and keyword
 */
function createSearchFromArea(
  area: Area,
  keyword: string
): [number, GifSearch] | null {
  const config = SEARCH_MAPPINGS[area];
  if (!config) return null;

  return [config.priority, { area, keyword, provider: config.provider }];
}

/**
 * Parse topic suggestion and compute priority-sorted search list
 *
 * Input format:
 * "Brand: Apple, iPhone
 *  Emotion: excited, happy
 *  Action: running"
 *
 * Output: Array of searches sorted by priority (Brand first, then Product, etc.)
 */
export function computeGifSearches(topicSuggestion: string): GifSearch[] {
  // Parse input and create priority-based searches
  const searchesByPriority = topicSuggestion
    .split("\n")
    .map((line) => parseTopicLine(line))
    .flatMap(([area, keywords]) =>
      keywords.map((keyword) => createSearchFromArea(area, keyword))
    )
    .filter((entry): entry is [number, GifSearch] => entry !== null)
    .reduce((acc, [priority, search]) => {
      acc.set(priority, [...(acc.get(priority) ?? []), search]);
      return acc;
    }, new Map<number, GifSearch[]>());

  // Convert to sorted array (lower priority number = higher importance)
  return Array.from(searchesByPriority.entries())
    .sort(([a], [b]) => a - b)
    .flatMap(([_, searches]) => searches);
}
