import type { Request, Response, NextFunction } from "express";
import * as gifDbService from "../services/gifService";
import {
  getGif as getGifFromProvider,
  getGifs as getGifsFromProvider,
  getURL,
  GifSearchProviders,
} from "../modules/gif";

// ============================================
// DATABASE CRUD OPERATIONS
// ============================================

export const getAllGifsFromDb = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.pageSize as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await gifDbService.getAllGifs(limit, offset);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getGifFromDb = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gif = await gifDbService.getGifById(req.params.id as string);
    if (!gif) {
      res.status(404).json({ message: "Gif not found" });
      return;
    }
    res.json(gif);
  } catch (error) {
    next(error);
  }
};

export const createGif = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gif = await gifDbService.createGif(req.body);
    res.status(201).json(gif);
  } catch (error) {
    next(error);
  }
};

export const updateGif = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gif = await gifDbService.updateGif(req.params.id as string, req.body);
    if (!gif) {
      res.status(404).json({ message: "Gif not found" });
      return;
    }
    res.json(gif);
  } catch (error) {
    next(error);
  }
};

// ============================================
// POST /gif/search - Single GIF for post enrichment
// ============================================

export const searchSingleGif = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { topic } = req.body;

    if (!topic) {
      res.status(400).json({ success: false, error: "Topic is required" });
      return;
    }

    const result = await getGifFromProvider(topic);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[GIF Controller] Error searching GIFs:", error);
    next(error);
  }
};

// ============================================
// GET /gif/search - Multiple GIFs with pagination
// ============================================

export const searchGifs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q: query, limit = "20", offset = "0", provider } = req.query;

    if (!query) {
      res.status(400).json({ success: false, error: "Query parameter 'q' is required" });
      return;
    }

    const options = {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      provider: provider as GifSearchProviders | undefined,
    };

    const result = await getGifsFromProvider(query as string, options);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[GIF Controller] Error searching multiple GIFs:", error);
    next(error);
  }
};

// ============================================
// POST /gif/search/:provider - Search with specific provider
// ============================================

export const searchByProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider } = req.params;
    const { query, limit = 25 } = req.body;

    if (!query) {
      res.status(400).json({ success: false, error: "Query is required" });
      return;
    }

    // Validate provider
    if (!Object.values(GifSearchProviders).includes(provider as GifSearchProviders)) {
      res.status(400).json({
        success: false,
        error: `Invalid provider. Use '${GifSearchProviders.Giphy}' or '${GifSearchProviders.Tenor}'`,
      });
      return;
    }

    const { url, params } = getURL(provider as GifSearchProviders, query);

    // Override limit if provided
    if (limit !== 25) {
      params.set("limit", limit.toString());
    }

    res.json({
      success: true,
      data: {
        provider,
        searchUrl: url,
        params: Object.fromEntries(params),
        instructions: "Use this URL and params to make a direct API call",
      },
    });
  } catch (error) {
    console.error("[GIF Controller] Error getting GIF URL:", error);
    next(error);
  }
};

// ============================================
// GET /gif/trending - Get trending GIFs
// ============================================

export const getTrendingGifs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit = "20", offset = "0" } = req.query;

    const options = {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    };

    // Use popular trending terms
    const trendingQueries = ["trending", "viral", "popular", "funny", "reaction"];
    const randomQuery = trendingQueries[Math.floor(Math.random() * trendingQueries.length)];

    const result = await getGifsFromProvider(randomQuery, options);

    res.json({
      success: true,
      data: {
        ...result,
        category: "trending",
        query: randomQuery,
      },
    });
  } catch (error) {
    console.error("[GIF Controller] Error getting trending GIFs:", error);
    next(error);
  }
};

// ============================================
// GET /gif/providers - List available providers
// ============================================

export const getProviders = (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      providers: Object.values(GifSearchProviders),
      default: GifSearchProviders.Giphy,
    },
  });
};
