import Link from "next/link";

export default function NonAteneoEmailPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-2 mb-10">
        <h1 className="text-[#3761B0] text-5xl font-black tracking-tight mt-3">MakeAbot</h1>
      </div>

      <div className="w-full max-w-sm bg-[#3761B0] rounded-2xl shadow-xl p-8 flex flex-col gap-4 text-center">
        <h2 className="text-white font-bold text-lg">Ateneo account required</h2>
        <p className="text-white text-sm">
          Only <span className="font-bold text-white">@student.ateneo.edu</span> accounts
          are allowed to use MakeAbot. Please sign in with your Ateneo Google account.
        </p>
        <Link
          href="/auth/login"
          className="w-full flex items-center justify-center rounded-full py-3 px-4 bg-[#E5A550] text-gray-900 font-semibold text-sm transition-colors"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}
