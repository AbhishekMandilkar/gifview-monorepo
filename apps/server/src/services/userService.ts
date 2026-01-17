import { db, user, type User } from "@gifview-monorepo/db";
import { eq, count } from "drizzle-orm";

export const getAllUsers = async (limit = 50, offset = 0): Promise<{ data: User[]; total: number }> => {
  const [data, countResult] = await Promise.all([
    db.query.user.findMany({ limit, offset }),
    db.select({ total: count() }).from(user),
  ]);
  return { data, total: countResult[0]?.total ?? 0 };
};

export const getUserById = async (id: string): Promise<User | undefined> => {
  return db.query.user.findFirst({
    where: eq(user.id, id),
  });
};

export const updateUser = async (id: string, data: Partial<Omit<User, "id">>): Promise<User | undefined> => {
  const [updated] = await db.update(user).set(data).where(eq(user.id, id)).returning();
  return updated;
};
