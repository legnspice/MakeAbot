"use client";

import { createContext, useContext, ReactNode } from "react";
import { CurrentUserData } from "@/hooks/use-current-user";

interface AuthContextType {
  userData: CurrentUserData;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  userData: CurrentUserData;
}

export function AuthProvider({ children, userData }: AuthProviderProps) {
  // userData is guaranteed to be non-null when this is rendered
  return (
    <AuthContext.Provider value={{ userData }}>{children}</AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
