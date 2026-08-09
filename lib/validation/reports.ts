import { z } from "zod";
import { ReportReasonEnum } from "@/lib/db/enums";
import { hasReportTarget } from "@/lib/reports";

export const insertReportSchema = z
  .object({
    reason: ReportReasonEnum,
    details: z.string().max(500).nullish(),
    reported_user_id: z.string().uuid().optional(),
    reported_offer_id: z.string().uuid().optional(),
    reported_request_id: z.string().uuid().optional(),
  })
  .refine(hasReportTarget, {
    message: "A report must target a user, offer, or request.",
  });

export type InsertReportSchema = z.infer<typeof insertReportSchema>;
