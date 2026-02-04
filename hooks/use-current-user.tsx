import { useEffect, useState } from "react";
import { getSupabaseUser } from "@/app/actions/users";
import { User } from "@supabase/supabase-js";
import { SelectUser } from "@/lib/db/schema";
import { getUsers } from "@/app/actions/users";

export interface CurrentUserData {
  supabaseUser: User;
  publicUser: SelectUser;
}

export function useCurrentUser() {
  // SUPABASE USER: User from supabase's auth built-in table (notable fields: id, email)
  // PUBLIC USER: User from db table that has custom attributes that are not present in supabase user

  const [userData, setUserData] = useState<CurrentUserData | null>(null);
  const [currentUserDataLoading, setCurrentUserDataLoading] = useState(true);

  useEffect(() => {
    async function loadSupabaseUser() {
      const response = await getSupabaseUser();
      const user = response.data.user;
      // setSupabaseUser(user);

      if (user?.id) {
        // Get database user using supabase user id
        const returnedPublicUser = await getUsers({ id: user.id });

        // Extract the first user from the array if successful
        if (returnedPublicUser.data && returnedPublicUser.data.length > 0) {
          setUserData({
            supabaseUser: user,
            publicUser: returnedPublicUser.data[0],
          });
        }
      }

      setCurrentUserDataLoading(false);
    }
    loadSupabaseUser();
  }, []);

  return {
    userData,
    currentUserDataLoading,
  };
}
