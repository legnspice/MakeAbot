import webpush from "web-push";
import * as notificationsRepo from "../repo/notifications.repo";
import { createAdminClient } from "../supabase/admin";
import { sendTransactionalEmail } from "./email.service";
import {
  NotificationType,
  type BroadcastType,
} from "../validation/notifications";
import type { SelectNotificationPreferences } from "../db/schema";
import { withinRecipientCap, type BroadcastTier } from "../broadcast-policy";

/**
 * VAPID is configured lazily: this module is imported by messages.service, so a
 * throw at import time would take down message sending in any environment
 * missing the keys rather than just disabling push.
 */
let vapidReady: boolean | null = null;
function ensureVapid(): boolean {
  if (vapidReady !== null) return vapidReady;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.PUBLIC_VAPID_KEY;
  const privateKey = process.env.PRIVATE_VAPID_KEY;
  if (!subject || !publicKey || !privateKey) {
    console.warn("[push] VAPID keys not configured — web push disabled");
    vapidReady = false;
    return vapidReady;
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidReady = true;
  } catch (err) {
    console.warn("[push] invalid VAPID configuration — web push disabled", err);
    vapidReady = false;
  }
  return vapidReady;
}

// Events that trigger an immediate transactional email
const EMAIL_EVENTS = new Set<NotificationType>(["new_inquiry"]);

// Types that coalesce per-thread via upsert
const COALESCED_TYPES = new Set<NotificationType>([
  "new_inquiry",
  "new_message",
]);

/**
 * Informational events: they belong in the bell, but none of them is actionable
 * enough to justify an OS-level interrupt.
 *  - request_completed_loser: nothing to do but move on
 *  - bid_expired: batched housekeeping about a thread that went cold 14 days ago
 *  - new_review: worth knowing, not worth buzzing
 */
const IN_APP_ONLY_TYPES = new Set<NotificationType>([
  "request_completed_loser",
  "bid_expired",
  "new_review",
]);

async function sendToSubscriptions(
  subscriptions: {
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }[],
  payload: { title: string; body: string; url: string; tag?: string },
) {
  if (!ensureVapid()) return;
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
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
  payload: {
    title: string;
    body: string;
    url: string;
    contextId?: string | null;
  },
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
      messageCount =
        (upserted as { message_count?: number })?.message_count ?? 1;
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
    const prefKey = type as keyof Omit<
      SelectNotificationPreferences,
      "user_id"
    >;
    if (prefKey in prefs && prefs[prefKey] === false) return;
  }

  // 3. Send Web Push — skipped for bell-only types
  if (!IN_APP_ONLY_TYPES.has(type)) {
    const subscriptions =
      await notificationsRepo.findSubscriptionsForUser(userId);
    if (subscriptions.length > 0) {
      const tag =
        COALESCED_TYPES.has(type) && contextId
          ? `chat_${contextId}`
          : undefined;
      await sendToSubscriptions(subscriptions, { ...pushPayload, tag });
    }
  }

  // 4. Transactional email — only on first contact for coalesced types
  const isFirstContact = !COALESCED_TYPES.has(type) || messageCount === 1;
  if (EMAIL_EVENTS.has(type) && isFirstContact && process.env.RESEND_FROM) {
    try {
      const adminClient = await createAdminClient();
      const { data: userData } =
        await adminClient.auth.admin.getUserById(userId);
      const email = userData?.user?.email;
      if (email) {
        await sendTransactionalEmail(
          email,
          pushPayload.title,
          pushPayload.body,
          pushPayload.url,
        );
      }
    } catch {
      // Email failure must never block the caller
    }
  }
}

/**
 * Fan a new post out to the platform. `tier` comes from lib/broadcast-policy:
 * "push" buzzes (subject to the per-recipient daily cap), "in_app" only writes
 * bell rows, "none" never reaches here.
 */
export async function sendPushToAllUsers(
  excludeUserId: string,
  type: BroadcastType,
  tier: BroadcastTier,
  payload: { title: string; body: string; url: string },
): Promise<void> {
  if (tier === "none") return;

  const recipients = await notificationsRepo.findBroadcastRecipients(
    excludeUserId,
    type,
  );
  if (recipients.length === 0) return;

  // Work out who may be pushed before writing rows, so each row records whether
  // it was delivered as a push — that flag is what the daily cap counts.
  let pushable: {
    id: string;
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }[] = [];
  if (tier === "push") {
    const subscriptions =
      await notificationsRepo.findSubscriptionsForUsers(recipients);
    if (subscriptions.length > 0) {
      const pushesToday = await notificationsRepo.countRecentBroadcastPushes([
        ...new Set(subscriptions.map((s) => s.user_id)),
      ]);
      pushable = subscriptions.filter((s) =>
        withinRecipientCap(pushesToday.get(s.user_id) ?? 0),
      );
    }
  }
  const pushedUserIds = new Set(pushable.map((s) => s.user_id));

  try {
    await notificationsRepo.insertBroadcastNotifications(
      recipients,
      type,
      payload,
      pushedUserIds,
    );
  } catch {
    // in-app failure must not block push
  }

  if (pushable.length > 0) await sendToSubscriptions(pushable, payload);
}
