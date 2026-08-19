import { db } from "@/lib/db";
import {
  buildOpenReportTargetsQuery,
  findOpenReportTargetIds,
} from "@/lib/repo/reports.repo";

afterEach(() => {
  jest.restoreAllMocks();
});

describe("buildOpenReportTargetsQuery", () => {
  it("constrains on status = 'open'", () => {
    const { sql, params } = buildOpenReportTargetsQuery(["r1"], []).toSQL();

    expect(sql).toContain('"status"');
    expect(params).toContain("open");
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
