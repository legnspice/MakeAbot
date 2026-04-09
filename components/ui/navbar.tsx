"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { PersonFill, QuestionCircleFill } from "react-bootstrap-icons";
import { useAuth } from "@/contexts/auth-context";
import { useTutorial } from "@/contexts/tutorial-context";
import NotificationsPanel from "@/components/ui/notifications-panel";
import NotificationsBell from "@/components/notifications-bell";

export default function Navbar() {
  const { userData } = useAuth();
  const meta = userData.supabaseUser.user_metadata ?? {};
  const avatarUrl = (meta.avatar_url ?? meta.picture ?? "") as string;
  const displayName = (userData.publicUser.name ??
    meta.full_name ??
    meta.name ??
    "Profile") as string;

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const chatContextId =
    pathname === "/chat" ? (searchParams.get("bidId") ?? undefined) : undefined;

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { openTutorial } = useTutorial();
  const loggedRef = useRef(false);

  useEffect(() => {
    if (loggedRef.current) return;
    loggedRef.current = true;
    console.log(
      `%c
 ███╗   ███╗  █████╗
 ████╗ ████║ ██╔══██╗
 ██╔████╔██║ ███████║
 ██║╚██╔╝██║ ██╔══██║
 ██║ ╚═╝ ██║ ██║  ██║
 ╚═╝     ╚═╝ ╚═╝  ╚═╝

 there's nothing to lend/borrow here, ${displayName.split(" ")[0]}
`,
      "color: #3761B0; font-weight: bold; font-size: 12px;"
    );
  }, [displayName]);

  return (
    <>
      <nav className="flex justify-between items-center px-5 py-3 bg-white border-b border-gray-100">
        <Link
          href="/"
          className="text-3xl sm:text-5xl font-black tracking-tight text-[#3761B0]"
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
          <Link
            href="/tracker"
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-[#3761B0] transition-colors"
          >
            Tracker
          </Link>
          <NotificationsBell onClick={() => setNotificationsOpen((v) => !v)} />
          <button
            type="button"
            onClick={openTutorial}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-[#3761B0] transition-colors"
            aria-label="Help"
          >
            <QuestionCircleFill size={16} />
            Help
          </button>
          <Link
            href="/profile"
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-[#3761B0] transition-colors"
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
        <div className="flex md:hidden gap-1 items-center">
          <button
            type="button"
            className="w-10 h-10 rounded-full hover:bg-gray-100 transition-colors flex items-center justify-center"
            onClick={openTutorial}
            aria-label="Help"
          >
            <QuestionCircleFill size={20} className="text-black" />
          </button>
          <Link
            href="/profile"
            className="w-10 h-10 rounded-full cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-center"
            aria-label="Profile"
          >
            <PersonFill size={20} className="text-black" />
          </Link>
        </div>
      </nav>

      <div className="hidden md:block">
        <NotificationsPanel
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          chatContextId={chatContextId}
        />
      </div>
    </>
  );
}
