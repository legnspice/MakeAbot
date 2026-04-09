# Notifications Rework — Pass 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the notifications panel's flat section-header grouping with tab navigation (All / Messages / Activity) and collapse read notifications after 3, with a "Show X more" button.

**Architecture:** All changes are confined to `components/ui/notifications-panel.tsx`. Add `activeTab` and `showAllRead` state, replace `groupNotifications` with a `filterByTab` function, and render tabs + split unread/read lists inline. No new files, no DB changes.

**Tech Stack:** Next.js 15 App Router, React, Tailwind CSS, TypeScript.

**Spec:** `docs/superpowers/specs/2026-04-08-notifications-rework-pass2-design.md`

---

## File Map

| File | Action |
|---|---|
| `components/ui/notifications-panel.tsx` | Modify — add tabs, read collapsing, remove groupNotifications |

---

## Task 1: Implement tabs and read collapsing in NotificationsPanel

**Files:**
- Modify: `components/ui/notifications-panel.tsx`

This is a pure UI refactor. The component currently uses `groupNotifications` to produce section headers. We replace that with:
1. A `filterByTab` function (flat filter, no headers)
2. A tab bar rendered between the header row and the list
3. Inline unread/read split with collapse threshold of 3

There are no unit-testable pure functions here (the component renders inside a client boundary and depends on server actions). Tests are manual/visual. The existing test suite covers the actions layer — no test file is modified.

- [ ] **Step 1: Read the current file**

Read `components/ui/notifications-panel.tsx` in full before making any changes. Understand the current state shape, the `groupNotifications` function, and the JSX structure.

- [ ] **Step 2: Replace the file with the updated implementation**

Replace the entire contents of `components/ui/notifications-panel.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, GearFill } from "react-bootstrap-icons";
import {
  getNotifications,
  markNotificationRead,
  markAllRead,
} from "@/lib/actions/notifications";
import type { SelectNotification } from "@/lib/db/schema";

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type ActiveTab = "All" | "Messages" | "Activity";

const CATEGORY_MAP: Record<string, ActiveTab> = {
  new_message: "Messages",
  new_review: "Activity",
  new_request: "Activity",
};

function filterByTab(
  notifications: SelectNotification[],
  tab: ActiveTab,
): SelectNotification[] {
  if (tab === "All") return notifications;
  return notifications.filter(
    (n) => (CATEGORY_MAP[n.type] ?? "Activity") === tab,
  );
}

const READ_THRESHOLD = 3;

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function NotificationsPanel({ open, onClose }: Props) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<SelectNotification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("All");
  const [showAllRead, setShowAllRead] = useState(false);

  const loading = open && !loaded;

  useEffect(() => {
    if (!open) {
      setLoaded(false);
      setActiveTab("All");
      setShowAllRead(false);
      return;
    }
    if (loaded) return;
    let cancelled = false;
    getNotifications().then((result) => {
      if (!cancelled) {
        setNotifications(result.data ?? []);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  async function handleClick(n: SelectNotification) {
    if (!n.is_read) {
      await markNotificationRead(n.id);
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === n.id ? { ...item, is_read: true } : item,
        ),
      );
    }
    if (n.url) {
      router.push(n.url);
      onClose();
    }
  }

  async function handleMarkAllRead() {
    await markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  const hasUnread = notifications.some((n) => !n.is_read);

  const TABS: ActiveTab[] = ["All", "Messages", "Activity"];

  const filtered = filterByTab(notifications, activeTab);
  const unread = filtered.filter((n) => !n.is_read);
  const read = filtered.filter((n) => n.is_read);
  const visibleRead = showAllRead ? read : read.slice(0, READ_THRESHOLD);
  const hiddenReadCount = read.length - READ_THRESHOLD;

  function renderNotification(n: SelectNotification) {
    return (
      <button
        key={n.id}
        type="button"
        onClick={() => handleClick(n)}
        className={`w-full text-left px-5 py-4 hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50 transition-colors ${n.is_read ? "opacity-60" : ""}`}
      >
        {!n.is_read && (
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2 mb-0.5" />
        )}
        <p className="text-sm font-semibold text-gray-900 leading-snug inline">
          {n.title}
        </p>
        {n.body && (
          <p className="mt-0.5 text-sm text-gray-600">{n.body}</p>
        )}
        <p className="mt-1 text-xs text-gray-400">
          {formatTime(new Date(n.created_at))}
        </p>
      </button>
    );
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 h-full w-100 bg-white border-l border-gray-200 z-50 flex flex-col shadow-xl transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
          <div className="flex items-center gap-3">
            {hasUnread && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-[#3761B0] hover:underline"
              >
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={() => { router.push("/settings/notifications"); onClose(); }}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
              aria-label="Notification settings"
            >
              <GearFill size={20} className="text-gray-600" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
              aria-label="Close notifications"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
                activeTab === tab
                  ? "text-[#3761B0] border-b-2 border-[#3761B0]"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center text-gray-400 text-sm pt-10">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 text-sm pt-10">
              No notifications yet
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {unread.map(renderNotification)}
              {visibleRead.map(renderNotification)}
              {!showAllRead && hiddenReadCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllRead(true)}
                  className="w-full py-3 text-xs text-[#3761B0] hover:underline text-center"
                >
                  Show {hiddenReadCount} more
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Run all tests**

```bash
pnpm test
```

Expected: All 79 tests pass (no test files touch this component directly; the actions layer tests are unaffected).

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm build 2>&1 | head -30
```

Expected: Build succeeds with no type errors. If there are errors, fix them before committing.

- [ ] **Step 5: Manual smoke test (optional but recommended)**

Open the app locally (`pnpm dev`), open the notifications panel:
- Confirm three tabs render: All, Messages, Activity
- Confirm All tab is selected by default
- Confirm switching tabs filters notifications correctly
- If you have more than 3 read notifications, confirm only 3 show and "Show X more" appears
- Confirm clicking "Show X more" reveals all read notifications
- Confirm closing and reopening the panel resets to the All tab

- [ ] **Step 6: Commit**

```bash
git add components/ui/notifications-panel.tsx
git commit -m "feat: add tab navigation and read notification collapsing to notifications panel"
```
