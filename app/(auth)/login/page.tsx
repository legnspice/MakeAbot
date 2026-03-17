import { googleLogin } from "./actions";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#3761B0] flex flex-col items-center justify-center px-6">
      {/* Logo / App name */}
      <div className="flex flex-col items-center gap-2 mb-10">
        <h1 className="text-white text-5xl font-black tracking-tight mt-3">MakeAbot</h1>
        <p className="text-blue-200 text-sm text-center max-w-xs">
          The campus marketplace for borrowing, lending, and getting things done.
        </p>
      </div>

      {/* Sign in card */}
        <form action={googleLogin}>
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-full py-3 px-4 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors shadow-sm"
          >
            {/* Google logo SVG */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 shrink-0">
              <path fill="#EA4335" d="M24 9.5c3.1 0 5.6 1.1 7.6 2.9l5.6-5.6C33.7 3.5 29.2 1.5 24 1.5 14.9 1.5 7.2 7.1 3.9 14.9l6.6 5.1C12.2 13.7 17.6 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.8-2.1 5.2-4.5 6.8l7 5.4c4.1-3.8 6.2-9.3 6.2-16.2z"/>
              <path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-6.6-5.1A23.5 23.5 0 0 0 .5 24c0 3.8.9 7.4 2.5 10.6l7.5-6z"/>
              <path fill="#34A853" d="M24 46.5c5.2 0 9.6-1.7 12.8-4.6l-7-5.4c-1.8 1.2-4 1.9-5.8 1.9-6.4 0-11.8-4.3-13.5-10l-7.5 6C7.2 40.9 14.9 46.5 24 46.5z"/>
            </svg>
            <span className="text-gray-700 font-semibold text-sm">Sign in with your Ateneo account </span>
          </button>
        </form>
    </div>
  );
}
