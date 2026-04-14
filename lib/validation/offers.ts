import { z } from "zod";
import { OfferStatusEnum, TypeEnum, BidStatusEnum } from "../db/enums";

export const offerSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  imgUrl: z.string().nullable(),
  price: z.number().int().nonnegative().nullable(),
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
  .partial();

export const insertOfferSchema = offerSchema.pick({
  user_id: true,
  title: true,
  price: true,
  description: true,
  imgUrl: true,
  status: true,
  type: true,
});

export const updateOfferSchema = offerSchema
  .pick({
    price: true,
    title: true,
    description: true,
    status: true,
    imgUrl: true,
    type: true,
  })
  .partial();

export const findOfferBidsSchema = offerBidSchema
  .pick({ id: true, offer_id: true, bidder_id: true, created_at: true })
  .partial();

export const insertOfferBidSchema = offerBidSchema.pick({
  offer_id: true,
  bidder_id: true,
});

export type FindOffersSchema = z.infer<typeof findOffersSchema>;
export type InsertOfferSchema = z.infer<typeof insertOfferSchema>;
export type UpdateOfferSchema = z.infer<typeof updateOfferSchema>;
export type FindOfferBidsSchema = z.infer<typeof findOfferBidsSchema>;
export type InsertOfferBidSchema = z.infer<typeof insertOfferBidSchema>;
