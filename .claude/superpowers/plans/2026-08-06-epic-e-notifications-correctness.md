# Epic E — Notifications Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove review notifications entirely, unify the mobile notification filter on a scrollable chip UI, and harden the notification emails (escape interpolation + graceful logo fallback).

**Architecture:** Three independent workstreams. (1) A pure `escapeHtml`/`siteBaseUrl` helper module used by the email service. (2) Deletion of every `new_review` path across service/validation/schema/UI. (3) A shared pure `matchesTab` helper + a `NotificationFilter` chip component consumed by both the notifications panel and page, replacing equal-width tabs and stacked groups.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle ORM, Resend, Jest, react-bootstrap-icons.

## Global Constraints

- Branch: `feature/qa-fixes-v2` (off `dev`). Do NOT create a new branch.
- One `drizzle-kit push` (dropping the `new_review` column) is bundled with Epic D's push and run by the user in their TTY — this plan does NOT run it. Code must compile without it having run.
- Layered backend: Server Action → Service → Repository → DB.
- Category mapping (used by the filter): **Messages** = `new_inquiry`, `new_message`; **Activity** = everything else (`new_request`, `request_completed_winner`, `request_completed_loser`, `offer_bid_completed`, `bid_expired`). **All** = no filter.
- Brand color: `#3761B0`. Active chip = filled `#3761B0` white text; inactive = gray.
- Only touched files must be lint-clean (0 new errors); the repo has large pre-existing lint debt.
- `npm format` before any push.

---

### Task 1: `escapeHtml` + `siteBaseUrl` email helpers (pure, TDD)

**Files:**
- Create: `lib/email-format.ts`
- Test: `__tests__/lib/email-format.test.ts`

**Interfaces:**
- Produces: `escapeHtml(s: string): string` and `siteBaseUrl(): string` — consumed by Task 2.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/email-format.test.ts`:

```ts
import { escapeHtml, siteBaseUrl } from "@/lib/email-format";

describe("escapeHtml", () => {
  it("escapes & < > \" '", () => {
    expect(escapeHtml(`<a href="x">Tom & "Jerry" 'x'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; &quot;Jerry&quot; &#39;x&#39;&lt;/a&gt;",
    );
  });
  it("escapes & first (no double-escaping)", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });
  it("leaves plain text and empty string untouched", () => {
    expect(escapeHtml("Hello world")).toBe("Hello world");
    expect(escapeHtml("")).toBe("");
  });
});

describe("siteBaseUrl", () => {
  const orig = process.env.NEXT_PUBLIC_SITE_URL;
  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = orig;
  });
  it("returns the env value without a trailing slash", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://makeabot.app/";
    expect(siteBaseUrl()).toBe("https://makeabot.app");
  });
  it("returns empty string (never 'undefined') when unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(siteBaseUrl()).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/lib/email-format.test.ts`
Expected: FAIL — cannot find module `@/lib/email-format`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/email-format.ts`:

```ts
/** Escape a string for safe interpolation into HTML. Order matters: & first. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Absolute site base URL for email links/assets, without trailing slash.
 *  Empty string when unset — callers must never emit "undefined" into markup. */
export function siteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/lib/email-format.test.ts`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add lib/email-format.ts __tests__/lib/email-format.test.ts
git commit -m "feat(email): escapeHtml + siteBaseUrl pure helpers (tested)"
```

---

### Task 2: Apply escaping + graceful logo fallback in the email service

**Files:**
- Modify: `lib/services/email.service.ts`

**Interfaces:**
- Consumes: `escapeHtml`, `siteBaseUrl` (Task 1).

- [ ] **Step 1: Import the helpers**

At the top of `lib/services/email.service.ts`, add:

```ts
import { escapeHtml, siteBaseUrl } from "@/lib/email-format";
```

- [ ] **Step 2: Escape interpolation + logo fallback in `buildEmailHtml`**

Replace the body of `buildEmailHtml` so `title`/`body` are escaped and the logo degrades to a text wordmark when there's no base URL. Change the logo `<td>` and the title/body `<p>` lines:

```ts
function buildEmailHtml(
  title: string,
  body: string | undefined,
  fullUrl: string,
): string {
  const base = siteBaseUrl();
  const logo = base
    ? `<img src="${base}/icons/icon-192x192.png" alt="MakeAbot" width="40" height="40" style="border-radius:8px;display:block;" />`
    : `<span style="font-size:20px;font-weight:700;color:#3761B0;">MakeAbot</span>`;
  const safeTitle = escapeHtml(title);
  const safeBody = body ? escapeHtml(body) : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#3761B0;height:4px;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0;text-align:left;">
              ${logo}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;">
              <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#111827;">${safeTitle}</p>
              ${safeBody ? `<p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">${safeBody}</p>` : ""}
              <a href="${fullUrl}"
                 style="display:inline-block;padding:12px 24px;background:#3761B0;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
                View on MakeAbot
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                You're receiving this because you have email notifications enabled.<br />
                Manage your preferences in the MakeAbot app under Settings → Notifications.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
```

- [ ] **Step 3: Use `siteBaseUrl()` in `sendTransactionalEmail`**

In `sendTransactionalEmail`, replace the `fullUrl` line:

```ts
  const fullUrl = url.startsWith("http") ? url : `${siteBaseUrl()}${url}`;
```

(The `subject`/`text` fields are plain text — no escaping. `title`/`body` are escaped inside `buildEmailHtml`.)

- [ ] **Step 4: Escape interpolation + logo fallback in `sendDailyDigest`**

In `sendDailyDigest`, (a) escape the per-row `r.title`/`r.body` and use `siteBaseUrl()` for the row URL, (b) escape `subject` where interpolated into HTML, (c) apply the same `logo` fallback. Replace the `listItems` builder and the `fullUrl`/`html` lines:

```ts
        const base = siteBaseUrl();
        const logo = base
          ? `<img src="${base}/icons/icon-192x192.png" alt="MakeAbot" width="40" height="40" style="border-radius:8px;display:block;" />`
          : `<span style="font-size:20px;font-weight:700;color:#3761B0;">MakeAbot</span>`;

        const listItems = rows
          .map((r) => {
            const url = r.url
              ? r.url.startsWith("http")
                ? r.url
                : `${base}${r.url}`
              : base || "/";
            return `<li style="margin-bottom:12px;">
              <a href="${url}" style="font-size:14px;font-weight:600;color:#3761B0;text-decoration:none;">${escapeHtml(r.title)}</a>
              ${r.body ? `<p style="margin:2px 0 0;font-size:13px;color:#6b7280;">${escapeHtml(r.body)}</p>` : ""}
            </li>`;
          })
          .join("");

        const fullUrl = `${base}/notifications`;
        const safeSubject = escapeHtml(subject);
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeSubject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr><td style="background:#3761B0;height:4px;font-size:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:24px 32px 0;text-align:left;">
              ${logo}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;">
              <p style="margin:0 0 16px;font-size:20px;font-weight:600;color:#111827;">${safeSubject}</p>
              <ul style="margin:0 0 24px;padding-left:0;list-style:none;">${listItems}</ul>
              <a href="${fullUrl}"
                 style="display:inline-block;padding:12px 24px;background:#3761B0;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
                View all notifications
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                You're receiving this daily digest because you have unread conversations.<br />
                Manage your preferences in the MakeAbot app under Settings → Notifications.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
```

(The `text:` fallback and `subject:` field passed to `resend.emails.send` stay as-is — plain text, not HTML.)

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add lib/services/email.service.ts
git commit -m "fix(email): escape interpolated values + graceful logo fallback"
```

> **Deploy note (not a code step):** set `NEXT_PUBLIC_SITE_URL` in the Vercel/prod env so the logo image + absolute links resolve; without it the email now shows a text "MakeAbot" wordmark instead of a broken image.

---

### Task 3: Remove review notifications — backend (service + validation + schema)

**Files:**
- Modify: `lib/services/reviews.service.ts`
- Modify: `lib/validation/notifications.ts`
- Modify: `lib/db/schema.ts:178`

**Interfaces:**
- Produces: no `new_review` notification is ever sent; `new_review` no longer a valid notification type or preference.

- [ ] **Step 1: Remove the review push send**

In `lib/services/reviews.service.ts`, delete the `sendPushToUser(data.rated_user_id, "new_review", {...})` block inside `createReview` so it becomes:

```ts
export async function createReview(data: InsertReviewSchema) {
  return await reviewsRepo.insertReview(data);
}
```

Remove the now-unused `import { sendPushToUser } from "./push.service";` if nothing else in the file uses it.

- [ ] **Step 2: Remove `new_review` from validation**

In `lib/validation/notifications.ts`: delete `"new_review",` from `NOTIFICATION_TYPES` (line 6) and delete `new_review: z.boolean().optional(),` from `updatePreferencesSchema` (line 37).

- [ ] **Step 3: Remove the schema column**

In `lib/db/schema.ts`, delete the `new_review: boolean("new_review").notNull().default(true),` line (line 178) from `notification_preferences`. (`insertDefaultPreferences` inserts only `{ user_id }` and push gating uses `prefKey in prefs`, so nothing references the column by name — safe once pushed.)

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors. (`SelectNotificationPreferences` loses `new_review`; Task 4 removes the UI reference that would otherwise error.)

- [ ] **Step 5: Commit**

```bash
git add lib/services/reviews.service.ts lib/validation/notifications.ts lib/db/schema.ts
git commit -m "feat(notif): stop sending review notifications (remove new_review type/pref/column)"
```

---

### Task 4: Remove the review toggle from settings

**Files:**
- Modify: `app/(protected)/settings/notifications/page.tsx:19`

**Interfaces:**
- Consumes: the trimmed `SelectNotificationPreferences` from Task 3.

- [ ] **Step 1: Remove the label entry**

In `app/(protected)/settings/notifications/page.tsx`, delete `new_review: "New reviews",` from the `EVENT_LABELS` map (line 19). The page derives its toggles from `Object.keys(EVENT_LABELS)`, so the review toggle disappears automatically.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors (the `Record<keyof Omit<SelectNotificationPreferences,"user_id">, string>` type now has no `new_review` key — consistent).

- [ ] **Step 3: Commit**

```bash
git add "app/(protected)/settings/notifications/page.tsx"
git commit -m "feat(notif): remove review toggle from notification settings"
```

---

### Task 5: Shared `matchesTab` helper + `NotificationFilter` chip component

**Files:**
- Create: `lib/notifications-filter.ts`
- Test: `__tests__/lib/notifications-filter.test.ts`
- Create: `components/ui/notification-filter.tsx`

**Interfaces:**
- Produces:
  - `NOTIF_TABS: readonly ["All","Messages","Activity"]`, `type NotifTab`, and `matchesTab(type: string, tab: NotifTab): boolean` (pure).
  - `NotificationFilter({ active, onChange }: { active: NotifTab; onChange: (t: NotifTab) => void })` — a horizontally-scrollable chip row.
- Consumed by Tasks 6 and 7.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/notifications-filter.test.ts`:

```ts
import { matchesTab } from "@/lib/notifications-filter";

describe("matchesTab", () => {
  it("All matches everything", () => {
    expect(matchesTab("new_message", "All")).toBe(true);
    expect(matchesTab("bid_expired", "All")).toBe(true);
  });
  it("Messages matches inquiries and messages only", () => {
    expect(matchesTab("new_inquiry", "Messages")).toBe(true);
    expect(matchesTab("new_message", "Messages")).toBe(true);
    expect(matchesTab("new_request", "Messages")).toBe(false);
  });
  it("Activity matches everything that is not a message", () => {
    expect(matchesTab("new_request", "Activity")).toBe(true);
    expect(matchesTab("offer_bid_completed", "Activity")).toBe(true);
    expect(matchesTab("new_message", "Activity")).toBe(false);
    expect(matchesTab("new_inquiry", "Activity")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/lib/notifications-filter.test.ts`
Expected: FAIL — cannot find module `@/lib/notifications-filter`.

- [ ] **Step 3: Write the pure helper**

Create `lib/notifications-filter.ts`:

```ts
export const NOTIF_TABS = ["All", "Messages", "Activity"] as const;
export type NotifTab = (typeof NOTIF_TABS)[number];

const MESSAGE_TYPES = new Set(["new_inquiry", "new_message"]);

export function matchesTab(type: string, tab: NotifTab): boolean {
  if (tab === "All") return true;
  const isMessage = MESSAGE_TYPES.has(type);
  return tab === "Messages" ? isMessage : !isMessage;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/lib/notifications-filter.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the chip component**

Create `components/ui/notification-filter.tsx`:

```tsx
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
```

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add lib/notifications-filter.ts __tests__/lib/notifications-filter.test.ts components/ui/notification-filter.tsx
git commit -m "feat(notif): shared matchesTab helper + scrollable NotificationFilter chips"
```

---

### Task 6: Panel — use `NotificationFilter`, responsive width, drop `new_review`

**Files:**
- Modify: `components/ui/notifications-panel.tsx`

**Interfaces:**
- Consumes: `NotificationFilter`, `NOTIF_TABS`, `NotifTab`, `matchesTab` (Task 5).

- [ ] **Step 1: Swap the filter model**

In `components/ui/notifications-panel.tsx`:
- Add imports:
  ```tsx
  import NotificationFilter from "@/components/ui/notification-filter";
  import { type NotifTab, matchesTab } from "@/lib/notifications-filter";
  ```
- Delete the local `type ActiveTab`, the `CATEGORY_MAP` object (which still references `new_review`), and the `filterByTab` function.
- Change the active-tab state to `useState<NotifTab>("All")` (rename `activeTab`/`setActiveTab` accordingly, keep the name `activeTab`).
- Replace the filtering line `const filtered = filterByTab(notifications, activeTab);` with:
  ```tsx
  const filtered = notifications.filter((n) => matchesTab(n.type, activeTab));
  ```

- [ ] **Step 2: Replace the equal-width tab row with the chip filter**

Replace the `{/* Tabs */}` block (the `<div className="flex border-b …">{TABS.map(...)}</div>`) with:

```tsx
        {/* Filter chips */}
        <div className="border-b border-gray-200 shrink-0 px-3">
          <NotificationFilter active={activeTab} onChange={setActiveTab} />
        </div>
```

Delete the now-unused `const TABS: ActiveTab[] = [...]` line.

- [ ] **Step 3: Make the panel width responsive**

In the panel container `div`, change the fixed `w-100` to a responsive width so it no longer overflows narrow phones. Change `w-100` to `w-full sm:w-100` in that `className`.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors; no remaining `CATEGORY_MAP`/`filterByTab`/`ActiveTab`/`new_review` references in the file.

- [ ] **Step 5: Commit**

```bash
git add components/ui/notifications-panel.tsx
git commit -m "feat(notif): panel uses scrollable chip filter, responsive width"
```

---

### Task 7: Notifications page — chip filter + flat list (drop stacked groups)

**Files:**
- Modify: `app/(protected)/notifications/page.tsx`

**Interfaces:**
- Consumes: `NotificationFilter`, `NotifTab`, `matchesTab` (Task 5). This also removes the defunct "Reviews" group.

- [ ] **Step 1: Replace group model with the chip filter**

In `app/(protected)/notifications/page.tsx`:
- Add imports:
  ```tsx
  import NotificationFilter from "@/components/ui/notification-filter";
  import { type NotifTab, matchesTab } from "@/lib/notifications-filter";
  ```
- Delete the `GROUPS` constant (lines 27-31).
- Add tab state next to the others: `const [activeTab, setActiveTab] = useState<NotifTab>("All");`
- Compute the filtered list before the return: `const filtered = notifications.filter((n) => matchesTab(n.type, activeTab));`

- [ ] **Step 2: Render the chip filter + flat list**

Replace the loaded-state block (the `notifications.length === 0 ? … : (<div className="space-y-6">{GROUPS.map(...)}</div>)`) with a chip row + a single flat, newest-first list:

```tsx
        ) : (
          <>
            <NotificationFilter active={activeTab} onChange={setActiveTab} />
            {filtered.length === 0 ? (
              <p className="text-center text-gray-400 text-sm pt-10">
                Nothing here yet
              </p>
            ) : (
              <div className="divide-y divide-gray-200 border-t border-b border-gray-200 bg-white mt-2">
                {filtered.map((n) => (
                  <NotificationRow key={n.id} n={n} onClick={handleClick} />
                ))}
              </div>
            )}
          </>
        )}
```

(`notifications` already arrives newest-first from `getNotifications()`; keep that order. The `NotificationRow` component and `handleClick`/`formatTime` are unchanged.)

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors; no remaining `GROUPS` reference.

- [ ] **Step 4: Commit**

```bash
git add "app/(protected)/notifications/page.tsx"
git commit -m "feat(notif): notifications page uses chip filter + flat list"
```

---

### Task 8: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the new unit tests**

Run: `npm test -- __tests__/lib/email-format.test.ts __tests__/lib/notifications-filter.test.ts`
Expected: all pass.

- [ ] **Step 2: Lint the touched files**

Run:
```bash
npx eslint lib/email-format.ts lib/services/email.service.ts lib/services/reviews.service.ts lib/validation/notifications.ts lib/db/schema.ts lib/notifications-filter.ts components/ui/notification-filter.tsx components/ui/notifications-panel.tsx "app/(protected)/settings/notifications/page.tsx" "app/(protected)/notifications/page.tsx"
```
Expected: 0 errors from these files.

- [ ] **Step 3: Confirm no `new_review` references remain**

Run: `git grep -n new_review -- '*.ts' '*.tsx'`
Expected: no matches (the column drop is applied separately via `drizzle-kit push`; code has zero references).

- [ ] **Step 4: Manual QA (after the bundled `drizzle-kit push`)**

- [ ] Creating a review fires no push/notification to the rated user.
- [ ] Settings → Notifications shows no "New reviews" toggle; the other three remain and still save.
- [ ] Notifications panel + page: chip filter (All/Messages/Activity) scrolls, never crams, at 320/360/768/desktop; Messages shows inquiries+messages, Activity shows the rest.
- [ ] Panel no longer overflows a ~360px screen (full-width on mobile).
- [ ] A test email whose title/body contains `<`, `&`, `"` renders literally (no broken layout); logo shows when `NEXT_PUBLIC_SITE_URL` is set, degrades to a "MakeAbot" text wordmark when unset.

---

## Notes / dependencies

- **Bundled push:** dropping the `new_review` column is applied with Epic D's `drizzle-kit push` in the user's TTY. Code compiles/lints without it; the runtime only diverges on the (now-removed) preference read, which no code performs.
- No change to message coalescing, push topics, or digest scope.
