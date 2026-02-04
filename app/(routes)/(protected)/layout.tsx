"use client";

import { useSupabaseUser } from "@/hooks/use-supabase-user";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Layout level auth requirement for accessing protected pages
export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const { supabaseUser, loading } = useSupabaseUser();

  useEffect(() => {
    if (!loading && !supabaseUser) {
      router.push("/error");
    }
  }, [supabaseUser, loading, router]);

  // Show loading state while checking auth
  if (loading) {
    return <div>Loading...</div>;
  }

  // Show children only if user is authenticated
  if (supabaseUser) {
    return <>{children}</>;
  }

  // Return null while redirecting
  return null;
}
