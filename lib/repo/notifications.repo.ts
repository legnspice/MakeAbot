import {
  eq,
  desc,
  and,
  count,
  sql,
  ne,
  or,
  gt,
  lt,
  isNull,
  inArray,
} from "drizzle-orm";
import { db } from "../db";
import {
  notifications,
  push_subscriptions,
  notification_preferences,
  users,
} from "../db/schema";
import {
  BROADCAST_TYPES,
  InsertNotificationSchema,
  type BroadcastType,
} from "../validation/notifications";

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

export async function findInquiryNotification(
  userId: string,
  contextId: string,
) {
  return await db.query.notifications.findFirst({
    where: and(
      eq(notifications.user_id, userId),
      eq(notifications.type, "new_inquiry"),
      eq(notifications.context_id, contextId),
    ),
  });
}

/**
 * Drop the inquiry row for a thread that has graduated to a two-way
 * conversation. Its `new_message` row supersedes it, and keeping both leaves
 * two bell entries pointing at the same chat.
 */
export async function deleteInquiryNotification(
  userId: string,
  contextId: string,
) {
  return await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.user_id, userId),
        eq(notifications.type, "new_inquiry"),
        eq(notifications.context_id, contextId),
      ),
    );
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

export async function findSubscriptionsForUsers(userIds: string[]) {
  if (userIds.length === 0) return [];
  const out: {
    id: string;
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }[] = [];
  // Chunked: an `IN (...)` of every user id would eventually exceed Postgres'
  // bind-parameter limit as the userbase grows.
  for (const chunk of chunkIds(userIds)) {
    const rows = await db
      .select({
        id: push_subscriptions.id,
        user_id: push_subscriptions.user_id,
        endpoint: push_subscriptions.endpoint,
        p256dh: push_subscriptions.p256dh,
        auth: push_subscriptions.auth,
      })
      .from(push_subscriptions)
      .where(inArray(push_subscriptions.user_id, chunk));
    out.push(...rows);
  }
  return out;
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

/** Chunk size — keeps a single statement from ballooning as the userbase grows. */
const BROADCAST_CHUNK = 500;

function* chunkIds(ids: string[]): Generator<string[]> {
  for (let i = 0; i < ids.length; i += BROADCAST_CHUNK) {
    yield ids.slice(i, i + BROADCAST_CHUNK);
  }
}

/**
 * Users who should receive a broadcast of this type, honouring their preference.
 * A missing preferences row falls back to the column default: `new_request` is
 * on, `new_offer` is opt-in.
 */
export async function findBroadcastRecipients(
  excludeUserId: string,
  type: BroadcastType,
): Promise<string[]> {
  const prefColumn =
    type === "new_offer"
      ? notification_preferences.new_offer
      : notification_preferences.new_request;
  const defaultsOn = type !== "new_offer";

  const rows = await db
    .select({ id: users.id })
    .from(users)
    .leftJoin(
      notification_preferences,
      eq(users.id, notification_preferences.user_id),
    )
    .where(
      and(
        ne(users.id, excludeUserId),
        defaultsOn
          ? or(isNull(notification_preferences.user_id), eq(prefColumn, true))
          : eq(prefColumn, true),
      ),
    );
  return rows.map((r) => r.id);
}

/**
 * Broadcast pushes each user has received in the last 24h, keyed by user id.
 * Counts `pushed` rows rather than all rows — a capped broadcast still writes a
 * bell row, and those must not count against the next day's budget.
 */
export async function countRecentBroadcastPushes(
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const counts = new Map<string, number>();
  for (const chunk of chunkIds(userIds)) {
    const rows = await db
      .select({ user_id: notifications.user_id, value: count() })
      .from(notifications)
      .where(
        and(
          inArray(notifications.user_id, chunk),
          inArray(notifications.type, [...BROADCAST_TYPES]),
          eq(notifications.pushed, true),
          gt(notifications.created_at, since),
        ),
      )
      .groupBy(notifications.user_id);
    for (const r of rows) counts.set(r.user_id, r.value);
  }
  return counts;
}

/**
 * Housekeeping for the bell: broadcast rows are written for every user on every
 * qualifying post, so without retention the tracker fills with stale
 * platform-wide chatter and the unread badge stops meaning anything.
 */
export async function deleteStaleBroadcastNotifications(
  olderThanDays = 14,
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(notifications)
    .where(
      and(
        inArray(notifications.type, [...BROADCAST_TYPES]),
        lt(notifications.created_at, cutoff),
      ),
    )
    .returning({ id: notifications.id });
  return deleted.length;
}

export async function insertBroadcastNotifications(
  recipientIds: string[],
  type: BroadcastType,
  data: { title: string; body: string; url: string },
  pushedUserIds: Set<string>,
) {
  if (recipientIds.length === 0) return;
  for (const chunk of chunkIds(recipientIds)) {
    await db.insert(notifications).values(
      chunk.map((id) => ({
        user_id: id,
        type,
        title: data.title,
        body: data.body,
        url: data.url,
        pushed: pushedUserIds.has(id),
      })),
    );
  }
}

// --- Daily digest ---

export async function findUsersWithUnreadMessageNotifications(): Promise<
  {
    user_id: string;
    rows: {
      type: string;
      title: string;
      body: string | null;
      url: string | null;
    }[];
  }[]
> {
  // Only conversations that went unread in the last 24h. Without this bound a
  // notification the user never opens generates a digest email every night,
  // forever.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const unread = await db
    .select({
      user_id: notifications.user_id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      url: notifications.url,
    })
    .from(notifications)
    .leftJoin(
      notification_preferences,
      eq(notifications.user_id, notification_preferences.user_id),
    )
    .where(
      and(
        inArray(notifications.type, ["new_inquiry", "new_message"]),
        eq(notifications.is_read, false),
        gt(notifications.updated_at, since),
        or(
          isNull(notification_preferences.user_id),
          eq(notification_preferences.email_digest, true),
        ),
      ),
    );

  const grouped = new Map<
    string,
    { type: string; title: string; body: string | null; url: string | null }[]
  >();
  for (const row of unread) {
    const existing = grouped.get(row.user_id) ?? [];
    existing.push({
      type: row.type,
      title: row.title,
      body: row.body,
      url: row.url,
    });
    grouped.set(row.user_id, existing);
  }

  return Array.from(grouped.entries()).map(([user_id, rows]) => ({
    user_id,
    rows,
  }));
}
