"use server";

import * as usersService from "@/lib/services/users.service";
import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { FindUserSchema, UpdateUserSchema } from "@/lib/validation/users";
import { AppError } from "@/lib/error/app-error";
import { resolveMetaAvatar } from "@/lib/avatar";

export async function getUsers(filters: FindUserSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return usersService.getUsers(filters);
  });
}

export async function editUser(id: string, data: UpdateUserSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    if (user.id !== id) throw new AppError("Forbidden", 403);
    return usersService.editUser(id, data);
  });
}

export async function getSupabaseUser() {
  const supabase = await createClient();
  return await supabase.auth.getUser();
}

export async function syncAvatarUrl() {
  return await handleAction(async () => {
    const user = await requireAuth();
    const next = resolveMetaAvatar(user.user_metadata);
    await usersService.syncAvatarUrl(user.id, next);
  });
}

export async function getPublicProfile(userId: string) {
  return await handleAction(async () => {
    const viewer = await requireAuth();
    return usersService.getPublicProfile(viewer.id, userId);
  });
}
