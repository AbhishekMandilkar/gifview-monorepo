import { Router, type IRouter } from "express";
import * as gifController from "../controllers/gifController";

const router: IRouter = Router();

router.get("/", gifController.getGifs);
router.get("/:id", gifController.getGif);
router.post("/", gifController.createGif);
router.put("/:id", gifController.updateGif);

export default router;
