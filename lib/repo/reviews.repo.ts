import { and, eq, lte, ilike, gte, desc } from "drizzle-orm";
import { db } from "../db";
import { reviews } from "../db/schema";
import { getDayRange } from "./helper";
import {
  FindReviewsSchema,
  InsertReviewSchema,
} from "@/lib/validation/reviews";

export async function findReviews(filters: FindReviewsSchema) {
  const {
    id,
    rated_user_id,
    creator_id,
    request_bid_id,
    post_bid_id,
    comment,
    created_at,
    rating,
  } = filters;

  const conditions = [];

  if (id) conditions.push(eq(reviews.id, id));
  if (rated_user_id) conditions.push(eq(reviews.rated_user_id, rated_user_id));
  if (creator_id) conditions.push(eq(reviews.creator_id, creator_id));
  if (request_bid_id)
    conditions.push(eq(reviews.request_bid_id, request_bid_id));
  if (post_bid_id) conditions.push(eq(reviews.post_bid_id, post_bid_id));
  if (comment) conditions.push(ilike(reviews.comment, `%${comment}%`));
  if (rating) conditions.push(eq(reviews.rating, rating));

  if (created_at) {
    const { startOfDay, endOfDay } = getDayRange(created_at);
    conditions.push(gte(reviews.created_at, startOfDay));
    conditions.push(lte(reviews.created_at, endOfDay));
  }

  return await db.query.reviews.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(reviews.created_at)],
  });
}

export async function insertReview(data: InsertReviewSchema) {
  return await db.insert(reviews).values(data).returning();
}

export async function deleteReview(id: string, userId: string) {
  return await db
    .delete(reviews)
    .where(and(eq(reviews.id, id), eq(reviews.creator_id, userId)));
}
