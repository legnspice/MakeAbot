"use client";

import { createClient } from "@/lib/supabase/server";
import { useSupabaseUser } from "@/hooks/use-supabase-user";

export default function DashboardPage() {
  const { supabaseUser } = useSupabaseUser();

  return <div>Welcome, {supabaseUser?.email}</div>;
}
