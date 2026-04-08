"use client";

import Link from "next/link";

export function Header() {
  return (
    <header className="flex items-center justify-between px-5 pt-3 pb-1">
      <Link href="/" className="text-base font-semibold tracking-tight text-fg/80">
        discern
      </Link>
      <Link
        href="/about"
        className="text-xs text-muted hover:text-fg transition-colors"
      >
        about
      </Link>
    </header>
  );
}
