"use server";

import { createClient } from "@/lib/supabase/server";
import * as postsService from "@/lib/services/posts.service";
import { handleAction } from "@/lib/error/actions-handler";
import { AppError } from "@/lib/error/app-error";
import {
  FindPostsSchema,
  FindPostBidsSchema,
  InsertPostBidSchema,
  InsertPostSchema,
  UpdatePostSchema,
} from "@/lib/validation/posts";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new AppError("Unauthorized", 401);
  return user;
}

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
    await requireAuth();
    return postsService.createPost(data);
  });
}

export async function createPostBid(data: InsertPostBidSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return postsService.createPostBid(data);
  });
}

export async function removePost(id: string) {
  return await handleAction(async () => {
    await requireAuth();
    return postsService.removePost(id);
  });
}

export async function removePostBid(id: string) {
  return await handleAction(async () => {
    await requireAuth();
    return postsService.removePostBid(id);
  });
}

export async function editPost(id: string, data: UpdatePostSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return postsService.editPost(id, data);
  });
}
