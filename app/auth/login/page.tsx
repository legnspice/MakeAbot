import Image from "next/image";
import { googleLogin } from "./actions";

export default function LoginPage() {
  return (
    <div className="relative min-h-screen bg-white md:bg-[#d9eafe] flex items-center justify-center overflow-hidden px-6">
      {/* Texture overlay (desktop only) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden md:block opacity-[0.03] bg-size-[1024px_1024px] bg-top-left"
        style={{ backgroundImage: "url('/login-noise.png')" }}
      />

      {/* Card: bare on mobile, white card on desktop */}
      <div className="relative z-10 flex w-full max-w-md flex-col items-center justify-center md:h-172.25 md:w-124 md:max-w-none md:rounded-3xl md:bg-white md:px-10 md:py-12 md:shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]">
        <Image
          src="/ma-monogram.svg"
          alt="MakeAbot monogram"
          width={126}
          height={75}
          priority
          className="h-15 w-25 md:h-18.75 md:w-31.5"
        />
        <h1 className="mt-4 text-4xl font-bold leading-none text-black md:mt-4.5 md:text-[52px]">
          MakeAbot
        </h1>
        <p className="mt-2.5 w-67.75 text-center text-sm font-medium italic text-blue-500 md:text-base">
          A lending service by the community, for the community
        </p>
        <form action={googleLogin} className="mt-8 w-full max-w-xs md:mt-10 md:w-auto md:max-w-none">
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-blue-500 text-sm font-semibold text-white transition-colors hover:bg-blue-600 md:h-12.5 md:w-87.5 md:text-base"
          >
            Login with your Ateneo Account
          </button>
        </form>
        <p className="mt-8 w-72 text-center text-sm font-semibold text-blue-500 md:mt-10 md:text-base">
          Trivia: Over 100 items have been shared in the MakeAbot community.
        </p>
      </div>
    </div>
  );
}
