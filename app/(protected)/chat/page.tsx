"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, StarFill } from "react-bootstrap-icons";
import Navbar from "@/components/ui/navbar";
import { ChatRoom } from "@/components/chat-room";
import { useAuth } from "@/contexts/auth-context";
import { PageShellSkeleton } from "@/components/ui/page-shell-skeleton";
import { getDealStatus, closeRequest, completeOfferBid } from "@/lib/actions/deals";
import { getPublicUsers } from "@/lib/actions/users";
import { getReviews } from "@/lib/actions/reviews";
import ReportModal, { type ReportTarget } from "@/components/report-modal";

function ChatPageInner() {
  const router = useRouter();
  const params = useSearchParams();

  const bidId = params.get("bidId") ?? "";
  const kind = (params.get("kind") ?? "offer") as "offer" | "request";
  const title = params.get("title") ?? "";
  const otherId = params.get("otherId") ?? "";

  const { userData } = useAuth();
  const currentUser = userData.publicUser;

  const [otherName, setOtherName] = useState("");
  const [otherAvatarUrl, setOtherAvatarUrl] = useState<string | null>(null);
  const [otherRating, setOtherRating] = useState<number | null>(null);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [parentId, setParentId] = useState("");
  const [isDone, setIsDone] = useState(false);
  // Server-decided: getDealStatus.canReview. Never derived here.
  const [canReview, setCanReview] = useState(false);
  const [offerStillActive, setOfferStillActive] = useState(false);
  const [justMarkedDone, setJustMarkedDone] = useState(false);
  const [isMarkingDone, setIsMarkingDone] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  // Route guard
  useEffect(() => {
    if (!bidId || !otherId) {
      router.replace("/tracker");
    }
  }, [bidId, otherId, router]);

  useEffect(() => {
    if (!bidId || !otherId) return;

    Promise.all([
      getDealStatus(bidId, kind),
      getReviews({ rated_user_id: otherId }),
      getPublicUsers([otherId]),
    ]).then(([statusResult, reviewsResult, usersResult]) => {
      if (statusResult.data) {
        setOwnerUserId(statusResult.data.ownerUserId);
        setParentId(statusResult.data.parentId);
        // A deal is "done" for THIS chat when its bid is Completed or Closed
        // (offers — Closed covers dismissed inquiries and the read-only state
        // left behind on siblings once the offer itself closes) or the parent
        // request is not Active (requests).
        const done =
          kind === "offer"
            ? statusResult.data.bidStatus !== "Pending" ||
              statusResult.data.parentStatus !== "Active"
            : statusResult.data.parentStatus !== "Active";
        if (done) setIsDone(true);
        setCanReview(statusResult.data.canReview);
        // A dismissed inquiry leaves the offer itself Active, so the banner
        // must not claim the offer is closed when it is still in the feed.
        setOfferStillActive(statusResult.data.parentStatus === "Active");
      }
      const reviews = reviewsResult.data ?? [];
      if (reviews.length > 0) {
        const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
        setOtherRating(Math.round(avg * 10) / 10);
      }
      const user = usersResult.data?.[0];
      if (user) {
        setOtherName(user.name ?? "");
        setOtherAvatarUrl(user.avatar_url ?? null);
      }
    });
  }, [bidId, otherId, kind]);

  const isOwner = ownerUserId === currentUser?.id;

  const bannerText = isDone
    ? justMarkedDone
      ? "This deal has been marked done."
      : kind === "request"
        ? canReview
          ? "This request was closed. You can leave a review."
          : "This request was closed."
        : canReview
          ? "This transaction is complete. You can leave a review."
          : offerStillActive
            ? "The owner closed this inquiry."
            : "This offer is closed."
    : null;

  const handleMarkDone = async () => {
    if (isMarkingDone) return;
    const prompt =
      kind === "offer"
        ? "Close this transaction?"
        : "Close this request? All open inquiries will be closed, and everyone you've spoken with can leave a review.";
    if (!window.confirm(prompt)) return;

    setIsMarkingDone(true);
    try {
      const result =
        kind === "offer"
          ? await completeOfferBid(bidId)
          : await closeRequest(parentId);

      if (result.error) {
        alert(result.error);
        return;
      }
      setIsDone(true);
      setJustMarkedDone(true);
      const refreshed = await getDealStatus(bidId, kind);
      if (refreshed.data) {
        setCanReview(refreshed.data.canReview);
      }
    } finally {
      setIsMarkingDone(false);
    }
  };

  if (!bidId || !otherId) return null;

  return (
    <div className="h-dvh bg-white flex flex-col overflow-hidden">
      <Navbar />

      {/* Header */}
      <header className="h-14 border-b border-gray-200 bg-white shrink-0">
        {/* The shell behaviour (h-14, shrink-0, the full-bleed bottom rule)
            stays on <header>; only the content is capped, so the header,
            banner and message column share one set of edges. */}
        <div className="h-full w-full max-w-4xl mx-auto flex items-center px-4 gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full border border-[#3761B0] text-[#3761B0] flex items-center justify-center shrink-0"
            aria-label="Back"
          >
            <ChevronLeft size={20} />
          </button>

          <Link
            href={`/profile/${otherId}`}
            className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-90"
          >
            <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden shrink-0">
              {otherAvatarUrl ? (
                <Image src={otherAvatarUrl} alt={otherName || "User"} width={36} height={36} className="object-cover w-full h-full" />
              ) : (
                <span className="flex items-center justify-center w-full h-full text-sm font-medium text-gray-500 uppercase">
                  {(otherName || "U").charAt(0)}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-gray-900 leading-tight line-clamp-1 text-sm">
                  {title}{otherName ? ` | ${otherName}` : ""}
                </p>
                {otherRating != null ? (
                  <span className="flex items-center gap-0.5 text-xs font-medium text-gray-600 shrink-0">
                    {otherRating}<StarFill className="text-[#DEA440]" size={12} />
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 italic shrink-0">No reviews yet</span>
                )}
              </div>
              <p className="text-xs text-gray-500 leading-tight">
                {kind === "offer" ? "Offer" : "Request"}
              </p>
            </div>
          </Link>

          {isOwner && !isDone && (
            <button
              type="button"
              onClick={handleMarkDone}
              disabled={isMarkingDone}
              className="shrink-0 text-xs font-medium border border-gray-400 rounded px-3 py-1.5 text-gray-600 hover:border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMarkingDone
              ? "Marking…"
              : kind === "request"
                ? "Close request"
                : "Close transaction"}
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              setReportTarget({ type: "user", id: otherId, label: otherName || "user" })
            }
            className="shrink-0 text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Report
          </button>
        </div>
      </header>

      {/* Completion banner */}
      {bannerText && (
        <div className="bg-green-50 border-b border-green-200 shrink-0">
          <div className="w-full max-w-4xl mx-auto px-4 py-2 text-sm text-green-700 font-medium text-center">
            {bannerText}
          </div>
        </div>
      )}

      {/* Chat — the flex child keeps `flex-1 min-h-0` so it still bounds the
          message list's scroll region; the width cap lives on the inner
          wrapper, matching the header and banner. */}
      <div className="flex-1 min-h-0">
        <div className="h-full w-full max-w-4xl mx-auto">
          <ChatRoom
            other_user_id={otherId}
            offer_bid_id={kind === "offer" ? bidId : null}
            request_bid_id={kind === "request" ? bidId : null}
            disabled={isDone}
            otherName={otherName}
            otherAvatarUrl={otherAvatarUrl ?? undefined}
            dealDone={isDone}
            canReview={canReview}
          />
        </div>
      </div>
      <ReportModal
        open={reportTarget !== null}
        onClose={() => setReportTarget(null)}
        target={reportTarget}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<PageShellSkeleton />}>
      <ChatPageInner />
    </Suspense>
  );
}
