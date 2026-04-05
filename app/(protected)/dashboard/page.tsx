"use client";

import { useAuth } from "@/contexts/auth-context";

export default function DashboardPage() {
  const { userData } = useAuth();

  return <div>Welcome, {userData!.supabaseUser?.email}</div>;
}
