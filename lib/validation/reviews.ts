import { z } from "zod";

export const reviewsSchema = z.object({
  id: z.string().uuid(),
  rated_user_id: z.string().uuid(),
  creator_id: z.string().uuid(),
  request_bid_id: z.string().uuid().nullable().optional(),
  post_bid_id: z.string().uuid().nullable().optional(),
  comment: z.string().min(1, "Comment is required"),
  created_at: z.date().optional(),
  rating: z.number().int().min(1).max(5),
});

export const insertReviewSchema = reviewsSchema.omit({
  id: true,
  created_at: true,
});

export const findReviewsSchema = reviewsSchema.partial();

export type ReviewSchema = z.infer<typeof reviewsSchema>;
export type FindReviewsSchema = z.infer<typeof findReviewsSchema>;
export type InsertReviewSchema = z.infer<typeof insertReviewSchema>;
