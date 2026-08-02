import { z } from "zod";
import { UrgencyEnum, RequestStatusEnum, TypeEnum } from "../db/enums";
import { PRICE_CAP } from "../constants";
import { incentiveOverCap } from "../incentive";

export const requestSchema = z.object({
  id: z.string().uuid({}),
  user_id: z.string().uuid({}),
  imgUrl: z.string().nullable(),
  fee: z.number().int().nonnegative().nullable(),
  incentive: z
    .string()
    .max(60)
    .nullable()
    .refine((s) => !incentiveOverCap(s), {
      message: `Please keep incentives at ₱${PRICE_CAP} or under.`,
    }),
  title: z.string().min(1),
  description: z.string().nullable(),
  created_at: z.date(),
  completed_at: z.date().nullable(),
  urgency: UrgencyEnum,
  type: TypeEnum.optional(),
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
  incentive: true,
  status: true,
  description: true,
  urgency: true,
  imgUrl: true,
  type: true,
});

export const updateRequestSchema = requestSchema
  .pick({
    incentive: true,
    title: true,
    description: true,
    status: true,
    urgency: true,
    completed_at: true,
    imgUrl: true,
    type: true,
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
