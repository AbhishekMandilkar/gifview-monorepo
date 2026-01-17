import type { Request, Response, NextFunction } from "express";
import * as interestService from "../services/interestService";

export const getInterests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.pageSize as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await interestService.getAllInterests(limit, offset);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getInterest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const interest = await interestService.getInterestById(req.params.id as string);
    if (!interest) {
      res.status(404).json({ message: "Interest not found" });
      return;
    }
    res.json(interest);
  } catch (error) {
    next(error);
  }
};

export const getInterestsByDepth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.pageSize as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await interestService.getInterestsByDepth(req.params.depth as string, limit, offset);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const createInterest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const interest = await interestService.createInterest(req.body);
    res.status(201).json(interest);
  } catch (error) {
    next(error);
  }
};

export const updateInterest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const interest = await interestService.updateInterest(req.params.id as string, req.body);
    if (!interest) {
      res.status(404).json({ message: "Interest not found" });
      return;
    }
    res.json(interest);
  } catch (error) {
    next(error);
  }
};
