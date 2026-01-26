import { and, eq, lte, ilike, gte, desc } from "drizzle-orm";
import { db } from "../db";
import { posts, post_bids } from "../db/schema";
import { getDayRange } from "./helper";
import {
  FindPostsSchema,
  FindPostBidsSchema,
  InsertPostBidSchema,
  InsertPostSchema,
  UpdatePostSchema,
} from "../validation/posts";

export async function findPosts(filters: FindPostsSchema) {
  const { id, user_id, price, title, status, created_at } = filters;
  const conditions = [];

  // If the filter exists, use the filter for the query.
  if (id) conditions.push(eq(posts.id, id));
  if (user_id) conditions.push(eq(posts.user_id, user_id));
  if (price) conditions.push(lte(posts.price, price));
  if (status) conditions.push(eq(posts.status, status));
  if (title) conditions.push(ilike(posts.title, `%${title}%`));
  if (created_at) {
    const { startOfDay, endOfDay } = getDayRange(created_at);
    conditions.push(gte(posts.created_at, startOfDay));
    conditions.push(lte(posts.created_at, endOfDay));
  }

  return await db.query.posts.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(posts.created_at)],
  });
}

export async function findPostBids(filters: FindPostBidsSchema) {
  const { id, post_id, bidder_id, created_at } = filters;
  const conditions = [];

  if (id) conditions.push(eq(post_bids.id, id));
  if (post_id) conditions.push(eq(post_bids.post_id, post_id));
  if (bidder_id) conditions.push(eq(post_bids.bidder_id, bidder_id));
  if (created_at) {
    const { startOfDay, endOfDay } = getDayRange(created_at);
    conditions.push(gte(post_bids.created_at, startOfDay));
    conditions.push(lte(post_bids.created_at, endOfDay));
  }

  return await db.query.post_bids.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(post_bids.created_at)],
  });
}

export async function insertPost(data: InsertPostSchema) {
  return await db.insert(posts).values(data);
}

export async function insertPostBid(data: InsertPostBidSchema) {
  return await db.insert(post_bids).values(data);
}

export async function deletePost(id: string) {
  return await db.delete(posts).where(eq(posts.id, id));
}

export async function deletePostBid(id: string) {
  return await db.delete(post_bids).where(eq(post_bids.id, id));
}

export async function updatePost(id: string, data: UpdatePostSchema) {
  return await db.update(posts).set(data).where(eq(posts.id, id));
}
