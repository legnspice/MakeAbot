import Image from "next/image";
import { googleLogin } from "./actions";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 gap-6">
      {/* M. monogram */}
      <Image
        src="/logo.svg"
        alt="MakeAbot logo"
        width={80}
        height={72}
        priority
      />

      {/* Wordmark */}
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-5xl md:text-6xl font-black tracking-tight text-[#3761B0]">
          MakeAbot
        </h1>
        <p className="text-[#3761B0] text-sm text-center max-w-xs">
          A lending app for the Ateneo community
        </p>
      </div>

      {/* Login button */}
      <form action={googleLogin} className="w-full max-w-xs">
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-3 rounded-xl py-3 px-4 bg-[#3761B0] shadow-sm hover:bg-[#2a4d8a] transition-colors"
        >
          <span className="text-white font-semibold text-sm">
            Login with your Ateneo Account
          </span>
        </button>
      </form>

      <p className="text-xs text-gray-400 text-center max-w-xs leading-relaxed">
        MakeAbot is an independent student project, not an official university
        platform. We provide a space for students to connect, but all
        transactions are made at your own risk. Transact safely and responsibly!
      </p>
    </div>
  );
}
