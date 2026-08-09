export function hasReportTarget(t: {
  reported_user_id?: string;
  reported_offer_id?: string;
  reported_request_id?: string;
}): boolean {
  return Boolean(
    t.reported_user_id || t.reported_offer_id || t.reported_request_id,
  );
}

export function isSelfReport(
  reporterId: string,
  reportedUserId?: string | null,
): boolean {
  return !!reportedUserId && reporterId === reportedUserId;
}

export function mergeReportDetails(
  existing: string | null,
  incoming: string | null | undefined,
): string | null {
  const a = existing?.trim() || "";
  const b = incoming?.trim() || "";
  if (a && b) return `${a}\n---\n${b}`;
  return a || b || null;
}

export function isValidReportStatus(s: string): boolean {
  return ["open", "reviewing", "resolved", "dismissed"].includes(s);
}
