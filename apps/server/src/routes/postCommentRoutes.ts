import { Router, type IRouter } from "express";
import * as postCommentController from "../controllers/postCommentController";

const router: IRouter = Router();

router.get("/posts/:postId/comments", postCommentController.getCommentsByPost);
router.post("/posts/:postId/comments", postCommentController.createComment);
router.put("/comments/:id", postCommentController.updateComment);

export default router;
