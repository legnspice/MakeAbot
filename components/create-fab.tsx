"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TagFill, QuestionCircleFill, XLg } from "react-bootstrap-icons";
import { Plus } from "lucide-react";

/**
 * Floating "Create" button + type-picker modal (Offer / Request).
 * Fixed-positioned, so it can be dropped into any page (home, tracker, …).
 */
export default function CreateFab() {
  const router = useRouter();
  const [isTypePickerOpen, setIsTypePickerOpen] = useState(false);

  return (
    <>
      {/* Type picker modal (all viewports) */}
      {isTypePickerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setIsTypePickerOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="pointer-events-auto bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 px-6 pt-5 pb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-800">
                  What are you creating?
                </h2>
                <button
                  type="button"
                  onClick={() => setIsTypePickerOpen(false)}
                  className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <XLg size={20} className="text-gray-500" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsTypePickerOpen(false);
                    router.push("/create-offer");
                  }}
                  className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-gray-200 hover:border-[#DEA440] hover:bg-amber-50 active:bg-amber-100 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-full bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center transition-colors">
                    <TagFill size={24} className="text-[#DEA440]" />
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-800 text-sm">
                      Offer
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      I have something to share
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsTypePickerOpen(false);
                    router.push("/create-request");
                  }}
                  className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-gray-200 hover:border-[#3761B0] hover:bg-blue-50 active:bg-blue-100 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
                    <QuestionCircleFill size={24} className="text-[#3761B0]" />
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-800 text-sm">
                      Request
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      I need something
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Floating action button */}
      <div className="fixed bottom-30 md:bottom-6 right-6 z-10">
        <Button
          size="icon"
          className="w-14 h-14 md:w-32 md:h-14 rounded-full bg-[#D89A30] hover:bg-[#C4881C] text-white shadow-lg p-0 flex items-center justify-center gap-1.5"
          aria-label="Create item"
          onClick={() => setIsTypePickerOpen((v) => !v)}
        >
          <span className="hidden md:inline text-white font-medium">Create</span>
          <Plus size={30} strokeWidth={3} className="text-white" />
        </Button>
      </div>
    </>
  );
}
