import { z } from "zod";
import { UrgencyEnum, RequestStatusEnum } from "../validation/enums";

export const requestSchema = z.object({
  id: z.string().uuid({}),
  user_id: z.string().uuid({}),
  fee: z.number().int().nonnegative().nullable(),
  title: z.string().min(1),
  description: z.string().nullable(),
  created_at: z.date(),
  completed_at: z.date().nullable(),
  urgency: UrgencyEnum,
  status: RequestStatusEnum,
});

export const requestBidSchema = z.object({
  id: z.string().uuid({}),
  request_id: z.string().uuid({}),
  bidder_id: z.string().uuid({}),
  created_at: z.date(),
});

export const findRequestsSchema = requestSchema
  .pick({
    id: true,
    user_id: true,
    fee: true,
    title: true,
    status: true,
    urgency: true,
    created_at: true,
  })
  .partial();

export const insertRequestSchema = requestSchema.pick({
  user_id: true,
  title: true,
  fee: true,
  status: true,
  description: true,
  urgency: true,
});

export const updateRequestSchema = requestSchema
  .pick({
    fee: true,
    title: true,
    description: true,
    status: true,
    urgency: true,
    completed_at: true,
  })
  .partial();

export const findRequestBidsSchema = requestBidSchema
  .pick({
    id: true,
    request_id: true,
    bidder_id: true,
    created_at: true,
  })
  .partial();

export const insertRequestBidSchema = requestBidSchema.pick({
  request_id: true,
  bidder_id: true,
});

export type FindRequestsSchema = z.infer<typeof findRequestsSchema>;
export type InsertRequestSchema = z.infer<typeof insertRequestSchema>;
export type UpdateRequestSchema = z.infer<typeof updateRequestSchema>;
export type FindRequestBidsSchema = z.infer<typeof findRequestBidsSchema>;
export type InsertRequestBidSchema = z.infer<typeof insertRequestBidSchema>;
