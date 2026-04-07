"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HouseFill, BoxSeamFill } from "react-bootstrap-icons";
import NotificationsBell from "@/components/notifications-bell";

const staticItems = [
  { href: "/", label: "Home", Icon: HouseFill },
  { href: "/tracker", label: "Tracker", Icon: BoxSeamFill },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#3761B0] shadow-lg z-40">
      <div className="flex justify-around items-stretch gap-1 py-2 px-2 min-h-[68px]">
        {staticItems.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center justify-center gap-1 min-w-0 px-1 py-2"
            >
              <Icon
                size={24}
                className={`transition-colors ${active ? "text-white" : "text-white/60"}`}
              />
              <span
                className={`text-xs font-medium text-center leading-tight ${active ? "text-white" : "text-white/60"}`}
              >
                {label}
              </span>
            </Link>
          );
        })}

        {/* Notifications with realtime badge */}
        <div className="flex flex-1 flex-col items-center justify-center gap-1 min-w-0 px-1 py-2">
          <NotificationsBell
            asLink
            className={`w-6 h-6 transition-colors ${pathname === "/notifications" ? "text-white" : "text-white/60"}`}
          />
          <span
            className={`text-xs font-medium text-center leading-tight ${pathname === "/notifications" ? "text-white" : "text-white/60"}`}
          >
            Notifications
          </span>
        </div>
      </div>
    </nav>
  );
}
