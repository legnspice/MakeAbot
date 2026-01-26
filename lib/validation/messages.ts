import { z } from "zod";

export const messageSchema = z.object({
  id: z.string().uuid({}),
  sender_id: z.string().uuid({}),
  receiver_id: z.string().uuid({}),
  request_bid_id: z.string().uuid({}).nullable(),
  post_bid_id: z.string().uuid({}).nullable(),
  content: z.string().min(1, "Content cannot be empty"),
  timestamp: z.date(),
  is_read: z.boolean(),
});

export const insertMessageSchema = messageSchema
  .omit({ id: true, timestamp: true, is_read: true })
  .extend({
    request_bid_id: z.string().uuid({}).optional(),
    post_bid_id: z.string().uuid({}).optional(),
  });

export const findMessagesSchema = messageSchema
  .pick({
    id: true,
    sender_id: true,
    receiver_id: true,
    request_bid_id: true,
    post_bid_id: true,
    content: true,
    timestamp: true,
  })
  .partial();

export type FindMessagesSchema = z.infer<typeof findMessagesSchema>;
export type InsertMessageSchema = z.infer<typeof insertMessageSchema>;
