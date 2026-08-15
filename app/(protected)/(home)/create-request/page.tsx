"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Navbar from "@/components/ui/navbar";
import BottomNav from "@/components/ui/bottomnavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ImageFill, XLg } from "react-bootstrap-icons";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  createRequest,
  getRequests,
  editRequest,
} from "@/lib/actions/requests";
import { createClient } from "@/lib/supabase/client";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import imageCompression from "browser-image-compression";
import { URGENCY_VALUES, type Urgency } from "@/lib/db/enums";
import { ImageCropModal } from "@/components/image-crop-modal";
import {
  PushPermissionModal,
  PUSH_PROMPT_KEY,
} from "@/components/push-permission-modal";
import { PRICE_CAP } from "@/lib/constants";
import { incentiveOverCap } from "@/lib/incentive";

export default function CreateRequest() {
  const router = useRouter();
  const { userData } = useAuth();
  const currentUser = userData.publicUser;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { requestPermissionAndSubscribe } = usePushSubscription();

  // Default is deliberately not the loudest tier — "Now" broadcasts a push to
  // the whole campus (lib/broadcast-policy.ts), so it must be a choice.
  const [urgency, setUrgency] = useState<Urgency>("Within the day");
  const [isPosting, setIsPosting] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    incentive: "",
  });

  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);

  useEffect(() => {
    if (!editId) return;
    setIsLoadingEdit(true);
    getRequests({ id: editId }).then((result) => {
      const req = result.data?.[0];
      if (req) {
        setForm({
          title: req.title ?? "",
          description: req.description ?? "",
          incentive: req.incentive ?? "",
        });
        if (req.urgency) setUrgency(req.urgency);
        if (req.imgUrl) setUploadedImageUrl(req.imgUrl);
      } else {
        router.push("/tracker");
      }
      setIsLoadingEdit(false);
    });
  }, [editId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setRawImageSrc(null);
    setIsUploading(true);
    try {
      const file = new File([croppedBlob], "cropped.webp", {
        type: "image/webp",
      });
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
        fileType: "image/webp",
      });

      const fileName = `${crypto.randomUUID()}-${Date.now()}.webp`;
      const supabase = createClient();

      const { error: uploadError } = await supabase.storage
        .from("post_photos")
        .upload(fileName, compressed);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("post_photos")
        .getPublicUrl(fileName);

      setUploadedImageUrl(data.publicUrl);
    } catch (err) {
      console.error("Image upload failed:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCropCancel = () => {
    setRawImageSrc(null);
  };

  const handleRemoveImage = () => {
    setUploadedImageUrl(null);
  };

  const handlePost = async () => {
    const title = form.title.trim();
    if (!title) return;
    const incentive = form.incentive.trim() || null;
    if (incentiveOverCap(incentive)) {
      alert(`Please keep incentives at ₱${PRICE_CAP} or under.`);
      return;
    }

    setIsPosting(true);
    try {
      if (editId) {
        await editRequest(editId, {
          title,
          incentive,
          description: form.description.trim() || null,
          imgUrl: uploadedImageUrl,
          urgency,
        });
      } else {
        await createRequest({
          user_id: currentUser.id,
          title,
          incentive,
          description: form.description.trim() || null,
          imgUrl: uploadedImageUrl,
          urgency,
          status: "Active",
        });
        const seen = localStorage.getItem(PUSH_PROMPT_KEY);
        const denied =
          typeof Notification !== "undefined" &&
          Notification.permission === "denied";
        if (!seen && !denied) {
          setShowPushModal(true);
          return;
        }
      }
      router.push(editId ? "/tracker" : "/");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <div className="flex-1 overflow-y-auto pb-28 md:pb-6">
        <div className="max-w-lg mx-auto px-4 pt-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-6">
            <button
              type="button"
              onClick={() => router.push(editId ? "/tracker" : "/")}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Back"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-lg font-bold text-gray-800">
              {editId ? "Edit Request" : "Create a Request"}
            </h1>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-sm text-gray-600">Title</div>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="What do you need?"
                className="flex-1 rounded-xl bg-gray-100 border-0"
              />
            </div>

            {/* Description */}
            <div className="flex items-start gap-3">
              <div className="w-28 shrink-0 pt-2 text-sm text-gray-600">
                Description
              </div>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={4}
                className="flex-1 rounded-xl bg-gray-100 border-0 px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-gray-300"
                placeholder="Add more details about your request..."
              />
            </div>

            {/* Urgency */}
            <div className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-sm text-gray-600">Urgency</div>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as Urgency)}
                className="flex-1 rounded-xl bg-gray-100 border-0 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300 appearance-none cursor-pointer"
              >
                {URGENCY_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* Incentive */}
            <div className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-sm text-gray-600">
                Incentive
              </div>
              <Input
                value={form.incentive}
                maxLength={60}
                onChange={(e) =>
                  setForm((f) => ({ ...f, incentive: e.target.value }))
                }
                placeholder="e.g. ₱20, a coffee, just goodwill"
                className="flex-1 rounded-xl bg-gray-100 border-0"
              />
            </div>

            {/* Image Upload */}
            <div className="flex items-start gap-3">
              <div className="w-28 shrink-0 pt-2 text-sm text-gray-600">
                Photo
              </div>
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                />
                {uploadedImageUrl ? (
                  <div className="relative rounded-xl overflow-hidden bg-gray-100">
                    <Image
                      src={uploadedImageUrl}
                      alt="Request photo"
                      width={400}
                      height={200}
                      className="w-full h-48 object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 rounded-full p-1 transition-colors"
                      aria-label="Remove photo"
                    >
                      <XLg size={16} className="text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full h-32 rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-gray-500 transition-colors disabled:opacity-60"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="text-sm">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <ImageFill size={24} />
                        <span className="text-sm">Add a photo</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="pt-2 pb-4">
              <Button
                type="button"
                onClick={handlePost}
                disabled={
                  isPosting ||
                  isUploading ||
                  isLoadingEdit ||
                  !form.title.trim()
                }
                className="w-full rounded-full bg-[#3761B0] hover:bg-[#2d52a0] text-white font-bold uppercase disabled:opacity-60"
              >
                {isPosting
                  ? editId
                    ? "Saving..."
                    : "Posting..."
                  : editId
                    ? "SAVE"
                    : "POST!"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Push permission modal */}
      {showPushModal && (
        <PushPermissionModal
          onEnable={async () => {
            localStorage.setItem(PUSH_PROMPT_KEY, "true");
            await requestPermissionAndSubscribe().catch(() => {});
            setShowPushModal(false);
            router.push("/");
          }}
          onSkip={() => {
            localStorage.setItem(PUSH_PROMPT_KEY, "true");
            setShowPushModal(false);
            router.push("/");
          }}
        />
      )}

      {/* Image crop modal */}
      {rawImageSrc && (
        <ImageCropModal
          imageSrc={rawImageSrc}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}

      <BottomNav />
    </div>
  );
}
