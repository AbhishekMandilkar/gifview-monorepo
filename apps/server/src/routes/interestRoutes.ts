import { Router, type IRouter } from "express";
import * as interestController from "../controllers/interestController";

const router: IRouter = Router();

router.get("/", interestController.getInterests);
router.get("/depth/:depth", interestController.getInterestsByDepth);
router.get("/:id", interestController.getInterest);
router.post("/", interestController.createInterest);
router.put("/:id", interestController.updateInterest);

export default router;
