"use server";

import { createClient } from "@/lib/supabase/server";
import * as usersService from "@/lib/services/users.service";
import { handleAction } from "@/lib/error/actions-handler";
import { AppError } from "@/lib/error/app-error";
import { FindUserSchema, UpdateUserSchema } from "@/lib/validation/users";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new AppError("Unauthorized", 401);
  return user;
}

export async function getUsers(filters: FindUserSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return usersService.getUsers(filters);
  });
}

export async function editUser(id: string, data: UpdateUserSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return usersService.editUser(id, data);
  });
}

export async function getSupabaseUser() {
  const supabase = await createClient();
  return await supabase.auth.getUser();
}
