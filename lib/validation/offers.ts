import { z } from "zod";
import { OfferStatusEnum, TypeEnum, BidStatusEnum } from "../db/enums";
import { PRICE_CAP } from "../constants";
import { incentiveOverCap } from "../incentive";

export const offerSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  imgUrl: z.string().nullable(),
  price: z.number().int().nonnegative().nullable(),
  incentive: z
    .string()
    .max(60)
    .nullable()
    .refine((s) => !incentiveOverCap(s), {
      message: `Please keep incentives at ₱${PRICE_CAP} or under.`,
    }),
  title: z.string(),
  description: z.string().nullable(),
  created_at: z.date(),
  type: TypeEnum.optional(),
  status: OfferStatusEnum.optional(),
});

export const offerBidSchema = z.object({
  id: z.string().uuid(),
  offer_id: z.string().uuid(),
  bidder_id: z.string().uuid(),
  created_at: z.date(),
  status: BidStatusEnum.optional(),
});

export const findOffersSchema = offerSchema
  .pick({
    id: true,
    user_id: true,
    price: true,
    title: true,
    status: true,
    created_at: true,
  })
  .partial()
  .extend({ ids: z.array(z.string().uuid()).optional() });

export const insertOfferSchema = offerSchema.pick({
  user_id: true,
  title: true,
  incentive: true,
  description: true,
  imgUrl: true,
  status: true,
  type: true,
});

export const updateOfferSchema = offerSchema
  .pick({
    incentive: true,
    title: true,
    description: true,
    status: true,
    imgUrl: true,
    type: true,
  })
  .partial();

export const findOfferBidsSchema = offerBidSchema
  .pick({ id: true, offer_id: true, bidder_id: true, created_at: true })
  .partial()
  .extend({ offer_ids: z.array(z.string().uuid()).optional() });

export const insertOfferBidSchema = offerBidSchema.pick({
  offer_id: true,
  bidder_id: true,
});

export type FindOffersSchema = z.infer<typeof findOffersSchema>;
export type InsertOfferSchema = z.infer<typeof insertOfferSchema>;
export type UpdateOfferSchema = z.infer<typeof updateOfferSchema>;
export type FindOfferBidsSchema = z.infer<typeof findOfferBidsSchema>;
export type InsertOfferBidSchema = z.infer<typeof insertOfferBidSchema>;
