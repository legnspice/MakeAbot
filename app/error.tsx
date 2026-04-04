"use client";

import Image from "next/image";
import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 gap-6">
      <Image src="/logo.svg" alt="MakeAbot logo" width={80} height={72} priority />

      <div className="flex flex-col items-center gap-1">
        <h1 className="text-5xl md:text-6xl font-black tracking-tight text-[#3761B0]">
          MakeAbot
        </h1>
      </div>

      <div className="flex flex-col items-center gap-2 text-center max-w-xs">
        <p className="text-gray-800 font-semibold text-lg">Something went wrong</p>
        <p className="text-gray-500 text-sm">
          An unexpected error occurred. Please try again or go back home.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          type="button"
          onClick={reset}
          className="w-full flex items-center justify-center rounded-xl py-3 px-4 bg-[#3761B0] hover:bg-[#2a4d8a] transition-colors"
        >
          <span className="text-white font-semibold text-sm">Try Again</span>
        </button>
        <Link
          href="/"
          className="w-full flex items-center justify-center rounded-xl py-3 px-4 border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <span className="text-gray-700 font-semibold text-sm">Go Home</span>
        </Link>
      </div>
    </div>
  );
}
