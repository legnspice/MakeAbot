import { z } from "zod";

export const UrgencyEnum = z.enum([
  "Now",
  "Within the hour",
  "Within the day",
  "Within the week",
  "Indefinite",
]);

export const RequestStatusEnum = z.enum([
  "Active",
  "Ongoing",
  "Completed",
  "Cancelled",
]);

export const PostStatusEnum = z.enum(["Active", "Closed", "Busy"]);

export type Urgency = z.infer<typeof UrgencyEnum>;
export type RequestStatus = z.infer<typeof RequestStatusEnum>;
export type PostStatus = z.infer<typeof PostStatusEnum>;
