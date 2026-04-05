"use server";

import * as reviewsService from "@/lib/services/reviews.service";
import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
import {
  FindReviewsSchema,
  InsertReviewSchema,
} from "@/lib/validation/reviews";

export async function getReviews(filters: FindReviewsSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return reviewsService.getReviews(filters);
  });
}

export async function createReview(data: InsertReviewSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return reviewsService.createReview({ ...data, creator_id: user.id });
  });
}

export async function removeReview(id: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return reviewsService.removeReview(id, user.id);
  });
}
