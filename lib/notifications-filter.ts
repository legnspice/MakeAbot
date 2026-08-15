export const NOTIF_TABS = ["All", "Messages", "Activity"] as const;
export type NotifTab = (typeof NOTIF_TABS)[number];

const MESSAGE_TYPES = new Set(["new_inquiry", "new_message"]);

/**
 * Message types coalesce per thread, so they carry a running count and their
 * `updated_at` — not `created_at` — is the meaningful timestamp.
 */
export function isCoalescedType(type: string): boolean {
  return MESSAGE_TYPES.has(type);
}

export function matchesTab(type: string, tab: NotifTab): boolean {
  if (tab === "All") return true;
  const isMessage = MESSAGE_TYPES.has(type);
  return tab === "Messages" ? isMessage : !isMessage;
}
