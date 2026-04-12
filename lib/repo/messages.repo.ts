import {
  and,
  eq,
  lte,
  gte,
  desc,
  ilike,
  asc,
  or,
  inArray,
  max,
  count,
} from "drizzle-orm";
import { db } from "../db";
import { messages } from "../db/schema";
import { getDayRange } from "./helper";
import {
  FindMessagesSchema,
  InsertMessageSchema,
  FindConversationSchema,
} from "../validation/messages";

export async function findConversation(filters: FindConversationSchema) {
  const { user1_id, user2_id, request_bid_id, offer_bid_id } = filters;
  const conditions = [];

  // Messages between these two users
  conditions.push(
    or(
      and(eq(messages.sender_id, user1_id), eq(messages.receiver_id, user2_id)),
      and(eq(messages.sender_id, user2_id), eq(messages.receiver_id, user1_id)),
    ),
  );

  if (request_bid_id) {
    conditions.push(eq(messages.request_bid_id, request_bid_id));
  } else if (offer_bid_id) {
    conditions.push(eq(messages.offer_bid_id, offer_bid_id));
  }

  return await db.query.messages.findMany({
    where: and(...conditions),
    orderBy: [asc(messages.timestamp)], // Oldest first for chat display
  });
}

export async function findMessages(filters: FindMessagesSchema) {
  const {
    id,
    sender_id,
    receiver_id,
    request_bid_id,
    offer_bid_id,
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
  if (offer_bid_id) conditions.push(eq(messages.offer_bid_id, offer_bid_id));
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

/** Returns a map of bidId → latest timestamp for the given bid IDs. */
export async function findLatestTimestampsForBids(
  offerBidIds: string[],
  requestBidIds: string[],
): Promise<Map<string, Date>> {
  const result = new Map<string, Date>();

  const [offerRows, reqRows] = await Promise.all([
    offerBidIds.length > 0
      ? db
          .select({
            bidId: messages.offer_bid_id,
            latest: max(messages.timestamp),
          })
          .from(messages)
          .where(inArray(messages.offer_bid_id, offerBidIds))
          .groupBy(messages.offer_bid_id)
      : [],
    requestBidIds.length > 0
      ? db
          .select({
            bidId: messages.request_bid_id,
            latest: max(messages.timestamp),
          })
          .from(messages)
          .where(inArray(messages.request_bid_id, requestBidIds))
          .groupBy(messages.request_bid_id)
      : [],
  ]);

  for (const row of [...offerRows, ...reqRows]) {
    if (row.bidId && row.latest) result.set(row.bidId, row.latest);
  }

  return result;
}

/** Returns true if userId has sent at least one message in the given thread. */
export async function hasUserSentMessageInThread(
  userId: string,
  field: "request_bid_id" | "offer_bid_id",
  threadId: string,
): Promise<boolean> {
  const result = await db
    .select({ value: count() })
    .from(messages)
    .where(
      and(
        eq(messages.sender_id, userId),
        field === "request_bid_id"
          ? eq(messages.request_bid_id, threadId)
          : eq(messages.offer_bid_id, threadId),
      ),
    );
  return (result[0]?.value ?? 0) > 0;
}

export async function deleteMessage(id: string, userId: string) {
  return await db
    .delete(messages)
    .where(and(eq(messages.id, id), eq(messages.sender_id, userId)));
}
