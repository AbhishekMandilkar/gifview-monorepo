import { Router, type IRouter } from "express";
import * as postLikeController from "../controllers/postLikeController";

const router: IRouter = Router();

router.get("/posts/:postId/likes", postLikeController.getLikesByPost);
router.post("/posts/:postId/likes", postLikeController.likePost);
router.delete("/posts/:postId/likes", postLikeController.unlikePost);

export default router;
