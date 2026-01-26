import { and, eq, lte, gte, desc, ilike } from "drizzle-orm";
import { db } from "../db";
import { messages } from "../db/schema";
import { getDayRange } from "./helper";
import {
  FindMessagesSchema,
  InsertMessageSchema,
} from "../validation/messages";

export async function findMessages(filters: FindMessagesSchema) {
  const {
    id,
    sender_id,
    receiver_id,
    request_bid_id,
    post_bid_id,
    content,
    timestamp,
  } = filters;
  const conditions = [];

  // If the filter exists, use the filter for the query.
  if (id) conditions.push(eq(messages.id, id));
  if (sender_id) conditions.push(eq(messages.sender_id, sender_id));
  if (request_bid_id)
    conditions.push(eq(messages.request_bid_id, request_bid_id));
  if (receiver_id) conditions.push(eq(messages.receiver_id, receiver_id));
  if (post_bid_id) conditions.push(eq(messages.post_bid_id, post_bid_id));
  if (content) conditions.push(ilike(messages.content, `%${content}%`));

  //   Selects all messages made in the day in general; TODO: Maybe add more specific ranges(?)
  if (timestamp) {
    const { startOfDay, endOfDay } = getDayRange(timestamp);
    conditions.push(gte(messages.timestamp, startOfDay));
    conditions.push(lte(messages.timestamp, endOfDay));
  }

  return await db.query.messages.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(messages.timestamp)],
  });
}

export async function insertMessage(data: InsertMessageSchema) {
  return await db.insert(messages).values(data);
}

export async function deleteMessage(id: string) {
  return await db.delete(messages).where(eq(messages.id, id));
}
