import { eq, desc, and, count, sql, ne, or, isNull } from "drizzle-orm";
import { db } from "../db";
import {
  notifications,
  push_subscriptions,
  notification_preferences,
} from "../db/schema";
import { InsertNotificationSchema } from "../validation/notifications";

// --- Notifications ---

export async function findNotificationsForUser(userId: string) {
  return await db.query.notifications.findMany({
    where: eq(notifications.user_id, userId),
    orderBy: [desc(notifications.created_at)],
  });
}

export async function countUnreadForUser(userId: string) {
  const result = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.user_id, userId), eq(notifications.is_read, false)));
  return result[0]?.value ?? 0;
}

export async function insertNotification(data: InsertNotificationSchema) {
  const [row] = await db.insert(notifications).values(data).returning();
  return row;
}

export async function upsertMessageNotification(
  data: InsertNotificationSchema & { context_id: string },
) {
  const [row] = await db
    .insert(notifications)
    .values({ ...data, message_count: 1 })
    .onConflictDoUpdate({
      target: [notifications.user_id, notifications.type, notifications.context_id],
      targetWhere: sql`${notifications.context_id} IS NOT NULL`,
      set: {
        message_count: sql`${notifications.message_count} + 1`,
        body: sql`excluded.body`,
        title: sql`excluded.title`,
        is_read: false,
        updated_at: sql`now()`,
      },
    })
    .returning();
  return row;
}

export async function markNotificationRead(id: string, userId: string) {
  return await db
    .update(notifications)
    .set({ is_read: true })
    .where(and(eq(notifications.id, id), eq(notifications.user_id, userId)));
}

export async function markAllNotificationsRead(userId: string) {
  return await db
    .update(notifications)
    .set({ is_read: true })
    .where(and(eq(notifications.user_id, userId), eq(notifications.is_read, false)));
}

// --- Push Subscriptions ---

export async function findSubscriptionsForUser(userId: string) {
  return await db.query.push_subscriptions.findMany({
    where: eq(push_subscriptions.user_id, userId),
  });
}

export async function insertSubscription(data: {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  return await db
    .insert(push_subscriptions)
    .values(data)
    .onConflictDoNothing();
}

export async function deleteSubscriptionById(id: string) {
  return await db.delete(push_subscriptions).where(eq(push_subscriptions.id, id));
}

export async function deleteSubscriptionByEndpoint(userId: string, endpoint: string) {
  return await db
    .delete(push_subscriptions)
    .where(
      and(eq(push_subscriptions.user_id, userId), eq(push_subscriptions.endpoint, endpoint))
    );
}

export async function findSubscriptionsForBroadcast(excludeUserId: string) {
  return await db
    .select({
      id: push_subscriptions.id,
      endpoint: push_subscriptions.endpoint,
      p256dh: push_subscriptions.p256dh,
      auth: push_subscriptions.auth,
    })
    .from(push_subscriptions)
    .leftJoin(
      notification_preferences,
      eq(push_subscriptions.user_id, notification_preferences.user_id),
    )
    .where(
      and(
        ne(push_subscriptions.user_id, excludeUserId),
        or(
          isNull(notification_preferences.user_id),
          eq(notification_preferences.new_request, true),
        ),
      ),
    );
}

// --- Notification Preferences ---

export async function findPreferences(userId: string) {
  return await db.query.notification_preferences.findFirst({
    where: eq(notification_preferences.user_id, userId),
  });
}

export async function insertDefaultPreferences(userId: string) {
  return await db
    .insert(notification_preferences)
    .values({ user_id: userId })
    .onConflictDoNothing();
}

export async function updatePreferences(
  userId: string,
  data: Partial<Omit<typeof notification_preferences.$inferInsert, "user_id">>
) {
  return await db
    .update(notification_preferences)
    .set(data)
    .where(eq(notification_preferences.user_id, userId));
}
