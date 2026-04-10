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
  postStatusEnum,
  requestStatusEnum,
  bidStatusEnum,
  typeEnum,
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
  post_bid_id: uuid("post_bid_id").references(() => post_bids.id, {
    onDelete: "cascade",
  }),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  is_read: boolean("is_read").default(false).notNull(),
});

export const reviews = pgTable("reviews", {
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
  post_bid_id: uuid("post_bid_id").references(() => post_bids.id, {
    onDelete: "cascade",
  }),
  comment: text("comment"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  rating: integer("rating").notNull(),
});

export const requests = pgTable("requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  imgUrl: text("imgUrl"),
  // For currency we use the smallest unit: Php in cents
  fee: integer("fee"),
  title: text("title").notNull(),
  description: text("description"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  completed_at: timestamp("completed_at"),
  urgency: urgencyEnum("urgency").notNull().default("Now"),
  type: typeEnum("type").notNull().default("Unknown"),
  status: requestStatusEnum("status").notNull().default("Active"),
});

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),

  imgUrl: text("imgUrl"),
  // For currency we use the smallest unit: Php in cents
  price: integer("price"),
  title: text("title").notNull(),
  description: text("description"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  type: typeEnum("type").notNull().default("Unknown"),
  status: postStatusEnum("status").notNull().default("Active"),
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
});

export const post_bids = pgTable("post_bids", {
  id: uuid("id").primaryKey().defaultRandom(),
  post_id: uuid("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  bidder_id: uuid("bidder_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
  created_at: timestamp("created_at").notNull().defaultNow(),
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
  new_review: boolean("new_review").notNull().default(true),
  new_request: boolean("new_request").notNull().default(true),
});

export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;
export type SelectMessage = typeof messages.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;
export type SelectPost = typeof posts.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type SelectNotification = typeof notifications.$inferSelect;
export type InsertPushSubscription = typeof push_subscriptions.$inferInsert;
export type SelectPushSubscription = typeof push_subscriptions.$inferSelect;
export type SelectNotificationPreferences =
  typeof notification_preferences.$inferSelect;
