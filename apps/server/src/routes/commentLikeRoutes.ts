import { Router, type IRouter } from "express";
import * as commentLikeController from "../controllers/commentLikeController";

const router: IRouter = Router();

router.get("/comments/:commentId/likes", commentLikeController.getLikesByComment);
router.post("/comments/:commentId/likes", commentLikeController.likeComment);
router.delete("/comments/:commentId/likes", commentLikeController.unlikeComment);

export default router;
