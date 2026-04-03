import * as postsRepo from "../repo/posts.repo";
import { posts } from "../db/schema";
import {
  FindPostsSchema,
  FindPostBidsSchema,
  InsertPostBidSchema,
  InsertPostSchema,
  UpdatePostSchema,
} from "../validation/posts";

export async function getPosts(filters: FindPostsSchema) {
  return await postsRepo.findPosts(filters);
}

export async function getPostBids(filters: FindPostBidsSchema) {
  return await postsRepo.findPostBids(filters);
}

export async function createPost(data: InsertPostSchema) {
  return await postsRepo.insertPost(data);
}

export async function createPostBid(data: InsertPostBidSchema) {
  return await postsRepo.insertPostBid(data);
}

export async function removePost(id: string, userId: string) {
  return await postsRepo.deletePost(id, userId);
}

export async function removePostBid(id: string, userId: string) {
  return await postsRepo.deletePostBid(id, userId);
}

export async function editPost(
  id: string,
  data: UpdatePostSchema,
  userId: string,
) {
  const updatePayload: Partial<typeof posts.$inferInsert> = { ...data };

  if (data.status === "Closed") {
    updatePayload.imgUrl = null;
  }

  return await postsRepo.updatePost(id, updatePayload, userId);
}
