import type { Request, Response, NextFunction } from "express";
import * as postCommentService from "../services/postCommentService";

export const getCommentsByPost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.pageSize as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await postCommentService.getCommentsByPostId(req.params.postId as string, limit, offset);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const createComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const comment = await postCommentService.createComment({
      ...req.body,
      postId: req.params.postId as string,
      isDeleted: false,
    });
    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
};

export const updateComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const comment = await postCommentService.updateComment(req.params.id as string, req.body);
    if (!comment) {
      res.status(404).json({ message: "Comment not found" });
      return;
    }
    res.json(comment);
  } catch (error) {
    next(error);
  }
};
