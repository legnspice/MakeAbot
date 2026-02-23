import * as reviewsRepo from "../repo/reviews.repo";
import { FindReviewsSchema, InsertReviewSchema } from "../validation/reviews";

export async function getReviews(filters: FindReviewsSchema) {
  return await reviewsRepo.findReviews(filters);
}

export async function createReview(data: InsertReviewSchema) {
  return await reviewsRepo.insertReview(data);
}

export async function removeReview(id: string) {
  return await reviewsRepo.deleteReview(id);
}
