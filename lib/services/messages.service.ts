import * as messagesRepo from "../repo/messages.repo";
import { sendPushToUser } from "./push.service";
import {
  FindMessagesSchema,
  InsertMessageSchema,
  FindConversationSchema,
} from "../validation/messages";

export async function getMessages(filters: FindMessagesSchema) {
  return await messagesRepo.findMessages(filters);
}

export async function getConversation(filters: FindConversationSchema) {
  return await messagesRepo.findConversation(filters);
}

export async function createMessage(data: InsertMessageSchema) {
  const result = await messagesRepo.insertMessage(data);
  const contextId = data.request_bid_id ?? data.post_bid_id ?? null;
  // fire-and-forget — failure must not throw
  sendPushToUser(data.receiver_id, "new_message", {
    title: "New message",
    body: data.content.length > 60 ? data.content.slice(0, 60) + "…" : data.content,
    url: contextId
      ? `/chat?bidId=${contextId}&otherId=${data.sender_id}`
      : "/notifications",
    contextId,
  }).catch(() => {});
  return result;
}

export async function getLatestTimestampsForBids(
  postBidIds: string[],
  requestBidIds: string[],
) {
  return await messagesRepo.findLatestTimestampsForBids(postBidIds, requestBidIds);
}

export async function removeMessage(id: string, userId: string) {
  return await messagesRepo.deleteMessage(id, userId);
}
