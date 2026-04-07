"use client";

import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";

interface ImageCropModalProps {
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

export function ImageCropModal({
  imageSrc,
  onCropComplete,
  onCancel,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropDone = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;

    const croppedBlob = await getCroppedImage(imageSrc, croppedAreaPixels);
    if (croppedBlob) {
      onCropComplete(croppedBlob);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-800 text-center">
              Adjust Photo
            </h2>
            <p className="text-xs text-gray-500 text-center mt-0.5">
              Drag to reposition, pinch or scroll to zoom
            </p>
          </div>

          <div
            className="relative w-full bg-black"
            style={{ height: 350 }}
          >
            <style>{`
              .crop-container img {
                max-width: none !important;
                max-height: none !important;
              }
            `}</style>
            <div className="crop-container" style={{ position: "absolute", inset: 0 }}>
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                minZoom={1}
                maxZoom={3}
                aspect={4 / 3}
                objectFit="contain"
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropDone}
                showGrid
              />
            </div>
          </div>

          <div className="px-4 py-2">
            <label className="text-xs text-gray-500 block mb-1">Zoom</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-[#3761B0]"
            />
          </div>

          <div className="flex gap-3 px-4 py-3 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1 rounded-full"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              className="flex-1 rounded-full bg-[#E5A550] hover:bg-[#D89440] text-white font-bold"
            >
              Confirm
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

async function getCroppedImage(
  imageSrc: string,
  pixelCrop: Area,
): Promise<Blob | null> {
  const image = new window.Image();
  image.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      "image/webp",
      0.85,
    );
  });
}
