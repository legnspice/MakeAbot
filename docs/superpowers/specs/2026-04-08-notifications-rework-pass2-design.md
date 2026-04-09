# Notifications Rework — Pass 2: Panel Tabs + Read Collapsing

**Date:** 2026-04-08
**Branch:** feature/notifications-overhaul
**Scope:** `components/ui/notifications-panel.tsx` only. No new files, no DB changes.

---

## Background

Pass 1 fixed all behavioral notification bugs. Pass 2 reworks the panel UI for better scannability:
- Replace flat section-header grouping with actual tab navigation
- Collapse read notifications after a threshold (3 visible, rest behind "Show X more")

---

## Changes

### 1. Tab navigation

Add a tab bar below the title/actions header row. Three tabs:

| Tab | Shows |
|---|---|
| All | All notifications, unread first then read |
| Messages | Only `new_message` type |
| Activity | Only `new_review` and `new_request` types |

**State:** `activeTab: "All" | "Messages" | "Activity"` — `useState`, defaults to `"All"`.

**Reset:** When `open` becomes `false`, reset `activeTab` to `"All"` (alongside existing `loaded` reset).

**Tab styling:** Underline-style tabs matching the existing chat page tab pattern (`text-[#3761B0] border-b-2 border-[#3761B0]` for active, `text-gray-400 hover:text-gray-600` for inactive). Tab bar sits below the title/gear/close row, separated by the existing `border-b`.

**Remove:** The existing `groupNotifications` function and all section header rendering. Tabs replace this concern entirely. The `CATEGORY_MAP` constant is retained (used internally to determine which tab a notification belongs to) but the grouping/header output is dropped.

**Filter function:** Replace `groupNotifications` with `filterByTab(notifications: SelectNotification[], tab: ActiveTab): SelectNotification[]`:
- `"All"` → return all notifications
- `"Messages"` → return where `n.type === "new_message"`
- `"Activity"` → return where `CATEGORY_MAP[n.type] === "Activity"`

---

### 2. Read notification collapsing

Within the tab-filtered list, split into unread and read groups:

- **Unread** items: shown always, full opacity, in chronological order (most recent first, matching existing `updated_at` sort from the server)
- **Read** items: dimmed (existing `opacity-60` class). Show first 3. If more than 3 read notifications exist in the current tab, show a `"Show X more"` button below the visible 3 (where X = total read count − 3). Clicking reveals all read notifications. No re-collapse after expanding.

**State:** `showAllRead: boolean` — `useState(false)`, reset to `false` when `open` becomes `false`.

**New user edge case:** If there are zero read notifications, no collapse UI renders at all.

**Threshold:** 3 read notifications visible before collapsing. This applies per-tab (i.e., switching tabs resets the visible count to the first 3 read in that tab). `showAllRead` is a single boolean — switching tabs while `showAllRead = true` still shows all read in the new tab. This is acceptable behaviour; no need to reset `showAllRead` on tab switch.

---

## What Does NOT Change

- Panel open/close animation and backdrop
- Header layout (title, "Mark all read" button, gear icon, close button)
- `handleClick` (mark read + navigate)
- `handleMarkAllRead`
- `formatTime`
- `getNotifications` fetch and cache-reset logic
- `notifications-bell.tsx` — untouched

---

## Files Changed

| File | Action |
|---|---|
| `components/ui/notifications-panel.tsx` | Modify — add tabs, add read collapsing, remove `groupNotifications` |
