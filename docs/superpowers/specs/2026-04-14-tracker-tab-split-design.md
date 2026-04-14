# Tracker Tab Split Design

## Summary

Split the tracker page into two primary tabs — **Posts** and **Inquiries** — using a segmented control above the filter bar. Posts shows cards the user owns (their own offers and requests). Inquiries shows cards the user has bid on (offers and requests from other users). All existing filter, sort, search, and history behavior is preserved within each tab.

## Scope

Single file: `app/(protected)/tracker/page.tsx`

No changes to server actions, services, repositories, schema, or any other component.

## Design

### 1. State

Add one new state variable:

```ts
const [activeTab, setActiveTab] = useState<"posts" | "inquiries">("posts");
```

On tab change, reset `activeFilter` to `"All"` to prevent stale keyword filters carrying over between tabs.

### 2. Card Pool Derivation

Split existing `offers` and `requests` state by `isOwned` before the active/history split:

```ts
// Posts tab
const postOffers = offers.filter(o => o.isOwned);
const postRequests = requests.filter(r => r.isOwned);

// Inquiries tab
const inquiryOffers = offers.filter(o => !o.isOwned);
const inquiryRequests = requests.filter(r => !r.isOwned);
```

The active/history split, filter, sort, and search pipelines operate on whichever pool matches `activeTab`. The existing split logic is already correct for both owned and bid-on cards:

- Offers active: `status === "Active"` (owned) or any bid with `bidStatus === "Pending"` (bid-on)
- Offers history: `status === "Closed"` (owned) or all bids non-pending (bid-on)
- Requests active: `status !== "Completed"`
- Requests history: `status === "Completed"`

### 3. Segmented Control UI

New inline component in the same file:

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
          className={`flex-1 py-1.5 text-sm font-semibold rounded-full transition-colors capitalize ${
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

Renders between `<Navbar />` and `<FilterBar />`.

### 4. Filter Bar

No changes to `FilterBar` component or props. The `All / Offers / Requests / [custom]` chips continue to work as sub-filters within the active tab. Custom filters (keyword) persist across tabs.

### 5. History Section

Behavior unchanged. Operates on the active tab's pool. History cards change from `opacity-50` to `grayscale opacity-60 pointer-events-none` for a clearly muted/gray appearance rather than washed-out white.

### 6. Empty States

Each tab renders an empty state when no active cards exist:

- **Posts (empty):** "No posts yet. Create an offer or request to get started."
- **Inquiries (empty):** "No inquiries yet. Browse listings to find something you need."

## Files Modified

| File | Change |
|------|--------|
| `app/(protected)/tracker/page.tsx` | Add `activeTab` state, `SegmentedTabs` component, tab-scoped pool derivation, empty states, history grayscale |

## Out of Scope

- Separate routes for each tab
- Persisting active tab across sessions
- Per-tab notification counts in the segmented control
- Any changes to `fetchTrackerData`, server actions, or other components
