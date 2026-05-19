"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Navbar from "@/components/ui/navbar";
import BottomNav from "@/components/ui/bottomnavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, XLg, Upload } from "react-bootstrap-icons";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { createPost, getPosts, editPost } from "@/lib/actions/posts";
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

  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);

  useEffect(() => {
    if (!editId) return;
    setIsLoadingEdit(true);
    getPosts({ id: editId }).then((result) => {
      const post = result.data?.[0];
      if (post) {
        setForm({
          title: post.title ?? "",
          description: post.description ?? "",
          price: post.price != null ? String(post.price) : "",
        });
        if (post.type === "Item" || post.type === "Service") setItemKind(post.type);
        if (post.imgUrl) setUploadedImageUrl(post.imgUrl);
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
    const priceValue = form.price.trim()
      ? parseInt(form.price.trim(), 10) || null
      : null;

    setIsPosting(true);
    try {
      if (editId) {
        await editPost(editId, {
          title,
          price: priceValue,
          description: form.description.trim() || null,
          imgUrl: uploadedImageUrl,
          type: itemKind,
        });
      } else {
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
      }
      router.push(editId ? "/tracker" : "/");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <div className="flex-1 overflow-y-auto pb-28 md:pb-12">
        <div className="max-w-lg md:max-w-5xl mx-auto px-6 md:px-12 pt-4 md:pt-8">
          {/* Header */}
          <button
            type="button"
            onClick={() => router.push(editId ? "/tracker" : "/")}
            className="inline-flex items-center gap-1.5 mb-4 text-sm md:text-base text-black hover:text-gray-700 transition-colors"
            aria-label="Back"
          >
            <ChevronLeft size={20} />
            Back
          </button>
          <h1 className="text-2xl md:text-4xl font-bold text-black mb-6 md:mb-8">
            {editId ? "Edit Offer" : "Create Offer"}
          </h1>

          {/* Form */}
          <div className="space-y-5 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-12 md:gap-y-6">
            {/* Type */}
            <div className="flex items-center gap-6 md:col-span-2">
              <div className="text-sm md:text-lg font-medium text-black">Type</div>
              <button
                type="button"
                onClick={() => setItemKind("Item")}
                className="flex items-center gap-2 text-sm md:text-base font-medium text-black"
              >
                <span className="inline-flex w-4.5 h-4.5 md:w-5 md:h-5 rounded-full border-2 border-blue-500/40 items-center justify-center bg-blue-500/20">
                  {itemKind === "Item" && <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-blue-500" />}
                </span>
                Item
              </button>
              <button
                type="button"
                onClick={() => setItemKind("Service")}
                className="flex items-center gap-2 text-sm md:text-base font-medium text-black"
              >
                <span className="inline-flex w-4.5 h-4.5 md:w-5 md:h-5 rounded-full border-2 border-blue-500/40 items-center justify-center bg-blue-500/20">
                  {itemKind === "Service" && <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-blue-500" />}
                </span>
                Service
              </button>
            </div>

            {/* Title */}
            <div className="md:col-start-1">
              <label className="block text-sm md:text-lg font-medium text-black mb-1.5">Title</label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="What are you offering?"
                className="w-full rounded-xl bg-blue-500/20 border-0 h-10 md:h-12 text-sm md:text-base px-3 md:px-4"
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2 md:row-start-3">
              <label className="block text-sm md:text-lg font-medium text-black mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={4}
                className="w-full rounded-xl bg-blue-500/20 border-0 px-3 md:px-4 py-2 md:py-3 text-sm md:text-base resize-none outline-none focus:ring-2 focus:ring-blue-500/40 h-28 md:h-44"
                placeholder="Add more details about your offer..."
              />
            </div>

            {/* Price */}
            <div className="md:col-start-1 md:row-start-4">
              <label className="block text-sm md:text-lg font-medium text-black mb-1.5">Price (₱)</label>
              <Input
                type="number"
                min={0}
                value={form.price}
                onChange={(e) =>
                  setForm((f) => ({ ...f, price: e.target.value }))
                }
                placeholder="20.00"
                className="w-full md:w-1/2 rounded-xl bg-blue-500/20 border-0 h-10 md:h-12 text-sm md:text-base px-3 md:px-4"
              />
            </div>

            {/* Image Upload */}
            <div className="md:col-span-2 md:row-start-5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
              {uploadedImageUrl ? (
                <div className="relative rounded-xl overflow-hidden bg-gray-100 max-w-md">
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
                  className="inline-flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-black text-sm md:text-base font-medium transition-colors disabled:opacity-60"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      Upload Image
                      <Upload size={16} />
                    </>
                  )}
                </button>
              )}
            </div>

            {/* POST button */}
            <div className="pt-4 md:pt-6 md:col-span-2 md:row-start-6">
              <Button
                type="button"
                onClick={handlePost}
                disabled={isPosting || isUploading || isLoadingEdit || !form.title.trim()}
                className="w-full md:max-w-md rounded-full bg-[#DEA440] hover:bg-[#C48A2A] text-black font-bold uppercase disabled:opacity-60 h-11 md:h-12 text-sm md:text-base"
              >
                {isPosting ? (editId ? "Saving..." : "Posting...") : (editId ? "SAVE" : "POST")}
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
