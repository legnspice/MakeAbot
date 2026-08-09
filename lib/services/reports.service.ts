import * as reportsRepo from "../repo/reports.repo";
import type { InsertReportSchema } from "../validation/reports";

export async function createReport(
  data: InsertReportSchema & { reporter_id: string },
) {
  return await reportsRepo.insertReport(data);
}
