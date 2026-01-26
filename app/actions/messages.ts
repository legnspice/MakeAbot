"use server";

import * as messagesService from "@/lib/services/messages.service";
import { handleAction } from "@/lib/error/actions-handler";
import {
  FindMessagesSchema,
  InsertMessageSchema,
} from "@/lib/validation/messages";

// TODO: ADD AUTHENTICATION TO SERVER ACTION ENDPOINTS FOR SECURITY (THIS)

export async function getMessages(filters: FindMessagesSchema) {
  return await handleAction(() => messagesService.getMessages(filters));
}

export async function createMessage(data: InsertMessageSchema) {
  return await handleAction(() => messagesService.createMessage(data));
}

export async function removeMessage(id: string) {
  return await handleAction(() => messagesService.removeMessage(id));
}
