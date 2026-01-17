import { db, postLikes, type PostLike, type PostLikeInsert } from "@gifview-monorepo/db";
import { eq, and } from "drizzle-orm";

export const getLikesByPostId = async (postId: string): Promise<PostLike[]> => {
  return db.query.postLikes.findMany({
    where: and(eq(postLikes.postId, postId), eq(postLikes.isDeleted, false)),
  });
};

export const getLikeByUserAndPost = async (userId: string, postId: string): Promise<PostLike | undefined> => {
  return db.query.postLikes.findFirst({
    where: and(eq(postLikes.userId, userId), eq(postLikes.postId, postId)),
  });
};

export const createPostLike = async (data: PostLikeInsert): Promise<PostLike> => {
  const [like] = await db.insert(postLikes).values(data).returning();
  return like!;
};

export const deletePostLike = async (userId: string, postId: string): Promise<PostLike | undefined> => {
  // Soft delete by setting isDeleted to true
  const [like] = await db
    .update(postLikes)
    .set({ isDeleted: true })
    .where(and(eq(postLikes.userId, userId), eq(postLikes.postId, postId)))
    .returning();
  return like;
};
