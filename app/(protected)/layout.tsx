"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthProvider } from "@/contexts/auth-context";

// Layout level auth requirement for accessing protected pages
export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const { userData, currentUserDataLoading } = useCurrentUser();

  useEffect(() => {
    if (!currentUserDataLoading && !userData) {
      router.push("/auth/login");
    }
  }, [userData, currentUserDataLoading, router]);

  // Show loading state while checking auth
  if (currentUserDataLoading) {
    return <div>Authentication Loading...</div>;
  }

  // Redirect handled by useEffect, show nothing while redirecting
  if (!userData) {
    return null;
  }

  // Wrap children with AuthProvider, passing the guaranteed non-null userData
  return <AuthProvider userData={userData}>{children}</AuthProvider>;
}
