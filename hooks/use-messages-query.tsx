// hooks/use-messages-query.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { getMessages } from "@/app/actions/messages";
import type { FindMessagesSchema } from "@/lib/validation/messages";

export function useMessagesQuery(filters: FindMessagesSchema) {
  return useQuery({
    queryKey: ["messages", filters],
    queryFn: () => getMessages(filters),
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60,
  });
}
