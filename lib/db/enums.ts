import { pgEnum } from "drizzle-orm/pg-core";

const urgencyEnum = pgEnum("urgency_enum", [
  "Now",
  "Within the hour",
  "Within the day",
  "Within the week",
  "Indefinite",
]);

const requestsStatusEnum = pgEnum("request_status", [
  "Active",
  "Ongoing",
  "Completed",
  "Cancelled",
]);

const postsStatusEnum = pgEnum("post_status", ["Active", "Closed", "Busy"]);

export { urgencyEnum, requestsStatusEnum, postsStatusEnum };
