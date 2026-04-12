import * as offersRepo from "../repo/offers.repo";
import { offers } from "../db/schema";
import { sendPushToAllUsers } from "./push.service";
import {
  FindOffersSchema,
  FindOfferBidsSchema,
  InsertOfferBidSchema,
  InsertOfferSchema,
  UpdateOfferSchema,
} from "../validation/offers";

export async function getOffers(filters: FindOffersSchema) {
  return await offersRepo.findOffers(filters);
}

export async function getOfferBids(filters: FindOfferBidsSchema) {
  return await offersRepo.findOfferBids(filters);
}

export async function createOffer(data: InsertOfferSchema) {
  const offer = await offersRepo.insertOffer(data);
  if (offer && data.user_id) {
    sendPushToAllUsers(data.user_id, {
      title: "New post available",
      body: data.title,
      url: `/`,
    }).catch(() => {});
  }
  return offer;
}

export async function createOfferBid(data: InsertOfferBidSchema) {
  return await offersRepo.insertOfferBid(data);
}

export async function removeOffer(id: string, userId: string) {
  return await offersRepo.deleteOffer(id, userId);
}

export async function removeOfferBid(id: string, userId: string) {
  return await offersRepo.deleteOfferBid(id, userId);
}

export async function editOffer(
  id: string,
  data: UpdateOfferSchema,
  userId: string,
) {
  const updatePayload: Partial<typeof offers.$inferInsert> = { ...data };
  if (data.status === "Closed") {
    updatePayload.imgUrl = null;
  }
  return await offersRepo.updateOffer(id, updatePayload, userId);
}

export async function closeOffer(id: string, userId: string) {
  await offersRepo.updateOffer(id, { status: "Closed", imgUrl: null }, userId);
  await offersRepo.closeOfferBids(id);
}

export async function completeOfferBid(bidId: string) {
  return await offersRepo.completeOfferBid(bidId);
}

export async function expireStaleOfferBids() {
  return await offersRepo.expireStaleOfferBids();
}
