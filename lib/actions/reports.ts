"use server";

import * as reportsService from "@/lib/services/reports.service";
import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
import { insertReportSchema } from "@/lib/validation/reports";
import { isSelfReport } from "@/lib/reports";
import { AppError } from "@/lib/error/app-error";

export async function createReport(input: unknown) {
  return await handleAction(async () => {
    const user = await requireAuth();
    const data = insertReportSchema.parse(input);
    if (isSelfReport(user.id, data.reported_user_id)) {
      throw new AppError("You can't report yourself.", 400);
    }
    return reportsService.createReport({ ...data, reporter_id: user.id });
  });
}
