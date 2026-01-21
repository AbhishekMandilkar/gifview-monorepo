import { Router, type IRouter } from "express";
import postRoutes from "./postRoutes";
import gifRoutes from "./gifRoutes";
import userRoutes from "./userRoutes";
import connectorRoutes from "./connectorRoutes";
import interestRoutes from "./interestRoutes";
import postMediaRoutes from "./postMediaRoutes";
import postLikeRoutes from "./postLikeRoutes";
import postCommentRoutes from "./postCommentRoutes";
import commentLikeRoutes from "./commentLikeRoutes";
import { syncController } from "../modules/sync";

const router: IRouter = Router();

router.use("/posts", postRoutes);
router.use("/gifs", gifRoutes);
router.use("/users", userRoutes);
router.use("/connectors", connectorRoutes);
router.use("/interests", interestRoutes);
router.use("/sync", syncController);
router.use(postMediaRoutes);
router.use(postLikeRoutes);
router.use(postCommentRoutes);
router.use(commentLikeRoutes);

export default router;
