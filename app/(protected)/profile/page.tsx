"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/ui/navbar";
import BottomNav from "@/components/ui/bottomnavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PencilSquare,
  StarFill,
  Star,
  XLg,
  BoxArrowRight,
  CameraFill,
} from "react-bootstrap-icons";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { getReviews } from "@/lib/actions/reviews";
import { getOffers } from "@/lib/actions/offers";
import { editUser, getUsers } from "@/lib/actions/users";
import { logout } from "@/app/auth/login/actions";
import type { SelectOffer, SelectReview } from "@/lib/db/schema";
import ReviewsList from "@/components/reviews-list";
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";

function formatPrice(value: number | null | undefined): string {
  if (value == null || value === 0) return "FREE";
  return `₱${value}`;
}

function getHighResAvatarUrl(url: string): string {
  if (!url) return url;
  return url.replace(/=s\d+-c/, "=s400-c");
}

export default function ProfilePage() {
  const { userData } = useAuth();
  const currentUser = userData.publicUser;
  const isAdmin = userData.publicUser.is_admin;
  const meta = userData.supabaseUser.user_metadata ?? {};
  const avatarUrl = (meta.avatar_url ?? meta.picture ?? "") as string;
  const googleName = (meta.full_name ?? meta.name ?? "") as string;

  const [avgRating, setAvgRating] = useState<number>(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [offers, setOffers] = useState<SelectOffer[]>([]);
  const [reviews, setReviews] = useState<SelectReview[]>([]);

  // Local copy of editable fields so UI updates after save
  const [name, setName] = useState(currentUser.name ?? googleName);
  const [idNumber, setIdNumber] = useState(
    currentUser.id_number?.toString() ?? "",
  );
  const [phoneNumber, setPhoneNumber] = useState(
    currentUser.phone_number ?? "",
  );
  const [description, setDescription] = useState(currentUser.description ?? "");

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    idNumber: "",
    phoneNumber: "",
    description: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const highResAvatar = getHighResAvatarUrl(avatarUrl);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    setIsUploadingAvatar(true);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 400,
        useWebWorker: true,
        fileType: "image/webp",
      });

      const fileName = `${currentUser.id}-${Date.now()}.webp`;
      const supabase = createClient();

      const { error: uploadError } = await supabase.storage
        .from("profile_photos")
        .upload(fileName, compressed);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("profile_photos")
        .getPublicUrl(fileName);

      await supabase.auth.updateUser({
        data: { avatar_url: data.publicUrl },
      });

      // Keep the denormalized users.avatar_url in sync immediately.
      await editUser(currentUser.id, { avatar_url: data.publicUrl });

      window.location.reload();
    } catch (err) {
      console.error("Avatar upload failed:", err);
    } finally {
      setIsUploadingAvatar(false);
      if (avatarFileRef.current) avatarFileRef.current.value = "";
    }
  };

  const loadData = useCallback(async () => {
    const [userResult, reviewsResult, offersResult] = await Promise.all([
      getUsers({ id: currentUser.id }),
      getReviews({ rated_user_id: currentUser.id }),
      getOffers({ user_id: currentUser.id }),
    ]);

    if (userResult.data?.[0]) {
      const u = userResult.data[0];
      setName(u.name ?? googleName);
      setIdNumber(u.id_number?.toString() ?? "");
      setPhoneNumber(u.phone_number ?? "");
      setDescription(u.description ?? "");
    }

    if (reviewsResult.data && reviewsResult.data.length > 0) {
      const sum = reviewsResult.data.reduce((acc, r) => acc + r.rating, 0);
      setAvgRating(Math.round((sum / reviewsResult.data.length) * 10) / 10);
      setReviewCount(reviewsResult.data.length);
      setReviews(reviewsResult.data);
    }

    if (offersResult.data) {
      setOffers(offersResult.data.filter((p) => p.status === "Active"));
    }
  }, [currentUser.id, googleName]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openEdit = () => {
    setEditForm({ name, idNumber, phoneNumber, description });
    setEditOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await editUser(currentUser.id, {
        name: editForm.name.trim() || null,
        id_number: editForm.idNumber ? parseInt(editForm.idNumber, 10) : null,
        phone_number: editForm.phoneNumber.trim() || null,
        description: editForm.description.trim() || null,
      });
      if (result.error) {
        setSaveError(result.error);
        return;
      }
      setName(editForm.name.trim());
      setIdNumber(editForm.idNumber);
      setPhoneNumber(editForm.phoneNumber.trim());
      setDescription(editForm.description.trim());
      setEditOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const displayRating = avgRating || 0;
  const filledStars = Math.round(displayRating);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 pt-6 pb-28 w-full mx-auto max-w-md md:max-w-5xl">
        {/* Single responsive tree: mobile-first, `md:` widens to the desktop
            layout. Do not re-fork this into per-viewport copies. */}
        <div className="flex flex-col gap-4 md:gap-0">
          {/* Header: avatar stacked on mobile, side-by-side from md up.
              `relative` anchors the mobile edit-profile button. */}
          <div className="relative flex flex-col md:flex-row items-start gap-3 md:gap-8">
            {/* Avatar */}
            <div className="relative w-24 h-24 md:w-48 md:h-48 shrink-0">
              <div className="relative w-full h-full rounded-full overflow-hidden bg-gray-200 flex items-center justify-center text-gray-500 text-sm md:text-2xl font-medium">
                {highResAvatar ? (
                  <Image
                    src={highResAvatar}
                    alt="Profile"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <span className="uppercase">{(name || "U").charAt(0)}</span>
                )}
              </div>
              <input
                ref={avatarFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={isUploadingAvatar}
              />
              <button
                type="button"
                onClick={() => avatarFileRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute bottom-0 right-0 md:bottom-2 md:right-2 w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#DEA440] hover:bg-[#C48A2A] text-black flex items-center justify-center shadow-md transition-colors disabled:opacity-60 z-10"
                aria-label="Change profile picture"
              >
                {isUploadingAvatar ? (
                  <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                ) : (
                  <CameraFill className="w-4 h-4 md:w-5 md:h-5" />
                )}
              </button>
            </div>

            {/* Info */}
            <div className="w-full md:flex-1 md:pt-2">
              <div className="flex items-center md:items-start justify-between gap-4 w-full pr-2 md:pr-0">
                <div className="flex flex-col items-start min-w-0">
                  <h1 className="text-2xl md:text-4xl font-bold text-gray-900">
                    {name || "User"}
                  </h1>
                  {/* Phone + ID: stacked under the name on mobile, one row from md up */}
                  <div className="flex flex-col md:flex-row md:items-center md:gap-4 mt-0.5 md:mt-2 text-gray-500 text-sm">
                    {phoneNumber && <span>{phoneNumber}</span>}
                    {idNumber && <span>ID: {idNumber}</span>}
                  </div>
                </div>

                {/* Rating — genuinely forked: mobile renders a five-star row
                    with "x / 5 (n)" plus an explicit empty state, desktop a
                    compact numeric score with no empty state. Different
                    element counts, so no single element expresses both. */}
                {reviewCount > 0 ? (
                  <>
                    <div className="flex md:hidden flex-col items-center justify-center gap-1 shrink-0 ml-auto">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) =>
                          n <= filledStars ? (
                            <StarFill
                              key={n}
                              className="text-[#DEA440]"
                              size={20}
                            />
                          ) : (
                            <Star key={n} className="text-gray-200" size={20} />
                          ),
                        )}
                      </div>
                      <span className="text-sm text-gray-600 font-medium">
                        {displayRating} / 5 ({reviewCount})
                      </span>
                    </div>
                    <div className="hidden md:flex items-center gap-1.5 shrink-0">
                      <span className="text-2xl font-semibold text-gray-800">
                        {displayRating}
                      </span>
                      <StarFill className="text-[#DEA440]" size={24} />
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-gray-400 italic md:hidden">
                    No reviews yet
                  </span>
                )}

                {/* Edit profile: icon-only chip pinned to the top-right of the
                    header on mobile, labelled button in the header row from
                    md up. */}
                <button
                  type="button"
                  onClick={openEdit}
                  className="absolute top-0 right-0 md:static md:ml-auto w-8 h-8 md:w-32 md:h-8 rounded bg-[#DEA440] hover:bg-[#C48A2A] md:bg-[#D89A30] md:hover:bg-[#C4881C] text-black md:text-white font-bold text-sm flex items-center justify-center transition-colors shrink-0"
                  aria-label="Edit profile"
                >
                  <span className="hidden md:inline">Edit Profile</span>
                  <PencilSquare className="md:ml-2" size={16} />
                </button>
              </div>

              {description && (
                <p className="mt-3 text-sm text-gray-700 leading-relaxed md:max-w-xl">
                  {/* Decorative quotes are a mobile-only treatment; from md up
                      the bio renders plain, matching the public profile page. */}
                  <span className="md:hidden">&quot;</span>
                  {description}
                  <span className="md:hidden">&quot;</span>
                </p>
              )}
            </div>
          </div>

          {/* Buttons row */}
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-3 md:mt-6">
            <Button
              type="button"
              className="w-full md:w-auto rounded-xl md:rounded-full py-6 md:py-2 md:px-6 bg-[#3761B0] hover:bg-[#2d5199] text-white font-medium"
            >
              {currentUser.contributions} completed transaction
              {currentUser.contributions !== 1 ? "s" : ""}
            </Button>
            <form action={logout}>
              <Button
                type="submit"
                variant="outline"
                className="w-full md:w-auto rounded-xl md:rounded-full border-red-200 md:border-gray-300 text-red-500 hover:bg-red-50 hover:text-red-600 font-medium flex items-center justify-center gap-2"
              >
                <BoxArrowRight size={16} />
                Log out
              </Button>
            </form>
            {isAdmin && (
              <Link
                href="/admin/reports"
                className="text-sm text-[#3761B0] hover:underline"
              >
                Admin · Reports
              </Link>
            )}
          </div>

          {/* Current offers */}
          <section className="mt-4 md:mt-8">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4">
              Current Offers
            </h2>
            <div className="md:border-t md:border-gray-200 md:pt-4">
              {offers.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No active offers</p>
              ) : (
                <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
                  {offers.map((offer) => (
                    <div
                      key={offer.id}
                      className="shrink-0 w-40 md:w-52 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <p className="font-bold text-gray-800 uppercase text-sm mb-1 truncate">
                        {offer.title}
                      </p>
                      <p className="text-sm text-gray-500 mb-2 md:mb-4 line-clamp-2 md:line-clamp-3">
                        {offer.description ?? "—"}
                      </p>
                      <p className="font-bold text-gray-900 md:text-[#3761B0]">
                        {formatPrice(offer.price)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Reviews */}
          <section className="mt-4 md:mt-8">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-2 md:mb-4">
              Reviews
            </h2>
            <div className="border-t border-gray-200 pt-2 md:max-w-2xl">
              <ReviewsList reviews={reviews} />
            </div>
          </section>
        </div>
      </main>

      {/* Edit profile modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="w-full max-w-md bg-white rounded-t-3xl p-6 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Edit Profile</h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
                aria-label="Close"
              >
                <XLg className="text-gray-600" size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-600 font-medium">
                  Display Name
                </label>
                <Input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Your name"
                  className="rounded-xl bg-gray-100 border-0"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-600 font-medium">
                  Student ID Number
                </label>
                <Input
                  type="number"
                  value={editForm.idNumber}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, idNumber: e.target.value }))
                  }
                  placeholder="e.g. 202012345"
                  className="rounded-xl bg-gray-100 border-0"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-600 font-medium">
                  Phone Number
                </label>
                <Input
                  value={editForm.phoneNumber}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, phoneNumber: e.target.value }))
                  }
                  placeholder="e.g. 09171234567"
                  className="rounded-xl bg-gray-100 border-0"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-600 font-medium">Bio</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Tell others about yourself..."
                  rows={3}
                  className="rounded-xl bg-gray-100 border-0 px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>
            </div>

            {saveError && (
              <p className="text-sm text-red-500 text-center">{saveError}</p>
            )}

            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full rounded-full bg-[#DEA440] hover:bg-[#C48A2A] text-black font-bold uppercase disabled:opacity-60"
            >
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
