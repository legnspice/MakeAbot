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
import { getDealStatus, completeRequest, completeOfferBid } from "@/lib/actions/deals";
import { getUsers } from "@/lib/actions/users";
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
  const [justMarkedDone, setJustMarkedDone] = useState(false);
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
      getUsers({ id: otherId }),
    ]).then(([statusResult, reviewsResult, usersResult]) => {
      if (statusResult.data) {
        setOwnerUserId(statusResult.data.ownerUserId);
        setParentId(statusResult.data.parentId);
        const s = statusResult.data.parentStatus;
        if (s === "Completed" || s === "Closed") setIsDone(true);
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
        ? "This request has been fulfilled."
        : "This offer is closed."
    : null;

  const handleMarkDone = async () => {
    if (!window.confirm("Mark this deal as done?")) return;
    let error: string | null = null;
    if (kind === "offer") {
      const result = await completeOfferBid(bidId);
      error = result.error ?? null;
    } else {
      const result = await completeRequest(parentId, bidId);
      error = result.error ?? null;
    }
    if (error) { alert("Failed. Please try again."); return; }
    setIsDone(true);
    setJustMarkedDone(true);
  };

  if (!bidId || !otherId) return null;

  return (
    <div className="h-dvh bg-white flex flex-col overflow-hidden">
      <Navbar />

      {/* Header */}
      <header className="h-14 border-b border-gray-200 bg-white flex items-center px-4 gap-3 shrink-0">
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
            className="shrink-0 text-xs font-medium border border-gray-400 rounded px-3 py-1.5 text-gray-600 hover:border-gray-600 transition-colors"
          >
            Mark done
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
      </header>

      {/* Completion banner */}
      {bannerText && (
        <div className="bg-green-50 border-b border-green-200 px-4 py-2 text-sm text-green-700 font-medium text-center shrink-0">
          {bannerText}
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 min-h-0">
        <ChatRoom
          other_user_id={otherId}
          offer_bid_id={kind === "offer" ? bidId : null}
          request_bid_id={kind === "request" ? bidId : null}
          disabled={isDone}
        />
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
