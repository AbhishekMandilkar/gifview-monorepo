import { db, post2Interest, type Post2Interest, type Post2InterestInsert } from "@gifview-monorepo/db";
import { eq, and } from "drizzle-orm";

// ============================================
// READ OPERATIONS
// ============================================

export const getPost2InterestsByPostId = async (postId: string): Promise<Post2Interest[]> => {
  return db.query.post2Interest.findMany({
    where: and(eq(post2Interest.postId, postId), eq(post2Interest.isDeleted, false)),
  });
};

export const getPost2InterestsByInterestId = async (interestId: string): Promise<Post2Interest[]> => {
  return db.query.post2Interest.findMany({
    where: and(eq(post2Interest.interestId, interestId), eq(post2Interest.isDeleted, false)),
  });
};

// ============================================
// WRITE OPERATIONS
// ============================================

export const createPost2Interest = async (data: Post2InterestInsert): Promise<Post2Interest> => {
  const [result] = await db.insert(post2Interest).values(data).returning();
  return result!;
};

/**
 * Create multiple post2interest records in batch.
 * Used during post enrichment to link posts to multiple interests.
 */
export const createPost2InterestBatch = async (
  dataArray: Post2InterestInsert[]
): Promise<Post2Interest[]> => {
  if (dataArray.length === 0) return [];

  const result = await db
    .insert(post2Interest)
    .values(dataArray)
    .onConflictDoNothing()
    .returning();

  return result;
};

/**
 * Create post2interest records for a single post with multiple interests.
 * Convenience method for post enrichment.
 */
export const linkPostToInterests = async (
  postId: string,
  interestIds: string[]
): Promise<Post2Interest[]> => {
  if (interestIds.length === 0) return [];

  const dataArray: Post2InterestInsert[] = interestIds.map((interestId) => ({
    postId,
    interestId,
    isDeleted: false,
  }));

  return createPost2InterestBatch(dataArray);
};
