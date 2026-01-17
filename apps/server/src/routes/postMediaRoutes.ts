import { Router, type IRouter } from "express";
import * as postMediaController from "../controllers/postMediaController";

const router: IRouter = Router();

router.get("/posts/:postId/media", postMediaController.getMediaByPost);
router.post("/posts/:postId/media", postMediaController.createMedia);
router.put("/media/:id", postMediaController.updateMedia);

export default router;
