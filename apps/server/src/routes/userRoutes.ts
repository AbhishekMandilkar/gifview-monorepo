import { Router, type IRouter } from "express";
import * as userController from "../controllers/userController";

const router: IRouter = Router();

router.get("/", userController.getUsers);
router.get("/:id", userController.getUser);
router.put("/:id", userController.updateUser);

export default router;
