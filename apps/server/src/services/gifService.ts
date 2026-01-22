import { db, gifs, type Gif, type GifInsert } from "@gifview-monorepo/db";
import { eq, count, inArray } from "drizzle-orm";

export const getAllGifs = async (limit = 50, offset = 0): Promise<{ data: Gif[]; total: number }> => {
  const [data, countResult] = await Promise.all([
    db.query.gifs.findMany({ limit, offset }),
    db.select({ total: count() }).from(gifs),
  ]);
  return { data, total: countResult[0]?.total ?? 0 };
};

export const getGifById = async (id: string): Promise<Gif | undefined> => {
  return db.query.gifs.findFirst({
    where: eq(gifs.id, id),
  });
};

export const getGifByPostId = async (postId: string): Promise<Gif | undefined> => {
  return db.query.gifs.findFirst({
    where: eq(gifs.postId, postId),
  });
};

/**
 * Get existing GIF URLs from a list of URLs
 * Used for deduplication when selecting GIFs
 */
export const getExistingGifUrls = async (urls: string[]): Promise<Set<string>> => {
  if (urls.length === 0) return new Set();

  const existingGifs = await db
    .select({ url: gifs.url })
    .from(gifs)
    .where(inArray(gifs.url, urls));

  return new Set(existingGifs.map((g) => g.url));
};

export const createGif = async (data: GifInsert): Promise<Gif> => {
  const [gif] = await db.insert(gifs).values(data).returning();
  return gif!;
};

export const updateGif = async (id: string, data: Partial<GifInsert>): Promise<Gif | undefined> => {
  const [gif] = await db.update(gifs).set(data).where(eq(gifs.id, id)).returning();
  return gif;
};
