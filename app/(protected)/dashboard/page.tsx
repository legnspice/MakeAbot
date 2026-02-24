"use client";

import { useAuth } from "@/contexts/auth-context";
import { createRequestBid } from "@/lib/actions/requests";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  async function createTest() {
    await createRequestBid({
      request_id: "7c3a3b6e-1026-4b0c-a2b2-bff8e3c9b7db",
      bidder_id: "27e5c51f-d60f-4eff-82cf-2bc7f25df68c",
    });
  }

  const { userData } = useAuth();

  return (
    <>
      <div>Welcome, {userData!.supabaseUser?.email}</div>
      <Button onClick={createTest}>TEST</Button>
    </>
  );
}
