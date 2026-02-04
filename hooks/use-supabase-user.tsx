import { useEffect, useState } from "react";
import { getSupabaseUser } from "@/app/actions/users";
import { User } from "@supabase/supabase-js";

export function useSupabaseUser() {
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSupabaseUser() {
      const response = await getSupabaseUser();
      setSupabaseUser(response.data.user);
      setLoading(false);
    }
    loadSupabaseUser();
  }, []);

  return { supabaseUser, setSupabaseUser, loading };
}
