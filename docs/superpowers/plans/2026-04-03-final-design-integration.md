# Final Design Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Translate the MakeAbot Figma HiFi designs (mobile + widescreen) into the codebase — font, logo SVG, bottom nav icons, item type badges, image slots, and profile description display.

**Architecture:** All changes are purely presentational: updating CSS tokens, swapping the font, creating one SVG asset, and touching existing component/page files. No new routes, no backend changes. The branch `feature/final-design-integration` already exists and is checked out.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4, Instrument Sans (Google Fonts via `next/font/google`), lucide-react, shadcn/ui

---

## File Map

| File | Change |
|---|---|
| `app/layout.tsx` | Swap Geist → Instrument Sans, apply font variable |
| `app/globals.css` | Add `--font-instrument` token, brand color CSS vars |
| `public/logo.svg` | Create — the "M." monogram SVG (new file) |
| `app/auth/login/page.tsx` | Redesign: logo SVG + wordmark + tagline + button |
| `components/ui/bottomnavbar.tsx` | Replace gray squares with Home / Package / Bell icons |
| `components/ui/navbar.tsx` | Use `<Image src="/logo.svg">` monogram on mobile |
| `components/ui/item.tsx` | Add variant badge (ITEM / SERVICE) to card |
| `components/ui/item-detail-modal.tsx` | Add image placeholder / image display at top |
| `app/(public)/profile/page.tsx` | Display `description` field under bio |
| `app/(public)/notifications/page.tsx` | Minor: widen max-width to `max-w-2xl` for desktop |
| `app/(public)/chat/page.tsx` | Desktop chat header: item thumbnail square + pill type label |

---

## Task 1: Switch font to Instrument Sans

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Replace font imports in `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "MakeAbot",
  description: "The campus marketplace for borrowing, lending, and getting things done.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${instrumentSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Wire the font token into Tailwind in `app/globals.css`**

In the `@theme inline` block, replace `--font-sans: var(--font-geist-sans);` with:

```css
  --font-sans: var(--font-instrument);
```

Remove the `--font-mono` line entirely (Geist Mono is no longer loaded).

- [ ] **Step 3: Verify build compiles without font errors**

```bash
cd C:/Users/Niles/Documents/Files/Scripts/Projects/MakeAbot
pnpm build 2>&1 | tail -20
```

Expected: no font-related errors.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: switch font from Geist to Instrument Sans"
```

---

## Task 2: Create the "M." logo SVG

**Files:**
- Create: `public/logo.svg`

The Figma shows a bold sans-serif "M" with a dot below-right — a wordmark monogram used on the login screen.

- [ ] **Step 1: Create `public/logo.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 72" fill="none">
  <!-- Bold M letterform -->
  <path
    d="M4 64V8h12l24 36L64 8h12v56H64V30L40 64 16 30v34H4Z"
    fill="#3761B0"
  />
  <!-- Dot -->
  <circle cx="70" cy="66" r="6" fill="#E5A550" />
</svg>
```

- [ ] **Step 2: Verify SVG renders correctly**

Open `http://localhost:3000` (or view the file in browser) to confirm the logo displays: a solid blue bold M with an amber dot at lower-right.

- [ ] **Step 3: Commit**

```bash
git add public/logo.svg
git commit -m "feat: add MakeAbot M. logo SVG asset"
```

---

## Task 3: Redesign the login page

**Files:**
- Modify: `app/auth/login/page.tsx`

The Figma login screen: centred layout, "M." SVG monogram on top, "MakeAbot" wordmark below, blue tagline, then a blue full-width rounded button.

- [ ] **Step 1: Rewrite `app/auth/login/page.tsx`**

```tsx
import Image from "next/image";
import { googleLogin } from "./actions";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 gap-6">
      {/* M. monogram */}
      <Image
        src="/logo.svg"
        alt="MakeAbot logo"
        width={80}
        height={72}
        priority
      />

      {/* Wordmark */}
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-5xl md:text-6xl font-black tracking-tight text-[#3761B0]">
          MakeAbot
        </h1>
        <p className="text-[#3761B0] text-sm text-center max-w-xs">
          A lending app for the Ateneo community
        </p>
      </div>

      {/* Login button */}
      <form action={googleLogin} className="w-full max-w-xs">
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-3 rounded-xl py-3 px-4 bg-[#3761B0] shadow-sm hover:bg-[#2a4d8a] transition-colors"
        >
          <span className="text-white font-semibold text-sm">
            Login with your Ateneo Account
          </span>
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/auth/login/page.tsx
git commit -m "feat: redesign login page with M. logo and Figma layout"
```

---

## Task 4: Replace bottom nav placeholder squares with real icons

**Files:**
- Modify: `components/ui/bottomnavbar.tsx`

The Figma bottom nav has 3 tabs. The gray squares are placeholder icons. Use lucide-react icons: `Home` for home, `Package` for tracker, `Bell` for notifications. Add `usePathname` to highlight the active tab.

- [ ] **Step 1: Rewrite `components/ui/bottomnavbar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, Bell } from "lucide-react";

const navItems = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/tracker", label: "Tracker", Icon: Package },
  { href: "/notifications", label: "Notifications", Icon: Bell },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#4A6FA5] shadow-lg z-40">
      <div className="flex justify-around items-stretch gap-1 py-2 px-2 min-h-[68px]">
        {navItems.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center justify-center gap-1 min-w-0 px-1 py-2"
            >
              <Icon
                className={`w-6 h-6 transition-colors ${active ? "text-white" : "text-white/60"}`}
                strokeWidth={active ? 2.5 : 1.8}
              />
              <span
                className={`text-xs font-medium text-center leading-tight ${active ? "text-white" : "text-white/60"}`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ui/bottomnavbar.tsx
git commit -m "feat: replace bottom nav placeholder squares with Home/Package/Bell icons"
```

---

## Task 5: Add M. monogram to mobile navbar

**Files:**
- Modify: `components/ui/navbar.tsx`

The Figma navbar shows "MakeAbot" as a wordmark (text). On mobile the logo doubles as the home link. No structural changes needed — just ensure the wordmark uses the brand font weight and colour. Also add active Notifications dot on mobile when needed.

- [ ] **Step 1: Update the wordmark styling in `components/ui/navbar.tsx`**

Change the `<Link href="/">` text from:
```tsx
<Link href="/" className="text-4xl sm:text-5xl font-bold tracking-tight">
  MakeAbot
</Link>
```
To:
```tsx
<Link href="/" className="text-4xl sm:text-5xl font-black tracking-tight text-[#3761B0]">
  MakeAbot
</Link>
```

- [ ] **Step 2: Commit**

```bash
git add components/ui/navbar.tsx
git commit -m "feat: match navbar wordmark to Figma — font-black, brand blue"
```

---

## Task 6: Add type badge to item cards

**Files:**
- Modify: `components/ui/item.tsx`

The Figma item cards show a small "ITEM" label badge at the top-left. The `variant` prop already distinguishes lent vs. requested. Use the `detail` prop's title prefix to derive the type, or add a new optional `typeBadge` prop.

- [ ] **Step 1: Add `typeBadge` prop and badge display to `components/ui/item.tsx`**

Add `typeBadge?: string` to `ItemRequestCardProps` and render it:

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

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-gray-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3761B0] focus-visible:ring-offset-2"
    >
      {typeBadge && (
        <span className="inline-block mb-2 text-xs font-bold uppercase tracking-wider text-[#3761B0] bg-blue-50 px-2 py-0.5 rounded">
          {typeBadge}
        </span>
      )}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-lg font-bold text-gray-900 line-clamp-1">
          {detail?.title ?? "Item"}
        </h3>
        <p className="text-sm text-gray-600">
          {variant === "lent"
            ? requestedBy.replace(/^Offered by:/i, "Lent by:")
            : requestedBy}
        </p>
        {detail?.description && (
          <p className="hidden md:block text-sm text-gray-500 line-clamp-2">
            {detail.description}
          </p>
        )}
        {(hasLocation || hasDate) && (
          <div className="text-sm text-gray-600 flex flex-wrap gap-x-2 gap-y-0">
            {hasLocation && <span>{section}</span>}
            {hasDate && <span>{time}</span>}
          </div>
        )}
      </div>
      <div className="mt-3 flex justify-end">
        <span className="text-[#3761B0] font-semibold">{price}</span>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Pass `typeBadge` from the home page**

In `app/(public)/(home)/page.tsx`, update the `mapped.push` calls:

For posts:
```tsx
mapped.push({
  ...
  typeBadge: "Offer",
  ...
});
```

For requests:
```tsx
mapped.push({
  ...
  typeBadge: "Request",
  ...
});
```

And in the JSX where `<ItemRequestCard>` is rendered, add:
```tsx
typeBadge={item.typeBadge}
```

Also add `typeBadge?: string` to the `ListItem` type at the top of `app/(public)/(home)/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/ui/item.tsx app/(public)/(home)/page.tsx
git commit -m "feat: add OFFER/REQUEST type badge to item cards"
```

---

## Task 7: Add image slot to item detail modal

**Files:**
- Modify: `components/ui/item-detail-modal.tsx`

The Figma item detail shows a large image placeholder at the top (`ITEM_IMAGE`). The `ItemDetailData` already has `imageUrl?: string`. Render it when present, otherwise show a styled placeholder.

- [ ] **Step 1: Add image slot to `components/ui/item-detail-modal.tsx`**

After the back button block (`</div>` at line 73), add an image section before `{/* Content */}`:

```tsx
{/* Image */}
<div className="shrink-0 w-full h-40 bg-gray-100 overflow-hidden flex items-center justify-center">
  {item.imageUrl ? (
    <img
      src={item.imageUrl}
      alt={item.title}
      className="w-full h-full object-cover"
    />
  ) : (
    <span className="text-gray-300 text-xs uppercase tracking-widest font-medium">
      No image
    </span>
  )}
</div>
```

Also update the modal container height to accommodate: change `max-h-80 md:max-h-96` to `max-h-[28rem] md:max-h-[32rem]`.

- [ ] **Step 2: Add FREE badge next to price**

In the price display section (line 84-88), update:
```tsx
<div className="flex items-center gap-2 shrink-0">
  {item.quantity != null && <span>{item.quantity}x</span>}
  <span
    className={`font-semibold text-sm px-2 py-0.5 rounded ${
      item.price === "FREE"
        ? "bg-emerald-100 text-emerald-700"
        : "text-[#3761B0]"
    }`}
  >
    {item.price}
  </span>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/item-detail-modal.tsx
git commit -m "feat: add image slot and FREE badge to item detail modal"
```

---

## Task 8: Show description on profile page

**Files:**
- Modify: `app/(public)/profile/page.tsx`

The Figma profile shows a biography paragraph under the name/phone/ID section. The `description` field exists in the DB and schema. Fetch it and display it.

- [ ] **Step 1: Add description state in `app/(public)/profile/page.tsx`**

After `const [phoneNumber, setPhoneNumber] = useState(...)`, add:
```tsx
const [description, setDescription] = useState(currentUser.description ?? '');
```

- [ ] **Step 2: Populate description from `loadData` result**

Inside `loadData`, after setting name/idNumber/phoneNumber:
```tsx
setDescription(u.description ?? '');
```

- [ ] **Step 3: Display description in both desktop and mobile layouts**

In the desktop layout (`hidden md:block`), after the phone/ID div (around line 148), add:
```tsx
{description && (
  <p className="mt-3 text-sm text-gray-700 leading-relaxed max-w-xl">
    &quot;{description}&quot;
  </p>
)}
```

In the mobile layout (`flex md:hidden`), after the name/rating row, add:
```tsx
{description && (
  <p className="text-sm text-gray-700 leading-relaxed">
    &quot;{description}&quot;
  </p>
)}
```

- [ ] **Step 4: Add description field to the Edit modal**

In the `editForm` state, add `description: ''`:
```tsx
const [editForm, setEditForm] = useState({ name: '', idNumber: '', phoneNumber: '', description: '' });
```

In `openEdit()`:
```tsx
setEditForm({ name, idNumber, phoneNumber, description });
```

In `handleSave()`, include description in the `editUser` call:
```tsx
const result = await editUser(currentUser.id, {
  name: editForm.name.trim() || null,
  id_number: editForm.idNumber ? parseInt(editForm.idNumber, 10) : null,
  phone_number: editForm.phoneNumber.trim() || null,
  description: editForm.description.trim() || null,
});
```

After save success, add:
```tsx
setDescription(editForm.description.trim());
```

In the edit modal form fields, add a textarea for description after phoneNumber field:
```tsx
<div className="flex flex-col gap-1">
  <label className="text-sm text-gray-600 font-medium">Bio</label>
  <textarea
    value={editForm.description}
    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
    placeholder="Tell others about yourself..."
    rows={3}
    className="rounded-xl bg-gray-100 border-0 px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-gray-300"
  />
</div>
```

- [ ] **Step 5: Commit**

```bash
git add app/\(public\)/profile/page.tsx
git commit -m "feat: show and edit description/bio on profile page"
```

---

## Task 9: Desktop chat header polish

**Files:**
- Modify: `app/(public)/chat/page.tsx`

The Figma chat screen shows a header with a small coloured item thumbnail square + the item name and a pill label (ITEM | Lorem ipsum name). Update the desktop chat header to match.

- [ ] **Step 1: Update the desktop chat header in `app/(public)/chat/page.tsx`**

Replace the existing `<header className="bg-[#E8ECFF]...">` block (around lines 209–222) with:

```tsx
<header className="bg-[#E8ECFF] flex items-center px-5 py-3 gap-3 shrink-0 border-b border-blue-100">
  <div className="w-9 h-9 rounded bg-[#8B5E52] shrink-0" />
  <div className="flex-1 min-w-0">
    <p className="font-bold text-gray-900 text-sm leading-tight truncate">
      {selectedConv.kind === 'offer' ? 'OFFER' : 'REQUEST'}
      {' | '}
      {selectedConv.otherName || selectedConv.title}
    </p>
    <p className="text-xs text-gray-500 leading-tight truncate">{selectedConv.title}</p>
  </div>
  <button
    type="button"
    onClick={() => setSelectedConv(null)}
    className="text-[#3761B0] hover:text-[#2a4d8a] transition-colors p-1 rounded-full hover:bg-blue-50"
    aria-label="Close"
  >
    <ArrowLeft className="w-5 h-5" />
  </button>
</header>
```

- [ ] **Step 2: Commit**

```bash
git add app/\(public\)/chat/page.tsx
git commit -m "feat: update desktop chat header to match Figma style"
```

---

## Task 10: Widescreen notifications layout

**Files:**
- Modify: `app/(public)/notifications/page.tsx`

The Figma widescreen design shows notifications in a wider panel. Expand the max-width for desktop.

- [ ] **Step 1: Update max-width in `app/(public)/notifications/page.tsx`**

Change:
```tsx
<main className="flex-1 max-w-md mx-auto w-full px-4 pt-4 pb-28">
```
To:
```tsx
<main className="flex-1 max-w-md md:max-w-2xl mx-auto w-full px-4 pt-4 pb-28 md:pb-6">
```

- [ ] **Step 2: Commit**

```bash
git add app/\(public\)/notifications/page.tsx
git commit -m "feat: expand notifications layout width for desktop"
```

---

## Task 11: Final verification & branch push-ready check

- [ ] **Step 1: Run TypeScript check**

```bash
cd C:/Users/Niles/Documents/Files/Scripts/Projects/MakeAbot
pnpm tsc --noEmit 2>&1 | head -40
```

Expected: 0 errors (or only pre-existing errors unrelated to this work).

- [ ] **Step 2: Run build**

```bash
pnpm build 2>&1 | tail -30
```

Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Verify git log**

```bash
git log --oneline -12
```

Expected: 9+ commits from this plan on `feature/final-design-integration`.
