import * as usersRepo from "../repo/users.repo";
import { FindUserSchema, UpdateUserSchema } from "../validation/users";

export async function getUsers(filters: FindUserSchema) {
  return await usersRepo.findUsers(filters);
}

export async function createUser(id: string) {
  return await usersRepo.insertUser(id);
}

export async function editUser(id: string, data: UpdateUserSchema) {
  return await usersRepo.updateUser(id, data);
}
