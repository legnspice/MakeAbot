"use server";

import * as postsService from "@/lib/services/posts.service";
import { handleAction } from "@/lib/error/actions-handler";
import {
  FindPostsSchema,
  FindPostBidsSchema,
  InsertPostBidSchema,
  InsertPostSchema,
  UpdatePostSchema,
} from "@/lib/validation/posts";

// TODO: ADD AUTHENTICATION TO SERVER ACTION ENDPOINTS FOR SECURITY (THIS)

export async function getPosts(filters: FindPostsSchema) {
  return await handleAction(() => postsService.getPosts(filters));
}

export async function getPostBids(filters: FindPostBidsSchema) {
  return await handleAction(() => postsService.getPostBids(filters));
}

export async function createPost(data: InsertPostSchema) {
  return await handleAction(() => postsService.createPost(data));
}

export async function createPostBid(data: InsertPostBidSchema) {
  return await handleAction(() => postsService.createPostBid(data));
}

export async function removePost(id: string) {
  return await handleAction(() => postsService.removePost(id));
}

export async function removePostBid(id: string) {
  return await handleAction(() => postsService.removePostBid(id));
}

export async function editPost(id: string, data: UpdatePostSchema) {
  return await postsService.editPost(id, data);
}
