import webpush from "web-push";
import { Resend } from "resend";
import * as notificationsRepo from "../repo/notifications.repo";
import { createAdminClient } from "../supabase/admin";
import { NotificationType } from "../validation/notifications";

const resend = new Resend(process.env.RESEND_API_KEY!);

const EMAIL_EVENTS = new Set<NotificationType>([
  "new_bid",
  "bid_accepted",
  "bid_rejected",
  "new_review",
]);

export async function sendPushToUser(
  userId: string,
  type: NotificationType,
  payload: { title: string; body: string; url: string }
): Promise<void> {
  // 1. Always write to in-app tracker (unconditional)
  await notificationsRepo.insertNotification({
    user_id: userId,
    type,
    title: payload.title,
    body: payload.body,
    url: payload.url,
  });

  // 2. Check preferences — if this event type is disabled, stop here
  const prefs = await notificationsRepo.findPreferences(userId);
  if (prefs && !prefs[type as keyof typeof prefs]) return;

  // 3. Send Web Push to all registered devices
  const subscriptions = await notificationsRepo.findSubscriptionsForUser(userId);
  if (subscriptions.length > 0) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.PUBLIC_VAPID_KEY!,
      process.env.PRIVATE_VAPID_KEY!,
    );
    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify({ title: payload.title, body: payload.body, url: payload.url })
          );
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 410 || status === 404) {
            // Stale subscription — delete immediately
            await notificationsRepo.deleteSubscriptionById(sub.id);
          }
        }
      })
    );
  }

  // 4. Send email for qualifying event types
  if (EMAIL_EVENTS.has(type)) {
    try {
      const adminClient = await createAdminClient();
      const { data: userData } = await adminClient.auth.admin.getUserById(userId);
      const email = userData?.user?.email;
      if (email) {
        await resend.emails.send({
          from: process.env.RESEND_FROM!,
          to: email,
          subject: payload.title,
          text: `${payload.body ?? ""}\n\nView: ${process.env.NEXT_PUBLIC_SITE_URL}${payload.url}`,
        });
      }
    } catch {
      // Email failure must never block the caller
    }
  }
}
