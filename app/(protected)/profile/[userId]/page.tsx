"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { StarFill } from "react-bootstrap-icons";
import Navbar from "@/components/ui/navbar";
import BottomNav from "@/components/ui/bottomnavbar";
import ReviewsList from "@/components/reviews-list";
import ReportModal, { type ReportTarget } from "@/components/report-modal";
import { PageShellSkeleton } from "@/components/ui/page-shell-skeleton";
import { useAuth } from "@/contexts/auth-context";
import { getPublicProfile } from "@/lib/actions/users";
import { getReviews } from "@/lib/actions/reviews";
import { getOffers } from "@/lib/actions/offers";
import type { PublicProfile } from "@/lib/services/users.service";
import type { SelectReview, SelectOffer } from "@/lib/db/schema";

export default function PublicProfilePage() {
  const router = useRouter();
  const { userId } = useParams<{ userId: string }>();
  const { userData } = useAuth();
  const currentUser = userData.publicUser;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [reviews, setReviews] = useState<SelectReview[]>([]);
  const [offers, setOffers] = useState<SelectOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  // Own profile → redirect to the editable page.
  useEffect(() => {
    if (userId && userId === currentUser.id) router.replace("/profile");
  }, [userId, currentUser.id, router]);

  useEffect(() => {
    if (!userId || userId === currentUser.id) return;
    let cancelled = false;
    Promise.all([
      getPublicProfile(userId),
      getReviews({ rated_user_id: userId }),
      getOffers({ user_id: userId, status: "Active" }),
    ]).then(([profileRes, reviewsRes, offersRes]) => {
      if (cancelled) return;
      if (!profileRes.data) {
        setNotFound(true);
      } else {
        setProfile(profileRes.data);
        setReviews(reviewsRes.data ?? []);
        setOffers(offersRes.data ?? []);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, currentUser.id]);

  const avg =
    reviews.length > 0
      ? Math.round(
          (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10,
        ) / 10
      : 0;

  if (userId === currentUser.id) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar />
        <PageShellSkeleton />
        <BottomNav />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4">
          <p className="text-gray-400 text-sm">This user could not be found.</p>
        </main>
        <BottomNav />
      </div>
    );
  }

  const name = profile.name || "User";

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <main className="flex-1 px-4 pt-6 pb-28 w-full mx-auto max-w-md md:max-w-3xl">
        {/* Header */}
        <div className="flex items-start gap-4 md:gap-8">
          <div className="relative w-24 h-24 md:w-40 md:h-40 shrink-0 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center text-gray-500 text-2xl font-medium">
            {profile.avatar_url ? (
              <Image src={profile.avatar_url} alt={name} fill className="object-cover" />
            ) : (
              <span className="uppercase">{name.charAt(0)}</span>
            )}
          </div>

          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-4xl font-bold text-gray-900">{name}</h1>
              {reviews.length > 0 && (
                <span className="flex items-center gap-1 text-lg font-semibold text-gray-800">
                  {avg}
                  <StarFill className="text-[#DEA440]" size={18} />
                </span>
              )}
            </div>

            {/* Contextual disclosure — only present when server deems the viewer a counterparty */}
            {(profile.phone_number || !!profile.id_number) && (
              <div className="flex items-center gap-4 mt-2 text-gray-500 text-sm">
                {profile.phone_number && <span>{profile.phone_number}</span>}
                {!!profile.id_number && <span>ID: {profile.id_number}</span>}
              </div>
            )}

            {profile.description && (
              <p className="mt-3 text-sm text-gray-700 leading-relaxed">
                {profile.description}
              </p>
            )}

            <p className="mt-3 inline-block rounded-full bg-[#3761B0] text-white text-sm font-medium px-4 py-1.5">
              {profile.contributions} completed transaction
              {profile.contributions !== 1 ? "s" : ""}
            </p>

            <button
              type="button"
              onClick={() =>
                setReportTarget({ type: "user", id: profile.id, label: name })
              }
              className="mt-3 ml-3 text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Report user
            </button>
          </div>
        </div>

        {/* Current offers */}
        <section className="mt-8">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4">Current Offers</h2>
          <div className="border-t border-gray-200 pt-4">
            {offers.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No active offers</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="shrink-0 w-44 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <p className="font-bold text-gray-800 uppercase text-sm mb-1 truncate">
                      {offer.title}
                    </p>
                    <p className="text-sm text-gray-500 line-clamp-3">
                      {offer.description ?? "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Reviews */}
        <section className="mt-8">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-2">Reviews</h2>
          <div className="border-t border-gray-200 pt-2">
            <ReviewsList reviews={reviews} />
          </div>
        </section>
      </main>
      <BottomNav />
      <ReportModal
        open={reportTarget !== null}
        onClose={() => setReportTarget(null)}
        target={reportTarget}
      />
    </div>
  );
}
