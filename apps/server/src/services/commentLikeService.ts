import { db, commentLikes, type CommentLike, type CommentLikeInsert } from "@gifview-monorepo/db";
import { eq, and } from "drizzle-orm";

export const getLikesByCommentId = async (commentId: string): Promise<CommentLike[]> => {
  return db.query.commentLikes.findMany({
    where: and(eq(commentLikes.commentId, commentId), eq(commentLikes.isDeleted, false)),
  });
};

export const getLikeByUserAndComment = async (userId: string, commentId: string): Promise<CommentLike | undefined> => {
  return db.query.commentLikes.findFirst({
    where: and(eq(commentLikes.userId, userId), eq(commentLikes.commentId, commentId)),
  });
};

export const createCommentLike = async (data: CommentLikeInsert): Promise<CommentLike> => {
  const [like] = await db.insert(commentLikes).values(data).returning();
  return like!;
};

export const deleteCommentLike = async (userId: string, commentId: string): Promise<CommentLike | undefined> => {
  const [like] = await db
    .update(commentLikes)
    .set({ isDeleted: true })
    .where(and(eq(commentLikes.userId, userId), eq(commentLikes.commentId, commentId)))
    .returning();
  return like;
};
