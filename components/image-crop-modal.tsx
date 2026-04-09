"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface ImageCropModalProps {
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

/**
 * Simple image crop modal. Shows the full image with a draggable/resizable
 * crop rectangle overlaid. The user drags the crop box to choose the visible
 * portion. The whole image is always visible.
 */
export function ImageCropModal({
  imageSrc,
  onCropComplete,
  onCancel,
}: ImageCropModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Image dimensions as rendered inside the container
  const [imgRect, setImgRect] = useState({ x: 0, y: 0, w: 0, h: 0 });

  // Crop box in percentage of the rendered image (0-100)
  const [cropPct, setCropPct] = useState({ x: 10, y: 10, w: 80, h: 80 });

  const [dragging, setDragging] = useState<
    null | "move" | "nw" | "ne" | "sw" | "se"
  >(null);
  const dragStart = useRef({ mx: 0, my: 0, crop: cropPct });

  // Calculate where the image renders inside the container (object-contain)
  const recalcImgRect = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || !img.naturalWidth) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.min(cw / iw, ch / ih);
    const rw = iw * scale;
    const rh = ih * scale;
    const rx = (cw - rw) / 2;
    const ry = (ch - rh) / 2;
    setImgRect({ x: rx, y: ry, w: rw, h: rh });
  }, []);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    if (img.complete && img.naturalWidth) recalcImgRect();
    img.onload = recalcImgRect;
    window.addEventListener("resize", recalcImgRect);
    return () => window.removeEventListener("resize", recalcImgRect);
  }, [recalcImgRect]);

  // Crop box in pixels relative to the container
  const cropBox = {
    x: imgRect.x + (cropPct.x / 100) * imgRect.w,
    y: imgRect.y + (cropPct.y / 100) * imgRect.h,
    w: (cropPct.w / 100) * imgRect.w,
    h: (cropPct.h / 100) * imgRect.h,
  };

  const handlePointerDown = (
    e: React.PointerEvent,
    mode: "move" | "nw" | "ne" | "sw" | "se",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(mode);
    dragStart.current = { mx: e.clientX, my: e.clientY, crop: { ...cropPct } };
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const dx = ((e.clientX - dragStart.current.mx) / imgRect.w) * 100;
      const dy = ((e.clientY - dragStart.current.my) / imgRect.h) * 100;
      const s = dragStart.current.crop;

      if (dragging === "move") {
        const nx = Math.max(0, Math.min(100 - s.w, s.x + dx));
        const ny = Math.max(0, Math.min(100 - s.h, s.y + dy));
        setCropPct((c) => ({ ...c, x: nx, y: ny }));
      } else {
        const minSize = 10;
        let { x, y, w, h } = s;

        if (dragging === "nw" || dragging === "sw") {
          const newX = Math.max(0, Math.min(x + w - minSize, x + dx));
          w = w + (x - newX);
          x = newX;
        }
        if (dragging === "ne" || dragging === "se") {
          w = Math.max(minSize, Math.min(100 - x, w + dx));
        }
        if (dragging === "nw" || dragging === "ne") {
          const newY = Math.max(0, Math.min(y + h - minSize, y + dy));
          h = h + (y - newY);
          y = newY;
        }
        if (dragging === "sw" || dragging === "se") {
          h = Math.max(minSize, Math.min(100 - y, h + dy));
        }

        setCropPct({ x, y, w, h });
      }
    },
    [dragging, imgRect.w, imgRect.h],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleConfirm = async () => {
    const img = imgRef.current;
    if (!img) return;

    // Convert crop percentages to actual pixel coordinates on the natural image
    const px = (cropPct.x / 100) * img.naturalWidth;
    const py = (cropPct.y / 100) * img.naturalHeight;
    const pw = (cropPct.w / 100) * img.naturalWidth;
    const ph = (cropPct.h / 100) * img.naturalHeight;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(pw);
    canvas.height = Math.round(ph);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      img,
      Math.round(px),
      Math.round(py),
      Math.round(pw),
      Math.round(ph),
      0,
      0,
      Math.round(pw),
      Math.round(ph),
    );

    canvas.toBlob(
      (blob) => {
        if (blob) onCropComplete(blob);
      },
      "image/webp",
      0.85,
    );
  };

  const handleSize = 12;

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
              Drag the box to choose what part is shown
            </p>
          </div>

          {/* Image + crop overlay */}
          <div
            ref={containerRef}
            className="relative w-full bg-gray-900 select-none touch-none"
            style={{ height: 350 }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop preview"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              draggable={false}
            />

            {imgRect.w > 0 && (
              <>
                {/* Dark overlay outside crop area */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5))`,
                    clipPath: `polygon(
                      0% 0%, 100% 0%, 100% 100%, 0% 100%,
                      0% 0%,
                      ${cropBox.x}px ${cropBox.y}px,
                      ${cropBox.x}px ${cropBox.y + cropBox.h}px,
                      ${cropBox.x + cropBox.w}px ${cropBox.y + cropBox.h}px,
                      ${cropBox.x + cropBox.w}px ${cropBox.y}px,
                      ${cropBox.x}px ${cropBox.y}px
                    )`,
                  }}
                />

                {/* Crop border */}
                <div
                  className="absolute border-2 border-white"
                  style={{
                    left: cropBox.x,
                    top: cropBox.y,
                    width: cropBox.w,
                    height: cropBox.h,
                  }}
                />

                {/* Draggable move area */}
                <div
                  className="absolute cursor-move"
                  style={{
                    left: cropBox.x + handleSize / 2,
                    top: cropBox.y + handleSize / 2,
                    width: cropBox.w - handleSize,
                    height: cropBox.h - handleSize,
                  }}
                  onPointerDown={(e) => handlePointerDown(e, "move")}
                />

                {/* Corner handles */}
                {(["nw", "ne", "sw", "se"] as const).map((corner) => {
                  const isLeft = corner.includes("w");
                  const isTop = corner.includes("n");
                  return (
                    <div
                      key={corner}
                      className="absolute bg-white border border-gray-400 rounded-sm"
                      style={{
                        width: handleSize,
                        height: handleSize,
                        left: isLeft
                          ? cropBox.x - handleSize / 2
                          : cropBox.x + cropBox.w - handleSize / 2,
                        top: isTop
                          ? cropBox.y - handleSize / 2
                          : cropBox.y + cropBox.h - handleSize / 2,
                        cursor: `${corner}-resize`,
                      }}
                      onPointerDown={(e) => handlePointerDown(e, corner)}
                    />
                  );
                })}
              </>
            )}
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
              className="flex-1 rounded-full bg-[#DEA440] hover:bg-[#C48A2A] text-black font-bold"
            >
              Confirm
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
