"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Navbar from "@/components/ui/navbar";
import BottomNav from "@/components/ui/bottomnavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ImageFill, XLg } from "react-bootstrap-icons";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { createPost } from "@/lib/actions/posts";
import { createClient } from "@/lib/supabase/client";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import imageCompression from "browser-image-compression";
import { ImageCropModal } from "@/components/image-crop-modal";

export default function CreateOffer() {
  const router = useRouter();
  const { userData } = useAuth();
  const currentUser = userData.publicUser;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { requestPermissionAndSubscribe } = usePushSubscription();

  const [itemKind, setItemKind] = useState<"Item" | "Service">("Item");
  const [isPosting, setIsPosting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
  });

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
    const priceValue = form.price.trim()
      ? parseInt(form.price.trim(), 10) || null
      : null;

    setIsPosting(true);
    try {
      await createPost({
        user_id: currentUser.id,
        title,
        price: priceValue,
        description: form.description.trim() || null,
        imgUrl: uploadedImageUrl,
        status: "Active",
        type: itemKind,
      });
      requestPermissionAndSubscribe().catch(() => {});
      router.push("/");
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
              onClick={() => router.push("/")}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Back"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-lg font-bold text-gray-800">Create an Offer</h1>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Type: Item / Service */}
            <div className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-sm text-gray-600">Type</div>
              <div className="inline-flex rounded-full bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setItemKind("Item")}
                  className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                    itemKind === "Item"
                      ? "bg-white text-black font-semibold shadow-sm"
                      : "text-gray-600"
                  }`}
                >
                  Item
                </button>
                <button
                  type="button"
                  onClick={() => setItemKind("Service")}
                  className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                    itemKind === "Service"
                      ? "bg-white text-black font-semibold shadow-sm"
                      : "text-gray-600"
                  }`}
                >
                  Service
                </button>
              </div>
            </div>

            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-sm text-gray-600">Title</div>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="What are you offering?"
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
                placeholder="Add more details about your offer..."
              />
            </div>

            {/* Price */}
            <div className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-sm text-gray-600">
                Price (₱)
              </div>
              <Input
                type="number"
                min={0}
                value={form.price}
                onChange={(e) =>
                  setForm((f) => ({ ...f, price: e.target.value }))
                }
                placeholder="20.00"
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
                      alt="Offer photo"
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
                disabled={isPosting || isUploading || !form.title.trim()}
                className="w-full rounded-full bg-[#DEA440] hover:bg-[#C48A2A] text-white font-bold uppercase disabled:opacity-60"
              >
                {isPosting ? "Posting..." : "POST!"}
              </Button>
            </div>
          </div>
        </div>
      </div>

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
