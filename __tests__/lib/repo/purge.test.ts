import { getTableName } from "drizzle-orm";
import { RETENTION_DAYS, retentionCutoff } from "@/lib/repo/soft-delete";

jest.mock("@/lib/db", () => ({ db: {} }));
jest.mock("@/lib/repo/reports.repo");
jest.mock("@/lib/supabase/storage");

import { db } from "@/lib/db";
import * as reportsRepo from "@/lib/repo/reports.repo";
import { deleteStorageObject } from "@/lib/supabase/storage";
import { ANONYMIZED_TITLE, purgeDueListings } from "@/lib/repo/purge.repo";

type Row = Record<string, unknown>;

/** Every db operation the sweep issued, in order, for assertions. */
type Op =
  | { kind: "select"; table: string; params: unknown[]; sql: string }
  | { kind: "delete"; table: string; params: unknown[] }
  | { kind: "update"; table: string; values: Row; params: unknown[] };

/**
 * Pull the bound values out of a Drizzle SQL predicate.
 *
 * Lets the window tests assert on the real cutoff and the real
 * "not already anonymized" marker instead of trusting an empty result set.
 */
function boundParams(node: unknown, out: unknown[] = []): unknown[] {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const child of node) boundParams(child, out);
    return out;
  }
  const n = node as {
    queryChunks?: unknown;
    value?: unknown;
    encoder?: unknown;
  };
  if (n.queryChunks !== undefined) return boundParams(n.queryChunks, out);
  if (n.encoder !== undefined && "value" in n) out.push(n.value);
  return out;
}

/**
 * Render the *operator text* of a Drizzle SQL predicate, e.g.
 * `"( is not null and  <  and  is null)"`.
 *
 * `boundParams` only proves the right value was bound; it says nothing about
 * which comparison bound it, so `lt` -> `gt` or `isNull` -> `isNotNull`
 * would pass silently. Drizzle's SQL tree stores literal SQL text as
 * `StringChunk`s (a bare array-valued node with no `encoder`) interleaved
 * with the column/param nodes, so collecting just those chunks reconstructs
 * the operators in source order without the identifiers or bound values
 * getting in the way.
 */
function sqlText(node: unknown, out: string[] = []): string {
  if (!node || typeof node !== "object") return out.join("");
  if (Array.isArray(node)) {
    for (const child of node) sqlText(child, out);
    return out.join("");
  }
  const n = node as {
    queryChunks?: unknown;
    value?: unknown;
    encoder?: unknown;
  };
  if (
    n.value !== undefined &&
    Array.isArray(n.value) &&
    n.encoder === undefined
  ) {
    out.push(...n.value.filter((v): v is string => typeof v === "string"));
    return out.join("");
  }
  if (n.queryChunks !== undefined) sqlText(n.queryChunks, out);
  return out.join("");
}

let ops: Op[];
/** Queued results per table: one array per successive call. */
let selectResults: Record<string, Row[][]>;
let deleteResults: Record<string, Row[][]>;

function nextFor(store: Record<string, Row[][]>, table: string): Row[] {
  const queue = store[table];
  return (queue && queue.shift()) ?? [];
}

/**
 * Minimal stand-in for the Drizzle builder: records which table each verb
 * touched and replays queued rows. Recording, not just returning, is what lets
 * the "never delete a bid" test inspect the calls themselves.
 */
function installDbMock() {
  ops = [];
  selectResults = {};
  deleteResults = {};

  const mock = db as unknown as Record<string, unknown>;
  mock.select = () => ({
    from: (table: object) => ({
      where: (w: unknown) => {
        const name = getTableName(table as never);
        ops.push({
          kind: "select",
          table: name,
          params: boundParams(w),
          sql: sqlText(w),
        });
        return Promise.resolve(nextFor(selectResults, name));
      },
    }),
  });
  mock.delete = (table: object) => {
    const name = getTableName(table as never);
    return {
      where: (w: unknown) => ({
        returning: () => {
          ops.push({ kind: "delete", table: name, params: boundParams(w) });
          return Promise.resolve(nextFor(deleteResults, name));
        },
      }),
    };
  };
  mock.update = (table: object) => {
    const name = getTableName(table as never);
    return {
      set: (values: Row) => ({
        where: (w: unknown) => {
          ops.push({
            kind: "update",
            table: name,
            values,
            params: boundParams(w),
          });
          return Promise.resolve([]);
        },
      }),
    };
  };
}

const NOW = new Date("2026-08-19T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
/** Comfortably outside the retention window. */
const OLD = new Date(NOW.getTime() - (RETENTION_DAYS + 5) * DAY);

function candidate(id: string, imgUrl: string | null = null): Row {
  return { id, imgUrl, updated_at: OLD };
}

beforeEach(() => {
  jest.clearAllMocks();
  installDbMock();
  (reportsRepo.findOpenReportTargetIds as jest.Mock).mockResolvedValue({
    requestIds: new Set<string>(),
    offerIds: new Set<string>(),
  });
  (deleteStorageObject as jest.Mock).mockResolvedValue(true);
});

describe("purgeDueListings", () => {
  it("anonymizes a due listing and hard-deletes its messages", async () => {
    selectResults = {
      requests: [
        [
          candidate(
            "r1",
            "https://x/storage/v1/object/public/post_photos/a.jpg",
          ),
        ],
      ],
      offers: [[]],
      request_bids: [[{ id: "rb1" }, { id: "rb2" }]],
    };
    deleteResults = { messages: [[{ id: "m1" }, { id: "m2" }, { id: "m3" }]] };

    const summary = await purgeDueListings(NOW);

    expect(summary).toEqual({
      requests: 1,
      offers: 0,
      messagesDeleted: 3,
      skippedReported: 0,
      storageFailures: 0,
    });

    // Messages go first, then the row is stripped.
    const messageDelete = ops.findIndex(
      (o) => o.kind === "delete" && o.table === "messages",
    );
    const rowUpdate = ops.findIndex(
      (o) => o.kind === "update" && o.table === "requests",
    );
    expect(messageDelete).toBeGreaterThanOrEqual(0);
    expect(rowUpdate).toBeGreaterThan(messageDelete);

    const update = ops[rowUpdate] as Extract<Op, { kind: "update" }>;
    expect(update.values).toEqual({
      title: ANONYMIZED_TITLE,
      description: null,
      incentive: null,
      imgUrl: null,
      anonymized_at: NOW,
      updated_at: OLD,
    });
    // Nothing else may be written — fee/price/urgency/status/user_id/timestamps stay.
    for (const key of [
      "fee",
      "price",
      "urgency",
      "status",
      "user_id",
      "created_at",
      "completed_at",
      "deleted_at",
    ]) {
      expect(update.values).not.toHaveProperty(key);
    }

    // imgUrl was captured before nulling, so the object is still findable.
    expect(deleteStorageObject).toHaveBeenCalledWith(
      "https://x/storage/v1/object/public/post_photos/a.jpg",
    );
  });

  it("skips a listing with an open report entirely", async () => {
    selectResults = {
      requests: [[candidate("r1", "https://x/img.jpg")]],
      offers: [[candidate("o1")]],
      offer_bids: [[{ id: "ob1" }]],
    };
    deleteResults = { messages: [[{ id: "m1" }]] };
    (reportsRepo.findOpenReportTargetIds as jest.Mock).mockResolvedValue({
      requestIds: new Set(["r1"]),
      offerIds: new Set<string>(),
    });

    const summary = await purgeDueListings(NOW);

    expect(summary.skippedReported).toBe(1);
    expect(summary.requests).toBe(0);
    // The reported request produced neither a message delete nor an update...
    expect(ops.filter((o) => o.table === "request_bids")).toHaveLength(0);
    expect(
      ops.filter((o) => o.kind === "update" && o.table === "requests"),
    ).toHaveLength(0);
    // ...and its image was left in storage as evidence.
    expect(deleteStorageObject).not.toHaveBeenCalledWith("https://x/img.jpg");
    // The unreported offer alongside it was still swept.
    expect(summary.offers).toBe(1);
  });

  it("leaves a listing soft-deleted inside the window untouched", async () => {
    // The window is enforced in SQL: assert the predicate really binds the
    // retention cutoff, so a row tombstoned after it cannot be a candidate.
    selectResults = { requests: [[]], offers: [[]] };

    const summary = await purgeDueListings(NOW);

    const cutoff = retentionCutoff(NOW);
    for (const table of ["requests", "offers"]) {
      const op = ops.find(
        (o) => o.kind === "select" && o.table === table,
      ) as Extract<Op, { kind: "select" }>;
      expect(op).toBeDefined();
      expect(op.params).toContainEqual(cutoff);
      // Sanity: the cutoff is RETENTION_DAYS back, not "now".
      expect(cutoff.getTime()).toBe(NOW.getTime() - RETENTION_DAYS * DAY);
      // Operator coverage: `boundParams` above only proves the cutoff value
      // was bound *somewhere* — it would still pass if `lt` became `gt`, or
      // if `isNull(anonymized_at)` became `isNotNull(anonymized_at)`. The
      // mock replays whatever rows a test queues regardless of the predicate
      // it's given, so a behavioural "two rows, only the older one swept"
      // test can't distinguish those inversions either — it would pass
      // against a broken predicate just as easily. Assert on the generated
      // SQL text instead, which does encode the operator.
      expect(op.sql).toContain(" < ");
      expect(op.sql).not.toContain(" > ");
      expect(op.sql.trim().endsWith("is null)")).toBe(true);
      expect(op.sql).not.toContain("is not null)");
    }

    expect(summary).toEqual({
      requests: 0,
      offers: 0,
      messagesDeleted: 0,
      skippedReported: 0,
      storageFailures: 0,
    });
    expect(ops.filter((o) => o.kind !== "select")).toHaveLength(0);
    // With no candidates there is nothing to ask the reports table about.
    expect(reportsRepo.findOpenReportTargetIds).not.toHaveBeenCalled();
  });

  it("never deletes a bid, in any path", async () => {
    // Two requests and two offers, one of each reported, all with bids and
    // messages — every branch the sweep has.
    selectResults = {
      requests: [[candidate("r1", "https://x/a.jpg"), candidate("r2")]],
      offers: [[candidate("o1"), candidate("o2", "https://x/b.jpg")]],
      request_bids: [[{ id: "rb1" }]],
      offer_bids: [[{ id: "ob1" }]],
    };
    deleteResults = { messages: [[{ id: "m1" }], [{ id: "m2" }]] };
    (reportsRepo.findOpenReportTargetIds as jest.Mock).mockResolvedValue({
      requestIds: new Set(["r2"]),
      offerIds: new Set(["o1"]),
    });
    (deleteStorageObject as jest.Mock).mockResolvedValue(false);

    await purgeDueListings(NOW);

    const deletes = ops.filter((o) => o.kind === "delete");
    expect(deletes.length).toBeGreaterThan(0);
    // reviews ON DELETE CASCADE from both bid tables: deleting a bid would
    // destroy the reviews this whole spec exists to preserve.
    expect(deletes.map((o) => o.table)).not.toContain("request_bids");
    expect(deletes.map((o) => o.table)).not.toContain("offer_bids");
    for (const op of deletes) expect(op.table).toBe("messages");
    // Bid tables are read only, and never written at all.
    for (const op of ops) {
      if (op.table === "request_bids" || op.table === "offer_bids") {
        expect(op.kind).toBe("select");
      }
    }
  });

  it("counts a failed storage delete and keeps going", async () => {
    selectResults = {
      requests: [[candidate("r1", "https://x/a.jpg")]],
      offers: [[candidate("o1", "https://x/b.jpg")]],
      request_bids: [[{ id: "rb1" }]],
      offer_bids: [[{ id: "ob1" }]],
    };
    deleteResults = { messages: [[{ id: "m1" }], [{ id: "m2" }]] };
    (deleteStorageObject as jest.Mock)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const summary = await purgeDueListings(NOW);

    expect(summary.storageFailures).toBe(1);
    // The offer after the failing request was still anonymized.
    expect(summary.requests).toBe(1);
    expect(summary.offers).toBe(1);
    expect(summary.messagesDeleted).toBe(2);
    expect(ops.filter((o) => o.kind === "update").map((o) => o.table)).toEqual([
      "requests",
      "offers",
    ]);
  });

  it("is a no-op on a second run over already-anonymized listings", async () => {
    // Run once for real, then hand the second run what the DB would return:
    // nothing, because the predicate excludes rows with anonymized_at set.
    selectResults = {
      requests: [[candidate("r1")], []],
      offers: [[], []],
      request_bids: [[{ id: "rb1" }]],
    };
    deleteResults = { messages: [[{ id: "m1" }]] };

    const first = await purgeDueListings(NOW);
    expect(first.requests).toBe(1);

    const opsAfterFirst = ops.length;
    const second = await purgeDueListings(NOW);

    expect(second).toEqual({
      requests: 0,
      offers: 0,
      messagesDeleted: 0,
      skippedReported: 0,
      storageFailures: 0,
    });
    // The second pass only read; it wrote and deleted nothing.
    expect(ops.slice(opsAfterFirst).every((o) => o.kind === "select")).toBe(
      true,
    );
    // And the exclusion it relies on is genuinely in the predicate: a row
    // with anonymized_at already set is excluded via `isNull(anonymized_at)`,
    // not by matching on ANONYMIZED_TITLE (which is now just a placeholder
    // value, not the sentinel — a user-chosen title of "[deleted]" must not
    // exempt a listing from the sweep). Assert on the generated SQL text so
    // an inversion to `isNotNull` — which would flip the sweep to target
    // already-anonymized rows instead of skipping them — fails the test.
    const requestSelects = ops.filter(
      (o) => o.kind === "select" && o.table === "requests",
    ) as Extract<Op, { kind: "select" }>[];
    expect(requestSelects).toHaveLength(2);
    for (const op of requestSelects) {
      expect(op.sql.trim().endsWith("is null)")).toBe(true);
      expect(op.sql).not.toContain("is not null)");
    }
  });
});
