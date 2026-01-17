import type { Request, Response, NextFunction } from "express";
import * as postMediaService from "../services/postMediaService";

export const getMediaByPost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const media = await postMediaService.getMediaByPostId(req.params.postId as string);
    res.json(media);
  } catch (error) {
    next(error);
  }
};

export const createMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const media = await postMediaService.createMedia({
      ...req.body,
      postId: req.params.postId as string,
    });
    res.status(201).json(media);
  } catch (error) {
    next(error);
  }
};

export const updateMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const media = await postMediaService.updateMedia(req.params.id as string, req.body);
    if (!media) {
      res.status(404).json({ message: "Media not found" });
      return;
    }
    res.json(media);
  } catch (error) {
    next(error);
  }
};
