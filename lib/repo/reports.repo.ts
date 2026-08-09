import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { reports, type InsertReport } from "../db/schema";

export async function insertReport(data: InsertReport) {
  return await db.insert(reports).values(data).returning();
}

type Target = {
  reported_user_id?: string;
  reported_offer_id?: string;
  reported_request_id?: string;
};

function targetCondition(t: Target) {
  if (t.reported_user_id) return eq(reports.reported_user_id, t.reported_user_id);
  if (t.reported_offer_id) return eq(reports.reported_offer_id, t.reported_offer_id);
  return eq(reports.reported_request_id, t.reported_request_id!);
}

export async function findOpenReportByTarget(reporterId: string, t: Target) {
  return await db.query.reports.findFirst({
    where: and(
      eq(reports.reporter_id, reporterId),
      eq(reports.status, "open"),
      targetCondition(t),
    ),
  });
}

export async function coalesceReport(id: string, mergedDetails: string | null) {
  return await db
    .update(reports)
    .set({
      details: mergedDetails,
      updated_at: sql`now()`,
      report_count: sql`${reports.report_count} + 1`,
    })
    .where(eq(reports.id, id));
}

export async function findReports(filters: { status?: string }) {
  return await db.query.reports.findMany({
    where: filters.status ? eq(reports.status, filters.status) : undefined,
    orderBy: [
      sql`case when ${reports.status} = 'open' then 0 else 1 end`,
      desc(reports.updated_at),
    ],
  });
}

export async function updateReportStatus(id: string, status: string) {
  return await db
    .update(reports)
    .set({ status, updated_at: sql`now()` })
    .where(eq(reports.id, id));
}
