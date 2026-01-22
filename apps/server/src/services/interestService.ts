import { db, interests, type Interest, type InterestInsert } from "@gifview-monorepo/db";
import { eq, and, count, inArray } from "drizzle-orm";

// ============================================
// READ OPERATIONS
// ============================================

export const getAllInterests = async (limit = 50, offset = 0): Promise<{ data: Interest[]; total: number }> => {
  const [data, countResult] = await Promise.all([
    db.query.interests.findMany({
      where: eq(interests.isDeleted, false),
      limit,
      offset,
    }),
    db.select({ total: count() }).from(interests).where(eq(interests.isDeleted, false)),
  ]);
  return { data, total: countResult[0]?.total ?? 0 };
};

export const getInterestById = async (id: string): Promise<Interest | undefined> => {
  return db.query.interests.findFirst({
    where: and(eq(interests.id, id), eq(interests.isDeleted, false)),
  });
};

export const getInterestsByDepth = async (depth: string, limit = 50, offset = 0): Promise<{ data: Interest[]; total: number }> => {
  const whereClause = and(eq(interests.depth, depth), eq(interests.isDeleted, false));
  const [data, countResult] = await Promise.all([
    db.query.interests.findMany({ where: whereClause, limit, offset }),
    db.select({ total: count() }).from(interests).where(whereClause!),
  ]);
  return { data, total: countResult[0]?.total ?? 0 };
};

export const getInterestsByParentId = async (parentId: string): Promise<Interest[]> => {
  return db.query.interests.findMany({
    where: and(eq(interests.parentId, parentId), eq(interests.isDeleted, false)),
  });
};

/**
 * Get active interests by depth level, optionally filtered by parent IDs.
 * Used for hierarchical interest suggestion.
 */
export const getActiveInterestsByDepth = async (
  depth: string,
  parentIds?: string[]
): Promise<Pick<Interest, "id" | "nameEn">[]> => {
  const conditions = [
    eq(interests.active, true),
    eq(interests.depth, depth),
    eq(interests.isDeleted, false),
  ];

  // Add parent filter for sub/subsub levels
  if (parentIds && parentIds.length > 0) {
    conditions.push(inArray(interests.parentId, parentIds));
  }

  return db
    .select({
      id: interests.id,
      nameEn: interests.nameEn,
    })
    .from(interests)
    .where(and(...conditions));
};

// ============================================
// WRITE OPERATIONS
// ============================================

export const createInterest = async (data: InterestInsert): Promise<Interest> => {
  const [interest] = await db.insert(interests).values(data).returning();
  return interest!;
};

export const updateInterest = async (id: string, data: Partial<InterestInsert>): Promise<Interest | undefined> => {
  const [interest] = await db.update(interests).set(data).where(eq(interests.id, id)).returning();
  return interest;
};
