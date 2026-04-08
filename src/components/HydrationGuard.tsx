"use client";

import { useEffect, useState } from "react";

export function HydrationGuard({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-muted/30 border-t-muted rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
