import Image from "next/image";
import { Facebook, EnvelopeFill } from "react-bootstrap-icons";

export function AppFooter() {
  return (
    <footer className="bg-[#1e2d4d] text-white px-9 pt-8 pb-[calc(68px+2rem)] md:pb-8 mt-auto">
      <div className="flex flex-col md:flex-row md:justify-between gap-8">
      {/* Left: logo + wordmark + disclaimer */}
      <div className="flex flex-col gap-3 max-w-sm">
        <div className="flex items-center gap-2">
          <Image src="/logo.svg" alt="MakeAbot logo" width={28} height={25} />
          <span className="font-black text-lg tracking-tight">MakeAbot</span>
        </div>
        <p className="text-xs text-white/70 leading-relaxed">
          MakeAbot is an independent student project, not an official university
          platform. We provide a space for students to connect, but all
          transactions are made at your own risk. The creators are not liable
          for any damages, scams, losses, or disputes that arise from using this
          app. Transact safely and responsibly!
        </p>
      </div>

      {/* Right: contacts */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Contact Us</h3>
        <a
          href="https://www.facebook.com/people/MakeAbot/61575401159655/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-white/70 hover:text-[#3761B0] transition-colors"
        >
          <Facebook className="shrink-0" size={16} />
          MakeAbot on Facebook
        </a>
        <a
          href="mailto:niles.tristan.cabrera@student.ateneo.edu"
          className="flex items-center gap-2 text-xs text-white/70 hover:text-[#3761B0] transition-colors"
        >
          <EnvelopeFill className="shrink-0" size={16} />
          niles.tristan.cabrera@student.ateneo.edu
        </a>
      </div>
      </div>
    </footer>
  );
}
