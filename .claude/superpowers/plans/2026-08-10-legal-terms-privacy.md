# Legal — Terms of Use & Data Privacy Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public `/terms` and `/privacy` pages with MakeAbot-specific content, and fold agreement to them into the existing one-time acknowledgment modal (plus footer + login links).

**Architecture:** Two static top-level route pages (outside `(protected)` so they're reachable pre-auth) rendered through a shared `LegalLayout` presentational component. Content is authored as semantic TSX — no markdown dependency. Consent is handled by upgrading the existing `disclaimer-modal.tsx` (agreement line + links + storage-key bump) and adding legal links to the footer and login page.

**Tech Stack:** Next.js 16 App Router (server components), React 19, Tailwind v4, `next/link`, `next/image`, react-bootstrap-icons.

## Global Constraints

- Branch: `feature/qa-fixes-v2` (off `dev`). No new branch. No schema/migration changes. No new npm dependencies.
- `/terms` and `/privacy` MUST be top-level routes (NOT under `(protected)`), reachable while logged out.
- Real login page is `app/auth/login/page.tsx` (route `/auth/login`); footer is `components/app-footer.tsx`; acknowledgment modal is `components/disclaimer-modal.tsx` (rendered in `app/(protected)/layout.tsx`).
- Content must match actual data practices (contextual disclosure of phone/ID only to counterparties; reports admin-only; no data selling; processors Supabase / Google / Resend / Web-Push) — do not overstate or misstate.
- Incentive cap copy: **₱500**. Brand blue `#3761B0`, dark footer `#1e2d4d`.
- Only touched files must be lint-clean; `npm format` before push.
- These are student-project drafts, not legal advice — do not print that caveat on the pages; it lives in the spec for the user.

---

### Task 1: Shared `LegalLayout` component

**Files:**
- Create: `components/legal-layout.tsx`

**Interfaces:**
- Produces: `LegalLayout({ title, lastUpdated, children }: { title: string; lastUpdated: string; children: React.ReactNode })` — a server component (no hooks) rendering logo, a back link to `/`, a readable prose container, the title, and the "Last updated" line. Consumed by Tasks 2-3.

- [ ] **Step 1: Create the component**

Create `components/legal-layout.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";

export function LegalLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-gray-200 px-4 py-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[#3761B0] hover:underline"
        >
          <Image src="/logo.svg" alt="MakeAbot" width={24} height={22} />
          <span className="font-semibold">← Back to MakeAbot</span>
        </Link>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-5 py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{title}</h1>
        <p className="mt-1 text-xs text-gray-400">Last updated: {lastUpdated}</p>

        <div
          className="mt-6 flex flex-col gap-6 text-sm leading-relaxed text-gray-700
            [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:mb-1
            [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1
            [&_a]:text-[#3761B0] [&_a]:hover:underline"
        >
          {children}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint components/legal-layout.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/legal-layout.tsx
git commit -m "feat(legal): shared LegalLayout prose wrapper"
```

---

### Task 2: Terms of Use page

**Files:**
- Create: `app/terms/page.tsx`

**Interfaces:**
- Consumes: `LegalLayout` (Task 1).

- [ ] **Step 1: Create the page**

Create `app/terms/page.tsx` (static server component; each section is a `<section>` inside `LegalLayout`):

```tsx
import { LegalLayout } from "@/components/legal-layout";

export const metadata = { title: "Terms of Use — MakeAbot" };

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Use" lastUpdated="August 10, 2026">
      <section>
        <p>
          Welcome to MakeAbot. These Terms of Use (&quot;Terms&quot;) govern your
          use of the MakeAbot platform. By creating an account or using the app,
          you agree to these Terms. If you do not agree, please do not use
          MakeAbot.
        </p>
      </section>

      <section>
        <h2>1. About MakeAbot</h2>
        <p>
          MakeAbot is an independent, student-led platform that helps students
          coordinate to offer and request items and services within their
          community. It is <strong>not affiliated with, maintained by, or
          endorsed by the Ateneo de Manila University</strong>. MakeAbot only
          provides a space to connect — we do not participate in, oversee, or
          guarantee any transaction, exchange, or arrangement made between users.
        </p>
      </section>

      <section>
        <h2>2. Eligibility</h2>
        <p>
          MakeAbot is intended for students of the Ateneo community. You are
          responsible for ensuring you are permitted to use the platform and for
          all activity under your account.
        </p>
      </section>

      <section>
        <h2>3. Your Account</h2>
        <p>
          You sign in with your Google account. Keep your profile information
          accurate, and do not impersonate anyone or misrepresent your identity.
          You are responsible for activity that happens through your account.
        </p>
      </section>

      <section>
        <h2>4. Posting Offers and Requests</h2>
        <p>
          You may post offers (things you can lend or provide) and requests
          (things you need). Listings must be accurate and lawful. Any incentive
          you attach is an informal token of appreciation and is capped at
          ₱500 — MakeAbot is not a commercial marketplace and is not intended for
          profit-driven selling. Do not post prohibited, illegal, unsafe, or
          inappropriate items or services.
        </p>
      </section>

      <section>
        <h2>5. Bidding, Chat, and Completing Deals</h2>
        <p>
          Users express interest by bidding, then coordinate directly through
          in-app chat. Any actual exchange, meet-up, or payment is arranged
          between the users themselves and happens off-platform, at your own
          arrangement and risk. Marking a deal as done simply records that the
          interaction concluded.
        </p>
      </section>

      <section>
        <h2>6. Reviews and Reporting</h2>
        <p>
          After a completed deal, you may leave a review of the person you dealt
          with. Reviews must be honest and tied to a real interaction. If someone
          behaves in bad faith or a post looks unsafe, you can report them or the
          post; reports are reviewed by our team. Do not use reviews or reports to
          harass, retaliate against, or unfairly target other users.
        </p>
      </section>

      <section>
        <h2>7. Prohibited Conduct</h2>
        <ul>
          <li>Harassment, threats, hate speech, or abusive behavior.</li>
          <li>Scams, fraud, or deceptive practices.</li>
          <li>Posting illegal, stolen, unsafe, or prohibited items or services.</li>
          <li>Spam, impersonation, or misuse of other users&apos; information.</li>
          <li>Attempting to disrupt, exploit, or gain unauthorized access to the platform.</li>
        </ul>
      </section>

      <section>
        <h2>8. Disclaimers and Limitation of Liability</h2>
        <p>
          MakeAbot is provided &quot;as is,&quot; without warranties of any kind.
          Because we only provide the communication platform and do not oversee
          the actual transactions, all exchanges are made at your own risk. To the
          fullest extent permitted by law, the creators and administrators of
          MakeAbot are not responsible or liable for any disputes, financial
          losses, property damage, or other harm resulting from interactions or
          transactions initiated through this platform. Please exercise caution
          and common sense.
        </p>
      </section>

      <section>
        <h2>9. Suspension and Termination</h2>
        <p>
          We may suspend or remove accounts that violate these Terms or that
          threaten the safety of the community, at our discretion.
        </p>
      </section>

      <section>
        <h2>10. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. Significant changes will be
          reflected by an updated date above, and continued use of MakeAbot after
          changes take effect constitutes acceptance of the revised Terms.
        </p>
      </section>

      <section>
        <h2>11. Governing Law</h2>
        <p>
          These Terms are governed by the laws of the Republic of the Philippines.
        </p>
      </section>

      <section>
        <h2>12. Contact</h2>
        <p>
          Questions about these Terms? Reach us on{" "}
          <a
            href="https://www.facebook.com/people/MakeAbot/61575401159655/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Facebook
          </a>{" "}
          or at{" "}
          <a href="mailto:niles.tristan.cabrera@student.ateneo.edu">
            niles.tristan.cabrera@student.ateneo.edu
          </a>
          .
        </p>
      </section>
    </LegalLayout>
  );
}
```

- [ ] **Step 2: Typecheck + lint + reachability**

Run: `npx tsc --noEmit && npx eslint "app/terms/page.tsx"`
Expected: no errors. Confirm the file is at `app/terms/page.tsx` (NOT under `app/(protected)/`).

- [ ] **Step 3: Commit**

```bash
git add "app/terms/page.tsx"
git commit -m "feat(legal): Terms of Use page"
```

---

### Task 3: Data Privacy Policy page

**Files:**
- Create: `app/privacy/page.tsx`

**Interfaces:**
- Consumes: `LegalLayout` (Task 1).

- [ ] **Step 1: Create the page**

Create `app/privacy/page.tsx`:

```tsx
import { LegalLayout } from "@/components/legal-layout";

export const metadata = { title: "Data Privacy Policy — MakeAbot" };

export default function PrivacyPage() {
  return (
    <LegalLayout title="Data Privacy Policy" lastUpdated="August 10, 2026">
      <section>
        <p>
          This Data Privacy Policy explains how MakeAbot collects, uses, and
          protects your personal information. We are committed to handling your
          data responsibly and in line with the Philippine Data Privacy Act of
          2012 (Republic Act No. 10173). By using MakeAbot, you consent to the
          practices described here.
        </p>
      </section>

      <section>
        <h2>1. Information We Collect</h2>
        <ul>
          <li>
            <strong>From your Google sign-in:</strong> your email address, name,
            and profile photo.
          </li>
          <li>
            <strong>Profile information you provide:</strong> your display name,
            phone number, ID number, and a short bio/description.
          </li>
          <li>
            <strong>Content you create:</strong> your posts (offers and requests),
            chat messages, reviews, and any reports you submit.
          </li>
          <li>
            <strong>Technical data:</strong> push-notification subscriptions and
            in-app notification records used to deliver updates.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>To operate the platform and let you post, bid, and chat.</li>
          <li>To connect you with the right counterparties.</li>
          <li>To send you in-app, push, and email notifications you&apos;ve enabled.</li>
          <li>To keep the community safe (moderation and handling reports).</li>
        </ul>
      </section>

      <section>
        <h2>3. Legal Basis</h2>
        <p>
          We process your information based on your consent (given when you accept
          this policy) and as necessary to provide the service you request, in
          accordance with the Data Privacy Act.
        </p>
      </section>

      <section>
        <h2>4. How We Share Your Information</h2>
        <p>
          We <strong>do not sell your personal data</strong>. Your contact details
          (phone number and ID number) are shown only to users you have actually
          dealt with — that is, someone you share a bid or deal with — and never to
          the general public or to users you have not interacted with. Reports you
          submit are visible only to MakeAbot administrators for review, and are
          not shown to the person reported.
        </p>
      </section>

      <section>
        <h2>5. Service Providers</h2>
        <p>
          We rely on trusted third-party services to run MakeAbot, and your data
          may be processed on their infrastructure:
        </p>
        <ul>
          <li><strong>Supabase</strong> — database, authentication, and file storage.</li>
          <li><strong>Google</strong> — sign-in (OAuth).</li>
          <li><strong>Resend</strong> — sending email notifications.</li>
          <li><strong>Web Push</strong> — delivering browser push notifications.</li>
        </ul>
      </section>

      <section>
        <h2>6. Data Retention</h2>
        <p>
          We keep your information while your account is active. If you delete your
          account, we delete or anonymize your personal data on a best-effort basis,
          except where we are required to retain it.
        </p>
      </section>

      <section>
        <h2>7. Your Rights</h2>
        <p>
          Under the Data Privacy Act, you have the right to access, correct, and
          request deletion or blocking of your personal data, and to object to its
          processing. To exercise these rights, contact us using the details below.
        </p>
      </section>

      <section>
        <h2>8. Security</h2>
        <p>
          We use managed authentication and access controls to protect your data.
          No system is perfectly secure, however, so we cannot guarantee absolute
          security — please protect your account and share sensitive details
          carefully.
        </p>
      </section>

      <section>
        <h2>9. Cookies and Local Storage</h2>
        <p>
          We use session cookies to keep you signed in, and your browser&apos;s
          local storage to remember small preferences (such as that you&apos;ve
          acknowledged our notices and seen the tutorial). We do not use
          third-party advertising or tracking cookies.
        </p>
      </section>

      <section>
        <h2>10. Who Can Use MakeAbot</h2>
        <p>
          MakeAbot is intended for students of the Ateneo community. It is not
          directed at children.
        </p>
      </section>

      <section>
        <h2>11. Changes to This Policy</h2>
        <p>
          We may update this policy; the &quot;Last updated&quot; date above will
          reflect the latest version.
        </p>
      </section>

      <section>
        <h2>12. Contact and Complaints</h2>
        <p>
          For privacy questions or requests, reach us on{" "}
          <a
            href="https://www.facebook.com/people/MakeAbot/61575401159655/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Facebook
          </a>{" "}
          or at{" "}
          <a href="mailto:niles.tristan.cabrera@student.ateneo.edu">
            niles.tristan.cabrera@student.ateneo.edu
          </a>
          . You also have the right to lodge a complaint with the National Privacy
          Commission (NPC) of the Philippines.
        </p>
      </section>
    </LegalLayout>
  );
}
```

- [ ] **Step 2: Typecheck + lint + reachability**

Run: `npx tsc --noEmit && npx eslint "app/privacy/page.tsx"`
Expected: no errors. Confirm the file is at `app/privacy/page.tsx` (NOT under `app/(protected)/`).

- [ ] **Step 3: Commit**

```bash
git add "app/privacy/page.tsx"
git commit -m "feat(legal): Data Privacy Policy page"
```

---

### Task 4: Consent + link wiring (modal, footer, login)

**Files:**
- Modify: `components/disclaimer-modal.tsx`
- Modify: `components/app-footer.tsx`
- Modify: `app/auth/login/page.tsx`

**Interfaces:**
- Consumes: the `/terms` and `/privacy` routes (Tasks 2-3).

- [ ] **Step 1: Upgrade the acknowledgment modal**

In `components/disclaimer-modal.tsx`:
- Add `import Link from "next/link";` at the top.
- Bump the storage key: change `const STORAGE_KEY = "disclaimer_accepted_v1";` → `const STORAGE_KEY = "disclaimer_accepted_v2";`.
- Add an agreement paragraph as the last item inside the `<div className="text-sm ...">` block (after the existing two `<p>`s):

```tsx
          <p>
            By continuing, you agree to our{" "}
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#3761B0] hover:underline"
            >
              Terms of Use
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#3761B0] hover:underline"
            >
              Data Privacy Policy
            </Link>
            .
          </p>
```

- Change the button label from `I understand, continue` to `I agree and continue`.

(The `localStorage` write stays only inside `handleAccept`, so opening the links in a new tab never dismisses or accepts the gate.)

- [ ] **Step 2: Add legal links to the footer**

In `components/app-footer.tsx`, add `import Link from "next/link";` and, inside the left column (after the disclaimer `<p>`), a legal-links row:

```tsx
          <div className="flex gap-4 text-xs text-white/70">
            <Link href="/terms" className="hover:text-[#3761B0] transition-colors">
              Terms of Use
            </Link>
            <Link href="/privacy" className="hover:text-[#3761B0] transition-colors">
              Privacy Policy
            </Link>
          </div>
```

- [ ] **Step 3: Add legal links to the login page**

In `app/auth/login/page.tsx`, add `import Link from "next/link";` and, below the existing disclaimer `<p>` (the "independent student project…" paragraph), a small links row:

```tsx
      <div className="flex gap-4 text-xs text-[#3761B0]">
        <Link href="/terms" className="hover:underline">
          Terms of Use
        </Link>
        <Link href="/privacy" className="hover:underline">
          Privacy Policy
        </Link>
      </div>
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint components/disclaimer-modal.tsx components/app-footer.tsx "app/auth/login/page.tsx"`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/disclaimer-modal.tsx components/app-footer.tsx "app/auth/login/page.tsx"
git commit -m "feat(legal): consent agreement in modal + Terms/Privacy links (footer, login)"
```

---

### Task 5: Verification

**Files:** none (verification only).

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: succeeds; the route list includes `/terms` and `/privacy` as static (`○`) routes NOT under the protected group.

- [ ] **Step 2: Lint the touched files**

Run:
```bash
npx eslint components/legal-layout.tsx "app/terms/page.tsx" "app/privacy/page.tsx" components/disclaimer-modal.tsx components/app-footer.tsx "app/auth/login/page.tsx"
```
Expected: 0 errors.

- [ ] **Step 3: Manual QA**

- [ ] While **logged out**, the login page shows "Terms of Use" + "Privacy Policy" links that open `/terms` and `/privacy` (both render fully, no auth redirect).
- [ ] While **logged in**, the footer links reach both pages; the "← Back to MakeAbot" link returns to the app.
- [ ] The acknowledgment modal re-appears once for an existing user (v2 key), shows the "By continuing, you agree to…" line; clicking Terms/Privacy opens them in a new tab **without** dismissing the modal; "I agree and continue" persists and doesn't reappear on reload.
- [ ] Both pages read correctly and are responsive at mobile + widescreen.

---

## Notes / dependencies
- No migration, no new deps. Content is a student-project draft — flag for legal review before public launch (with the domain-gate launch blocker).
- The Privacy Policy's stated practices (contextual disclosure, no selling, named processors) match the implemented behavior — keep them in sync if data practices change.
