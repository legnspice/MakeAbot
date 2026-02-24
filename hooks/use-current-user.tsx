import { useEffect, useState, useMemo } from "react";
import { getSupabaseUser } from "@/lib/actions/users";
import { User } from "@supabase/supabase-js";
import { SelectUser } from "@/lib/db/schema";
import { getUsers } from "@/lib/actions/users";

export interface CurrentUserData {
  supabaseUser: User;
  publicUser: SelectUser;
}

export function useCurrentUser() {
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [publicUser, setPublicUser] = useState<SelectUser | null>(null);
  const [currentUserDataLoading, setCurrentUserDataLoading] = useState(true);

  useEffect(() => {
    async function loadSupabaseUser() {
      const response = await getSupabaseUser();
      const user = response.data.user;

      if (user?.id) {
        const returnedPublicUser = await getUsers({ id: user.id });

        if (returnedPublicUser.data && returnedPublicUser.data.length > 0) {
          setSupabaseUser(user);
          setPublicUser(returnedPublicUser.data[0]);
        }
      }

      setCurrentUserDataLoading(false);
    }
    loadSupabaseUser();
  }, []);

  // Memoize the userData object so it has a stable reference
  const userData = useMemo(() => {
    if (!supabaseUser || !publicUser) return null;
    return {
      supabaseUser,
      publicUser,
    };
  }, [supabaseUser, publicUser]);

  return {
    userData,
    currentUserDataLoading,
  };
}
