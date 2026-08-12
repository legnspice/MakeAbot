export type UnreadRow = { context_id: string | null; message_count: number };

/** Sum coalesced message_count per context_id (bid/thread id); skip rows with no context. */
export function buildUnreadMap(rows: UnreadRow[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of rows) {
    if (!row.context_id) continue;
    map[row.context_id] = (map[row.context_id] ?? 0) + row.message_count;
  }
  return map;
}

/** Total unread across a set of bid ids (missing ids count as 0). */
export function sumUnreadForBids(
  map: Record<string, number>,
  bidIds: string[],
): number {
  let total = 0;
  for (const id of bidIds) total += map[id] ?? 0;
  return total;
}
