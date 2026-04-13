# Tracker Tab Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the tracker page into Posts (owned items) and Inquiries (bid-on items) using a segmented control above the filter bar.

**Architecture:** Add `activeTab` state to `TrackerPage`, derive tab-scoped card pools by filtering `offers`/`requests` by `isOwned`, and add a `SegmentedTabs` inline component. All existing filter/sort/search/history logic operates unchanged on the scoped pools. Single file change.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS

---

### Task 1: Add `activeTab` state and `SegmentedTabs` component

**Files:**
- Modify: `app/(protected)/tracker/page.tsx`

- [ ] **Step 1: Add `activeTab` state**

In `app/(protected)/tracker/page.tsx`, find the block of `useState` declarations inside `TrackerPage` (around line 245). Add after the existing `historyOpen` state:

```tsx
const [activeTab, setActiveTab] = useState<"posts" | "inquiries">("posts");
```

- [ ] **Step 2: Render `SegmentedTabs` between Navbar and FilterBar**

In the JSX, find the `<Navbar />` line. Replace:

```tsx
      <Navbar />

      <FilterBar
```

with:

```tsx
      <Navbar />

      <SegmentedTabs
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setActiveFilter("All");
        }}
      />

      <FilterBar
```

- [ ] **Step 3: Add the `SegmentedTabs` component at the bottom of the file**

After the closing `}` of the `ChatListModal` function (the last thing in the file), add:

```tsx
function SegmentedTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: "posts" | "inquiries";
  onTabChange: (tab: "posts" | "inquiries") => void;
}) {
  return (
    <div className="flex bg-gray-100 rounded-full p-1 mx-4 mt-3">
      {(["posts", "inquiries"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onTabChange(tab)}
          className={`flex-1 py-1.5 text-sm font-semibold rounded-full transition-colors ${
            activeTab === tab
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {tab === "posts" ? "Posts" : "Inquiries"}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add app/(protected)/tracker/page.tsx
git commit -m "feat: add Posts/Inquiries segmented control to tracker"
```

---

### Task 2: Derive tab-scoped card pools

**Files:**
- Modify: `app/(protected)/tracker/page.tsx`

- [ ] **Step 1: Replace the active/history split to operate on tab-scoped pools**

In `app/(protected)/tracker/page.tsx`, find the block that starts with:

```tsx
  // Split active vs history
  const activeOffers = offers.filter((o) =>
```

Replace the entire block from `// Split active vs history` through the end of the `historyRequests` line with:

```tsx
  // Scope to active tab: Posts = owned, Inquiries = bid-on
  const tabOffers =
    activeTab === "posts"
      ? offers.filter((o) => o.isOwned)
      : offers.filter((o) => !o.isOwned);

  const tabRequests =
    activeTab === "posts"
      ? requests.filter((r) => r.isOwned)
      : requests.filter((r) => !r.isOwned);

  // Split active vs history
  const activeOffers = tabOffers.filter((o) =>
    o.isOwned
      ? o.status === "Active"
      : o.requesters.some((r) => r.bidStatus === "Pending"),
  );
  const historyOffers = tabOffers.filter((o) =>
    o.isOwned
      ? o.status === "Closed"
      : o.requesters.every((r) => r.bidStatus !== "Pending"),
  );
  const activeRequests = tabRequests.filter((r) => r.status !== "Completed");
  const historyRequests = tabRequests.filter((r) => r.status === "Completed");
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds. Switching tabs in the browser should now show only owned cards under Posts and only bid-on cards under Inquiries.

- [ ] **Step 3: Commit**

```bash
git add app/(protected)/tracker/page.tsx
git commit -m "feat: scope tracker card pools by active tab"
```

---

### Task 3: Empty states and history grayscale

**Files:**
- Modify: `app/(protected)/tracker/page.tsx`

- [ ] **Step 1: Fix history grayscale**

Find the history grid div:

```tsx
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-3 opacity-50 pointer-events-none">
```

Replace `opacity-50` with `grayscale opacity-60`:

```tsx
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-3 grayscale opacity-60 pointer-events-none">
```

- [ ] **Step 2: Add empty states**

Find the active cards grid block:

```tsx
            {/* Active cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-w-7xl mx-auto">
              {sortedActiveCards.map((card) =>
                card.type === "offer"
                  ? renderOfferCard(card.data, false)
                  : renderRequestCard(card.data, false),
              )}
            </div>
```

Replace with:

```tsx
            {/* Active cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-w-7xl mx-auto">
              {sortedActiveCards.map((card) =>
                card.type === "offer"
                  ? renderOfferCard(card.data, false)
                  : renderRequestCard(card.data, false),
              )}
            </div>

            {/* Empty state */}
            {sortedActiveCards.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm text-gray-500">
                  {activeTab === "posts"
                    ? "No posts yet. Create an offer or request to get started."
                    : "No inquiries yet. Browse listings to find something you need."}
                </p>
              </div>
            )}
```

- [ ] **Step 3: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds. History cards render with a gray desaturated look. Empty tabs show the appropriate message.

- [ ] **Step 4: Commit**

```bash
git add app/(protected)/tracker/page.tsx
git commit -m "feat: add empty states and grayscale history to tracker tabs"
```

---

### Task 4: Final verification

**Files:** None

- [ ] **Step 1: Full build check**

Run: `npm run build`
Expected: Clean build, no type errors or warnings.

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: All tests pass. (No tracker-specific unit tests exist — this verifies no regressions in actions/services.)
