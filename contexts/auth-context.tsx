"use client";

import { createContext, useContext, ReactNode, useMemo, useEffect } from "react";
import { CurrentUserData } from "@/hooks/use-current-user";
import { syncAvatarUrl } from "@/lib/actions/users";
import { resolveMetaAvatar, avatarNeedsSync } from "@/lib/avatar";

interface AuthContextType {
  userData: CurrentUserData;
}

interface AuthProviderProps {
  children: ReactNode;
  userData: CurrentUserData;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children, userData }: AuthProviderProps) {
  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({ userData }), [userData]);

  // Mirror the auth-metadata avatar into users.avatar_url, and backfill a missing
  // display name, when either has drifted. The compare uses data already in memory
  // (no DB read); the server action fires fire-and-forget only when there's real work
  // (first-login backfill, a new Google photo, or a legacy row whose name is still null).
  useEffect(() => {
    const next = resolveMetaAvatar(userData.supabaseUser.user_metadata);
    if (
      avatarNeedsSync(userData.publicUser.avatar_url, next) ||
      !userData.publicUser.name
    ) {
      void syncAvatarUrl();
    }
  }, [userData]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
