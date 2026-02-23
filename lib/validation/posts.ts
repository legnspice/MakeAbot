import { z } from "zod";
import { PostStatusEnum } from "../validation/enums";

export const postSchema = z.object({
  id: z.string().uuid({}),
  user_id: z.string().uuid({}),
  imgUrl: z.string().nullable(),
  price: z.number().int().nonnegative().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  created_at: z.date(),
  status: PostStatusEnum.optional(),
});

export const postBidSchema = z.object({
  id: z.string().uuid({}),
  post_id: z.string().uuid({}),
  bidder_id: z.string().uuid({}),
  created_at: z.date(),
});

export const findPostsSchema = postSchema
  .pick({
    id: true,
    user_id: true,
    price: true,
    title: true,
    status: true,
    created_at: true,
  })
  .partial();

export const insertPostSchema = postSchema.pick({
  user_id: true,
  title: true,
  price: true,
  description: true,
  imgUrl: true,
  status: true,
});

export const updatePostSchema = postSchema
  .pick({
    price: true,
    title: true,
    description: true,
    status: true,
  })
  .partial();

export const findPostBidsSchema = postBidSchema
  .pick({
    id: true,
    post_id: true,
    bidder_id: true,
    created_at: true,
  })
  .partial();

export const insertPostBidSchema = postBidSchema.pick({
  post_id: true,
  bidder_id: true,
});

export type FindPostsSchema = z.infer<typeof findPostsSchema>;
export type InsertPostSchema = z.infer<typeof insertPostSchema>;
export type UpdatePostSchema = z.infer<typeof updatePostSchema>;
export type FindPostBidsSchema = z.infer<typeof findPostBidsSchema>;
export type InsertPostBidSchema = z.infer<typeof insertPostBidSchema>;
