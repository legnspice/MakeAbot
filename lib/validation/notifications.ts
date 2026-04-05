import { z } from "zod";

export const NOTIFICATION_TYPES = [
  "new_message",
  "new_bid",
  "bid_accepted",
  "bid_rejected",
  "new_review",
] as const;

export const NotificationTypeEnum = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof NotificationTypeEnum>;

export const insertNotificationSchema = z.object({
  user_id: z.string().uuid(),
  type: NotificationTypeEnum,
  title: z.string().min(1),
  body: z.string().optional(),
  url: z.string().optional(),
});
export type InsertNotificationSchema = z.infer<typeof insertNotificationSchema>;

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});
export type PushSubscriptionSchema = z.infer<typeof pushSubscriptionSchema>;

export const updatePreferencesSchema = z.object({
  new_message: z.boolean().optional(),
  new_bid: z.boolean().optional(),
  bid_accepted: z.boolean().optional(),
  bid_rejected: z.boolean().optional(),
  new_review: z.boolean().optional(),
});
export type UpdatePreferencesSchema = z.infer<typeof updatePreferencesSchema>;
