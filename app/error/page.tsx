import Image from "next/image";
import Link from "next/link";

export default function ErrorPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 gap-6">
      <Image
        src="/logo.svg"
        alt="MakeAbot logo"
        width={80}
        height={72}
        priority
      />

      <div className="flex flex-col items-center gap-1">
        <h1 className="text-5xl md:text-6xl font-black tracking-tight text-[#3761B0]">
          MakeAbot
        </h1>
      </div>

      <div className="flex flex-col items-center gap-2 text-center max-w-xs">
        <p className="text-gray-800 font-semibold text-lg">
          Something went wrong
        </p>
        <p className="text-gray-500 text-sm">
          An unexpected error occurred. Please try refreshing the page.
        </p>
      </div>

      <Link
        href="/"
        className="w-full max-w-xs flex items-center justify-center rounded-xl py-3 px-4 bg-[#3761B0] hover:bg-[#2a4d8a] transition-colors"
      >
        <span className="text-white font-semibold text-sm">Go Home</span>
      </Link>
    </div>
  );
}
