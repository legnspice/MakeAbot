"use server";

import * as usersService from "@/lib/services/users.service";
import { handleAction } from "@/lib/error/actions-handler";
import { FindUserSchema, UpdateUserSchema } from "@/lib/validation/users";

export async function getUsers(filters: FindUserSchema) {
  return await handleAction(() => usersService.getUsers(filters));
}

export async function editUser(id: string, data: UpdateUserSchema) {
  return await handleAction(() => usersService.editUser(id, data));
}
