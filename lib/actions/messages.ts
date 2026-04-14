"use server";

import * as messagesService from "@/lib/services/messages.service";
import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
import {
  FindConversationSchema,
  FindMessagesSchema,
  InsertMessageSchema,
} from "@/lib/validation/messages";

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
    const user = await requireAuth();
    return messagesService.createMessage({ ...data, sender_id: user.id });
  });
}

export async function getLatestTimestampsForBids(
  offerBidIds: string[],
  requestBidIds: string[],
) {
  return await handleAction(async () => {
    await requireAuth();
    return messagesService.getLatestTimestampsForBids(
      offerBidIds,
      requestBidIds,
    );
  });
}

export async function removeMessage(id: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return messagesService.removeMessage(id, user.id);
  });
}
