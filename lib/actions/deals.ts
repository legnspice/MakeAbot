"use server";

import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
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
    await requireAuth();

    if (kind === "request") {
      const bids = await requestsService.getRequestBids({ id: bidId });
      const bid = bids[0];
      if (!bid) throw new Error("Request bid not found");

      await requestsService.acceptRequestBid(bidId, bid.bidder_id);

      // Look up the request owner to pass to editRequest
      const reqs = await requestsService.getRequests({ id: bid.request_id });
      const req = reqs[0];
      if (req?.user_id) {
        await requestsService.editRequest(bid.request_id, { status: "Ongoing" }, req.user_id);
      }
      return { success: true };
    }

    // offer — the post owner is the offerer
    const bids = await postsService.getPostBids({ id: bidId });
    const bid = bids[0];
    if (!bid) throw new Error("Post bid not found");

    const posts = await postsService.getPosts({ id: bid.post_id });
    const post = posts[0];
    if (!post?.user_id) throw new Error("Post not found");

    await postsService.editPost(bid.post_id, { status: "Busy" }, post.user_id);
    return { success: true };
  });
}

export async function finishDeal(bidId: string, kind: DealKind) {
  return await handleAction(async () => {
    await requireAuth();

    if (kind === "request") {
      const bids = await requestsService.getRequestBids({ id: bidId });
      const bid = bids[0];
      if (!bid) throw new Error("Request bid not found");

      await requestsService.rejectRequestBid(bidId, bid.bidder_id);

      // Look up the request owner to pass to editRequest
      const reqs = await requestsService.getRequests({ id: bid.request_id });
      const req = reqs[0];
      if (req?.user_id) {
        await requestsService.editRequest(
          bid.request_id,
          { status: "Completed", completed_at: new Date() },
          req.user_id,
        );
      }
      return { success: true };
    }

    // offer — the post owner is the offerer
    const bids = await postsService.getPostBids({ id: bidId });
    const bid = bids[0];
    if (!bid) throw new Error("Post bid not found");

    const posts = await postsService.getPosts({ id: bid.post_id });
    const post = posts[0];
    if (!post?.user_id) throw new Error("Post not found");

    await postsService.editPost(bid.post_id, { status: "Closed" }, post.user_id);
    return { success: true };
  });
}
