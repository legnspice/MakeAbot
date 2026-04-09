"use client";

import { useState } from "react";
import { StarFill, Star, XLg } from "react-bootstrap-icons";
import { createReview } from "@/lib/actions/reviews";

interface RatingModalProps {
  open: boolean;
  onClose: () => void;
  ratedUserId: string;
  postBidId?: string | null;
  requestBidId?: string | null;
}

export function RatingModal({
  open,
  onClose,
  ratedUserId,
  postBidId,
  requestBidId,
}: RatingModalProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    await createReview({
      rated_user_id: ratedUserId,
      creator_id: "00000000-0000-0000-0000-000000000000",
      rating,
      comment: comment.trim() || "",
      post_bid_id: postBidId ?? null,
      request_bid_id: requestBidId ?? null,
    });
    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 text-center shadow-xl">
          <p className="text-lg font-semibold text-gray-900 mb-2">
            Thanks for your review!
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 px-6 py-2 rounded-full bg-[#3761B0] text-white font-semibold text-sm hover:bg-[#2d5199] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Rate this user</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
            aria-label="Close"
          >
            <XLg size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Stars */}
        <div className="flex justify-center gap-1 mb-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              className="p-1 transition-transform hover:scale-110"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
            >
              {n <= (hover || rating) ? (
                <StarFill size={32} className="text-[#DEA440]" />
              ) : (
                <Star size={32} className="text-gray-200" />
              )}
            </button>
          ))}
        </div>

        {/* Comment */}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Leave a comment (optional)"
          rows={3}
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#3761B0] focus:border-transparent"
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          className="mt-4 w-full py-2.5 rounded-full bg-[#DEA440] text-black font-semibold text-sm hover:bg-[#C48A2A] transition-colors disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit Review"}
        </button>
      </div>
    </div>
  );
}
