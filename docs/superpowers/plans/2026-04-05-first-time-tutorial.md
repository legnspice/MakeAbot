# First-Time User Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 5-step onboarding modal that fires after the disclaimer on first login and is re-triggerable anytime via a navbar help button.

**Architecture:** A `TutorialContext` at the protected-layout level owns `isOpen` state and exposes `openTutorial()` / `closeTutorial()`. `TutorialModal` consumes the context and renders a shadcn Dialog. `DisclaimerModal` calls `openTutorial()` on first accept; the Navbar help button calls it unconditionally.

**Tech Stack:** Next.js 16 App Router, React, shadcn/ui Dialog + Button, lucide-react, localStorage, Tailwind CSS.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `contexts/tutorial-context.tsx` | **Create** | `TutorialContext`, `TutorialProvider`, `useTutorial` hook |
| `components/tutorial-modal.tsx` | **Create** | 5-step modal UI, step navigation, localStorage write on close |
| `components/disclaimer-modal.tsx` | **Modify** | Add `onAccept` prop, restore `if (accepted) return null` |
| `components/ui/navbar.tsx` | **Modify** | Add `HelpCircle` help button (mobile + desktop) |
| `app/(protected)/layout.tsx` | **Modify** | Import `TutorialProvider`, render `DisclaimerModal`, wire `onAccept` |

---

## Task 1: TutorialContext

**Files:**
- Create: `contexts/tutorial-context.tsx`

- [ ] **Step 1: Create the context file**

```tsx
"use client";

import { createContext, useContext, useState, ReactNode, useMemo } from "react";

interface TutorialContextValue {
  isOpen: boolean;
  openTutorial: () => void;
  closeTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo(
    () => ({
      isOpen,
      openTutorial: () => setIsOpen(true),
      closeTutorial: () => setIsOpen(false),
    }),
    [isOpen]
  );

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error("useTutorial must be used within TutorialProvider");
  }
  return context;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors in `contexts/tutorial-context.tsx`.

- [ ] **Step 3: Commit**

```bash
git add contexts/tutorial-context.tsx
git commit -m "feat: add TutorialContext with openTutorial/closeTutorial"
```

---

## Task 2: TutorialModal

**Files:**
- Create: `components/tutorial-modal.tsx`

- [ ] **Step 1: Create the modal component**

```tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Plus, MessageCircle, ListChecks, Bell } from "lucide-react";
import { useTutorial } from "@/contexts/tutorial-context";

const TUTORIAL_STORAGE_KEY = "tutorial_seen_v1";

const STEPS = [
  {
    icon: LayoutGrid,
    iconBg: "bg-blue-100",
    iconColor: "text-[#3761B0]",
    title: "Browse the Feed",
    body: "Scroll through what your fellow Ateneans are offering and requesting. Use the filter bar to switch between Offers, Requests, or search by keyword.",
  },
  {
    icon: Plus,
    iconBg: "bg-amber-100",
    iconColor: "text-[#E5A550]",
    title: "Create a Post",
    body: "Tap the amber Create button to post something you want to offer or something you need.",
  },
  {
    icon: MessageCircle,
    iconBg: "bg-blue-100",
    iconColor: "text-[#3761B0]",
    title: "Inquire on an Item",
    body: "Tap any card, then hit Inquire to open a direct chat with the poster.",
  },
  {
    icon: ListChecks,
    iconBg: "bg-blue-100",
    iconColor: "text-[#3761B0]",
    title: "Track Your Chats",
    body: "Head to the Tracker tab to see all your active conversations and follow up on negotiations.",
  },
  {
    icon: Bell,
    iconBg: "bg-amber-100",
    iconColor: "text-[#E5A550]",
    title: "Notifications",
    body: "You'll be notified when someone inquires on your post or sends you a message. Check the notification bell to stay up to date.",
  },
] as const;

export function TutorialModal() {
  const { isOpen, closeTutorial } = useTutorial();
  const [step, setStep] = useState(0);

  function handleClose() {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
    setStep(0);
    closeTutorial();
  }

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      handleClose();
    }
  }

  const current = STEPS[step];
  const Icon = current.icon;
  const isLastStep = step === STEPS.length - 1;

  return (
    <Dialog open={isOpen}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-w-sm text-center mx-auto sm:mx-3 px-8"
      >
        {/* Progress dots */}
        <div className="flex justify-center gap-2 pt-2 mb-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? "bg-[#3761B0]" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        <DialogHeader className="items-center gap-3">
          <div
            className={`w-16 h-16 rounded-full ${current.iconBg} flex items-center justify-center`}
          >
            <Icon className={`w-8 h-8 ${current.iconColor}`} strokeWidth={2} />
          </div>
          <DialogTitle className="text-center text-lg font-bold text-gray-800">
            {current.title}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-5">
          {current.body}
        </p>

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
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors in `components/tutorial-modal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/tutorial-modal.tsx
git commit -m "feat: add TutorialModal with 5-step onboarding flow"
```

---

## Task 3: Update DisclaimerModal

**Files:**
- Modify: `components/disclaimer-modal.tsx`

Current state: `onAccept` prop is missing; the `if (accepted) return null;` line is commented out.

- [ ] **Step 1: Apply changes to `components/disclaimer-modal.tsx`**

Replace the entire file content with:

```tsx
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "disclaimer_accepted_v1";

interface DisclaimerModalProps {
  onAccept?: () => void;
}

export function DisclaimerModal({ onAccept }: DisclaimerModalProps) {
  // Default true to avoid a flash of the modal on returning visits
  const [accepted, setAccepted] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setAccepted(false);
    }
  }, []);

  function handleAccept() {
    localStorage.setItem(STORAGE_KEY, "true");
    setAccepted(true);
    onAccept?.();
  }

  if (accepted) return null;

  return (
    <Dialog open={true}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-w-sm text-center mx-auto sm:mx-3 px-8"
      >
        <DialogHeader>
          <DialogTitle className="text-center  ">
            Just a quick disclaimer...
          </DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground space-y-3 mb-5">
          <p>
            MakeAbot is an independent, student-led initiative designed to help
            students connect to offer and request items and services. It is not
            officially affiliated with, maintained by, or endorsed by Ateneo.
          </p>
          <p>
            We simply provide the communication platform; we do not oversee the
            actual transactions. By using this app, you acknowledge that all
            exchanges are made at your own risk. The creators and administrators
            of this app are not responsible or liable for any disputes,
            financial losses, or property damage resulting from interactions or
            transactions initiated through this platform. Please exercise
            caution and common sense accordingly.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={handleAccept} className="w-full">
            I understand, continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/disclaimer-modal.tsx
git commit -m "feat: add onAccept prop to DisclaimerModal, restore accepted guard"
```

---

## Task 4: Add Help Button to Navbar

**Files:**
- Modify: `components/ui/navbar.tsx`

- [ ] **Step 1: Add `HelpCircle` import and `useTutorial` import**

In `components/ui/navbar.tsx`, change the lucide import line from:

```tsx
import { User, Search } from "lucide-react";
```

to:

```tsx
import { User, Search, HelpCircle } from "lucide-react";
```

And add the tutorial context import directly below the existing imports:

```tsx
import { useTutorial } from "@/contexts/tutorial-context";
```

- [ ] **Step 2: Destructure `openTutorial` inside the component**

Inside `Navbar`, add this line after the existing `useState` declaration:

```tsx
const { openTutorial } = useTutorial();
```

- [ ] **Step 3: Add the help button to the mobile icon group**

Find the mobile icon group (the `<div className="flex md:hidden gap-5 items-center">`). Add the help button **before** the Profile link:

```tsx
{/* Mobile icon buttons */}
<div className="flex md:hidden gap-5 items-center">
  <button
    type="button"
    className={`w-12 h-12 rounded-full transition-colors flex items-center justify-center ${searchOpen ? "bg-gray-100" : "hover:bg-gray-100"}`}
    onClick={onSearchToggle}
    aria-label="Search"
  >
    <Search className="w-5 h-5 text-black" strokeWidth={2.5} />
  </button>
  <button
    type="button"
    className="w-12 h-12 rounded-full hover:bg-gray-100 transition-colors flex items-center justify-center"
    onClick={openTutorial}
    aria-label="Help"
  >
    <HelpCircle className="w-5 h-5 text-black" strokeWidth={2.5} />
  </button>
  <Link
    href="/profile"
    className="w-12 h-12 rounded-full cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-center"
    aria-label="Profile"
  >
    <User className="w-5 h-5 text-black" strokeWidth={2.5} />
  </Link>
</div>
```

- [ ] **Step 4: Add the help button to the desktop nav links**

Find the desktop nav links group (the `<div className="hidden md:flex items-center gap-6">`). Add the help button **before** the Profile link:

```tsx
<button
  type="button"
  onClick={openTutorial}
  className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-[#3761B0] transition-colors"
  aria-label="Help"
>
  <HelpCircle className="w-4 h-4" strokeWidth={2.5} />
  Help
</button>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/ui/navbar.tsx
git commit -m "feat: add Help button to navbar that opens tutorial"
```

---

## Task 5: Wire Everything in the Protected Layout

**Files:**
- Modify: `app/(protected)/layout.tsx`

- [ ] **Step 1: Update the protected layout**

Replace the entire file content with:

```tsx
"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthProvider } from "@/contexts/auth-context";
import { TutorialProvider } from "@/contexts/tutorial-context";
import { TutorialModal } from "@/components/tutorial-modal";
import { DisclaimerModal } from "@/components/disclaimer-modal";
import { PageShellSkeleton } from "@/components/ui/page-shell-skeleton";
import { useTutorial } from "@/contexts/tutorial-context";

const TUTORIAL_STORAGE_KEY = "tutorial_seen_v1";

function ProtectedContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { openTutorial } = useTutorial();

  function handleDisclaimerAccept() {
    if (!localStorage.getItem(TUTORIAL_STORAGE_KEY)) {
      openTutorial();
    }
  }

  return (
    <>
      <DisclaimerModal onAccept={handleDisclaimerAccept} />
      <TutorialModal />
      {children}
    </>
  );
}

// Layout level auth requirement for accessing protected pages
export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const { userData, currentUserDataLoading } = useCurrentUser();

  useEffect(() => {
    if (!currentUserDataLoading && !userData) {
      router.push("/auth/login");
    }
  }, [userData, currentUserDataLoading, router]);

  // Show loading state while checking auth
  if (currentUserDataLoading) {
    return <PageShellSkeleton />;
  }

  // Redirect handled by useEffect, show nothing while redirecting
  if (!userData) {
    return null;
  }

  return (
    <TutorialProvider>
      <AuthProvider userData={userData}>
        <ProtectedContent>{children}</ProtectedContent>
      </AuthProvider>
    </TutorialProvider>
  );
}
```

> **Note:** `ProtectedContent` is a separate inner component so it can call `useTutorial()` after `TutorialProvider` has mounted. Calling `useTutorial()` directly in `ProtectedLayout` would throw because the provider isn't yet in the tree.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/(protected)/layout.tsx
git commit -m "feat: wire TutorialProvider, DisclaimerModal, and TutorialModal into protected layout"
```

---

## Task 6: Manual Verification

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Test first-login flow**

1. Open DevTools → Application → Local Storage. Delete `disclaimer_accepted_v1` and `tutorial_seen_v1`.
2. Navigate to a protected route (e.g. `/`).
3. The disclaimer modal should appear.
4. Click "I understand, continue" — disclaimer closes, tutorial step 1 ("Browse the Feed") should open immediately.
5. Click "Next →" four times — confirm each step advances with the correct icon, title, and body text.
6. On step 5, the button should read "Got it". Clicking it closes the modal.
7. Confirm `tutorial_seen_v1` is now set in localStorage.

- [ ] **Step 3: Test skip flow**

1. Delete both localStorage keys again.
2. Accept the disclaimer — tutorial opens.
3. Click "Skip tutorial" — modal closes immediately.
4. Confirm `tutorial_seen_v1` is set.

- [ ] **Step 4: Test help button re-trigger**

1. With `tutorial_seen_v1` already set, navigate to the home page.
2. The disclaimer and tutorial should NOT auto-open.
3. Click the `?` Help button in the navbar — the tutorial should open from step 1.
4. Verify it works on both mobile (icon only) and desktop (icon + "Help" label).

- [ ] **Step 5: Test returning visitor**

1. Reload the page with both localStorage keys set.
2. Neither the disclaimer nor the tutorial should appear.

- [ ] **Step 6: Final commit if any tweaks were made**

```bash
git add -p
git commit -m "fix: tutorial manual verification adjustments"
```
