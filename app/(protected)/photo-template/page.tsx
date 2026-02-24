"use client";

import Image from "next/image";
import { useState } from "react";
import { createClient } from "@/lib/client";
import imageCompression from "browser-image-compression";

export default function PhotoTemplate() {
  const supabase = createClient();
  const [imageUrl, setImageUrl] = useState<string>("");
  const [isCompressing, setIsCompressing] = useState(false);

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;

      const file = e.target.files[0];

      // Photo Compression System
      setIsCompressing(true);
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
        fileType: "image/webp",
      };

      const compressedFile = await imageCompression(file, options);

      // Unique File Name Building System
      const fileExt = "webp";
      const fileName = `${Math.random().toPrecision()}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("post_photos")
        .upload(fileName, compressedFile);

      if (uploadError) throw uploadError;

      const { data: imgUrl } = supabase.storage
        .from("post_photos")
        .getPublicUrl(fileName);

      // TODO: Integrate with appropriate functions such as createPost to store imgUrl in the database
      if (imgUrl) {
        setImageUrl(imgUrl.publicUrl);
      }
    } catch (error) {
      console.error("Error uploading/compressing image:", error);
    } finally {
      setIsCompressing(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-800 text-gray-200 p-24">
      <div className="mt-5">
        <label className="block mb-2 text-sm font-medium">
          {isCompressing ? "Optimizing Image..." : "Upload Photo"}
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={uploadImage}
          disabled={isCompressing}
          className="block w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 cursor-pointer disabled:opacity-50"
        />
      </div>

      <div className="mt-5">
        {imageUrl && (
          <Image
            src={imageUrl}
            alt="Uploaded Image"
            width={500}
            height={500}
            className="rounded-lg border border-gray-300 object-cover"
          />
        )}
      </div>
    </main>
  );
}
