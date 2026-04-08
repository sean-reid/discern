"use client";

import Link from "next/link";

export function Header() {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
      <Link href="/" className="text-xl font-black tracking-tight">
        Discern
      </Link>
      <Link
        href="/stats"
        className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
      >
        Stats
      </Link>
    </header>
  );
}
