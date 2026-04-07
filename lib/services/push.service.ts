import webpush from "web-push";
import { Resend } from "resend";
import * as notificationsRepo from "../repo/notifications.repo";
import { createAdminClient } from "../supabase/admin";
import { NotificationType } from "../validation/notifications";
import type { SelectNotificationPreferences } from "../db/schema";

const resend = new Resend(process.env.RESEND_API_KEY!);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.PUBLIC_VAPID_KEY!,
  process.env.PRIVATE_VAPID_KEY!,
);

const EMAIL_EVENTS = new Set<NotificationType>([
  "new_bid",
  "bid_accepted",
  "bid_rejected",
  "new_review",
]);

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
  try {
    if (type === "new_message" && contextId) {
      await notificationsRepo.upsertMessageNotification({
        user_id: userId,
        type,
        context_id: contextId,
        title: pushPayload.title,
        body: pushPayload.body,
        url: pushPayload.url,
      });
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
    const tag = type === "new_message" && contextId ? `chat_${contextId}` : undefined;
    await sendToSubscriptions(subscriptions, { ...pushPayload, tag });
  }

  // 4. Send email for qualifying events (only when email is enabled via RESEND_FROM)
  if (EMAIL_EVENTS.has(type) && process.env.RESEND_FROM) {
    try {
      const adminClient = await createAdminClient();
      const { data: userData } = await adminClient.auth.admin.getUserById(userId);
      const email = userData?.user?.email;
      if (email) {
        await resend.emails.send({
          from: process.env.RESEND_FROM!,
          to: email,
          subject: pushPayload.title,
          text: `${pushPayload.body ?? ""}\n\nView: ${process.env.NEXT_PUBLIC_SITE_URL}${pushPayload.url}`,
        });
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
  // No in-app row — broadcast push only
  const subscriptions = await notificationsRepo.findSubscriptionsForBroadcast(excludeUserId);
  if (subscriptions.length === 0) return;
  await sendToSubscriptions(subscriptions, payload);
}
