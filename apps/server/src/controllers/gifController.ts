import type { Request, Response, NextFunction } from "express";
import * as gifService from "../services/gifService";

export const getGifs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.pageSize as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await gifService.getAllGifs(limit, offset);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getGif = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gif = await gifService.getGifById(req.params.id as string);
    if (!gif) {
      res.status(404).json({ message: "Gif not found" });
      return;
    }
    res.json(gif);
  } catch (error) {
    next(error);
  }
};

export const createGif = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gif = await gifService.createGif(req.body);
    res.status(201).json(gif);
  } catch (error) {
    next(error);
  }
};

export const updateGif = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gif = await gifService.updateGif(req.params.id as string, req.body);
    if (!gif) {
      res.status(404).json({ message: "Gif not found" });
      return;
    }
    res.json(gif);
  } catch (error) {
    next(error);
  }
};
