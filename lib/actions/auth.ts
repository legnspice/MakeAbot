import { createClient } from "@/lib/supabase/server";
import * as usersRepo from "@/lib/repo/users.repo";
import { AppError } from "@/lib/error/app-error";

export async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  const rows = await usersRepo.findUsers({ id: user.id });
  if (!rows[0]?.is_admin) throw new AppError("Forbidden", 403);
  return user;
}
