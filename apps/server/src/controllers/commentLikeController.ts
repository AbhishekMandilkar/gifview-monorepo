import type { Request, Response, NextFunction } from "express";
import * as commentLikeService from "../services/commentLikeService";

export const getLikesByComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const likes = await commentLikeService.getLikesByCommentId(req.params.commentId as string);
    res.json(likes);
  } catch (error) {
    next(error);
  }
};

export const likeComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const like = await commentLikeService.createCommentLike({
      commentId: req.params.commentId as string,
      userId: req.body.userId as string,
      isDeleted: false,
    });
    res.status(201).json(like);
  } catch (error) {
    next(error);
  }
};

export const unlikeComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const like = await commentLikeService.deleteCommentLike(req.body.userId as string, req.params.commentId as string);
    if (!like) {
      res.status(404).json({ message: "Like not found" });
      return;
    }
    res.json({ message: "Like removed" });
  } catch (error) {
    next(error);
  }
};
