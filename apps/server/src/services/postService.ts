import { db, posts, type Post, type PostInsert } from "@gifview-monorepo/db";
import { eq, and, count } from "drizzle-orm";

export const getAllPosts = async (limit = 50, offset = 0): Promise<{ data: Post[]; total: number }> => {
  const [data, countResult] = await Promise.all([
    db.query.posts.findMany({
      where: eq(posts.isDeleted, false),
      limit,
      offset,
    }),
    db.select({ total: count() }).from(posts).where(eq(posts.isDeleted, false)),
  ]);
  return { data, total: countResult[0]?.total ?? 0 };
};

export const getPostById = async (id: string): Promise<Post | undefined> => {
  return db.query.posts.findFirst({
    where: and(eq(posts.id, id), eq(posts.isDeleted, false)),
  });
};

export const getPostsByConnectorId = async (connectorId: string): Promise<Post[]> => {
  return db.query.posts.findMany({
    where: and(eq(posts.connectorId, connectorId), eq(posts.isDeleted, false)),
  });
};

export const createPost = async (data: PostInsert): Promise<Post> => {
  const [post] = await db.insert(posts).values(data).returning();
  return post!;
};

export const updatePost = async (id: string, data: Partial<PostInsert>): Promise<Post | undefined> => {
  const [post] = await db.update(posts).set(data).where(eq(posts.id, id)).returning();
  return post;
};
