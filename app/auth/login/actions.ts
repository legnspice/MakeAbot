"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function logout() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/auth/login");
}

import { createClient } from "@/lib/supabase/server";

export async function googleLogin() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    console.error("Sign in error:", error);
    return;
  }

  if (data.url) {
    redirect(data.url);
  }

  revalidatePath("/", "layout");
  redirect("/account");
}
