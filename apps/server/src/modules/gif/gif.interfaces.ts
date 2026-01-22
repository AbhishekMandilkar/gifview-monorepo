import type { GifSearchProviders } from "./gif.constants";

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
