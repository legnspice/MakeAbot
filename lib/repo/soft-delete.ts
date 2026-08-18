import { isNull, type Column } from "drizzle-orm";

/**
 * Days a soft-deleted listing keeps its content before the expire-bids cron
 * anonymizes it. Decided 2026-08-19; see the spec's "Retention window" section.
 */
export const RETENTION_DAYS = 30;

/**
 * The one predicate that hides soft-deleted rows.
 *
 * Every exported read in messages/offers/requests/relationships.repo.ts must
 * call this — `__tests__/lib/repo/soft-delete-coverage.test.ts` enumerates those
 * modules' exports and fails if one does not. A single named helper, rather than
 * an inlined `isNull(x.deleted_at)`, is what makes that test possible.
 */
export function notDeleted(table: { deleted_at: Column }) {
  return isNull(table.deleted_at);
}

/** Cutoff for the anonymize sweep: rows soft-deleted before this are due. */
export function retentionCutoff(now: Date): Date {
  return new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
}
