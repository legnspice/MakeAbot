import * as messagesRepo from "../repo/messages.repo";
import * as usersRepo from "../repo/users.repo";
import * as postsRepo from "../repo/posts.repo";
import * as requestsRepo from "../repo/requests.repo";
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
  (async () => {
    try {
      // Fetch sender name and conversation title in parallel
      const [senderUsers, conversationTitle] = await Promise.all([
        usersRepo.findUsers({ id: data.sender_id }),
        (async () => {
          if (data.request_bid_id) {
            const bid = await requestsRepo.findRequestBidById(data.request_bid_id);
            if (bid) {
              const req = await requestsRepo.findRequestById(bid.request_id);
              return req?.title ?? null;
            }
          } else if (data.post_bid_id) {
            const bids = await postsRepo.findPostBids({ id: data.post_bid_id });
            const bid = bids[0];
            if (bid) {
              const post = await postsRepo.findPostById(bid.post_id);
              return post?.title ?? null;
            }
          }
          return null;
        })(),
      ]);

      const senderName = senderUsers[0]?.name ?? "Someone";
      const title = conversationTitle ?? "New message";
      const truncated = data.content.length > 60
        ? data.content.slice(0, 60) + "…"
        : data.content;

      await sendPushToUser(data.receiver_id, "new_message", {
        title,
        body: `${senderName}: ${truncated}`,
        url: contextId ? `/chat?bidId=${contextId}&otherId=${data.sender_id}` : "/",
        contextId,
      });
    } catch {
      // notification failure must never block message creation
    }
  })();

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
