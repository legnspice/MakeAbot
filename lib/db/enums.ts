import { pgEnum } from "drizzle-orm/pg-core";
import { z } from "zod";

// Urgency
export const TYPE_VALUES = ["Item", "Service", "Unknown"] as const;
export const typeEnum = pgEnum("type", TYPE_VALUES);
export const TypeEnum = z.enum(TYPE_VALUES);
export type Type = z.infer<typeof TypeEnum>;

// Urgency
export const URGENCY_VALUES = [
  "Now",
  "Within the hour",
  "Within the day",
  "Within the week",
  "Indefinite",
] as const;
export const urgencyEnum = pgEnum("urgency", URGENCY_VALUES);
export const UrgencyEnum = z.enum(URGENCY_VALUES);
export type Urgency = z.infer<typeof UrgencyEnum>;

// Request Status
export const REQUEST_STATUS_VALUES = [
  "Active",
  "Ongoing",
  "Completed",
  "Cancelled",
] as const;
export const requestStatusEnum = pgEnum(
  "request_status",
  REQUEST_STATUS_VALUES,
);
export const RequestStatusEnum = z.enum(REQUEST_STATUS_VALUES);
export type RequestStatus = z.infer<typeof RequestStatusEnum>;

// Post Status
export const POST_STATUS_VALUES = ["Active", "Closed", "Busy"] as const;
export const postStatusEnum = pgEnum("post_status", POST_STATUS_VALUES);
export const PostStatusEnum = z.enum(POST_STATUS_VALUES);
export type PostStatus = z.infer<typeof PostStatusEnum>;

// Bid Status
export const BID_STATUS_VALUES = ["Pending", "Accepted", "Closed"] as const;
export const bidStatusEnum = pgEnum("bid_status", BID_STATUS_VALUES);
export const BidStatusEnum = z.enum(BID_STATUS_VALUES);
export type BidStatus = z.infer<typeof BidStatusEnum>;
