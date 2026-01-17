import { Router, type IRouter } from "express";
import * as connectorController from "../controllers/connectorController";

const router: IRouter = Router();

router.get("/", connectorController.getConnectors);
router.get("/:id", connectorController.getConnector);
router.post("/", connectorController.createConnector);
router.put("/:id", connectorController.updateConnector);

export default router;
