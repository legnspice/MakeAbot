"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { StarFill, Star } from "react-bootstrap-icons";
import type { SelectReview } from "@/lib/db/schema";
import { getUsers } from "@/lib/actions/users";
import { timeAgo } from "@/lib/date";

type Reviewer = { name: string | null; avatar_url: string | null };

function Avatar({ name, url }: { name: string | null; url: string | null }) {
  return (
    <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0 flex items-center justify-center text-xs font-medium text-gray-500 uppercase">
      {url ? (
        <Image src={url} alt={name ?? "User"} width={32} height={32} className="object-cover w-full h-full" />
      ) : (
        (name ?? "U").charAt(0)
      )}
    </div>
  );
}

export default function ReviewsList({ reviews }: { reviews: SelectReview[] }) {
  const [reviewers, setReviewers] = useState<Record<string, Reviewer>>({});

  useEffect(() => {
    const ids = Array.from(new Set(reviews.map((r) => r.creator_id)));
    if (ids.length === 0) return;
    let cancelled = false;
    getUsers({ ids }).then((res) => {
      if (cancelled) return;
      const map: Record<string, Reviewer> = {};
      for (const u of res.data ?? [])
        map[u.id] = { name: u.name, avatar_url: u.avatar_url };
      setReviewers(map);
    });
    return () => {
      cancelled = true;
    };
  }, [reviews]);

  if (reviews.length === 0) {
    return <p className="text-sm text-gray-400 italic">No reviews yet.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-gray-100">
      {reviews.map((r) => {
        const who = reviewers[r.creator_id];
        return (
          <li key={r.id} className="flex gap-3 py-3">
            <Avatar name={who?.name ?? null} url={who?.avatar_url ?? null} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900 truncate">
                  {who?.name ?? "User"}
                </span>
                <span className="flex items-center gap-0.5 shrink-0">
                  {[1, 2, 3, 4, 5].map((n) =>
                    n <= r.rating ? (
                      <StarFill key={n} className="text-[#DEA440]" size={12} />
                    ) : (
                      <Star key={n} className="text-gray-200" size={12} />
                    ),
                  )}
                </span>
                <span className="ml-auto text-xs text-gray-400 shrink-0">
                  {timeAgo(r.created_at)}
                </span>
              </div>
              {r.comment && (
                <p className="mt-0.5 text-sm text-gray-600 whitespace-pre-wrap break-words">
                  {r.comment}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
