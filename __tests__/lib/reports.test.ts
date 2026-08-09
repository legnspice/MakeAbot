import { hasReportTarget, isSelfReport, mergeReportDetails, isValidReportStatus } from "@/lib/reports";
import { insertReportSchema } from "@/lib/validation/reports";

describe("hasReportTarget", () => {
  it("true when any one target id is present", () => {
    expect(hasReportTarget({ reported_user_id: "u1" })).toBe(true);
    expect(hasReportTarget({ reported_offer_id: "o1" })).toBe(true);
    expect(hasReportTarget({ reported_request_id: "r1" })).toBe(true);
  });
  it("false when no target is present", () => {
    expect(hasReportTarget({})).toBe(false);
  });
});

describe("isSelfReport", () => {
  it("true only when reporter equals reported user", () => {
    expect(isSelfReport("u1", "u1")).toBe(true);
    expect(isSelfReport("u1", "u2")).toBe(false);
    expect(isSelfReport("u1", undefined)).toBe(false);
    expect(isSelfReport("u1", null)).toBe(false);
  });
});

describe("insertReportSchema", () => {
  it("accepts a valid user report", () => {
    const r = insertReportSchema.safeParse({
      reason: "Spam",
      reported_user_id: "b3f1c2d4-0000-4000-8000-000000000001",
    });
    expect(r.success).toBe(true);
  });
  it("rejects when no target is present", () => {
    const r = insertReportSchema.safeParse({ reason: "Spam" });
    expect(r.success).toBe(false);
  });
  it("rejects an invalid reason", () => {
    const r = insertReportSchema.safeParse({
      reason: "Nonsense",
      reported_user_id: "b3f1c2d4-0000-4000-8000-000000000001",
    });
    expect(r.success).toBe(false);
  });
});

describe("mergeReportDetails", () => {
  it("joins existing and incoming with a separator", () => {
    expect(mergeReportDetails("a", "b")).toBe("a\n---\nb");
  });
  it("returns the non-empty side when the other is empty", () => {
    expect(mergeReportDetails("a", null)).toBe("a");
    expect(mergeReportDetails(null, "b")).toBe("b");
    expect(mergeReportDetails("a", "")).toBe("a");
  });
  it("returns null when both are empty", () => {
    expect(mergeReportDetails(null, null)).toBeNull();
    expect(mergeReportDetails("", undefined)).toBeNull();
  });
});

describe("isValidReportStatus", () => {
  it("accepts the four statuses", () => {
    for (const s of ["open", "reviewing", "resolved", "dismissed"]) {
      expect(isValidReportStatus(s)).toBe(true);
    }
  });
  it("rejects anything else", () => {
    expect(isValidReportStatus("deleted")).toBe(false);
    expect(isValidReportStatus("")).toBe(false);
  });
});
