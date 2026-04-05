"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Navbar from "@/components/ui/navbar";
import BottomNav from "@/components/ui/bottomnavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SquarePen, Star, X, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { getReviews } from "@/lib/actions/reviews";
import { getPosts } from "@/lib/actions/posts";
import { editUser, getUsers } from "@/lib/actions/users";
import { logout } from "@/app/auth/login/actions";
import type { SelectPost } from "@/lib/db/schema";

function formatPrice(value: number | null | undefined): string {
  if (value == null || value === 0) return "FREE";
  return `₱${value}`;
}

export default function ProfilePage() {
  const { userData } = useAuth();
  const currentUser = userData.publicUser;
  const meta = userData.supabaseUser.user_metadata ?? {};
  const avatarUrl = (meta.avatar_url ?? meta.picture ?? "") as string;
  const googleName = (meta.full_name ?? meta.name ?? "") as string;

  const [avgRating, setAvgRating] = useState<number>(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [offers, setOffers] = useState<SelectPost[]>([]);

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

  const loadData = useCallback(async () => {
    const [userResult, reviewsResult, postsResult] = await Promise.all([
      getUsers({ id: currentUser.id }),
      getReviews({ rated_user_id: currentUser.id }),
      getPosts({ user_id: currentUser.id }),
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
    }

    if (postsResult.data) {
      setOffers(postsResult.data.filter((p) => p.status === "Active"));
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
        {/* ── Desktop layout ── */}
        <div className="hidden md:block">
          {/* Header: avatar + info side by side */}
          <div className="flex items-start gap-8">
            {/* Avatar */}
            <div className="relative w-48 h-48 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-gray-500 text-2xl font-medium shrink-0">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt="Profile"
                  fill
                  className="object-cover"
                />
              ) : (
                <span className="uppercase">{(name || "U").charAt(0)}</span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 pt-2">
              {/* Name + rating + edit */}
              <div className="flex items-center gap-4">
                <h1 className="text-4xl font-bold text-gray-900">
                  {name || "User"}
                </h1>
                {reviewCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xl font-semibold text-gray-800">
                      {displayRating}
                    </span>
                    <Star className="w-6 h-6 fill-[#E5A550] text-[#E5A550]" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={openEdit}
                  className="ml-auto font-bold text-sm w-32 h-8  bg-[#E5A550] rounded flex items-center justify-center text-white hover:bg-[#D89440] transition-colors shrink-0"
                  aria-label="Edit profile"
                >
                  Edit Profile
                  <SquarePen className="ml-2 w-4 h-4" />
                </button>
              </div>

              {/* Phone + ID */}
              <div className="flex items-center gap-4 mt-2 text-gray-500 text-sm">
                {phoneNumber && <span>{phoneNumber}</span>}
                {idNumber && <span>ID: {idNumber}</span>}
              </div>
              {description && (
                <p className="mt-3 text-sm text-gray-700 leading-relaxed max-w-xl">
                  &quot;{description}&quot;
                </p>
              )}
            </div>
          </div>

          {/* Buttons row */}
          <div className="flex items-center gap-3 mt-6">
            <Button
              type="button"
              className="rounded-full bg-[#3761B0] hover:bg-[#2d5199] text-white font-medium px-6"
            >
              {currentUser.contributions} completed transaction
              {currentUser.contributions !== 1 ? "s" : ""}
            </Button>
            <form action={logout}>
              <Button
                type="submit"
                variant="outline"
                className="rounded-full border-gray-300 text-red-500 hover:bg-red-50 hover:text-red-600 font-medium flex items-center gap-2"
              >
                Log out
              </Button>
            </form>
          </div>

          {/* Current offers */}
          <section className="mt-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Current Offers
            </h2>
            <div className="border-t border-gray-200 pt-4">
              {offers.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No active offers</p>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {offers.map((offer) => (
                    <div
                      key={offer.id}
                      className="shrink-0 w-52 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <p className="font-bold text-gray-800 uppercase text-sm mb-1 truncate">
                        {offer.title}
                      </p>
                      <p className="text-sm text-gray-500 mb-4 line-clamp-3">
                        {offer.description ?? "—"}
                      </p>
                      <p className="font-bold text-[#3761B0]">
                        {formatPrice(offer.price)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ── Mobile layout ── */}
        <div className="flex md:hidden flex-col gap-4">
          <div className="relative flex flex-col items-start gap-3">
            <button
              type="button"
              onClick={openEdit}
              className="absolute top-0 right-0 w-8 h-8 bg-[#E5A550] rounded flex items-center justify-center text-white hover:bg-[#D89440] transition-colors"
              aria-label="Edit profile"
            >
              <SquarePen className="w-4 h-4" />
            </button>

            {/* Profile picture */}
            <div className="relative w-24 h-24 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-gray-500 text-sm font-medium">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt="Profile"
                  fill
                  className="object-cover"
                />
              ) : (
                <span className="uppercase">{(name || "U").charAt(0)}</span>
              )}
            </div>

            {/* Name + rating row */}
            <div className="flex items-center justify-between gap-4 w-full pr-2">
              <div className="flex flex-col items-start">
                <h1 className="text-2xl font-bold text-gray-900">
                  {name || "User"}
                </h1>
                {phoneNumber && (
                  <span className="text-sm text-gray-500 mt-0.5">
                    {phoneNumber}
                  </span>
                )}
                {idNumber && (
                  <span className="text-sm text-gray-500">ID: {idNumber}</span>
                )}
              </div>
              {reviewCount > 0 ? (
                <div className="flex flex-col items-center justify-center gap-1 shrink-0 ml-auto">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`w-5 h-5 ${
                          n <= filledStars
                            ? "fill-[#E5A550] text-[#E5A550]"
                            : "fill-gray-200 text-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-gray-600 font-medium">
                    {displayRating} / 5 ({reviewCount})
                  </span>
                </div>
              ) : (
                <span className="text-sm text-gray-400 italic">
                  No reviews yet
                </span>
              )}
            </div>
            {description && (
              <p className="text-sm text-gray-700 leading-relaxed">
                &quot;{description}&quot;
              </p>
            )}
          </div>

          <Button
            type="button"
            className="w-full rounded-xl bg-[#3761B0] hover:bg-[#2d5199] text-white font-medium py-6"
          >
            {currentUser.contributions} completed transaction
            {currentUser.contributions !== 1 ? "s" : ""}
          </Button>

          <form action={logout}>
            <Button
              type="submit"
              variant="outline"
              className="w-full rounded-xl border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 font-medium flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </Button>
          </form>

          {/* Current offers */}
          <section className="mt-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Current Offers
            </h2>
            {offers.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No active offers</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
                {offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="shrink-0 w-40 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <p className="font-bold text-gray-800 uppercase text-sm mb-1 truncate">
                      {offer.title}
                    </p>
                    <p className="text-sm text-gray-500 mb-2 line-clamp-2">
                      {offer.description ?? "—"}
                    </p>
                    <p className="font-bold text-gray-900">
                      {formatPrice(offer.price)}
                    </p>
                  </div>
                ))}
              </div>
            )}
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
                <X className="w-5 h-5 text-gray-600" />
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
              className="w-full rounded-full bg-[#E5A550] hover:bg-[#D89440] text-white font-bold uppercase disabled:opacity-60"
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
