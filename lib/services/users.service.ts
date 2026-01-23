import * as usersRepo from "../repo/users.repo";

export async function getPosts(filters: { name?: string; id?: string }) {
  try {
    return await usersRepo.findUsers(filters);
  } catch (error) {
    console.error("Failed to get users from db: ", error);
    throw error;
  }
}

export async function editUser(
  id: string,
  data: {
    name?: string;
    phone_number?: string;
  },
) {
  try {
    return await usersRepo.updateUser(id, data);
  } catch (error) {
    console.error("Failed to update users from db: ", error);
    throw error;
  }
}
