# First-Time User Tutorial — Design Spec

**Date:** 2026-04-05
**Status:** Approved

---

## Overview

A 5-step modal wizard that appears automatically after the disclaimer is accepted on a user's first login, then remains re-triggerable at any time via a help button (`?`) in the navbar. Styled consistently with the app's existing design language (shadcn Dialog, `#3761B0` blue / `#E5A550` amber brand colors, white backgrounds).

---

## Architecture

### TutorialContext

A new React context (`contexts/tutorial-context.tsx`) added at the protected layout level. Provides:

```ts
interface TutorialContextValue {
  openTutorial: () => void;
}
```

The context owns `isOpen` state internally and renders `<TutorialModal>` directly. No prop-drilling needed — both `DisclaimerModal` and `Navbar` consume it independently.

**Provider placement:** Inside `app/(protected)/layout.tsx`, wrapping `AuthProvider` (or alongside it as a sibling wrapper). The tutorial only makes sense when authenticated, so protected layout is the correct boundary.

### localStorage

- Key: `tutorial_seen_v1`
- Set to `"true"` when the user clicks "Got it" on step 5 or "Skip tutorial" on any step.
- `DisclaimerModal` calls `openTutorial()` on accept **only if** `tutorial_seen_v1` is not set.
- The Navbar help button calls `openTutorial()` unconditionally (re-triggerable always).

---

## DisclaimerModal Changes

`DisclaimerModal` gains an `onAccept` callback prop (optional, defaults to no-op):

```ts
interface DisclaimerModalProps {
  onAccept?: () => void;
}
```

`handleAccept` calls `onAccept()` after setting localStorage. The protected layout passes a function that checks `tutorial_seen_v1` and calls `openTutorial()` if unset.

The currently-commented-out `if (accepted) return null;` line is restored so the modal hides correctly after acceptance.

---

## TutorialModal Component

**File:** `components/tutorial-modal.tsx`

Uses shadcn `<Dialog>` — same `max-w-sm`, `showCloseButton={false}`, escape/outside-click blocked (same pattern as DisclaimerModal). On step completion or skip, sets `tutorial_seen_v1` and closes.

### Step Content

| # | Icon (lucide) | Icon bg / color | Title | Body |
|---|---|---|---|---|
| 1 | `LayoutGrid` | `bg-blue-100` / `text-[#3761B0]` | Browse the Feed | Scroll through what your fellow Ateneans are offering and requesting. Use the filter bar to switch between Offers, Requests, or search by keyword. |
| 2 | `Plus` | `bg-amber-100` / `text-[#E5A550]` | Create a Post | Tap the amber **Create** button to post something you want to offer or something you need. |
| 3 | `MessageCircle` | `bg-blue-100` / `text-[#3761B0]` | Inquire on an Item | Tap any card, then hit **Inquire** to open a direct chat with the poster. |
| 4 | `ListChecks` | `bg-blue-100` / `text-[#3761B0]` | Track Your Chats | Head to the **Tracker** tab to see all your active conversations and follow up on negotiations. |
| 5 | `Bell` | `bg-amber-100` / `text-[#E5A550]` | Notifications | You'll be notified when someone inquires on your post or sends you a message. Check the notification bell to stay up to date. |

### Modal Layout (per step)

```
┌────────────────────────────────┐
│  ● ○ ○ ○ ○   (progress dots)  │
│                                │
│      [icon circle, large]      │
│         Bold Title             │
│    Body text, muted, small     │
│                                │
│  [Skip tutorial]   [Next →]   │
└────────────────────────────────┘
```

- **Progress dots:** 5 small circles, active dot filled `bg-[#3761B0]`, inactive `bg-gray-200`. Centered at top of content.
- **Icon circle:** `w-16 h-16 rounded-full`, centered. Background and icon color alternate blue/amber per step (see table above).
- **Title:** `text-lg font-bold text-gray-800`, centered.
- **Body:** `text-sm text-muted-foreground`, centered, `max-w-xs mx-auto`.
- **Footer:**
  - Left: "Skip tutorial" — `text-sm text-muted-foreground hover:text-gray-700` text button
  - Right: "Next →" (steps 1–4) / "Got it" (step 5) — full-width on step 5, normal on others. Uses existing `<Button>` component with default (blue) variant.

---

## Navbar Changes

**File:** `components/ui/navbar.tsx`

Add a `HelpCircle` icon button (already imported in the home page — add to navbar imports). Placed:
- **Mobile:** In the right icon group alongside Search and Profile, before the Profile icon.
- **Desktop:** In the nav links group, before the Profile avatar link.

The button calls `openTutorial()` from `useTutorial()` context hook. Styled identically to the existing Search button (`w-12 h-12 rounded-full hover:bg-gray-100 flex items-center justify-center`).

```tsx
// Mobile
<button
  type="button"
  className="w-12 h-12 rounded-full hover:bg-gray-100 transition-colors flex items-center justify-center"
  onClick={openTutorial}
  aria-label="Help"
>
  <HelpCircle className="w-5 h-5 text-black" strokeWidth={2.5} />
</button>
```

---

## Protected Layout Changes

**File:** `app/(protected)/layout.tsx`

Wrap children with `TutorialProvider`. Pass `onAccept` to `DisclaimerModal` that checks localStorage and calls `openTutorial()`:

```tsx
<TutorialProvider>
  <AuthProvider userData={userData}>
    <DisclaimerModal onAccept={handleDisclaimerAccept} />
    {children}
  </AuthProvider>
</TutorialProvider>
```

`handleDisclaimerAccept` reads `tutorial_seen_v1`; if absent, calls `openTutorial()`.

---

## Files Touched

| File | Change |
|---|---|
| `contexts/tutorial-context.tsx` | New — TutorialContext + TutorialProvider |
| `components/tutorial-modal.tsx` | New — 5-step modal component |
| `components/disclaimer-modal.tsx` | Add `onAccept` prop; restore `if (accepted) return null` |
| `components/ui/navbar.tsx` | Add HelpCircle help button (mobile + desktop) |
| `app/(protected)/layout.tsx` | Import and render DisclaimerModal (not yet present); wrap with TutorialProvider; wire up DisclaimerModal onAccept |

---

## Out of Scope

- No server-side tracking of tutorial completion (localStorage is sufficient)
- No analytics events on tutorial step views
- No ability to restart from a specific step (always starts at step 1)
