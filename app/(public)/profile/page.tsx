'use client';

import { useEffect, useState, useCallback } from 'react';
import Navbar from '@/components/ui/navbar';
import BottomNav from '@/components/ui/bottomnavbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SquarePen, Star, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { getReviews } from '@/lib/actions/reviews';
import { getPosts } from '@/lib/actions/posts';
import { editUser, getUsers } from '@/lib/actions/users';
import type { SelectPost } from '@/lib/db/schema';

function formatPrice(value: number | null | undefined): string {
  if (value == null || value === 0) return 'FREE';
  return `₱${value}`;
}

export default function ProfilePage() {
  const { userData } = useAuth();
  const currentUser = userData.publicUser;
  const avatarUrl = userData.supabaseUser.user_metadata?.avatar_url as string | undefined;
  const googleName = (userData.supabaseUser.user_metadata?.full_name ?? userData.supabaseUser.user_metadata?.name ?? '') as string;

  const [avgRating, setAvgRating] = useState<number>(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [offers, setOffers] = useState<SelectPost[]>([]);

  // Local copy of editable fields so UI updates after save
  const [name, setName] = useState(currentUser.name ?? googleName);
  const [idNumber, setIdNumber] = useState(currentUser.id_number?.toString() ?? '');
  const [phoneNumber, setPhoneNumber] = useState(currentUser.phone_number ?? '');

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', idNumber: '', phoneNumber: '' });
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
      setIdNumber(u.id_number?.toString() ?? '');
      setPhoneNumber(u.phone_number ?? '');
    }

    if (reviewsResult.data && reviewsResult.data.length > 0) {
      const sum = reviewsResult.data.reduce((acc, r) => acc + r.rating, 0);
      setAvgRating(Math.round((sum / reviewsResult.data.length) * 10) / 10);
      setReviewCount(reviewsResult.data.length);
    }

    if (postsResult.data) {
      setOffers(postsResult.data.filter((p) => p.status === 'Active'));
    }
  }, [currentUser.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openEdit = () => {
    setEditForm({ name, idNumber, phoneNumber });
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
      });
      if (result.error) {
        setSaveError(result.error);
        return;
      }
      setName(editForm.name.trim());
      setIdNumber(editForm.idNumber);
      setPhoneNumber(editForm.phoneNumber.trim());
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

      <main className="flex-1 px-4 pt-6 pb-28 max-w-md mx-auto w-full">
        <div className="flex flex-col gap-4">
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
            <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-gray-500 text-sm font-medium">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="uppercase">{(name || 'U').charAt(0)}</span>
              )}
            </div>

            {/* Name + rating row */}
            <div className="flex items-center justify-between gap-4 w-full pr-2">
              <div className="flex flex-col items-start">
                <h1 className="text-2xl font-bold text-gray-900">{name || 'User'}</h1>
                {phoneNumber && (
                  <span className="text-sm text-gray-500 mt-0.5">{phoneNumber}</span>
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
                            ? 'fill-[#E5A550] text-[#E5A550]'
                            : 'fill-gray-200 text-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-gray-600 font-medium">
                    {displayRating} / 5 ({reviewCount})
                  </span>
                </div>
              ) : (
                <span className="text-sm text-gray-400 italic">No reviews yet</span>
              )}
            </div>
          </div>

          {/* Completed transactions */}
          <Button
            type="button"
            className="w-full rounded-xl bg-[#3761B0] hover:bg-[#2d5199] text-white font-medium py-6"
          >
            {currentUser.contributions} completed transaction{currentUser.contributions !== 1 ? 's' : ''}
          </Button>
        </div>

        {/* Current offers */}
        <section className="mt-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Current Offers</h2>
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
                    {offer.description ?? '—'}
                  </p>
                  <p className="font-bold text-gray-900">{formatPrice(offer.price)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
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
                <label className="text-sm text-gray-600 font-medium">Display Name</label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Your name"
                  className="rounded-xl bg-gray-100 border-0"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-600 font-medium">Student ID Number</label>
                <Input
                  type="number"
                  value={editForm.idNumber}
                  onChange={(e) => setEditForm((f) => ({ ...f, idNumber: e.target.value }))}
                  placeholder="e.g. 202012345"
                  className="rounded-xl bg-gray-100 border-0"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-600 font-medium">Phone Number</label>
                <Input
                  value={editForm.phoneNumber}
                  onChange={(e) => setEditForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                  placeholder="e.g. 09171234567"
                  className="rounded-xl bg-gray-100 border-0"
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
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
