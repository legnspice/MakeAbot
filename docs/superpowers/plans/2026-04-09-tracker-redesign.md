# Tracker Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the tracker page to use rich item cards with Edit/Delete buttons on owned items, and add edit mode to the create-offer/create-request pages.

**Architecture:** Extend `ItemRequestCard` with optional `onEdit`/`onDelete` props. Refactor the tracker page to render these cards instead of the simple inline components. Add `?edit=<id>` query param support to create-offer and create-request pages for pre-filling forms.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Drizzle ORM, Supabase

---

### Task 1: Add `onEdit` / `onDelete` props to `ItemRequestCard`

**Files:**
- Modify: `components/ui/item.tsx`

- [ ] **Step 1: Add the new optional props to the interface and render Edit/Delete buttons**

In `components/ui/item.tsx`, add `onEdit` and `onDelete` to the props interface, and render buttons in the card footer when present:

```tsx
export interface ItemRequestCardProps {
  imageUrl?: string;
  requestedBy?: string;
  section?: string;
  time?: string;
  price?: string;
  variant?: "lent" | "requested";
  typeBadge?: string;
  detail?: ItemDetailData;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}
```

In the component function, destructure the new props:

```tsx
export default function ItemRequestCard({
  requestedBy = "Requested by:",
  section,
  time,
  price = "$$$",
  variant = "requested",
  typeBadge,
  detail,
  onClick,
  onEdit,
  onDelete,
}: ItemRequestCardProps) {
```

Replace the existing bottom row (the `<div className="mt-auto flex justify-between items-end">` block) with:

```tsx
<div className="mt-auto flex justify-between items-end">
  {(onEdit || onDelete) ? (
    <div className="flex gap-1.5">
      {onEdit && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="px-2.5 py-0.5 text-xs font-medium border border-gray-300 rounded-full text-gray-700 hover:bg-gray-100 transition-colors"
        >
          Edit
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="px-2.5 py-0.5 text-xs font-medium border border-red-300 rounded-full text-red-600 hover:bg-red-50 transition-colors"
        >
          Delete
        </button>
      )}
    </div>
  ) : (
    (hasLocation || hasDate) && (
      <div className="text-xs text-gray-600 flex flex-wrap gap-x-2 gap-y-0">
        {hasLocation && <span>{section}</span>}
        {hasDate && <span>{time}</span>}
      </div>
    )
  )}
  <span className="text-[#3761B0] font-semibold text-sm ml-auto">{price}</span>
</div>
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds with no type errors. Existing usage of `ItemRequestCard` (home page) is unaffected since the new props are optional.

- [ ] **Step 3: Commit**

```bash
git add components/ui/item.tsx
git commit -m "feat: add onEdit/onDelete props to ItemRequestCard"
```

---

### Task 2: Refactor tracker page to use `ItemRequestCard`

**Files:**
- Modify: `app/(protected)/tracker/page.tsx`

- [ ] **Step 1: Update data types and fetch function**

Update the `TrackerOffer` type to include full item details and ownership:

```tsx
type TrackerOffer = {
  id: string;
  itemName: string;
  description: string | null;
  imageUrl: string | null;
  price: string;
  type: string | null;
  isOwned: boolean;
  requesterCount: number;
  requesters: { id: string; name: string; bidId: string }[];
  notificationCount?: number;
};
```

Update the `TrackerRequest` type similarly:

```tsx
type TrackerRequest = {
  id: string;
  itemName: string;
  description: string | null;
  imageUrl: string | null;
  status: string;
  price: string;
  type: string | null;
  urgency: string | null;
  isOwned: boolean;
  bidders: { id: string; name: string; bidId: string }[];
  notificationCount?: number;
};
```

In `fetchTrackerData`, update the offer list mapping (my own posts) to include the new fields:

```tsx
const offerList: TrackerOffer[] = postBidGroups.map(({ post, bids }) => ({
  id: post.id,
  itemName: post.title,
  description: post.description ?? null,
  imageUrl: post.imgUrl ?? null,
  price: formatPrice(post.price),
  type: post.type ?? null,
  isOwned: true,
  requesterCount: bids.length,
  requesters: bids.map((bid) => ({
    id: bid.bidder_id,
    name: usersMap.get(bid.bidder_id) ?? "User",
    bidId: bid.id,
  })),
}));
```

Update the bid-on posts section:

```tsx
for (const { bid, post } of bidPostGroups) {
  if (!post || !post.user_id || myPostIds.has(post.id)) continue;
  offerList.push({
    id: `bid-${bid.id}`,
    itemName: post.title,
    description: post.description ?? null,
    imageUrl: post.imgUrl ?? null,
    price: formatPrice(post.price),
    type: post.type ?? null,
    isOwned: false,
    requesterCount: 1,
    requesters: [
      {
        id: post.user_id,
        name: usersMap.get(post.user_id) ?? "User",
        bidId: bid.id,
      },
    ],
  });
}
```

Update the request list mapping (my own requests):

```tsx
const requestList: TrackerRequest[] = reqBidGroups.map(({ req, bids }) => ({
  id: req.id,
  itemName: req.title,
  description: req.description ?? null,
  imageUrl: req.imgUrl ?? null,
  status: req.status,
  price: formatPrice(req.fee),
  type: req.type ?? null,
  urgency: req.urgency ?? null,
  isOwned: true,
  bidders: bids.map((bid) => ({
    id: bid.bidder_id,
    name: usersMap.get(bid.bidder_id) ?? "User",
    bidId: bid.id,
  })),
  notificationCount: bids.length > 0 ? bids.length : undefined,
}));
```

Update the bid-on requests section:

```tsx
for (const { bid, req } of bidReqGroups) {
  if (!req || !req.user_id || myRequestIds.has(req.id)) continue;
  requestList.push({
    id: `bid-${bid.id}`,
    itemName: req.title,
    description: req.description ?? null,
    imageUrl: req.imgUrl ?? null,
    status: req.status,
    price: formatPrice(req.fee),
    type: req.type ?? null,
    urgency: req.urgency ?? null,
    isOwned: false,
    bidders: [
      {
        id: req.user_id,
        name: usersMap.get(req.user_id) ?? "User",
        bidId: bid.id,
      },
    ],
  });
}
```

- [ ] **Step 2: Add imports and delete handler to the TrackerPage component**

Add imports at the top of the file:

```tsx
import ItemRequestCard from "@/components/ui/item";
import { removePost } from "@/lib/actions/posts";
import { removeRequest } from "@/lib/actions/requests";
```

Add delete handler functions inside the `TrackerPage` component, after the existing `goToChat` function:

```tsx
const handleDeleteOffer = async (offerId: string) => {
  if (!window.confirm("Are you sure you want to delete this item?")) return;
  await removePost(offerId);
  setOffers((prev) => prev.filter((o) => o.id !== offerId));
};

const handleDeleteRequest = async (requestId: string) => {
  if (!window.confirm("Are you sure you want to delete this item?")) return;
  await removeRequest(requestId);
  setRequests((prev) => prev.filter((r) => r.id !== requestId));
};
```

- [ ] **Step 3: Replace the card rendering in the JSX**

Replace the `sortedCards.map(...)` block inside the grid with:

```tsx
{sortedCards.map((card) => {
  if (card.type === "offer") {
    const offer = card.data as TrackerOffer;
    return (
      <div key={`offer-${offer.id}`}>
        <ItemRequestCard
          variant="lent"
          requestedBy={offer.isOwned ? "Offered by: You" : `Offered by: ${offer.requesters[0]?.name ?? "User"}`}
          price={offer.price}
          typeBadge="Offer"
          detail={{
            title: offer.itemName,
            lentBy: offer.isOwned ? "You" : (offer.requesters[0]?.name ?? "User"),
            quantity: 1,
            price: offer.price,
            description: offer.description ?? undefined,
            imageUrl: offer.imageUrl ?? undefined,
          }}
          onClick={offer.requesterCount > 0 ? () => setModalData({ title: offer.itemName, people: offer.requesters, type: "offer" }) : undefined}
          onEdit={offer.isOwned ? () => router.push(`/create-offer?edit=${offer.id}`) : undefined}
          onDelete={offer.isOwned ? () => handleDeleteOffer(offer.id) : undefined}
        />
      </div>
    );
  } else {
    const request = card.data as TrackerRequest;
    return (
      <div key={`request-${request.id}`}>
        <ItemRequestCard
          variant="requested"
          requestedBy={request.isOwned ? "Requested by: You" : `Requested by: ${request.bidders[0]?.name ?? "User"}`}
          price={request.price}
          typeBadge="Request"
          detail={{
            title: request.itemName,
            requestedBy: request.isOwned ? "You" : (request.bidders[0]?.name ?? "User"),
            quantity: 1,
            price: request.price,
            description: request.description ?? undefined,
            imageUrl: request.imageUrl ?? undefined,
          }}
          onClick={request.bidders.length > 0 ? () => setModalData({ title: request.itemName, people: request.bidders, type: "request" }) : undefined}
          onEdit={request.isOwned ? () => router.push(`/create-request?edit=${request.id}`) : undefined}
          onDelete={request.isOwned ? () => handleDeleteRequest(request.id) : undefined}
        />
      </div>
    );
  }
})}
```

- [ ] **Step 4: Replace inline OfferCard/RequestCard with modal state management**

Remove the inline `OfferCard` and `RequestCard` component functions (lines ~413-503 in the current file). Keep the `ChatListModal` component.

Add modal state inside `TrackerPage`, after existing state declarations:

```tsx
const [modalData, setModalData] = useState<{
  title: string;
  people: { id: string; name: string; bidId: string }[];
  type: "offer" | "request";
} | null>(null);
```

After the main grid `</section>`, render the modal:

```tsx
{modalData && (
  <ChatListModal
    title={modalData.title}
    people={modalData.people}
    accentClass={modalData.type === "offer" ? "bg-gray-50 hover:bg-gray-100" : "bg-blue-50 hover:bg-blue-100"}
    avatarClass={modalData.type === "offer" ? "bg-gray-300 text-gray-600" : "bg-blue-200 text-blue-700"}
    iconClass={modalData.type === "offer" ? "text-gray-400" : "text-blue-400"}
    onSelect={(bidId, otherId) =>
      goToChat(bidId, modalData.type, modalData.title, otherId)
    }
    onClose={() => setModalData(null)}
  />
)}
```

- [ ] **Step 5: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds. The tracker page renders `ItemRequestCard` components with Edit/Delete on owned items.

- [ ] **Step 6: Commit**

```bash
git add app/(protected)/tracker/page.tsx
git commit -m "feat: refactor tracker page to use ItemRequestCard with edit/delete"
```

---

### Task 3: Add edit mode to create-offer page

**Files:**
- Modify: `app/(protected)/(home)/create-offer/page.tsx`

- [ ] **Step 1: Add edit mode support**

Add imports at the top:

```tsx
import { useSearchParams } from "next/navigation";
import { getPosts, editPost } from "@/lib/actions/posts";
```

Remove the now-redundant `createPost` import (it's still needed for create mode — keep it). The final import line should be:

```tsx
import { createPost, getPosts, editPost } from "@/lib/actions/posts";
```

Inside the `CreateOffer` component, after the existing state declarations, add:

```tsx
const searchParams = useSearchParams();
const editId = searchParams.get("edit");
const [isLoadingEdit, setIsLoadingEdit] = useState(false);
```

Add a `useEffect` to fetch existing data when in edit mode, after the existing state declarations:

```tsx
useEffect(() => {
  if (!editId) return;
  setIsLoadingEdit(true);
  getPosts({ id: editId }).then((result) => {
    const post = result.data?.[0];
    if (post) {
      setForm({
        title: post.title ?? "",
        description: post.description ?? "",
        price: post.price != null ? String(post.price) : "",
      });
      if (post.type === "Item" || post.type === "Service") setItemKind(post.type);
      if (post.imgUrl) setUploadedImageUrl(post.imgUrl);
    }
    setIsLoadingEdit(false);
  });
}, [editId]);
```

- [ ] **Step 2: Update the submit handler**

Replace the `handlePost` function with:

```tsx
const handlePost = async () => {
  const title = form.title.trim();
  if (!title) return;
  const priceValue = form.price.trim()
    ? parseInt(form.price.trim(), 10) || null
    : null;

  setIsPosting(true);
  try {
    if (editId) {
      await editPost(editId, {
        title,
        price: priceValue,
        description: form.description.trim() || null,
        imgUrl: uploadedImageUrl,
        type: itemKind,
      });
    } else {
      await createPost({
        user_id: currentUser.id,
        title,
        price: priceValue,
        description: form.description.trim() || null,
        imgUrl: uploadedImageUrl,
        status: "Active",
        type: itemKind,
      });
      requestPermissionAndSubscribe().catch(() => {});
    }
    router.push(editId ? "/tracker" : "/");
  } finally {
    setIsPosting(false);
  }
};
```

- [ ] **Step 3: Update the header and button text**

Change the header `<h1>` to:

```tsx
<h1 className="text-lg font-bold text-gray-800">
  {editId ? "Edit Offer" : "Create an Offer"}
</h1>
```

Change the back button to navigate to `/tracker` when editing:

```tsx
<button
  type="button"
  onClick={() => router.push(editId ? "/tracker" : "/")}
  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
  aria-label="Back"
>
  <ChevronLeft size={20} />
</button>
```

Change the submit `<Button>` text to:

```tsx
{isPosting ? (editId ? "Saving..." : "Posting...") : (editId ? "SAVE" : "POST!")}
```

Add `isLoadingEdit` to the disabled condition:

```tsx
disabled={isPosting || isUploading || isLoadingEdit || !form.title.trim()}
```

- [ ] **Step 4: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds. Navigating to `/create-offer?edit=<id>` pre-fills the form.

- [ ] **Step 5: Commit**

```bash
git add app/(protected)/(home)/create-offer/page.tsx
git commit -m "feat: add edit mode to create-offer page"
```

---

### Task 4: Add edit mode to create-request page

**Files:**
- Modify: `app/(protected)/(home)/create-request/page.tsx`

- [ ] **Step 1: Add edit mode support**

Add imports at the top:

```tsx
import { useSearchParams } from "next/navigation";
import { getRequests, editRequest } from "@/lib/actions/requests";
```

Update the existing requests import line to:

```tsx
import { createRequest, getRequests, editRequest } from "@/lib/actions/requests";
```

Inside the `CreateRequest` component, after the existing state declarations, add:

```tsx
const searchParams = useSearchParams();
const editId = searchParams.get("edit");
const [isLoadingEdit, setIsLoadingEdit] = useState(false);
```

Add a `useEffect` to fetch existing data when in edit mode:

```tsx
useEffect(() => {
  if (!editId) return;
  setIsLoadingEdit(true);
  getRequests({ id: editId }).then((result) => {
    const req = result.data?.[0];
    if (req) {
      setForm({
        title: req.title ?? "",
        description: req.description ?? "",
        incentive: req.fee != null ? String(req.fee) : "",
      });
      if (req.type === "Item" || req.type === "Service") setItemKind(req.type);
      if (req.urgency) setUrgency(req.urgency);
      if (req.imgUrl) setUploadedImageUrl(req.imgUrl);
    }
    setIsLoadingEdit(false);
  });
}, [editId]);
```

- [ ] **Step 2: Update the submit handler**

Replace the `handlePost` function with:

```tsx
const handlePost = async () => {
  const title = form.title.trim();
  if (!title) return;
  const feeValue = form.incentive.trim()
    ? parseInt(form.incentive.trim(), 10) || null
    : null;

  setIsPosting(true);
  try {
    if (editId) {
      await editRequest(editId, {
        title,
        fee: feeValue,
        description: form.description.trim() || null,
        imgUrl: uploadedImageUrl,
        urgency,
        type: itemKind,
      });
    } else {
      await createRequest({
        user_id: currentUser.id,
        title,
        fee: feeValue,
        description: form.description.trim() || null,
        imgUrl: uploadedImageUrl,
        urgency,
        status: "Active",
        type: itemKind,
      });
      requestPermissionAndSubscribe().catch(() => {});
    }
    router.push(editId ? "/tracker" : "/");
  } finally {
    setIsPosting(false);
  }
};
```

- [ ] **Step 3: Update the header and button text**

Change the header `<h1>` to:

```tsx
<h1 className="text-lg font-bold text-gray-800">
  {editId ? "Edit Request" : "Create a Request"}
</h1>
```

Change the back button to navigate to `/tracker` when editing:

```tsx
<button
  type="button"
  onClick={() => router.push(editId ? "/tracker" : "/")}
  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
  aria-label="Back"
>
  <ChevronLeft size={20} />
</button>
```

Change the submit `<Button>` text to:

```tsx
{isPosting ? (editId ? "Saving..." : "Posting...") : (editId ? "SAVE" : "POST!")}
```

Add `isLoadingEdit` to the disabled condition:

```tsx
disabled={isPosting || isUploading || isLoadingEdit || !form.title.trim()}
```

- [ ] **Step 4: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds. Navigating to `/create-request?edit=<id>` pre-fills the form.

- [ ] **Step 5: Commit**

```bash
git add app/(protected)/(home)/create-request/page.tsx
git commit -m "feat: add edit mode to create-request page"
```

---

### Task 5: Final build verification

- [ ] **Step 1: Full build check**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Commit if any remaining changes**

```bash
git status
# If any unstaged changes remain, add and commit them
```
