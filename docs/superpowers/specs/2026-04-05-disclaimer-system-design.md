# Disclaimer System Design

**Date:** 2026-04-05
**Status:** Approved

## Overview

MakeAbot facilitates real-money transactions between students with no platform oversight. A disclaimer system is needed to establish liability coverage. The system has three parts: a passive disclaimer on the login page, a one-time blocking acceptance modal for authenticated users, and a persistent footer with disclaimer and contact information inside the protected layout.

---

## Disclaimer Text

### Short Form (Parts 1 and 3)

> MakeAbot is an independent student project, not an official university platform. We provide a space for students to connect, but all transactions are made at your own risk. The creators are not liable for any damages, scams, losses, or disputes that arise from using this app. Transact safely and responsibly!

### Long Form (Part 2)

> MakeAbot is an independent, student-led initiative designed to help students connect to offer and request items and services. It is not officially affiliated with, maintained by, or endorsed by Ateneo.
>
> We simply provide the communication platform; we do not oversee the actual transactions. By using this app, you acknowledge that all exchanges are made at your own risk. The creators and administrators of this app are not responsible or liable for any disputes, financial losses, or property damage resulting from interactions or transactions initiated through this platform. Please exercise caution and common sense when meeting up.

---

## Part 1 — Login Page Disclaimer

**File:** `app/auth/login/page.tsx`

Add the short-form disclaimer as a passive `<p>` tag below the sign-in `<form>`. No interaction required.

- Tag: `<p>`
- Styles: `text-xs`, `text-gray-400`, `text-center`, `max-w-xs` (matches button width)
- Position: below the `<form>`, inside the existing flex column

---

## Part 2 — One-Time Acceptance Modal

**New file:** `components/disclaimer-modal.tsx`
**Mounted in:** `app/(protected)/layout.tsx`

### Behavior

- On mount, checks `localStorage.getItem('disclaimer_accepted_v1')`
- If key is present: renders nothing (zero effect on returning users)
- If key is absent: opens a blocking shadcn `<Dialog>` immediately
- Modal is non-dismissable: no close button, `onInteractOutside` and `onEscapeKeyDown` are both suppressed
- Single CTA: "I understand, continue" — calls `localStorage.setItem('disclaimer_accepted_v1', 'true')` and closes the dialog
- The protected page renders underneath but is inaccessible until the user accepts

### Version key

`disclaimer_accepted_v1` — bump to `v2` if the disclaimer text changes materially, which will re-trigger the modal for all users.

### Placement in layout

`DisclaimerModal` is rendered inside `app/(protected)/layout.tsx` after the auth guard passes (i.e. only when `userData` is confirmed non-null), so unauthenticated users never see it.

### Component structure

```
<Dialog open={!accepted}>
  <DialogContent> (no close button)
    <DialogHeader>
      <DialogTitle>Before you continue</DialogTitle>
    </DialogHeader>
    <p>{LONG_FORM_TEXT}</p>
    <DialogFooter>
      <Button onClick={handleAccept}>I understand, continue</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Part 3 — Protected Layout Footer

**New file:** `components/app-footer.tsx`
**Mounted in:** `app/(protected)/layout.tsx`

The protected layout root `<div>` is converted to `flex flex-col min-h-screen` so the footer always sits at the bottom. The `{children}` area grows to fill available space (`flex-1`).

### Layout — Desktop (md+)

Two columns side by side:

| Left column | Right column |
|---|---|
| MakeAbot logo (`/logo.svg`) + "MakeAbot" wordmark | "Contact Us" heading |
| Short-form disclaimer text below | Facebook link with FB icon |
| | Email link with mail icon |

### Layout — Mobile

Single column: logo + wordmark + disclaimer stacked above the contacts section.

### Contact details

- **Facebook:** [MakeAbot Facebook Page](https://www.facebook.com/people/MakeAbot/61575401159655/) — label "MakeAbot on Facebook"
- **Email:** niles.tristan.cabrera@student.ateneo.edu — label "Email us"

### Styling

- Background: dark navy (`bg-[#1e2d4d]`)
- Text: white, `text-xs` for disclaimer
- Links: white with hover accent in brand blue (`#3761B0`)
- Icons: Lucide `Facebook` and `Mail` icons inline with link labels
- Padding: `px-6 py-8` or similar, consistent with app spacing

---

## Architecture

### New files

| File | Purpose |
|---|---|
| `components/disclaimer-modal.tsx` | One-time acceptance modal (Part 2) |
| `components/app-footer.tsx` | Persistent footer with disclaimer + contacts (Part 3) |

### Modified files

| File | Change |
|---|---|
| `app/auth/login/page.tsx` | Add short disclaimer `<p>` below sign-in form |
| `app/(protected)/layout.tsx` | Mount `DisclaimerModal` and `AppFooter`; wrap layout in `flex flex-col min-h-screen` |

### No new dependencies

- shadcn `Dialog` is already available
- Lucide icons are already available
- No server-side storage, no new DB tables, no new API routes

---

## Non-Goals

- No server-side acceptance tracking
- No separate terms-of-service page
- No email/push notification on acceptance
- No per-user disclaimer version management (localStorage only)
