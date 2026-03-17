import Link from "next/link";

export default function NonAteneoEmailPage() {
  return (
    <div className="min-h-screen bg-[#3761B0] flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-2 mb-10">
        <div className="w-20 h-20 rounded-full bg-[#E5A550] flex items-center justify-center shadow-lg">
          <span className="text-white text-4xl font-black">M</span>
        </div>
        <h1 className="text-white text-3xl font-black tracking-tight mt-3">MakeAbot</h1>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-4 text-center">
        <div className="text-4xl">🚫</div>
        <h2 className="text-gray-900 font-bold text-lg">Ateneo account required</h2>
        <p className="text-gray-500 text-sm">
          Only <span className="font-semibold text-gray-700">@student.ateneo.edu</span> accounts
          are allowed to use MakeAbot. Please sign in with your Ateneo Google account.
        </p>
        <Link
          href="/auth/login"
          className="w-full flex items-center justify-center rounded-full py-3 px-4 bg-[#3761B0] hover:bg-[#2d4f99] text-white font-semibold text-sm transition-colors"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}
