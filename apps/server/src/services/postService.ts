import { db, posts, type Post, type PostInsert } from "@gifview-monorepo/db";
import { eq, and, count, or, isNull, inArray, desc } from "drizzle-orm";

// ============================================
// READ OPERATIONS
// ============================================

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

/**
 * Check if a post exists by sourceLink.
 * Used for deduplication in sync handlers.
 */
export const getPostBySourceLink = async (sourceLink: string): Promise<Post | undefined> => {
  return db.query.posts.findFirst({
    where: eq(posts.sourceLink, sourceLink),
  });
};

/**
 * Check if a post exists by sourceKey.
 * Used for deduplication in sync handlers.
 */
export const getPostBySourceKey = async (sourceKey: string): Promise<Post | undefined> => {
  return db.query.posts.findFirst({
    where: eq(posts.sourceKey, sourceKey),
  });
};

/**
 * Check if a post already exists by sourceLink or sourceKey.
 * Returns true if post exists (duplicate), false otherwise.
 * Used for deduplication in sync handlers.
 */
export const checkPostExists = async (sourceLink?: string, sourceKey?: string): Promise<boolean> => {
  if (!sourceLink && !sourceKey) return false;

  const conditions = [];
  if (sourceLink) conditions.push(eq(posts.sourceLink, sourceLink));
  if (sourceKey) conditions.push(eq(posts.sourceKey, sourceKey));

  const existing = await db.query.posts.findFirst({
    where: conditions.length === 1 ? conditions[0] : or(...conditions),
  });

  return Boolean(existing);
};

// ============================================
// WRITE OPERATIONS
// ============================================

export const createPost = async (data: PostInsert): Promise<Post> => {
  const [post] = await db.insert(posts).values(data).returning();
  return post!;
};

/**
 * Create a post if it doesn't already exist (upsert with no update).
 * Returns the created post or null if it already existed.
 * Used by sync handlers to avoid duplicates.
 */
export const createPostIfNotExists = async (data: PostInsert): Promise<Post | null> => {
  const result = await db
    .insert(posts)
    .values(data)
    .onConflictDoNothing()
    .returning();

  return result[0] || null;
};

/**
 * Create multiple posts, skipping any that already exist.
 * Returns array of created posts (excludes skipped duplicates).
 * Used for batch inserts in sync handlers.
 */
export const createPostsBatch = async (dataArray: PostInsert[]): Promise<Post[]> => {
  if (dataArray.length === 0) return [];

  const result = await db
    .insert(posts)
    .values(dataArray)
    .onConflictDoNothing()
    .returning();

  return result;
};

export const updatePost = async (id: string, data: Partial<PostInsert>): Promise<Post | undefined> => {
  const [post] = await db.update(posts).set(data).where(eq(posts.id, id)).returning();
  return post;
};

// ============================================
// DELETE OPERATIONS
// ============================================

/**
 * Soft delete a post by setting isDeleted to true.
 */
export const softDeletePost = async (id: string): Promise<Post | undefined> => {
  const [post] = await db
    .update(posts)
    .set({ isDeleted: true })
    .where(eq(posts.id, id))
    .returning();
  return post;
};

// ============================================
// POST ENRICHMENT OPERATIONS
// ============================================

/**
 * Fetch posts that haven't been enriched yet (aiChecked is null).
 * Used by the post-enrichment scheduler.
 */
export const getUnenrichedPosts = async (
  limit: number = 5
): Promise<Pick<Post, "id" | "title" | "description" | "content">[]> => {
  return db
    .select({
      id: posts.id,
      title: posts.title,
      description: posts.description,
      content: posts.content,
    })
    .from(posts)
    .where(
      and(
        isNull(posts.aiChecked), // Not yet enriched
        eq(posts.isDeleted, false) // Not deleted
      )
    )
    .orderBy(desc(posts.createdDate)) // Most recent first
    .limit(limit);
};

/**
 * Mark posts as enriched by setting aiChecked timestamp.
 * Called after successful enrichment.
 */
export const markPostsAsEnriched = async (postIds: string[]): Promise<void> => {
  if (postIds.length === 0) return;

  await db
    .update(posts)
    .set({ aiChecked: new Date().toISOString() })
    .where(inArray(posts.id, postIds));
};
