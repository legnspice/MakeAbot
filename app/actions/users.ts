"use server";
import { createClient } from "@/lib/supabase/server";

import * as usersService from "@/lib/services/users.service";
import { handleAction } from "@/lib/error/actions-handler";
import { FindUserSchema, UpdateUserSchema } from "@/lib/validation/users";

export async function getUsers(filters: FindUserSchema) {
  return await handleAction(() => usersService.getUsers(filters));
}

export async function editUser(id: string, data: UpdateUserSchema) {
  return await handleAction(() => usersService.editUser(id, data));
}

export async function createUser(id: string) {
  return await handleAction(() => usersService.createUser(id));
}

export async function getSupabaseUser() {
  const supabase = await createClient();
  return await supabase.auth.getUser();
}
