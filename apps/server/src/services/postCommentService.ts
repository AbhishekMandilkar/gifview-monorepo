import { db, postComments, type PostComment, type PostCommentInsert } from "@gifview-monorepo/db";
import { eq, and, count } from "drizzle-orm";

export const getCommentsByPostId = async (postId: string, limit = 50, offset = 0): Promise<{ data: PostComment[]; total: number }> => {
  const whereClause = and(eq(postComments.postId, postId), eq(postComments.isDeleted, false));
  const [data, countResult] = await Promise.all([
    db.query.postComments.findMany({ where: whereClause, limit, offset }),
    db.select({ total: count() }).from(postComments).where(whereClause!),
  ]);
  return { data, total: countResult[0]?.total ?? 0 };
};

export const getCommentById = async (id: string): Promise<PostComment | undefined> => {
  return db.query.postComments.findFirst({
    where: and(eq(postComments.id, id), eq(postComments.isDeleted, false)),
  });
};

export const getRepliesByCommentId = async (parentId: string): Promise<PostComment[]> => {
  return db.query.postComments.findMany({
    where: and(eq(postComments.parentId, parentId), eq(postComments.isDeleted, false)),
  });
};

export const createComment = async (data: PostCommentInsert): Promise<PostComment> => {
  const [comment] = await db.insert(postComments).values(data).returning();
  return comment!;
};

export const updateComment = async (id: string, data: Partial<PostCommentInsert>): Promise<PostComment | undefined> => {
  const [comment] = await db.update(postComments).set(data).where(eq(postComments.id, id)).returning();
  return comment;
};
