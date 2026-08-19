import {
  integer,
  pgTable,
  pgSchema,
  text,
  uuid,
  timestamp,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  urgencyEnum,
  offerStatusEnum,
  requestStatusEnum,
  bidStatusEnum,
  typeEnum,
  reportReasonEnum,
} from "./enums";
import { sql } from "drizzle-orm";

const authSchema = pgSchema("auth");

const supabaseUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
});

export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .references(() => supabaseUsers.id, { onDelete: "cascade" }),
  name: text("name"),
  id_number: integer("id_number"),
  phone_number: text("phone_number"),
  description: text("description"),
  contributions: integer("contributions").notNull().default(0),
  avatar_url: text("avatar_url"),
  is_admin: boolean("is_admin").notNull().default(false),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sender_id: uuid("sender_id")
    .notNull()
    .references(() => users.id),
  receiver_id: uuid("receiver_id")
    .notNull()
    .references(() => users.id),
  request_bid_id: uuid("request_bid_id").references(() => request_bids.id, {
    onDelete: "cascade",
  }),
  offer_bid_id: uuid("offer_bid_id").references(() => offer_bids.id, {
    onDelete: "cascade",
  }),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  is_read: boolean("is_read").default(false).notNull(),
  // Soft delete. NULL means live.
  // See docs/superpowers/specs/2026-08-19-soft-delete-retention-design.md
  deleted_at: timestamp("deleted_at"),
});

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rated_user_id: uuid("rated_user_id")
      .notNull()
      .references(() => users.id),
    creator_id: uuid("creator_id")
      .notNull()
      .references(() => users.id),
    request_bid_id: uuid("request_bid_id").references(() => request_bids.id, {
      onDelete: "cascade",
    }),
    offer_bid_id: uuid("offer_bid_id").references(() => offer_bids.id, {
      onDelete: "cascade",
    }),
    comment: text("comment"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    rating: integer("rating").notNull(),
  },
  (t) => [
    uniqueIndex("reviews_creator_offer_bid_idx")
      .on(t.creator_id, t.offer_bid_id)
      .where(sql`${t.offer_bid_id} IS NOT NULL`),
    uniqueIndex("reviews_creator_request_bid_idx")
      .on(t.creator_id, t.request_bid_id)
      .where(sql`${t.request_bid_id} IS NOT NULL`),
  ],
);

export const requests = pgTable("requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  imgUrl: text("imgUrl"),
  // Optional ₱ amount (whole pesos)
  fee: integer("fee"),
  incentive: text("incentive"),
  title: text("title").notNull(),
  description: text("description"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  // $onUpdate keeps the 14-day expiry cron honest: expireStaleRequestBids
  // measures staleness against this column, so it must mean "last touched",
  // not "created".
  updated_at: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  completed_at: timestamp("completed_at"),
  urgency: urgencyEnum("urgency").notNull().default("Within the day"),
  type: typeEnum("type").notNull().default("Unknown"),
  status: requestStatusEnum("status").notNull().default("Active"),
  // Soft delete. NULL means live.
  // See docs/superpowers/specs/2026-08-19-soft-delete-retention-design.md
  deleted_at: timestamp("deleted_at"),
  // Set once the purge sweep anonymizes this row. NULL means not yet swept —
  // this is the real "already anonymized" marker; `title` is a placeholder
  // value only, never the sentinel (it is user-settable, so it was forgeable).
  anonymized_at: timestamp("anonymized_at"),
});

export const offers = pgTable("offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  imgUrl: text("imgUrl"),
  // Optional ₱ amount (whole pesos)
  price: integer("price"),
  incentive: text("incentive"),
  title: text("title").notNull(),
  description: text("description"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  // $onUpdate keeps the 14-day expiry cron honest: expireStaleOfferBids
  // measures staleness against this column, so it must mean "last touched",
  // not "created".
  updated_at: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  type: typeEnum("type").notNull().default("Unknown"),
  status: offerStatusEnum("status").notNull().default("Active"),
  // Soft delete. NULL means live.
  // See docs/superpowers/specs/2026-08-19-soft-delete-retention-design.md
  deleted_at: timestamp("deleted_at"),
  // Set once the purge sweep anonymizes this row. NULL means not yet swept —
  // this is the real "already anonymized" marker; `title` is a placeholder
  // value only, never the sentinel (it is user-settable, so it was forgeable).
  anonymized_at: timestamp("anonymized_at"),
});

export const request_bids = pgTable("request_bids", {
  id: uuid("id").primaryKey().defaultRandom(),
  request_id: uuid("request_id")
    .notNull()
    .references(() => requests.id, { onDelete: "cascade" }),
  bidder_id: uuid("bidder_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
  created_at: timestamp("created_at").notNull().defaultNow(),
  status: bidStatusEnum("status").notNull().default("Pending"),
  // Soft delete. NULL means live.
  // See docs/superpowers/specs/2026-08-19-soft-delete-retention-design.md
  deleted_at: timestamp("deleted_at"),
});

export const offer_bids = pgTable("offer_bids", {
  id: uuid("id").primaryKey().defaultRandom(),
  offer_id: uuid("offer_id")
    .notNull()
    .references(() => offers.id, { onDelete: "cascade" }),
  bidder_id: uuid("bidder_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
  created_at: timestamp("created_at").notNull().defaultNow(),
  status: bidStatusEnum("status").notNull().default("Pending"),
  // Soft delete. NULL means live.
  // See docs/superpowers/specs/2026-08-19-soft-delete-retention-design.md
  deleted_at: timestamp("deleted_at"),
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    context_id: text("context_id"),
    message_count: integer("message_count").notNull().default(1),
    title: text("title").notNull(),
    body: text("body"),
    url: text("url"),
    is_read: boolean("is_read").notNull().default(false),
    // True when this row was also delivered as a web push. Broadcast rows are
    // written even when push is capped, so the daily cap counts this, not rows.
    pushed: boolean("pushed").notNull().default(false),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("notifications_msg_coalesce_idx")
      .on(t.user_id, t.type, t.context_id)
      .where(sql`${t.context_id} IS NOT NULL`),
  ],
);

export const push_subscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const notification_preferences = pgTable("notification_preferences", {
  user_id: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  new_inquiry: boolean("new_inquiry").notNull().default(true),
  new_message: boolean("new_message").notNull().default(true),
  new_request: boolean("new_request").notNull().default(true),
  // Offers are browsable supply, not time-sensitive demand — opt-in only.
  new_offer: boolean("new_offer").notNull().default(false),
  email_digest: boolean("email_digest").notNull().default(true),
});

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporter_id: uuid("reporter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reported_user_id: uuid("reported_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  reported_offer_id: uuid("reported_offer_id").references(() => offers.id, {
    onDelete: "set null",
  }),
  reported_request_id: uuid("reported_request_id").references(
    () => requests.id,
    { onDelete: "set null" },
  ),
  reason: reportReasonEnum("reason").notNull(),
  details: text("details"),
  status: text("status").notNull().default("open"),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
  report_count: integer("report_count").notNull().default(1),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;
export type SelectMessage = typeof messages.$inferSelect;
export type InsertOffer = typeof offers.$inferInsert;
export type SelectOffer = typeof offers.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type SelectNotification = typeof notifications.$inferSelect;
export type InsertPushSubscription = typeof push_subscriptions.$inferInsert;
export type SelectPushSubscription = typeof push_subscriptions.$inferSelect;
export type SelectNotificationPreferences =
  typeof notification_preferences.$inferSelect;
export type InsertOfferBid = typeof offer_bids.$inferInsert;
export type SelectOfferBid = typeof offer_bids.$inferSelect;
export type SelectRequest = typeof requests.$inferSelect;
export type SelectRequestBid = typeof request_bids.$inferSelect;
export type SelectReview = typeof reviews.$inferSelect;
export type SelectReport = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;
