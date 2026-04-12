import webpush from "web-push";
import * as notificationsRepo from "../repo/notifications.repo";
import { createAdminClient } from "../supabase/admin";
import { sendTransactionalEmail } from "./email.service";
import { NotificationType } from "../validation/notifications";
import type { SelectNotificationPreferences } from "../db/schema";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.PUBLIC_VAPID_KEY!,
  process.env.PRIVATE_VAPID_KEY!,
);

// Events that trigger an immediate transactional email
const EMAIL_EVENTS = new Set<NotificationType>([
  "new_inquiry",
  "request_completed_winner",
  "offer_bid_completed",
]);

// Types that coalesce per-thread via upsert
const COALESCED_TYPES = new Set<NotificationType>(["new_inquiry", "new_message"]);

async function sendToSubscriptions(
  subscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[],
  payload: { title: string; body: string; url: string; tag?: string },
) {
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          payload.tag ? { TTL: 3600, topic: payload.tag } : { TTL: 3600 },
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await notificationsRepo.deleteSubscriptionById(sub.id);
        }
      }
    }),
  );
}

export async function sendPushToUser(
  userId: string,
  type: NotificationType,
  payload: { title: string; body: string; url: string; contextId?: string | null },
): Promise<void> {
  const { contextId, ...pushPayload } = payload;

  // 1. Write to in-app tracker
  let messageCount = 1;
  try {
    if (COALESCED_TYPES.has(type) && contextId) {
      const upserted = await notificationsRepo.upsertMessageNotification({
        user_id: userId,
        type,
        context_id: contextId,
        title: pushPayload.title,
        body: pushPayload.body,
        url: pushPayload.url,
      });
      messageCount = (upserted as { message_count?: number })?.message_count ?? 1;
    } else {
      await notificationsRepo.insertNotification({
        user_id: userId,
        type,
        title: pushPayload.title,
        body: pushPayload.body,
        url: pushPayload.url,
      });
    }
  } catch {
    // DB failure — in-app tracker unavailable, continue to push/email
  }

  // 2. Check preferences
  const prefs = await notificationsRepo.findPreferences(userId);
  if (prefs) {
    const prefKey = type as keyof Omit<SelectNotificationPreferences, "user_id">;
    if (prefKey in prefs && prefs[prefKey] === false) return;
  }

  // 3. Send Web Push
  const subscriptions = await notificationsRepo.findSubscriptionsForUser(userId);
  if (subscriptions.length > 0) {
    const tag =
      COALESCED_TYPES.has(type) && contextId ? `chat_${contextId}` : undefined;
    await sendToSubscriptions(subscriptions, { ...pushPayload, tag });
  }

  // 4. Transactional email — only on first contact for coalesced types
  const isFirstContact = !COALESCED_TYPES.has(type) || messageCount === 1;
  if (EMAIL_EVENTS.has(type) && isFirstContact && process.env.RESEND_FROM) {
    try {
      const adminClient = await createAdminClient();
      const { data: userData } = await adminClient.auth.admin.getUserById(userId);
      const email = userData?.user?.email;
      if (email) {
        await sendTransactionalEmail(email, pushPayload.title, pushPayload.body, pushPayload.url);
      }
    } catch {
      // Email failure must never block the caller
    }
  }
}

export async function sendPushToAllUsers(
  excludeUserId: string,
  payload: { title: string; body: string; url: string },
): Promise<void> {
  // Write in-app rows for all users (grouped under "Opportunities")
  try {
    await notificationsRepo.insertBroadcastNotifications(excludeUserId, payload);
  } catch {
    // in-app failure must not block push
  }

  const subscriptions = await notificationsRepo.findSubscriptionsForBroadcast(excludeUserId);
  if (subscriptions.length === 0) return;
  await sendToSubscriptions(subscriptions, payload);
}
