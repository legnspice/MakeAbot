import { db } from "@/lib/db";
import {
  buildOpenReportTargetsQuery,
  findOpenReportTargetIds,
  PROTECTIVE_REPORT_STATUSES,
} from "@/lib/repo/reports.repo";

afterEach(() => {
  jest.restoreAllMocks();
});

describe("buildOpenReportTargetsQuery", () => {
  it("constrains on the protective statuses, and only those", () => {
    const { sql, params } = buildOpenReportTargetsQuery(["r1"], []).toSQL();

    expect(sql).toContain('"status"');
    expect(params).toContain("open");
    // A report under active moderation review must protect its listing too —
    // that is exactly when the evidence matters most.
    expect(params).toContain("reviewing");
    // Closed-out reports must NOT protect, or nothing ever ages out.
    expect(params).not.toContain("resolved");
    expect(params).not.toContain("dismissed");
  });

  it("a reviewing report protects its listing from the purge", async () => {
    // Build the real query first — the db.select mock below would otherwise
    // swallow the builder.
    const { params } = buildOpenReportTargetsQuery(
      ["r-under-review"],
      [],
    ).toSQL();
    expect(params).toContain("reviewing");
    expect([...PROTECTIVE_REPORT_STATUSES]).toContain("reviewing");

    // The purge asks findOpenReportTargetIds which listings to skip; a report
    // sitting in `reviewing` must come back in that skip set.
    const where = jest
      .fn()
      .mockResolvedValue([{ requestId: "r-under-review", offerId: null }]);
    const from = jest.fn().mockReturnValue({ where });
    jest.spyOn(db, "select").mockReturnValue({ from } as never);

    const result = await findOpenReportTargetIds(["r-under-review"], []);

    expect(result.requestIds.has("r-under-review")).toBe(true);
  });

  it("includes both id branches when both arrays are non-empty", () => {
    const { sql, params } = buildOpenReportTargetsQuery(
      ["r1", "r2"],
      ["o1"],
    ).toSQL();

    expect(sql).toContain('"reported_request_id"');
    expect(sql).toContain('"reported_offer_id"');
    expect(params).toEqual(expect.arrayContaining(["r1", "r2", "o1"]));
  });

  it("includes only the request branch when offerIds is empty", () => {
    const { sql, params } = buildOpenReportTargetsQuery(
      ["r1", "r2"],
      [],
    ).toSQL();
    // The select projection always names both columns; only the WHERE
    // clause reveals whether the offer branch was actually included.
    const whereClause = sql.slice(sql.indexOf(" where "));

    expect(whereClause).toContain('"reported_request_id"');
    expect(whereClause).not.toContain('"reported_offer_id"');
    expect(params).toEqual(expect.arrayContaining(["r1", "r2"]));
  });

  it("includes only the offer branch when requestIds is empty", () => {
    const { sql, params } = buildOpenReportTargetsQuery(
      [],
      ["o1", "o2"],
    ).toSQL();
    const whereClause = sql.slice(sql.indexOf(" where "));

    expect(whereClause).toContain('"reported_offer_id"');
    expect(whereClause).not.toContain('"reported_request_id"');
    expect(params).toEqual(expect.arrayContaining(["o1", "o2"]));
  });
});

describe("findOpenReportTargetIds", () => {
  it("returns two empty Sets without building or issuing a query when both arrays are empty", async () => {
    const selectSpy = jest.spyOn(db, "select");

    const result = await findOpenReportTargetIds([], []);

    expect(result).toEqual({
      requestIds: new Set<string>(),
      offerIds: new Set<string>(),
    });
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it("returns { requestIds, offerIds } Sets and never adds null for the other column", async () => {
    const rows = [
      { requestId: "r1", offerId: null },
      { requestId: null, offerId: "o1" },
      { requestId: "r2", offerId: null },
    ];
    const where = jest.fn().mockResolvedValue(rows);
    const from = jest.fn().mockReturnValue({ where });
    jest.spyOn(db, "select").mockReturnValue({ from } as never);

    const result = await findOpenReportTargetIds(["r1", "r2"], ["o1"]);

    expect(result.requestIds).toEqual(new Set(["r1", "r2"]));
    expect(result.offerIds).toEqual(new Set(["o1"]));
    expect(result.requestIds.has(null as never)).toBe(false);
    expect(result.offerIds.has(null as never)).toBe(false);
  });
});
