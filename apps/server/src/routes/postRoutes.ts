import { Router, type IRouter } from "express";
import * as postController from "../controllers/postController";

const router: IRouter = Router();

router.get("/", postController.getPosts);
router.get("/:id", postController.getPost);
router.post("/", postController.createPost);
router.put("/:id", postController.updatePost);

export default router;
