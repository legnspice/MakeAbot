"use server";

import { createClient } from "@/lib/supabase/server";
import * as messagesService from "@/lib/services/messages.service";
import { handleAction } from "@/lib/error/actions-handler";
import { AppError } from "@/lib/error/app-error";
import {
  FindConversationSchema,
  FindMessagesSchema,
  InsertMessageSchema,
} from "@/lib/validation/messages";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new AppError("Unauthorized", 401);
  return user;
}

export async function getMessages(filters: FindMessagesSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return messagesService.getMessages(filters);
  });
}

export async function getConversation(filters: FindConversationSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return messagesService.getConversation(filters);
  });
}

export async function createMessage(data: InsertMessageSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return messagesService.createMessage(data);
  });
}

export async function removeMessage(id: string) {
  return await handleAction(async () => {
    await requireAuth();
    return messagesService.removeMessage(id);
  });
}
