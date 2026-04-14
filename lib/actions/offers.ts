"use server";

import * as offersService from "@/lib/services/offers.service";
import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
import {
  FindOffersSchema,
  FindOfferBidsSchema,
  InsertOfferBidSchema,
  InsertOfferSchema,
  UpdateOfferSchema,
} from "@/lib/validation/offers";

export async function getOffers(filters: FindOffersSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return offersService.getOffers(filters);
  });
}

export async function getOfferBids(filters: FindOfferBidsSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return offersService.getOfferBids(filters);
  });
}

export async function createOffer(data: InsertOfferSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return offersService.createOffer({ ...data, user_id: user.id });
  });
}

export async function createOfferBid(data: InsertOfferBidSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return offersService.createOfferBid({ ...data, bidder_id: user.id });
  });
}

export async function removeOffer(id: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return offersService.removeOffer(id, user.id);
  });
}

export async function removeOfferBid(id: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return offersService.removeOfferBid(id, user.id);
  });
}

export async function withdrawOfferBid(bidId: string) {
  return await handleAction(async () => {
    await requireAuth();
    return offersService.withdrawOfferBid(bidId);
  });
}

export async function reopenOfferBid(bidId: string) {
  return await handleAction(async () => {
    await requireAuth();
    return offersService.reopenOfferBid(bidId);
  });
}

export async function editOffer(id: string, data: UpdateOfferSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return offersService.editOffer(id, data, user.id);
  });
}
