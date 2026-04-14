# Security Fixes (Pass 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two live security bugs: dead middleware (no session refresh / no auth redirect at edge) and missing ownership checks in deal acceptance.

**Architecture:** Next.js middleware must be a default export from a file named `middleware.ts` at the project root. The current `proxy.ts` exports a named function and is never run by the framework. For deals, `requireAuth()` verifies identity but `acceptDeal`/`finishDeal` never verify the caller owns the deal — they look up the owner from the DB and pass that ID directly to the service, allowing any logged-in user to act as owner.

**Tech Stack:** Next.js 16 App Router, Supabase SSR (`@supabase/ssr`), Jest (tests)

---

## File Map

| Action | File |
|---|---|
| Create | `middleware.ts` (project root) |
| Delete | `proxy.ts` (project root) — dead code |
| Keep | `lib/supabase/proxy.ts` — unchanged, contains actual logic |
| Keep | `__tests__/lib/supabase/proxy.test.ts` — still valid (tests `updateSession` directly) |
| Modify | `lib/actions/deals.ts` — add ownership checks |
| Create | `__tests__/lib/actions/deals.test.ts` — new test file |

---

### Task 1: Fix middleware wiring

**Files:**
- Create: `middleware.ts`
- Delete: `proxy.ts`

- [ ] **Step 1: Write the failing test** (verify middleware module exports)

No unit test needed for this task — the proxy tests already cover `updateSession`. The observable fix is that Next.js will now run the middleware. Verify by running the existing proxy tests to confirm they still pass after the change.

Run: `npm test -- __tests__/lib/supabase/proxy.test.ts`
Expected: PASS (baseline — confirm tests are green before touching files)

- [ ] **Step 2: Create `middleware.ts` at project root**

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export default async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 3: Delete `proxy.ts` from project root**

This file was the dead middleware. `lib/supabase/proxy.ts` (the actual logic) is untouched.

- [ ] **Step 4: Verify proxy tests still pass**

Run: `npm test -- __tests__/lib/supabase/proxy.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add middleware.ts proxy.ts
git commit -m "fix: wire up Next.js middleware (rename proxy.ts → middleware.ts, fix export)"
```

---

### Task 2: Add ownership checks to deals actions

**Files:**
- Modify: `lib/actions/deals.ts:53-123`
- Create: `__tests__/lib/actions/deals.test.ts`

**The bug:** `acceptDeal` and `finishDeal` call `requireAuth()` without capturing the returned user, then fetch the owner from the DB and pass that `user_id` directly to service methods. Any authenticated user can accept or finish any deal.

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/actions/deals.test.ts`:

```ts
import { acceptDeal, finishDeal, getDealStatus } from "@/lib/actions/deals";
import * as authModule from "@/lib/actions/auth";
import * as postsService from "@/lib/services/posts.service";
import * as requestsService from "@/lib/services/requests.service";

jest.mock("@/lib/actions/auth");
jest.mock("@/lib/services/posts.service");
jest.mock("@/lib/services/requests.service");

const mockRequireAuth = authModule.requireAuth as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe("acceptDeal — offer", () => {
  it("allows the post owner to accept a bid", async () => {
    mockRequireAuth.mockResolvedValue({ id: "owner-id" });
    (postsService.getPostBids as jest.Mock).mockResolvedValue([
      { id: "bid-1", post_id: "post-1", bidder_id: "bidder-id" },
    ]);
    (postsService.getPosts as jest.Mock).mockResolvedValue([
      { id: "post-1", user_id: "owner-id", status: "Open" },
    ]);
    (postsService.editPost as jest.Mock).mockResolvedValue(undefined);

    const result = await acceptDeal("bid-1", "offer");

    expect(result.error).toBeNull();
    expect(postsService.editPost).toHaveBeenCalled();
  });

  it("rejects a non-owner trying to accept a bid", async () => {
    mockRequireAuth.mockResolvedValue({ id: "attacker-id" });
    (postsService.getPostBids as jest.Mock).mockResolvedValue([
      { id: "bid-1", post_id: "post-1", bidder_id: "bidder-id" },
    ]);
    (postsService.getPosts as jest.Mock).mockResolvedValue([
      { id: "post-1", user_id: "owner-id", status: "Open" },
    ]);

    const result = await acceptDeal("bid-1", "offer");

    expect(result.error).not.toBeNull();
    expect(postsService.editPost).not.toHaveBeenCalled();
  });
});

describe("acceptDeal — request", () => {
  it("allows the request owner to accept a bid", async () => {
    mockRequireAuth.mockResolvedValue({ id: "owner-id" });
    (requestsService.getRequestBids as jest.Mock).mockResolvedValue([
      { id: "bid-1", request_id: "req-1", bidder_id: "bidder-id" },
    ]);
    (requestsService.getRequests as jest.Mock).mockResolvedValue([
      { id: "req-1", user_id: "owner-id", status: "Open" },
    ]);
    (requestsService.acceptRequestBid as jest.Mock).mockResolvedValue(undefined);
    (requestsService.editRequest as jest.Mock).mockResolvedValue(undefined);

    const result = await acceptDeal("bid-1", "request");

    expect(result.error).toBeNull();
    expect(requestsService.acceptRequestBid).toHaveBeenCalled();
  });

  it("rejects a non-owner trying to accept a request bid", async () => {
    mockRequireAuth.mockResolvedValue({ id: "attacker-id" });
    (requestsService.getRequestBids as jest.Mock).mockResolvedValue([
      { id: "bid-1", request_id: "req-1", bidder_id: "bidder-id" },
    ]);
    (requestsService.getRequests as jest.Mock).mockResolvedValue([
      { id: "req-1", user_id: "owner-id", status: "Open" },
    ]);

    const result = await acceptDeal("bid-1", "request");

    expect(result.error).not.toBeNull();
    expect(requestsService.acceptRequestBid).not.toHaveBeenCalled();
  });
});

describe("finishDeal — offer", () => {
  it("allows the post owner to finish a deal", async () => {
    mockRequireAuth.mockResolvedValue({ id: "owner-id" });
    (postsService.getPostBids as jest.Mock).mockResolvedValue([
      { id: "bid-1", post_id: "post-1", bidder_id: "bidder-id" },
    ]);
    (postsService.getPosts as jest.Mock).mockResolvedValue([
      { id: "post-1", user_id: "owner-id", status: "Busy" },
    ]);
    (postsService.editPost as jest.Mock).mockResolvedValue(undefined);

    const result = await finishDeal("bid-1", "offer");

    expect(result.error).toBeNull();
    expect(postsService.editPost).toHaveBeenCalled();
  });

  it("rejects a non-owner trying to finish a deal", async () => {
    mockRequireAuth.mockResolvedValue({ id: "attacker-id" });
    (postsService.getPostBids as jest.Mock).mockResolvedValue([
      { id: "bid-1", post_id: "post-1", bidder_id: "bidder-id" },
    ]);
    (postsService.getPosts as jest.Mock).mockResolvedValue([
      { id: "post-1", user_id: "owner-id", status: "Busy" },
    ]);

    const result = await finishDeal("bid-1", "offer");

    expect(result.error).not.toBeNull();
    expect(postsService.editPost).not.toHaveBeenCalled();
  });
});

describe("finishDeal — request", () => {
  it("allows the request owner to finish a deal", async () => {
    mockRequireAuth.mockResolvedValue({ id: "owner-id" });
    (requestsService.getRequestBids as jest.Mock).mockResolvedValue([
      { id: "bid-1", request_id: "req-1", bidder_id: "bidder-id" },
    ]);
    (requestsService.getRequests as jest.Mock).mockResolvedValue([
      { id: "req-1", user_id: "owner-id", status: "Ongoing" },
    ]);
    (requestsService.rejectRequestBid as jest.Mock).mockResolvedValue(undefined);
    (requestsService.editRequest as jest.Mock).mockResolvedValue(undefined);

    const result = await finishDeal("bid-1", "request");

    expect(result.error).toBeNull();
    expect(requestsService.rejectRequestBid).toHaveBeenCalled();
  });

  it("rejects a non-owner trying to finish a request deal", async () => {
    mockRequireAuth.mockResolvedValue({ id: "attacker-id" });
    (requestsService.getRequestBids as jest.Mock).mockResolvedValue([
      { id: "bid-1", request_id: "req-1", bidder_id: "bidder-id" },
    ]);
    (requestsService.getRequests as jest.Mock).mockResolvedValue([
      { id: "req-1", user_id: "owner-id", status: "Ongoing" },
    ]);

    const result = await finishDeal("bid-1", "request");

    expect(result.error).not.toBeNull();
    expect(requestsService.rejectRequestBid).not.toHaveBeenCalled();
  });
});

describe("unauthenticated guard", () => {
  it("rejects unauthenticated calls to acceptDeal", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    const result = await acceptDeal("bid-1", "offer");
    expect(result.error).not.toBeNull();
  });

  it("rejects unauthenticated calls to finishDeal", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
    const result = await finishDeal("bid-1", "offer");
    expect(result.error).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm test -- __tests__/lib/actions/deals.test.ts`
Expected: FAIL — "rejects a non-owner" tests fail because ownership check doesn't exist yet

- [ ] **Step 3: Fix `lib/actions/deals.ts`**

Replace the entire file:

```ts
"use server";

import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
import { AppError } from "@/lib/error/app-error";
import * as postsService from "@/lib/services/posts.service";
import * as requestsService from "@/lib/services/requests.service";

type DealKind = "offer" | "request";

interface DealStatusResult {
  ownerUserId: string | null;
  bidStatus: string | null;
  parentStatus: string;
}

export async function getDealStatus(bidId: string, kind: DealKind) {
  return await handleAction<DealStatusResult>(async () => {
    await requireAuth();

    if (kind === "request") {
      const bids = await requestsService.getRequestBids({ id: bidId });
      const bid = bids[0];
      if (!bid) throw new Error("Request bid not found");

      const reqs = await requestsService.getRequests({ id: bid.request_id });
      const req = reqs[0];
      if (!req) throw new Error("Request not found");

      return {
        ownerUserId: req.user_id,
        bidStatus: bid.status,
        parentStatus: req.status,
      };
    }

    // offer
    const bids = await postsService.getPostBids({ id: bidId });
    const bid = bids[0];
    if (!bid) throw new Error("Post bid not found");

    const posts = await postsService.getPosts({ id: bid.post_id });
    const post = posts[0];
    if (!post) throw new Error("Post not found");

    return {
      ownerUserId: post.user_id,
      bidStatus: null,
      parentStatus: post.status,
    };
  });
}

export async function acceptDeal(bidId: string, kind: DealKind) {
  return await handleAction(async () => {
    const user = await requireAuth();

    if (kind === "request") {
      const bids = await requestsService.getRequestBids({ id: bidId });
      const bid = bids[0];
      if (!bid) throw new Error("Request bid not found");

      const reqs = await requestsService.getRequests({ id: bid.request_id });
      const req = reqs[0];
      if (!req) throw new Error("Request not found");
      if (req.user_id !== user.id) throw new AppError("Forbidden", 403);

      await requestsService.acceptRequestBid(bidId, bid.bidder_id);
      await requestsService.editRequest(bid.request_id, { status: "Ongoing" }, req.user_id);
      return { success: true };
    }

    // offer — the post owner is the offerer
    const bids = await postsService.getPostBids({ id: bidId });
    const bid = bids[0];
    if (!bid) throw new Error("Post bid not found");

    const posts = await postsService.getPosts({ id: bid.post_id });
    const post = posts[0];
    if (!post) throw new Error("Post not found");
    if (post.user_id !== user.id) throw new AppError("Forbidden", 403);

    await postsService.editPost(bid.post_id, { status: "Busy" }, post.user_id);
    return { success: true };
  });
}

export async function finishDeal(bidId: string, kind: DealKind) {
  return await handleAction(async () => {
    const user = await requireAuth();

    if (kind === "request") {
      const bids = await requestsService.getRequestBids({ id: bidId });
      const bid = bids[0];
      if (!bid) throw new Error("Request bid not found");

      const reqs = await requestsService.getRequests({ id: bid.request_id });
      const req = reqs[0];
      if (!req) throw new Error("Request not found");
      if (req.user_id !== user.id) throw new AppError("Forbidden", 403);

      await requestsService.rejectRequestBid(bidId, bid.bidder_id);
      await requestsService.editRequest(
        bid.request_id,
        { status: "Completed", completed_at: new Date() },
        req.user_id,
      );
      return { success: true };
    }

    // offer — the post owner is the offerer
    const bids = await postsService.getPostBids({ id: bidId });
    const bid = bids[0];
    if (!bid) throw new Error("Post bid not found");

    const posts = await postsService.getPosts({ id: bid.post_id });
    const post = posts[0];
    if (!post) throw new Error("Post not found");
    if (post.user_id !== user.id) throw new AppError("Forbidden", 403);

    await postsService.editPost(bid.post_id, { status: "Closed" }, post.user_id);
    return { success: true };
  });
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npm test -- __tests__/lib/actions/deals.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: PASS (all tests)

- [ ] **Step 6: Commit**

```bash
git add lib/actions/deals.ts __tests__/lib/actions/deals.test.ts
git commit -m "fix: require ownership check in acceptDeal and finishDeal"
```

---

### Task 3: Update CLAUDE.md — remove stale security warnings

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Critical security issues section**

In `CLAUDE.md`, replace the "Critical security issues (unresolved)" section with:

```markdown
## Security notes

- **`middleware.ts`** — session refresh + unauthenticated redirect at edge. Lives at project root; `lib/supabase/proxy.ts` has the actual logic.
- **Email domain restriction** (`app/auth/confirm/route.ts`) is intentionally disabled for local testing with non-Ateneo accounts. Re-enable before production.
- **N+1 query waterfalls** on data-loading pages — not a security issue, tracked separately.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md — remove resolved security warnings"
```
