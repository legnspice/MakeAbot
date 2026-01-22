import { db } from "../db";
import { users } from "../db/schema";
import { eq, and } from "drizzle-orm";

export async function findUsers(filters: { name?: string; id?: string }) {
  const { id, name } = filters;
  const conditions = [];

  if (id) conditions.push(eq(users.id, id));
  if (name) conditions.push(eq(users.name, name));

  return await db.query.posts.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
  });
}
