import { db, connectors, type Connector, type ConnectorInsert } from "@gifview-monorepo/db";
import { eq, count } from "drizzle-orm";

export const getAllConnectors = async (limit = 50, offset = 0): Promise<{ data: Connector[]; total: number }> => {
  const [data, countResult] = await Promise.all([
    db.query.connectors.findMany({ limit, offset }),
    db.select({ total: count() }).from(connectors),
  ]);
  return { data, total: countResult[0]?.total ?? 0 };
};

export const getConnectorById = async (id: string): Promise<Connector | undefined> => {
  return db.query.connectors.findFirst({
    where: eq(connectors.id, id),
  });
};

export const createConnector = async (data: ConnectorInsert): Promise<Connector> => {
  const [connector] = await db.insert(connectors).values(data).returning();
  return connector!;
};

export const updateConnector = async (id: string, data: Partial<ConnectorInsert>): Promise<Connector | undefined> => {
  const [connector] = await db.update(connectors).set(data).where(eq(connectors.id, id)).returning();
  return connector;
};
