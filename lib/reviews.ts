export function oneBidRef(d: {
  offer_bid_id?: string | null;
  request_bid_id?: string | null;
}): { kind: "offer" | "request"; bidId: string } | null {
  const hasOffer = !!d.offer_bid_id;
  const hasRequest = !!d.request_bid_id;
  if (hasOffer === hasRequest) return null; // zero or both → invalid
  return hasOffer
    ? { kind: "offer", bidId: d.offer_bid_id as string }
    : { kind: "request", bidId: d.request_bid_id as string };
}
