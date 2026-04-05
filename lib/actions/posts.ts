"use server";

import * as postsService from "@/lib/services/posts.service";
import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
import {
  FindPostsSchema,
  FindPostBidsSchema,
  InsertPostBidSchema,
  InsertPostSchema,
  UpdatePostSchema,
} from "@/lib/validation/posts";

export async function getPosts(filters: FindPostsSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return postsService.getPosts(filters);
  });
}

export async function getPostBids(filters: FindPostBidsSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return postsService.getPostBids(filters);
  });
}

export async function createPost(data: InsertPostSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return postsService.createPost({ ...data, user_id: user.id });
  });
}

export async function createPostBid(data: InsertPostBidSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return postsService.createPostBid({ ...data, bidder_id: user.id });
  });
}

export async function removePost(id: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return postsService.removePost(id, user.id);
  });
}

export async function removePostBid(id: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return postsService.removePostBid(id, user.id);
  });
}

export async function editPost(id: string, data: UpdatePostSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return postsService.editPost(id, data, user.id);
  });
}
