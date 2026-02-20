import { db } from "../db";
import { users } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { FindUserSchema, UpdateUserSchema } from "../validation/users";

export async function findUsers(filters: FindUserSchema) {
  const { id, name } = filters;
  const conditions = [];

  if (id) conditions.push(eq(users.id, id));
  if (name) conditions.push(eq(users.name, name));

  return await db.query.users.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
  });
}

export async function insertUser(id: string) {
  return await db.insert(users).values({ id });
}

export async function updateUser(id: string, data: UpdateUserSchema) {
  return await db.update(users).set(data).where(eq(users.id, id));
}
