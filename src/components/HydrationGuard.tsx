"use client";

import { useEffect, useState } from "react";

/**
 * Prevents hydration mismatch for components that depend on
 * client-only state (localStorage, Zustand persisted store).
 *
 * Children are only rendered after the first client-side render,
 * ensuring localStorage values are available.
 */
export function HydrationGuard({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-800 rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
