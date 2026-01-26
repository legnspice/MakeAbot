import * as messagesRepo from "../repo/messages.repo";
import {
  FindMessagesSchema,
  InsertMessageSchema,
} from "../validation/messages";

export async function getMessages(filters: FindMessagesSchema) {
  return await messagesRepo.findMessages(filters);
}

export async function createMessage(data: InsertMessageSchema) {
  return await messagesRepo.insertMessage(data);
}

export async function removeMessage(id: string) {
  return await messagesRepo.deleteMessage(id);
}
