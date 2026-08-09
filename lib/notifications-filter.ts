export const NOTIF_TABS = ["All", "Messages", "Activity"] as const;
export type NotifTab = (typeof NOTIF_TABS)[number];

const MESSAGE_TYPES = new Set(["new_inquiry", "new_message"]);

export function matchesTab(type: string, tab: NotifTab): boolean {
  if (tab === "All") return true;
  const isMessage = MESSAGE_TYPES.has(type);
  return tab === "Messages" ? isMessage : !isMessage;
}
