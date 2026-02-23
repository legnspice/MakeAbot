"use client";

import Image from "next/image";
import { useState } from "react";
import { createClient } from "@/lib/client";
// import {supabase}

export default function PhotoTemplate() {
  const supabase = createClient();
  const [imageUrl, setImageUrl] = useState<string>("");

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) {
        throw new Error("You must select an image to upload.");
      }
      const file = e.target.files[0];
      const { data: image, error: uploadError } = await supabase.storage
        .from("post_photos")
        .upload(`${file.name}`, file);
      if (uploadError) {
        throw uploadError;
      }

      if (image) {
        console.log(image);
      }

      const { data: imgUrl } = await supabase.storage
        .from("post_photos")
        .getPublicUrl(file.name);

      // TODO: Integrate with appropriate functions such as createPost to store imgUrl in the database

      if (imgUrl) {
        setImageUrl(imgUrl.publicUrl);
      }
    } catch (error) {
      console.log(error);
    }
  };
  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-800 text-gray-200 p-24">
      <div className="mt-5">
        <input
          type="file"
          onChange={uploadImage}
          className="block w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 cursor-pointer dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
        />
      </div>
      <div className="mt-5">
        {imageUrl && (
          <Image
            src={imageUrl}
            alt="Uploaded Image"
            width={500}
            height={500}
            className="rounded-lg border border-gray-300"
          />
        )}
      </div>
    </main>
  );
}
