// ============================================
// ENUMS
// ============================================

export enum GifSearchProviders {
  Tenor = "Tenor",
  Giphy = "Giphy",
}

// ============================================
// API ENDPOINTS
// ============================================

const TENOR_ENDPOINT = "https://tenor.googleapis.com/v2/search";
const GIPHY_ENDPOINT = "https://api.giphy.com/v1/gifs/search";

export const getGifBaseURLByProvider = (provider: GifSearchProviders): string => {
  switch (provider) {
    case GifSearchProviders.Tenor:
      return TENOR_ENDPOINT;
    case GifSearchProviders.Giphy:
      return GIPHY_ENDPOINT;
    default:
      return TENOR_ENDPOINT;
  }
};

// ============================================
// CONTENT AREAS (Categories)
// ============================================

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

// ============================================
// PROVIDER API RESPONSE TYPES
// ============================================

export interface TenorResponse {
  id: string;
  title: string;
  media_formats: {
    gif: {
      url: string;
      duration: number;
      preview: string;
      dims: [number, number];
      size: number;
    };
  };
  created: number;
  content_description: string;
  itemurl: string;
  url: string;
  tags: string[];
  flags: string[];
  hasaudio: boolean;
}

export interface GiphyResponse {
  id: string;
  url: string;
  embed_url: string;
  slug: string;
  title: string;
  images: {
    downsized_medium: {
      url: string;
    };
    fixed_height: {
      url: string;
    };
    original: {
      url: string;
    };
  };
}

// ============================================
// SEARCH TYPES
// ============================================

export interface GifSearch {
  provider: GifSearchProviders;
  keyword: string;
  area?: Area;
}

// ============================================
// SMART PROVIDER MAPPING
// ============================================
// Maps content categories to preferred providers with priority
// Lower priority number = higher importance

type SearchMapping = Record<
  Area,
  {
    priority: number;
    provider: GifSearchProviders;
  }
>;

export const SEARCH_MAPPINGS: SearchMapping = {
  Brand: { priority: 1, provider: GifSearchProviders.Tenor }, // Tenor better for brands
  Product: { priority: 2, provider: GifSearchProviders.Tenor }, // Tenor better for products
  Event: { priority: 3, provider: GifSearchProviders.Giphy }, // Giphy better for events
  Action: { priority: 4, provider: GifSearchProviders.Giphy }, // Giphy better for actions
  "Sports team": { priority: 5, provider: GifSearchProviders.Giphy }, // Giphy better for sports
  Celebrity: { priority: 6, provider: GifSearchProviders.Tenor }, // Tenor better for celebrities
  Location: { priority: 7, provider: GifSearchProviders.Tenor }, // Tenor better for locations
  Emotion: { priority: 8, provider: GifSearchProviders.Giphy }, // Giphy better for emotions
  Weather: { priority: 9, provider: GifSearchProviders.Giphy }, // Giphy better for weather
  Other: { priority: 10, provider: GifSearchProviders.Tenor }, // Default to Tenor
} as const;
