import * as usersRepo from "../repo/users.repo";
import * as notificationsRepo from "../repo/notifications.repo";
import { FindUserSchema, UpdateUserSchema } from "../validation/users";
import { avatarNeedsSync } from "../avatar";

export async function getUsers(filters: FindUserSchema) {
  return await usersRepo.findUsers(filters);
}

export async function createUser(id: string) {
  await usersRepo.insertUser(id);
  await notificationsRepo.insertDefaultPreferences(id);
}

export async function editUser(id: string, data: UpdateUserSchema) {
  return await usersRepo.updateUser(id, data);
}

export async function syncAvatarUrl(id: string, next: string | null) {
  const rows = await usersRepo.findUsers({ id });
  const stored = rows[0]?.avatar_url ?? null;
  if (!avatarNeedsSync(stored, next)) return;
  await usersRepo.updateUser(id, { avatar_url: next });
}
