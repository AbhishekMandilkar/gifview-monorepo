import type { Request, Response, NextFunction } from "express";
import * as postLikeService from "../services/postLikeService";

export const getLikesByPost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const likes = await postLikeService.getLikesByPostId(req.params.postId as string);
    res.json(likes);
  } catch (error) {
    next(error);
  }
};

export const likePost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const like = await postLikeService.createPostLike({
      postId: req.params.postId as string,
      userId: req.body.userId as string,
      isDeleted: false,
    });
    res.status(201).json(like);
  } catch (error) {
    next(error);
  }
};

export const unlikePost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const like = await postLikeService.deletePostLike(req.body.userId as string, req.params.postId as string);
    if (!like) {
      res.status(404).json({ message: "Like not found" });
      return;
    }
    res.json({ message: "Like removed" });
  } catch (error) {
    next(error);
  }
};
