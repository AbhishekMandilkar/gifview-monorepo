import type { Request, Response, NextFunction } from "express";
import * as connectorService from "../services/connectorService";

export const getConnectors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.pageSize as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await connectorService.getAllConnectors(limit, offset);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getConnector = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connector = await connectorService.getConnectorById(req.params.id as string);
    if (!connector) {
      res.status(404).json({ message: "Connector not found" });
      return;
    }
    res.json(connector);
  } catch (error) {
    next(error);
  }
};

export const createConnector = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connector = await connectorService.createConnector(req.body);
    res.status(201).json(connector);
  } catch (error) {
    next(error);
  }
};

export const updateConnector = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connector = await connectorService.updateConnector(req.params.id as string, req.body);
    if (!connector) {
      res.status(404).json({ message: "Connector not found" });
      return;
    }
    res.json(connector);
  } catch (error) {
    next(error);
  }
};
