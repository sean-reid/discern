"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

export function HydrationGuard({ children }: { children: React.ReactNode }) {
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!hydrated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-muted/30 border-t-muted rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
