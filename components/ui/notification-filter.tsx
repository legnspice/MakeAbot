"use client";

import { NOTIF_TABS, type NotifTab } from "@/lib/notifications-filter";

export default function NotificationFilter({
  active,
  onChange,
}: {
  active: NotifTab;
  onChange: (tab: NotifTab) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto whitespace-nowrap px-1 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {NOTIF_TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            active === tab
              ? "bg-[#3761B0] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
