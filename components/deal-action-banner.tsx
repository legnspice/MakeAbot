"use client";

import { useCallback, useEffect, useState } from "react";
import { getDealStatus, acceptDeal, finishDeal } from "@/lib/actions/deals";

interface DealActionBannerProps {
  bidId: string;
  kind: "offer" | "request";
  currentUserId: string;
  onFinished?: () => void;
}

export function DealActionBanner({
  bidId,
  kind,
  currentUserId,
  onFinished,
}: DealActionBannerProps) {
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [bidStatus, setBidStatus] = useState<string | null>(null);
  const [parentStatus, setParentStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const fetchStatus = useCallback(async () => {
    const result = await getDealStatus(bidId, kind);
    if (result.data) {
      setOwnerUserId(result.data.ownerUserId);
      setBidStatus(result.data.bidStatus);
      setParentStatus(result.data.parentStatus);
    }
    setLoading(false);
  }, [bidId, kind]);

  // Reset state when switching conversations
  useEffect(() => {
    setLoading(true);
    setOwnerUserId(null);
    setBidStatus(null);
    setParentStatus(null);
    fetchStatus();
  }, [fetchStatus]);

  const handleAccept = async () => {
    setActing(true);
    await acceptDeal(bidId, kind);
    await fetchStatus();
    setActing(false);
  };

  const handleFinish = async () => {
    setActing(true);
    await finishDeal(bidId, kind);
    await fetchStatus();
    setActing(false);
    onFinished?.();
  };

  if (loading) return null;

  const isOwner = currentUserId === ownerUserId;
  const isOfferer = kind === "request" ? !isOwner : isOwner;

  const showAccept =
    isOfferer &&
    (kind === "request"
      ? bidStatus === "Pending" && parentStatus === "Active"
      : parentStatus === "Active");

  const showFinish =
    isOfferer &&
    (kind === "request" ? parentStatus === "Ongoing" : parentStatus === "Busy");

  const isCompleted =
    kind === "request"
      ? parentStatus === "Completed"
      : parentStatus === "Closed";

  if (!showAccept && !showFinish && !isCompleted) return null;

  if (isCompleted) {
    return (
      <span className="text-xs font-medium text-green-600 shrink-0">
        Completed
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={showAccept ? handleAccept : handleFinish}
      disabled={acting}
      className={`px-4 py-2 rounded-full font-semibold text-sm shrink-0 transition-colors disabled:opacity-50 ${
        showAccept
          ? "bg-[#DEA440] hover:bg-[#C48A2A] text-black"
          : "bg-green-500 hover:bg-green-600 text-white"
      }`}
    >
      {acting
        ? showAccept
          ? "Accepting…"
          : "Finishing…"
        : showAccept
          ? "Accept"
          : "Finish"}
    </button>
  );
}
