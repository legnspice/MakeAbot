"use server";

import * as reportsService from "@/lib/services/reports.service";
import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
import { insertReportSchema } from "@/lib/validation/reports";

export async function createReport(input: unknown) {
  return await handleAction(async () => {
    const user = await requireAuth();
    const data = insertReportSchema.parse(input);
    return reportsService.createReport({ ...data, reporter_id: user.id });
  });
}
