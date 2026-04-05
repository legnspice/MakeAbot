"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { User, Search, HelpCircle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useTutorial } from "@/contexts/tutorial-context";
import NotificationsPanel from "@/components/ui/notifications-panel";

type NavbarProps = {
  onSearchToggle?: () => void;
  searchOpen?: boolean;
};

export default function Navbar({ onSearchToggle, searchOpen }: NavbarProps) {
  const { userData } = useAuth();
  const meta = userData.supabaseUser.user_metadata ?? {};
  const avatarUrl = (meta.avatar_url ?? meta.picture ?? "") as string;
  const displayName = (userData.publicUser.name ??
    meta.full_name ??
    meta.name ??
    "Profile") as string;

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { openTutorial } = useTutorial();

  return (
    <>
      <nav className="flex justify-between items-center px-5 py-3 bg-white border-b border-gray-100">
        <Link
          href="/"
          className="text-4xl sm:text-5xl font-black tracking-tight text-[#3761B0]"
        >
          MakeAbot
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-[#3761B0] transition-colors"
          >
            Home
          </Link>
          <button
            type="button"
            onClick={() => setNotificationsOpen((v) => !v)}
            className={`flex items-center gap-2 text-sm font-medium transition-colors ${notificationsOpen ? "text-[#3761B0]" : "text-gray-700 hover:text-[#3761B0]"}`}
          >
            Notifications
          </button>
          <Link
            href="/tracker"
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-[#3761B0] transition-colors"
          >
            Tracker
          </Link>
          <button
            type="button"
            onClick={openTutorial}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-[#3761B0] transition-colors"
            aria-label="Help"
          >
            <HelpCircle className="w-4 h-4" strokeWidth={2.5} />
            Help
          </button>
          <Link
            href="/profile"
            className="flex items-center ml-5 gap-2 text-sm font-medium text-gray-700 hover:text-[#3761B0] transition-colors"
          >
            {/* {displayName} */}
            <div className="relative w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt="Profile"
                  fill
                  className="object-cover"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs font-medium uppercase">
                  {displayName.charAt(0)}
                </span>
              )}
            </div>
            Profile
          </Link>
        </div>

        {/* Mobile icon buttons */}
        <div className="flex md:hidden gap-5 items-center">
          <button
            type="button"
            className={`w-12 h-12 rounded-full transition-colors flex items-center justify-center ${searchOpen ? "bg-gray-100" : "hover:bg-gray-100"}`}
            onClick={onSearchToggle}
            aria-label="Search"
          >
            <Search className="w-5 h-5 text-black" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            className="w-12 h-12 rounded-full hover:bg-gray-100 transition-colors flex items-center justify-center"
            onClick={openTutorial}
            aria-label="Help"
          >
            <HelpCircle className="w-5 h-5 text-black" strokeWidth={2.5} />
          </button>
          <Link
            href="/profile"
            className="w-12 h-12 rounded-full cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-center"
            aria-label="Profile"
          >
            <User className="w-5 h-5 text-black" strokeWidth={2.5} />
          </Link>
        </div>
      </nav>

      <div className="hidden md:block">
        <NotificationsPanel
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
        />
      </div>
    </>
  );
}
