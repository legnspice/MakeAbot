"use server";

import { createClient } from "@/lib/supabase/server";
import * as reviewsService from "@/lib/services/reviews.service";
import { handleAction } from "@/lib/error/actions-handler";
import {
  FindReviewsSchema,
  InsertReviewSchema,
} from "@/lib/validation/reviews";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user;
}

export async function getReviews(filters: FindReviewsSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return reviewsService.getReviews(filters);
  });
}

export async function createReview(data: InsertReviewSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return reviewsService.createReview(data);
  });
}

export async function removeReview(id: string) {
  return await handleAction(async () => {
    await requireAuth();
    return reviewsService.removeReview(id);
  });
}
