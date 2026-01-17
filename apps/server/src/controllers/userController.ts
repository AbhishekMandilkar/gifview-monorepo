import type { Request, Response, NextFunction } from "express";
import * as userService from "../services/userService";

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.pageSize as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await userService.getAllUsers(limit, offset);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await userService.getUserById(req.params.id as string);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await userService.updateUser(req.params.id as string, req.body);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
};
