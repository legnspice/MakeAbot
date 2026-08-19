import { and, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
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

/**
 * Report statuses that protect their target listing from the retention purge.
 *
 * `open` is untriaged and `reviewing` is actively under moderation — in both
 * cases the listing text, image and messages are still live evidence, so the
 * purge must leave them alone. `resolved` and `dismissed` are deliberately
 * absent: those reports are closed out, and protecting them would mean the
 * listing never ages out at all.
 *
 * Adding a new status to the vocabulary in `lib/reports.ts`? Decide here
 * whether it protects.
 */
export const PROTECTIVE_REPORT_STATUSES = ["open", "reviewing"] as const;

/**
 * Builds (without executing) the query behind `findOpenReportTargetIds`.
 *
 * Split out purely so tests can call `.toSQL()` on the builder and assert on
 * the rendered SQL/params without a database connection. Callers with both
 * arrays empty should use the early return in `findOpenReportTargetIds`
 * instead of calling this directly — an empty `or()` is a always-false
 * degenerate clause.
 */
export function buildOpenReportTargetsQuery(
  requestIds: string[],
  offerIds: string[],
) {
  const targets = [
    requestIds.length > 0
      ? inArray(reports.reported_request_id, requestIds)
      : undefined,
    offerIds.length > 0
      ? inArray(reports.reported_offer_id, offerIds)
      : undefined,
  ].filter((t): t is SQL => Boolean(t));

  return db
    .select({
      requestId: reports.reported_request_id,
      offerId: reports.reported_offer_id,
    })
    .from(reports)
    .where(
      and(
        inArray(reports.status, [...PROTECTIVE_REPORT_STATUSES]),
        or(...targets),
      ),
    );
}

/**
 * Which of these listings have a report against them in a protective status
 * (see `PROTECTIVE_REPORT_STATUSES`).
 *
 * The purge skips these so a reported user cannot delete the evidence and wait
 * out the retention window — and so moving a report to `reviewing` does not
 * itself hand the purge permission to destroy what moderation is reading.
 */
export async function findOpenReportTargetIds(
  requestIds: string[],
  offerIds: string[],
): Promise<{ requestIds: Set<string>; offerIds: Set<string> }> {
  const result = { requestIds: new Set<string>(), offerIds: new Set<string>() };
  if (requestIds.length === 0 && offerIds.length === 0) return result;

  const rows = await buildOpenReportTargetsQuery(requestIds, offerIds);

  for (const r of rows) {
    if (r.requestId) result.requestIds.add(r.requestId);
    if (r.offerId) result.offerIds.add(r.offerId);
  }
  return result;
}
