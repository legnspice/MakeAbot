# Frontend Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 9 user-reported frontend bugs and UX issues — image cropping, description formatting, own-post clicking, chat init, card sizing, card images, tutorial navigation, profile pictures, and create modal positioning.

**Architecture:** All changes are frontend-only — no DB migrations. Each task modifies 1-2 files with CSS/JSX changes. The chat fix is a React hook stabilization (useRef for Supabase client). Profile picture upload uses existing Supabase storage + auth metadata.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Supabase (storage + auth), browser-image-compression

---

### Task 1: Image display — no cropping in create forms and detail modal

**Files:**
- Modify: `app/(protected)/(home)/create-offer/page.tsx:213` — image preview
- Modify: `app/(protected)/(home)/create-request/page.tsx:233` — image preview
- Modify: `components/ui/item-detail-modal.tsx:76-88` — detail modal image

- [ ] **Step 1: Fix create-offer image preview**

In `app/(protected)/(home)/create-offer/page.tsx`, change the Image component (line 213) from cropping to containing:

```tsx
// OLD (line 213):
className="w-full h-48 object-cover"

// NEW:
className="w-full h-48 object-contain"
```

- [ ] **Step 2: Fix create-request image preview**

In `app/(protected)/(home)/create-request/page.tsx`, change the Image component (line 233) from cropping to containing:

```tsx
// OLD (line 233):
className="w-full h-48 object-cover"

// NEW:
className="w-full h-48 object-contain"
```

- [ ] **Step 3: Fix detail modal image**

In `components/ui/item-detail-modal.tsx`, change the img tag (line 80):

```tsx
// OLD (line 80):
className="w-full h-full object-cover"

// NEW:
className="w-full h-full object-contain"
```

- [ ] **Step 4: Verify visually**

Run: `npm run dev`

Check:
1. Create an offer with a tall/narrow image — preview should show full image (letterboxed) not cropped
2. Same for create-request
3. Click any post with an image — detail modal should show full image, not cropped

- [ ] **Step 5: Commit**

```bash
git add app/(protected)/(home)/create-offer/page.tsx app/(protected)/(home)/create-request/page.tsx components/ui/item-detail-modal.tsx
git commit -m "fix: prevent image cropping in create forms and detail modal"
```

---

### Task 2: Preserve description line breaks

**Files:**
- Modify: `components/ui/item-detail-modal.tsx` — add description rendering with whitespace preservation
- Modify: `components/ui/item.tsx:49` — description in card preview

- [ ] **Step 1: Add description display to detail modal**

The detail modal currently does NOT render the description at all. Add it after the "lentBy"/"requestedBy" lines, inside the content div. In `components/ui/item-detail-modal.tsx`, after the `{item.note && ...}` block (after line 131), add:

```tsx
{item.description && (
  <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap overflow-y-auto max-h-24">
    {item.description}
  </p>
)}
```

- [ ] **Step 2: Fix description in feed cards**

In `components/ui/item.tsx`, line 49, add `whitespace-pre-wrap` to the description paragraph:

```tsx
// OLD (line 49):
<p className="hidden md:block text-sm text-gray-500 line-clamp-2">

// NEW:
<p className="hidden md:block text-sm text-gray-500 line-clamp-2 whitespace-pre-wrap">
```

- [ ] **Step 3: Verify visually**

Run: `npm run dev`

Check:
1. Create a post with multi-line description (press Enter between lines)
2. View the post in detail modal — line breaks should be preserved
3. On desktop, the card preview should also show line breaks (within the 2-line clamp)

- [ ] **Step 4: Commit**

```bash
git add components/ui/item-detail-modal.tsx components/ui/item.tsx
git commit -m "fix: preserve description line breaks in modal and feed cards"
```

---

### Task 3: Disable clicking own posts

**Files:**
- Modify: `app/(protected)/(home)/page.tsx:289-300` — card rendering in grid

- [ ] **Step 1: Disable onClick for own posts**

In `app/(protected)/(home)/page.tsx`, in the grid map (around line 289), conditionally disable clicking:

```tsx
// OLD (lines 289-301):
{filteredItems.map((item) => (
  <ItemRequestCard
    key={item.id}
    variant={item.variant}
    requestedBy={item.requestedBy}
    section={item.section}
    time={item.time}
    price={item.price}
    typeBadge={item.typeBadge}
    detail={item.detail}
    onClick={() => setSelectedItem(item)}
  />
))}

// NEW:
{filteredItems.map((item) => {
  const isOwn = item.userId === currentUser.id;
  return (
    <ItemRequestCard
      key={item.id}
      variant={item.variant}
      requestedBy={item.requestedBy}
      section={item.section}
      time={item.time}
      price={item.price}
      typeBadge={item.typeBadge}
      detail={item.detail}
      onClick={isOwn ? undefined : () => setSelectedItem(item)}
    />
  );
})}
```

- [ ] **Step 2: Style non-clickable cards in ItemRequestCard**

In `components/ui/item.tsx`, update the component to handle missing `onClick` gracefully. The outer `<button>` should become a `<div>` or lose interactive styles when not clickable:

```tsx
// OLD (lines 28-33):
<button
  type="button"
  onClick={onClick}
  className="w-full text-left bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-gray-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3761B0] focus-visible:ring-offset-2"
>

// NEW:
<div
  role={onClick ? "button" : undefined}
  tabIndex={onClick ? 0 : undefined}
  onClick={onClick}
  onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
  className={`w-full text-left bg-white rounded-lg shadow-sm border border-gray-200 p-4 transition-colors focus:outline-none ${
    onClick
      ? "cursor-pointer hover:border-gray-300 focus-visible:ring-2 focus-visible:ring-[#3761B0] focus-visible:ring-offset-2"
      : "opacity-75"
  }`}
>
```

Also change the closing `</button>` (last line) to `</div>`.

- [ ] **Step 3: Verify visually**

Run: `npm run dev`

Check:
1. Posts you own should appear slightly dimmed (opacity-75) and not clickable
2. Posts by others should still be clickable and open the detail modal
3. No visual glitches on hover for own posts

- [ ] **Step 4: Commit**

```bash
git add app/(protected)/(home)/page.tsx components/ui/item.tsx
git commit -m "fix: disable clicking on own posts in home feed"
```

---

### Task 4: Fix chat initialization bug

**Files:**
- Modify: `hooks/use-realtime-chat.tsx:24-50` — stabilize Supabase client

- [ ] **Step 1: Stabilize the Supabase client with useRef**

In `hooks/use-realtime-chat.tsx`, the `createClient()` call on line 25 runs every render, creating a new Supabase client reference. This causes the `useEffect` on line 30 to cleanup and re-subscribe, resetting `isConnected` to false. Fix by storing the client in a ref:

```tsx
// OLD (lines 24-49):
export function useRealtimeChat({ roomName, username, currentUserId }: UseRealtimeChatProps) {
  const supabase = createClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const newChannel = supabase.channel(roomName);
    channelRef.current = newChannel;

    newChannel
      .on("broadcast", { event: EVENT_MESSAGE_TYPE }, (payload) => {
        setMessages((current) => [...current, payload.payload as ChatMessage]);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
        } else {
          setIsConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(newChannel);
      channelRef.current = null;
    };
  }, [roomName, supabase]);

// NEW:
export function useRealtimeChat({ roomName, username, currentUserId }: UseRealtimeChatProps) {
  const supabaseRef = useRef(createClient());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  useEffect(() => {
    const supabase = supabaseRef.current;
    const newChannel = supabase.channel(roomName);
    channelRef.current = newChannel;

    newChannel
      .on("broadcast", { event: EVENT_MESSAGE_TYPE }, (payload) => {
        setMessages((current) => [...current, payload.payload as ChatMessage]);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
        } else {
          setIsConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(newChannel);
      channelRef.current = null;
    };
  }, [roomName]);
```

Also update `sendMessage` to use the ref — no changes needed since `sendMessage` only uses `channelRef`, `isConnected`, `username`, and `currentUserId`. No reference to `supabase` in sendMessage.

- [ ] **Step 2: Verify the fix**

Run: `npm run dev`

Check:
1. Click "Inquire" on a post — you should be redirected to chat and the message input should be enabled immediately
2. You should NOT need to click on another conversation first
3. Messages should send and appear in real-time

- [ ] **Step 3: Commit**

```bash
git add hooks/use-realtime-chat.tsx
git commit -m "fix: stabilize Supabase client in useRealtimeChat to prevent reconnection loop"
```

---

### Task 5: Fixed height cards + show post images on cards

**Files:**
- Modify: `components/ui/item.tsx` — add fixed height, image thumbnail

These two fixes (5 and 6 from the spec) are combined since they both modify the same component and are interdependent — adding an image changes the card height calculation.

- [ ] **Step 1: Add image and fixed height to ItemRequestCard**

In `components/ui/item.tsx`, update the component to show images and have a fixed height. Replace the entire component body:

```tsx
import Image from "next/image";
import type { ItemDetailData } from "@/components/ui/item-detail-modal";

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
}

export default function ItemRequestCard({
  requestedBy = "Requested by:",
  section,
  time,
  price = "$$$",
  variant = "requested",
  typeBadge,
  detail,
  onClick,
}: ItemRequestCardProps) {
  const hasLocation = section && section !== "—";
  const hasDate = time && time !== "—";
  const imageUrl = detail?.imageUrl;

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      className={`w-full text-left bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-colors focus:outline-none h-52 flex flex-col ${
        onClick
          ? "cursor-pointer hover:border-gray-300 focus-visible:ring-2 focus-visible:ring-[#3761B0] focus-visible:ring-offset-2"
          : "opacity-75"
      }`}
    >
      {imageUrl && (
        <div className="w-full h-24 bg-gray-100 shrink-0 overflow-hidden">
          <Image
            src={imageUrl}
            alt={detail?.title ?? "Post image"}
            width={400}
            height={96}
            className="w-full h-full object-contain"
          />
        </div>
      )}
      <div className="flex-1 min-h-0 p-4 flex flex-col">
        {typeBadge && (
          <span className="inline-block mb-1 text-xs font-bold uppercase tracking-wider text-[#3761B0] bg-blue-50 px-2 py-0.5 rounded self-start">
            {typeBadge}
          </span>
        )}
        <h3 className="text-lg font-bold text-gray-900 line-clamp-1">
          {detail?.title ?? "Item"}
        </h3>
        <p className="text-sm text-gray-600 line-clamp-1">
          {variant === "lent"
            ? requestedBy.replace(/^Offered by:/i, "Lent by:")
            : requestedBy}
        </p>
        {detail?.description && (
          <p className="hidden md:block text-sm text-gray-500 line-clamp-1 whitespace-pre-wrap">
            {detail.description}
          </p>
        )}
        <div className="mt-auto flex justify-between items-end">
          {(hasLocation || hasDate) && (
            <div className="text-sm text-gray-600 flex flex-wrap gap-x-2 gap-y-0">
              {hasLocation && <span>{section}</span>}
              {hasDate && <span>{time}</span>}
            </div>
          )}
          <span className="text-[#3761B0] font-semibold ml-auto">{price}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify visually**

Run: `npm run dev`

Check:
1. All cards should be the same height (h-52 = 13rem)
2. Cards with images show a thumbnail at the top
3. Cards without images use the full height for text
4. Long titles/descriptions are truncated, not stretching the card
5. A long post next to a short post — both should be the same height

- [ ] **Step 3: Commit**

```bash
git add components/ui/item.tsx
git commit -m "fix: fixed height cards with image thumbnails on home feed"
```

---

### Task 6: Tutorial back button

**Files:**
- Modify: `components/tutorial-modal.tsx:94-99, 163-174` — add back navigation

- [ ] **Step 1: Add handleBack function and Back button**

In `components/tutorial-modal.tsx`:

1. Add a `handleBack` function after `handleNext` (after line 99):

```tsx
function handleBack() {
  if (step > 0) {
    setStep((s) => s - 1);
  }
}
```

2. Update the DialogFooter (lines 163-174) to include a Back button:

```tsx
// OLD (lines 163-174):
<DialogFooter className="flex flex-row items-center justify-between sm:justify-between">
  <button
    type="button"
    onClick={handleClose}
    className="text-sm text-muted-foreground hover:text-gray-700 transition-colors"
  >
    Skip tutorial
  </button>
  <Button onClick={handleNext} className="min-w-[90px]">
    {isLastStep ? "Got it" : "Next →"}
  </Button>
</DialogFooter>

// NEW:
<DialogFooter className="flex flex-row items-center justify-between sm:justify-between">
  <button
    type="button"
    onClick={handleClose}
    className="text-sm text-muted-foreground hover:text-gray-700 transition-colors"
  >
    Skip tutorial
  </button>
  <div className="flex items-center gap-2">
    {step > 0 && (
      <Button variant="outline" onClick={handleBack} className="min-w-[90px]">
        ← Back
      </Button>
    )}
    <Button onClick={handleNext} className="min-w-[90px]">
      {isLastStep ? "Got it" : "Next →"}
    </Button>
  </div>
</DialogFooter>
```

- [ ] **Step 2: Verify visually**

Run: `npm run dev`

Check:
1. Open the tutorial (click Help in navbar)
2. Step 1 (Welcome) — no Back button, only Skip and Next
3. Step 2+ — Back button appears, clicking it goes to previous step
4. Navigating back and forth works correctly
5. Progress dots update correctly

- [ ] **Step 3: Commit**

```bash
git add components/tutorial-modal.tsx
git commit -m "fix: add back button to tutorial wizard"
```

---

### Task 7: Profile picture — resolution fix + upload

**Files:**
- Modify: `app/(protected)/profile/page.tsx` — avatar resolution transform + upload UI

- [ ] **Step 1: Add high-resolution avatar URL helper**

In `app/(protected)/profile/page.tsx`, add a helper function after the imports (before the component). Also add the needed imports:

Add to imports (line 3):

```tsx
import Image from "next/image";
// ADD these:
import { Camera } from "lucide-react"; // add Camera to the existing lucide import
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
```

Actually, `Image` and `createClient` aren't imported yet in profile but `Image` is already imported on line 3. Add `Camera` to the existing lucide import on line 9, and add the other two imports:

Update the lucide import (line 9):

```tsx
// OLD:
import { SquarePen, Star, X, LogOut } from "lucide-react";

// NEW:
import { SquarePen, Star, X, LogOut, Camera, Loader2 } from "lucide-react";
```

Add after line 15 (after the last import):

```tsx
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";

function getHighResAvatarUrl(url: string): string {
  if (!url) return url;
  // Google profile pictures: replace low-res size param with high-res
  return url.replace(/=s\d+-c/, "=s400-c");
}
```

- [ ] **Step 2: Add avatar upload state and handler**

Inside the `ProfilePage` component, after the existing state declarations (after line 41), add:

```tsx
const avatarFileRef = useRef<HTMLInputElement>(null);
const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

const highResAvatar = getHighResAvatarUrl(avatarUrl);

const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  if (!e.target.files || e.target.files.length === 0) return;
  const file = e.target.files[0];

  setIsUploadingAvatar(true);
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 400,
      useWebWorker: true,
      fileType: "image/webp",
    });

    const fileName = `${currentUser.id}-${Date.now()}.webp`;
    const supabase = createClient();

    const { error: uploadError } = await supabase.storage
      .from("profile_photos")
      .upload(fileName, compressed);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("profile_photos")
      .getPublicUrl(fileName);

    // Update Supabase auth user metadata with new avatar URL
    await supabase.auth.updateUser({
      data: { avatar_url: data.publicUrl },
    });

    // Force page reload to pick up new metadata
    window.location.reload();
  } catch (err) {
    console.error("Avatar upload failed:", err);
  } finally {
    setIsUploadingAvatar(false);
    if (avatarFileRef.current) avatarFileRef.current.value = "";
  }
};
```

Also add `useRef` to the React import on line 1:

```tsx
// OLD:
import { useEffect, useState, useCallback } from "react";

// NEW:
import { useEffect, useState, useCallback, useRef } from "react";
```

- [ ] **Step 3: Update desktop avatar with upload overlay + high-res URL**

In `app/(protected)/profile/page.tsx`, update the desktop avatar section (lines 126-137):

```tsx
// OLD (lines 126-137):
<div className="relative w-48 h-48 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-gray-500 text-2xl font-medium shrink-0">
  {avatarUrl ? (
    <Image
      src={avatarUrl}
      alt="Profile"
      fill
      className="object-cover"
    />
  ) : (
    <span className="uppercase">{(name || "U").charAt(0)}</span>
  )}
</div>

// NEW:
<div className="relative w-48 h-48 shrink-0">
  <div className="w-full h-full rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-gray-500 text-2xl font-medium">
    {highResAvatar ? (
      <Image
        src={highResAvatar}
        alt="Profile"
        fill
        className="object-cover"
      />
    ) : (
      <span className="uppercase">{(name || "U").charAt(0)}</span>
    )}
  </div>
  <input
    ref={avatarFileRef}
    type="file"
    accept="image/*"
    className="hidden"
    onChange={handleAvatarUpload}
    disabled={isUploadingAvatar}
  />
  <button
    type="button"
    onClick={() => avatarFileRef.current?.click()}
    disabled={isUploadingAvatar}
    className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[#E5A550] hover:bg-[#D89440] text-white flex items-center justify-center shadow-md transition-colors disabled:opacity-60"
    aria-label="Change profile picture"
  >
    {isUploadingAvatar ? (
      <Loader2 className="w-5 h-5 animate-spin" />
    ) : (
      <Camera className="w-5 h-5" />
    )}
  </button>
</div>
```

- [ ] **Step 4: Update mobile avatar with upload overlay + high-res URL**

In `app/(protected)/profile/page.tsx`, update the mobile avatar section (lines 243-254):

```tsx
// OLD (lines 243-254):
<div className="relative w-24 h-24 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-gray-500 text-sm font-medium">
  {avatarUrl ? (
    <Image
      src={avatarUrl}
      alt="Profile"
      fill
      className="object-cover"
    />
  ) : (
    <span className="uppercase">{(name || "U").charAt(0)}</span>
  )}
</div>

// NEW:
<div className="relative w-24 h-24">
  <div className="w-full h-full rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-gray-500 text-sm font-medium">
    {highResAvatar ? (
      <Image
        src={highResAvatar}
        alt="Profile"
        fill
        className="object-cover"
      />
    ) : (
      <span className="uppercase">{(name || "U").charAt(0)}</span>
    )}
  </div>
  <input
    ref={avatarFileRef}
    type="file"
    accept="image/*"
    className="hidden"
    onChange={handleAvatarUpload}
    disabled={isUploadingAvatar}
  />
  <button
    type="button"
    onClick={() => avatarFileRef.current?.click()}
    disabled={isUploadingAvatar}
    className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#E5A550] hover:bg-[#D89440] text-white flex items-center justify-center shadow-md transition-colors disabled:opacity-60"
    aria-label="Change profile picture"
  >
    {isUploadingAvatar ? (
      <Loader2 className="w-4 h-4 animate-spin" />
    ) : (
      <Camera className="w-4 h-4" />
    )}
  </button>
</div>
```

**Note:** The mobile layout has TWO `<input type="file">` rendered but they share the same `avatarFileRef`, so only one will be active at a time (only one layout is visible via `hidden md:block` / `flex md:hidden`). This is fine since only one is in the DOM flow at a time.

- [ ] **Step 5: Verify visually**

Run: `npm run dev`

Check:
1. Profile page — avatar should be higher resolution (not blurry)
2. Camera icon overlay visible on bottom-right of avatar
3. Click camera icon — file picker opens
4. Select an image — loading spinner shows, then page reloads with new avatar
5. Check both mobile and desktop layouts

- [ ] **Step 6: Commit**

```bash
git add app/(protected)/profile/page.tsx
git commit -m "feat: high-res profile pictures + avatar upload"
```

---

### Task 8: Center create modal on mobile

**Files:**
- Modify: `app/(protected)/(home)/page.tsx:331` — modal positioning

- [ ] **Step 1: Update modal positioning**

In `app/(protected)/(home)/page.tsx`, change the type picker modal container (line 331):

```tsx
// OLD (line 331):
<div className="fixed inset-x-0 bottom-17 md:bottom-auto md:inset-0 md:flex md:items-center md:justify-center z-30 pointer-events-none">

// NEW:
<div className="fixed inset-0 flex items-center justify-center z-30 pointer-events-none">
```

Also update the inner container to use consistent rounding on mobile (line 332):

```tsx
// OLD (line 332):
<div className="pointer-events-auto bg-white rounded-t-3xl md:rounded-2xl md:shadow-2xl md:w-full md:max-w-sm mx-0 md:mx-0 px-6 pt-5 pb-10 md:pb-8">

// NEW:
<div className="pointer-events-auto bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 px-6 pt-5 pb-8">
```

Remove the mobile-only drag handle since the modal is now centered (line 334):

```tsx
// DELETE this line:
<div className="md:hidden w-10 h-1 rounded-full bg-gray-300 mx-auto mb-5" />
```

- [ ] **Step 2: Verify visually**

Run: `npm run dev`

Check:
1. Click the "Create" FAB — modal should appear centered on screen (both mobile and desktop)
2. Modal should have rounded corners and shadow
3. Clicking the backdrop should close the modal
4. Both "Offer" and "Request" buttons should navigate correctly

- [ ] **Step 3: Commit**

```bash
git add app/(protected)/(home)/page.tsx
git commit -m "fix: center create type picker modal on all screen sizes"
```

---

### Task 9: Build check

- [ ] **Step 1: Run the build**

```bash
npm run build
```

Expected: Build succeeds with no errors. Warnings are OK.

- [ ] **Step 2: Fix any build errors**

If there are TypeScript or build errors, fix them. Common issues:
- Missing `Image` import in `item.tsx` (added in Task 5)
- Type mismatch on `channelRef` in `use-realtime-chat.tsx` (check Task 4 types)

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build errors from frontend bugfixes"
```
