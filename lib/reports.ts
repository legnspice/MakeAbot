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
