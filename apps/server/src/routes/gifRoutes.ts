import { Router, type IRouter } from "express";
import * as gifController from "../controllers/gifController";

const router: IRouter = Router();

// ============================================
// GIF Provider Search Endpoints
// ============================================

// GET /gifs/search?q=&limit=&offset=&provider= - Search GIFs with pagination
router.get("/search", gifController.searchGifs);

// POST /gifs/search - Single GIF for topic (post enrichment)
router.post("/search", gifController.searchSingleGif);

// POST /gifs/search/:provider - Get search URL for specific provider
router.post("/search/:provider", gifController.searchByProvider);

// GET /gifs/trending - Get trending GIFs
router.get("/trending", gifController.getTrendingGifs);

// GET /gifs/providers - List available providers
router.get("/providers", gifController.getProviders);

// ============================================
// Database CRUD Endpoints
// ============================================

// GET /gifs - Get all GIFs from database
router.get("/", gifController.getAllGifsFromDb);

// GET /gifs/:id - Get GIF by ID from database
router.get("/:id", gifController.getGifFromDb);

// POST /gifs - Create GIF in database
router.post("/", gifController.createGif);

// PUT /gifs/:id - Update GIF in database
router.put("/:id", gifController.updateGif);

export default router;
