import * as usersRepo from "../repo/users.repo";
import * as notificationsRepo from "../repo/notifications.repo";
import * as relationshipsRepo from "../repo/relationships.repo";
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

export type PublicProfile = {
  id: string;
  name: string | null;
  description: string | null;
  contributions: number;
  avatar_url: string | null;
  phone_number: string | null;
  id_number: number | null;
  related: boolean;
};

export async function getPublicProfile(
  viewerId: string,
  userId: string,
): Promise<PublicProfile | null> {
  const rows = await usersRepo.findUsers({ id: userId });
  const u = rows[0];
  if (!u) return null;
  const related =
    viewerId === userId ||
    (await relationshipsRepo.relationshipExists(viewerId, userId));
  return {
    id: u.id,
    name: u.name,
    description: u.description,
    contributions: u.contributions,
    avatar_url: u.avatar_url,
    // contextual disclosure — private fields only for counterparties (or self)
    phone_number: related ? u.phone_number : null,
    id_number: related ? u.id_number : null,
    related,
  };
}
