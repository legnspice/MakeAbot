import { googleLogin } from "./actions";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#FFFFFF] flex flex-col items-center justify-center px-6">
      {/* Logo / App name */}
      <div className="flex flex-col items-center gap-2 mb-5">
        <h1 className="text-blue text-6xl md:text-7xl font-black tracking-tight mt-3">MakeAbot</h1>
        <p className="text-[#3761B0] text-sm text-center max-w-xs">
          The campus marketplace for borrowing, lending, and getting things done.
        </p>
      </div>

      {/* Sign in card */}

        <form action={googleLogin}>
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 rounded-xl py-3 px-4 bg-[#3761B0] shadow-sm"
          >
            <span className="text-white font-semibold text-sm">  Login in with your Ateneo account</span>
          </button>
        </form>
    </div>
  );
}
