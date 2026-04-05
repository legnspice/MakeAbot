# Security Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 8 security issues identified in code review — middleware dead code, IDOR on all mutating actions, broken getClaims API, env var mismatch, OTP confirm null edge case, duplicated requireAuth, and dead proxy.ts.

**Architecture:** Middleware wiring via root `middleware.ts` → `lib/supabase/proxy.ts`. Shared `requireAuth` extracted to `lib/actions/auth.ts`. IDOR fixed at two levels: create actions force-set identity fields from auth user; delete/update repos add owner condition to WHERE clause, propagated through services → actions.

**Tech Stack:** Next.js 15 App Router, Supabase SSR (`@supabase/ssr`), Drizzle ORM, TypeScript.

---

### Task 1: Wire middleware — fix getClaims, env var, create root middleware.ts, delete dead file

**Files:**
- Modify: `lib/supabase/proxy.ts`
- Delete: `lib/middleware.ts`
- Create: `middleware.ts` (project root)

The plan:
- Restore guard logic to `proxy.ts` using `getUser()` (not `getClaims()`) with the correct env var `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Delete `lib/middleware.ts` (dead duplicate)
- Create root `middleware.ts` that calls `proxy.ts`'s `updateSession` with a proper matcher

- [ ] **Step 1: Restore guard logic in `lib/supabase/proxy.ts`**

Replace the entire file with:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session — IMPORTANT: do not remove, keeps session alive
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPath = request.nextUrl.pathname.startsWith("/auth");

  if (!user && !isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 2: Delete `lib/middleware.ts`**

```bash
git rm lib/middleware.ts
```

- [ ] **Step 3: Create root `middleware.ts`**

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to middleware files.

- [ ] **Step 5: Commit**

```bash
git add middleware.ts lib/supabase/proxy.ts
git commit -m "fix: wire middleware — restore route guard in proxy.ts, create root middleware.ts"
```

---

### Task 2: Extract shared requireAuth utility

**Files:**
- Create: `lib/actions/auth.ts`
- Modify: `lib/actions/messages.ts`, `lib/actions/posts.ts`, `lib/actions/requests.ts`, `lib/actions/reviews.ts`, `lib/actions/users.ts`

- [ ] **Step 1: Create `lib/actions/auth.ts`**

```ts
import { createClient } from "@/lib/supabase/server";

export async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user;
}
```

- [ ] **Step 2: Update `lib/actions/posts.ts`**

Remove the local `requireAuth` function and add the import:

```ts
"use server";

import * as postsService from "@/lib/services/posts.service";
import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
import {
  FindPostsSchema,
  FindPostBidsSchema,
  InsertPostBidSchema,
  InsertPostSchema,
  UpdatePostSchema,
} from "@/lib/validation/posts";

export async function getPosts(filters: FindPostsSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return postsService.getPosts(filters);
  });
}

export async function getPostBids(filters: FindPostBidsSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return postsService.getPostBids(filters);
  });
}

export async function createPost(data: InsertPostSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return postsService.createPost({ ...data, user_id: user.id });
  });
}

export async function createPostBid(data: InsertPostBidSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return postsService.createPostBid({ ...data, bidder_id: user.id });
  });
}

export async function removePost(id: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return postsService.removePost(id, user.id);
  });
}

export async function removePostBid(id: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return postsService.removePostBid(id, user.id);
  });
}

export async function editPost(id: string, data: UpdatePostSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return postsService.editPost(id, data, user.id);
  });
}
```

- [ ] **Step 3: Update `lib/actions/requests.ts`**

```ts
"use server";

import * as requestsService from "@/lib/services/requests.service";
import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
import {
  FindRequestsSchema,
  FindRequestBidsSchema,
  InsertRequestBidSchema,
  InsertRequestSchema,
  UpdateRequestSchema,
} from "@/lib/validation/requests";

export async function getRequests(filters: FindRequestsSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return requestsService.getRequests(filters);
  });
}

export async function getRequestBids(filters: FindRequestBidsSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return requestsService.getRequestBids(filters);
  });
}

export async function createRequest(data: InsertRequestSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return requestsService.createRequest({ ...data, user_id: user.id });
  });
}

export async function createRequestBid(data: InsertRequestBidSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return requestsService.createRequestBid({ ...data, bidder_id: user.id });
  });
}

export async function removeRequest(id: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return requestsService.removeRequest(id, user.id);
  });
}

export async function removeRequestBid(id: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return requestsService.removeRequestBid(id, user.id);
  });
}

export async function editRequest(id: string, data: UpdateRequestSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return requestsService.editRequest(id, data, user.id);
  });
}
```

- [ ] **Step 4: Update `lib/actions/messages.ts`**

```ts
"use server";

import * as messagesService from "@/lib/services/messages.service";
import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
import {
  FindConversationSchema,
  FindMessagesSchema,
  InsertMessageSchema,
} from "@/lib/validation/messages";

export async function getMessages(filters: FindMessagesSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return messagesService.getMessages(filters);
  });
}

export async function getConversation(filters: FindConversationSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return messagesService.getConversation(filters);
  });
}

export async function createMessage(data: InsertMessageSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return messagesService.createMessage({ ...data, sender_id: user.id });
  });
}

export async function removeMessage(id: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return messagesService.removeMessage(id, user.id);
  });
}
```

- [ ] **Step 5: Update `lib/actions/reviews.ts`**

```ts
"use server";

import * as reviewsService from "@/lib/services/reviews.service";
import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
import {
  FindReviewsSchema,
  InsertReviewSchema,
} from "@/lib/validation/reviews";

export async function getReviews(filters: FindReviewsSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return reviewsService.getReviews(filters);
  });
}

export async function createReview(data: InsertReviewSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return reviewsService.createReview({ ...data, creator_id: user.id });
  });
}

export async function removeReview(id: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return reviewsService.removeReview(id, user.id);
  });
}
```

- [ ] **Step 6: Update `lib/actions/users.ts`**

```ts
"use server";

import * as usersService from "@/lib/services/users.service";
import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { FindUserSchema, UpdateUserSchema } from "@/lib/validation/users";
import { AppError } from "@/lib/error/app-error";

export async function getUsers(filters: FindUserSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return usersService.getUsers(filters);
  });
}

export async function editUser(id: string, data: UpdateUserSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    if (user.id !== id) throw new AppError("Forbidden", 403);
    return usersService.editUser(id, data);
  });
}

export async function getSupabaseUser() {
  const supabase = await createClient();
  return await supabase.auth.getUser();
}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add lib/actions/auth.ts lib/actions/messages.ts lib/actions/posts.ts lib/actions/requests.ts lib/actions/reviews.ts lib/actions/users.ts
git commit -m "fix: extract shared requireAuth, enforce identity fields on create actions, guard editUser with ownership check"
```

---

### Task 3: IDOR — add owner condition to delete/update repos

**Files:**
- Modify: `lib/repo/posts.repo.ts`
- Modify: `lib/repo/requests.repo.ts`
- Modify: `lib/repo/reviews.repo.ts`
- Modify: `lib/repo/messages.repo.ts`
- Modify: `lib/services/posts.service.ts`
- Modify: `lib/services/requests.service.ts`
- Modify: `lib/services/reviews.service.ts`
- Modify: `lib/services/messages.service.ts`

The approach: pass `userId` as second argument to all delete/update repo functions. The repo adds it as an AND condition in the WHERE clause. The service passes it through from whatever the action provides.

- [ ] **Step 1: Update `lib/repo/posts.repo.ts`**

Replace `deletePost`, `deletePostBid`, and `updatePost`:

```ts
export async function deletePost(id: string, userId: string) {
  return await db.delete(posts).where(and(eq(posts.id, id), eq(posts.user_id, userId)));
}

export async function deletePostBid(id: string, userId: string) {
  return await db.delete(post_bids).where(and(eq(post_bids.id, id), eq(post_bids.bidder_id, userId)));
}

export async function updatePost(id: string, data: UpdatePostSchema, userId: string) {
  const updatePayload: Partial<typeof posts.$inferInsert> = { ...data };
  return await db.update(posts).set(updatePayload).where(and(eq(posts.id, id), eq(posts.user_id, userId)));
}
```

Note: remove the `status === "Closed"` imgUrl logic from the repo — that belongs in the service (see Task 4).

- [ ] **Step 2: Update `lib/repo/requests.repo.ts`**

Replace `deleteRequest`, `deleteRequestBid`, and `updateRequest`:

```ts
export async function deleteRequest(id: string, userId: string) {
  return await db.delete(requests).where(and(eq(requests.id, id), eq(requests.user_id, userId)));
}

export async function deleteRequestBid(id: string, userId: string) {
  return await db.delete(request_bids).where(and(eq(request_bids.id, id), eq(request_bids.bidder_id, userId)));
}

export async function updateRequest(id: string, data: UpdateRequestSchema, userId: string) {
  return await db.update(requests).set(data).where(and(eq(requests.id, id), eq(requests.user_id, userId)));
}
```

- [ ] **Step 3: Update `lib/repo/reviews.repo.ts`**

Replace `deleteReview`:

```ts
export async function deleteReview(id: string, userId: string) {
  return await db.delete(reviews).where(and(eq(reviews.id, id), eq(reviews.creator_id, userId)));
}
```

- [ ] **Step 4: Update `lib/repo/messages.repo.ts`**

Replace `deleteMessage`:

```ts
export async function deleteMessage(id: string, userId: string) {
  return await db.delete(messages).where(and(eq(messages.id, id), eq(messages.sender_id, userId)));
}
```

- [ ] **Step 5: Update `lib/services/posts.service.ts`**

Move the `status === "Closed"` imgUrl logic here and thread userId through:

```ts
import * as postsRepo from "../repo/posts.repo";
import { posts } from "../db/schema";
import {
  FindPostsSchema,
  FindPostBidsSchema,
  InsertPostBidSchema,
  InsertPostSchema,
  UpdatePostSchema,
} from "../validation/posts";

export async function getPosts(filters: FindPostsSchema) {
  return await postsRepo.findPosts(filters);
}

export async function getPostBids(filters: FindPostBidsSchema) {
  return await postsRepo.findPostBids(filters);
}

export async function createPost(data: InsertPostSchema) {
  return await postsRepo.insertPost(data);
}

export async function createPostBid(data: InsertPostBidSchema) {
  return await postsRepo.insertPostBid(data);
}

export async function removePost(id: string, userId: string) {
  return await postsRepo.deletePost(id, userId);
}

export async function removePostBid(id: string, userId: string) {
  return await postsRepo.deletePostBid(id, userId);
}

export async function editPost(id: string, data: UpdatePostSchema, userId: string) {
  const updatePayload: Partial<typeof posts.$inferInsert> = { ...data };
  if (data.status === "Closed") {
    updatePayload.imgUrl = null;
  }
  return await postsRepo.updatePost(id, updatePayload, userId);
}
```

- [ ] **Step 6: Update `lib/services/requests.service.ts`**

```ts
import * as requestsRepo from "../repo/requests.repo";
import {
  FindRequestsSchema,
  FindRequestBidsSchema,
  InsertRequestBidSchema,
  InsertRequestSchema,
  UpdateRequestSchema,
} from "@/lib/validation/requests";

export async function getRequests(filters: FindRequestsSchema) {
  return await requestsRepo.findRequests(filters);
}

export async function getRequestBids(filters: FindRequestBidsSchema) {
  return await requestsRepo.findRequestBids(filters);
}

export async function createRequest(data: InsertRequestSchema) {
  return await requestsRepo.insertRequest(data);
}

export async function createRequestBid(data: InsertRequestBidSchema) {
  return await requestsRepo.insertRequestBid(data);
}

export async function removeRequest(id: string, userId: string) {
  return await requestsRepo.deleteRequest(id, userId);
}

export async function removeRequestBid(id: string, userId: string) {
  return await requestsRepo.deleteRequestBid(id, userId);
}

export async function editRequest(id: string, data: UpdateRequestSchema, userId: string) {
  return await requestsRepo.updateRequest(id, data, userId);
}
```

- [ ] **Step 7: Update `lib/services/reviews.service.ts`**

```ts
import * as reviewsRepo from "../repo/reviews.repo";
import { FindReviewsSchema, InsertReviewSchema } from "../validation/reviews";

export async function getReviews(filters: FindReviewsSchema) {
  return await reviewsRepo.findReviews(filters);
}

export async function createReview(data: InsertReviewSchema) {
  return await reviewsRepo.insertReview(data);
}

export async function removeReview(id: string, userId: string) {
  return await reviewsRepo.deleteReview(id, userId);
}
```

- [ ] **Step 8: Update `lib/services/messages.service.ts`**

```ts
import * as messagesRepo from "../repo/messages.repo";
import {
  FindConversationSchema,
  FindMessagesSchema,
  InsertMessageSchema,
} from "../validation/messages";

export async function getMessages(filters: FindMessagesSchema) {
  return await messagesRepo.findMessages(filters);
}

export async function getConversation(filters: FindConversationSchema) {
  return await messagesRepo.findConversation(filters);
}

export async function createMessage(data: InsertMessageSchema) {
  return await messagesRepo.insertMessage(data);
}

export async function removeMessage(id: string, userId: string) {
  return await messagesRepo.deleteMessage(id, userId);
}
```

- [ ] **Step 9: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add lib/repo/posts.repo.ts lib/repo/requests.repo.ts lib/repo/reviews.repo.ts lib/repo/messages.repo.ts lib/services/posts.service.ts lib/services/requests.service.ts lib/services/reviews.service.ts lib/services/messages.service.ts
git commit -m "fix: add owner condition to all delete/update repo operations to prevent IDOR"
```

---

### Task 4: Fix OTP confirm null user edge case

**Files:**
- Modify: `app/auth/confirm/route.ts`

After `verifyOtp` succeeds, `getUser()` could theoretically return null. The current code sets `email = ""` in that case, which fails the domain check and hits the cleanup path — but `user?.id` would be undefined so `deleteUser` is skipped. The session is still active and points to an anonymous user. Fix: explicitly check for null user before the domain validation and sign out + redirect to error.

- [ ] **Step 1: Update `app/auth/confirm/route.ts`**

```ts
import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = "/";
  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        await supabase.auth.signOut();
        redirectTo.pathname = "/error";
        return NextResponse.redirect(redirectTo);
      }

      const email = user.email?.toLowerCase() ?? "";
      const acceptedDomain = "@student.ateneo.edu";

      if (!email.endsWith(acceptedDomain)) {
        try {
          const supabaseAdmin = await createAdminClient();
          await supabaseAdmin.auth.admin.deleteUser(user.id);
          await supabase.auth.signOut();
        } catch (adminError) {
          console.error("Cleanup failed for unauthorized user:", adminError);
        }
        return NextResponse.redirect(
          `${baseUrl}/auth/login/non-ateneo-email-used`,
        );
      }

      redirectTo.searchParams.delete("next");
      return NextResponse.redirect(redirectTo);
    }
  }

  redirectTo.pathname = "/error";
  return NextResponse.redirect(redirectTo);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/auth/confirm/route.ts
git commit -m "fix: handle null user after OTP verify in confirm route"
```
