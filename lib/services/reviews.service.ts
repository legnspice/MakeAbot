import * as reviewsRepo from "../repo/reviews.repo";
import { sendPushToUser } from "./push.service";
import { FindReviewsSchema, InsertReviewSchema } from "../validation/reviews";

export async function getReviews(filters: FindReviewsSchema) {
  return await reviewsRepo.findReviews(filters);
}

export async function createReview(data: InsertReviewSchema) {
  const result = await reviewsRepo.insertReview(data);
  // fire-and-forget
  sendPushToUser(data.rated_user_id, "new_review", {
    title: "You received a new review",
    body: data.comment ? data.comment.slice(0, 80) : "",
    url: "/profile",
  }).catch(() => {});
  return result;
}

export async function removeReview(id: string, userId: string) {
  return await reviewsRepo.deleteReview(id, userId);
}
