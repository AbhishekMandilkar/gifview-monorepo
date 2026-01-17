import { db, postMedia, type PostMedia, type PostMediaInsert } from "@gifview-monorepo/db";
import { eq, and } from "drizzle-orm";

export const getMediaByPostId = async (postId: string): Promise<PostMedia[]> => {
  return db.query.postMedia.findMany({
    where: and(eq(postMedia.postId, postId), eq(postMedia.isDeleted, false)),
  });
};

export const getMediaById = async (id: string): Promise<PostMedia | undefined> => {
  return db.query.postMedia.findFirst({
    where: and(eq(postMedia.id, id), eq(postMedia.isDeleted, false)),
  });
};

export const createMedia = async (data: PostMediaInsert): Promise<PostMedia> => {
  const [media] = await db.insert(postMedia).values(data).returning();
  return media!;
};

export const updateMedia = async (id: string, data: Partial<PostMediaInsert>): Promise<PostMedia | undefined> => {
  const [media] = await db.update(postMedia).set(data).where(eq(postMedia.id, id)).returning();
  return media;
};
