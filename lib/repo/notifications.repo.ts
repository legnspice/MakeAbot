import { eq, desc, and, count, sql, ne, or, isNull, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  notifications,
  push_subscriptions,
  notification_preferences,
  users,
} from "../db/schema";
import { InsertNotificationSchema } from "../validation/notifications";

// --- Notifications ---

export async function findNotificationsForUser(userId: string) {
  return await db.query.notifications.findMany({
    where: eq(notifications.user_id, userId),
    orderBy: [desc(notifications.updated_at)],
  });
}

export async function countUnreadForUser(userId: string) {
  const result = await db
    .select({ value: count() })
    .from(notifications)
    .where(
      and(eq(notifications.user_id, userId), eq(notifications.is_read, false)),
    );
  return result[0]?.value ?? 0;
}

export async function insertNotification(data: InsertNotificationSchema) {
  const [row] = await db.insert(notifications).values(data).returning();
  return row;
}

export async function upsertMessageNotification(
  data: InsertNotificationSchema & { context_id: string },
) {
  const result = await db.execute(sql`
    INSERT INTO notifications (user_id, type, context_id, title, body, url, message_count, is_read, updated_at)
    VALUES (
      ${data.user_id},
      ${data.type},
      ${data.context_id},
      ${data.title},
      ${data.body ?? null},
      ${data.url ?? null},
      1,
      false,
      now()
    )
    ON CONFLICT (user_id, type, context_id) WHERE context_id IS NOT NULL
    DO UPDATE SET
      message_count = notifications.message_count + 1,
      body          = excluded.body,
      title         = excluded.title,
      is_read       = false,
      updated_at    = now()
    RETURNING *
  `);
  return result[0];
}

export async function markNotificationRead(id: string, userId: string) {
  return await db
    .update(notifications)
    .set({ is_read: true, message_count: 0 })
    .where(and(eq(notifications.id, id), eq(notifications.user_id, userId)));
}

export async function markAllNotificationsRead(userId: string) {
  return await db
    .update(notifications)
    .set({ is_read: true, message_count: 0 })
    .where(
      and(eq(notifications.user_id, userId), eq(notifications.is_read, false)),
    );
}

export async function findInquiryNotification(userId: string, contextId: string) {
  return await db.query.notifications.findFirst({
    where: and(
      eq(notifications.user_id, userId),
      eq(notifications.type, "new_inquiry"),
      eq(notifications.context_id, contextId),
    ),
  });
}

export async function markMessageNotificationReadByContext(
  userId: string,
  contextId: string,
) {
  return await db
    .update(notifications)
    .set({ is_read: true })
    .where(
      and(
        eq(notifications.user_id, userId),
        inArray(notifications.type, ["new_inquiry", "new_message"]),
        eq(notifications.context_id, contextId),
        eq(notifications.is_read, false),
      ),
    );
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
  return await db.insert(push_subscriptions).values(data).onConflictDoNothing();
}

export async function deleteSubscriptionById(id: string) {
  return await db
    .delete(push_subscriptions)
    .where(eq(push_subscriptions.id, id));
}

export async function deleteSubscriptionByEndpoint(
  userId: string,
  endpoint: string,
) {
  return await db
    .delete(push_subscriptions)
    .where(
      and(
        eq(push_subscriptions.user_id, userId),
        eq(push_subscriptions.endpoint, endpoint),
      ),
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
  data: Partial<Omit<typeof notification_preferences.$inferInsert, "user_id">>,
) {
  return await db
    .update(notification_preferences)
    .set(data)
    .where(eq(notification_preferences.user_id, userId));
}

// --- Broadcast ---

export async function insertBroadcastNotifications(
  excludeUserId: string,
  data: { title: string; body: string; url: string },
) {
  const allUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(ne(users.id, excludeUserId));
  if (allUsers.length === 0) return;
  await db.insert(notifications).values(
    allUsers.map((u) => ({
      user_id: u.id,
      type: "new_request" as const,
      title: data.title,
      body: data.body,
      url: data.url,
    })),
  );
}

// --- Daily digest ---

export async function findUsersWithUnreadMessageNotifications(): Promise<
  { user_id: string; rows: { type: string; title: string; body: string | null; url: string | null }[] }[]
> {
  const unread = await db
    .select({
      user_id: notifications.user_id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      url: notifications.url,
    })
    .from(notifications)
    .where(
      and(
        inArray(notifications.type, ["new_inquiry", "new_message"]),
        eq(notifications.is_read, false),
      ),
    );

  const grouped = new Map<
    string,
    { type: string; title: string; body: string | null; url: string | null }[]
  >();
  for (const row of unread) {
    const existing = grouped.get(row.user_id) ?? [];
    existing.push({ type: row.type, title: row.title, body: row.body, url: row.url });
    grouped.set(row.user_id, existing);
  }

  return Array.from(grouped.entries()).map(([user_id, rows]) => ({ user_id, rows }));
}
