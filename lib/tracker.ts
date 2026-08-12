export function indexById<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((r) => [r.id, r]));
}

export function groupBidsByParent<B>(
  bids: B[],
  parentKey: (b: B) => string,
): Map<string, B[]> {
  const m = new Map<string, B[]>();
  for (const b of bids) {
    const k = parentKey(b);
    const arr = m.get(k);
    if (arr) arr.push(b);
    else m.set(k, [b]);
  }
  return m;
}
