"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthProvider } from "@/contexts/auth-context";

export default function PublicLayout({
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

  if (currentUserDataLoading) {
    return <div>Loading...</div>;
  }

  if (!userData) {
    return null;
  }

  return <AuthProvider userData={userData}>{children}</AuthProvider>;
}
