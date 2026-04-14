import * as messagesRepo from "../repo/messages.repo";
import * as usersRepo from "../repo/users.repo";
import * as offersRepo from "../repo/offers.repo";
import * as requestsRepo from "../repo/requests.repo";
import * as notificationsRepo from "../repo/notifications.repo";
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
  const contextId = data.request_bid_id ?? data.offer_bid_id ?? null;
  const threadField = (
    data.request_bid_id ? "request_bid_id" : "offer_bid_id"
  ) as "request_bid_id" | "offer_bid_id";

  // fire-and-forget — failure must not throw
  (async () => {
    try {
      // Fetch sender name and conversation title in parallel
      const [senderUsers, conversationTitle] = await Promise.all([
        usersRepo.findUsers({ id: data.sender_id }),
        (async () => {
          if (data.request_bid_id) {
            const bid = await requestsRepo.findRequestBidById(
              data.request_bid_id,
            );
            if (bid) {
              const req = await requestsRepo.findRequestById(bid.request_id);
              return req?.title ?? null;
            }
          } else if (data.offer_bid_id) {
            const bid = await offersRepo.findOfferBidById(data.offer_bid_id);
            if (bid) {
              const offer = await offersRepo.findOfferById(bid.offer_id);
              return offer?.title ?? null;
            }
          }
          return null;
        })(),
      ]);

      const senderName = senderUsers[0]?.name ?? "Someone";
      const title = conversationTitle ?? "New message";
      const truncated =
        data.content.length > 60
          ? data.content.slice(0, 60) + "…"
          : data.content;
      const kind = data.request_bid_id ? "request" : "offer";
      const url = contextId
        ? `/chat?bidId=${contextId}&kind=${kind}&title=${encodeURIComponent(title)}&otherId=${data.sender_id}`
        : "/";

      if (!contextId) {
        // No thread context — fall back to generic new_message
        await sendPushToUser(data.receiver_id, "new_message", {
          title,
          body: `${senderName}: ${truncated}`,
          url,
          contextId: null,
        });
        return;
      }

      // --- Phase detection ---
      // Phase 1: receiver hasn't replied yet AND inquiry notification is unread (or doesn't exist yet)
      const nonNullContextId = contextId as string;
      const [receiverHasReplied, existingInquiry] = await Promise.all([
        messagesRepo.hasUserSentMessageInThread(
          data.receiver_id,
          threadField,
          nonNullContextId,
        ),
        notificationsRepo.findInquiryNotification(
          data.receiver_id,
          nonNullContextId,
        ),
      ]);

      const isPhase2 = receiverHasReplied || existingInquiry?.is_read === true;

      if (isPhase2) {
        // Phase 2 — standard coalesced message notification
        await sendPushToUser(data.receiver_id, "new_message", {
          title,
          body: `${senderName}: ${truncated}`,
          url,
          contextId,
        });
      } else if (existingInquiry) {
        // Phase 1 follow-up — upsert in-app only, no push, no email
        await notificationsRepo.upsertMessageNotification({
          user_id: data.receiver_id,
          type: "new_inquiry",
          context_id: contextId,
          title: conversationTitle
            ? `${senderName} is interested in your ${conversationTitle}`
            : `${senderName} sent you a message`,
          body: `${senderName} is interested in your post • ${(existingInquiry.message_count ?? 1) + 1} messages`,
          url,
        });
      } else {
        // Phase 1 first contact — send new_inquiry with push + email
        await sendPushToUser(data.receiver_id, "new_inquiry", {
          title: conversationTitle
            ? `${senderName} is interested in your ${conversationTitle}`
            : `${senderName} sent you a message`,
          body: `${senderName} is interested in your post`,
          url,
          contextId,
        });
      }
    } catch {
      // notification failure must never block message creation
    }
  })();

  return result;
}

export async function getLatestTimestampsForBids(
  offerBidIds: string[],
  requestBidIds: string[],
) {
  return await messagesRepo.findLatestTimestampsForBids(
    offerBidIds,
    requestBidIds,
  );
}

export async function removeMessage(id: string, userId: string) {
  return await messagesRepo.deleteMessage(id, userId);
}
