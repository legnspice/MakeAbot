import * as usersRepo from "../repo/users.repo";

export async function getPosts(filters: { name?: string; id?: string }) {
  try {
    return await usersRepo.findUsers(filters);
  } catch (error) {
    console.error("Failed to get users from db: ", error);
    throw error;
  }
}
