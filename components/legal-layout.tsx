import Image from "next/image";
import Link from "next/link";

export function LegalLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-gray-200 px-4 py-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[#3761B0] hover:underline"
        >
          <Image src="/logo.svg" alt="MakeAbot" width={24} height={22} />
          <span className="font-semibold">← Back to MakeAbot</span>
        </Link>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-5 py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{title}</h1>
        <p className="mt-1 text-xs text-gray-400">Last updated: {lastUpdated}</p>

        <div
          className="mt-6 flex flex-col gap-6 text-sm leading-relaxed text-gray-700
            [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:mb-1
            [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1
            [&_a]:text-[#3761B0] [&_a]:hover:underline"
        >
          {children}
        </div>
      </main>
    </div>
  );
}
