import { z } from "zod";

export const messageSchema = z.object({
  id: z.string().uuid({}),
  sender_id: z.string().uuid({}),
  receiver_id: z.string().uuid({}),
  request_bid_id: z.string().uuid({}).nullable(),
  offer_bid_id: z.string().uuid({}).nullable(),
  content: z.string().min(1, "Content cannot be empty"),
  timestamp: z.date(),
  is_read: z.boolean(),
});

export const insertMessageSchema = messageSchema
  .omit({ id: true, timestamp: true, is_read: true })
  .extend({
    request_bid_id: z.string().uuid({}).nullable().optional(),
    offer_bid_id: z.string().uuid({}).nullable().optional(),
  });

export const findMessagesSchema = messageSchema
  .pick({
    id: true,
    sender_id: true,
    receiver_id: true,
    request_bid_id: true,
    offer_bid_id: true,
    content: true,
    timestamp: true,
  })
  .partial();

export const findConversationSchema = z.object({
  user1_id: z.string().uuid({}),
  user2_id: z.string().uuid({}),
  request_bid_id: z.string().uuid({}).nullable(),
  offer_bid_id: z.string().uuid({}).nullable(),
});

export type MessageSchema = z.infer<typeof messageSchema>;
export type FindConversationSchema = z.infer<typeof findConversationSchema>;
export type FindMessagesSchema = z.infer<typeof findMessagesSchema>;
export type InsertMessageSchema = z.infer<typeof insertMessageSchema>;
