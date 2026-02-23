"use server";

import * as reviewsService from "@/lib/services/reviews.service";
import { handleAction } from "@/lib/error/actions-handler";
import {
  FindReviewsSchema,
  InsertReviewSchema,
} from "@/lib/validation/reviews";

// TODO: ADD AUTHENTICATION TO SERVER ACTION ENDPOINTS FOR SECURITY (THIS)

export async function getMessages(filters: FindReviewsSchema) {
  return await handleAction(() => reviewsService.getReviews(filters));
}

export async function createReview(data: InsertReviewSchema) {
  return await handleAction(() => reviewsService.createReview(data));
}

export async function removeReview(id: string) {
  return await handleAction(() => reviewsService.removeReview(id));
}
