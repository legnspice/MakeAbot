import * as requestsRepo from "../repo/requests.repo";
import { sendPushToAllUsers } from "./push.service";
import { tierAfterPosterCooldown } from "./broadcast.service";
import { requestBroadcastTier } from "../broadcast-policy";
import { runAfterResponse } from "../after-response";
import { AppError } from "@/lib/error/app-error";
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
  const request = await requestsRepo.insertRequest(data);
  if (request && data.user_id) {
    const userId = data.user_id;
    // Deferred to after the response — must not block or fail request creation.
    runAfterResponse(async () => {
      const tier = await tierAfterPosterCooldown(
        requestBroadcastTier(request.urgency),
        userId,
        { requestId: request.id },
      );
      await sendPushToAllUsers(userId, "new_request", tier, {
        title: "New request posted",
        body: data.title,
        url: `/`,
      });
    });
  }
  return request;
}

export async function createRequestBid(data: InsertRequestBidSchema) {
  // Look up the parent once, up front, before the insert. This is the
  // terminal-state guard: a genuine "not found" fails open (matches prior
  // behavior — nothing to block against), but a thrown read fails CLOSED —
  // we cannot positively confirm the request is still Active, so we must not
  // let the bid through. This is a distinct fetch from the best-effort
  // staleness touch below, which stays swallowed no matter what.
  let req: Awaited<ReturnType<typeof requestsRepo.findRequestById>> | undefined;
  try {
    req = await requestsRepo.findRequestById(data.request_id);
  } catch {
    throw new AppError("Could not verify this request is still open", 503);
  }

  if (req && req.status !== "Active") {
    throw new AppError("This request is no longer accepting bids", 409);
  }

  const bid = await requestsRepo.insertRequestBid(data);

  // A new bid is activity: reset the parent's staleness clock so
  // expireStaleRequestBids does not close live bids on a busy old request.
  // Best-effort — a failed touch must never fail the bid.
  try {
    if (req?.user_id)
      await requestsRepo.updateRequest(
        data.request_id,
        { updated_at: new Date() },
        req.user_id,
      );
  } catch {
    // Staleness bookkeeping only.
  }

  return bid;
}

export async function closeRequest(requestId: string, callerId: string) {
  const req = await requestsRepo.findRequestById(requestId);
  if (!req) throw new AppError("Request not found", 404);
  if (req.user_id !== callerId)
    throw new AppError("Only the requester can close this", 403);
  if (req.status !== "Active")
    throw new AppError("This request is already closed", 409);

  const { completed, finalStatus } = await requestsRepo.closeRequestAtomic(
    requestId,
    callerId,
  );

  // finalStatus is only null when the atomic close's Active/owner predicate
  // matched nothing at write time — the pre-check above read Active, but a
  // concurrent close can have already resolved the request in between. That
  // is a losing racer, not a fresh close: surface the same 409 a stale
  // pre-check would have, instead of reporting success with a fabricated
  // Cancelled status.
  if (finalStatus === null)
    throw new AppError("This request is already closed", 409);

  return { completed, request: req, finalStatus };
}

export async function expireStaleRequestBids() {
  return await requestsRepo.expireStaleRequestBids();
}

export async function removeRequest(id: string, userId: string) {
  return await requestsRepo.deleteRequest(id, userId);
}

export async function removeRequestBid(id: string, userId: string) {
  return await requestsRepo.deleteRequestBid(id, userId);
}

export async function withdrawRequestBid(bidId: string, bidderId: string) {
  const withdrawn = await requestsRepo.withdrawRequestBidForBidder(
    bidId,
    bidderId,
  );
  if (!withdrawn)
    throw new AppError("This inquiry can no longer be withdrawn", 409);
}

export async function reopenRequestBid(bidId: string, bidderId: string) {
  const bid = await requestsRepo.findRequestBidById(bidId);
  if (bid) {
    const req = await requestsRepo.findRequestById(bid.request_id);
    if (!req) throw new AppError("Request not found", 404);
    if (req.status !== "Active") {
      throw new AppError("This listing is no longer open", 409);
    }
    if (bid.status === "Completed")
      throw new AppError("A completed deal cannot be reopened", 409);
  }
  return await requestsRepo.updateRequestBidStatusForBidder(
    bidId,
    bidderId,
    "Pending",
  );
}

export async function editRequest(
  id: string,
  data: UpdateRequestSchema,
  userId: string,
) {
  const req = await requestsRepo.findRequestById(id);
  if (!req) throw new AppError("Request not found", 404);
  if (req.status !== "Active") {
    throw new AppError(
      "This request is closed and can no longer be edited",
      409,
    );
  }
  return await requestsRepo.updateRequest(id, data, userId);
}
