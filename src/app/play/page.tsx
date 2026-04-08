"use client";

import { HydrationGuard } from "@/components/HydrationGuard";
import { Header } from "@/components/Header";
import { StatsBar } from "@/components/StatsBar";
import { SwipeStack } from "@/components/SwipeStack";
import { useGameStore } from "@/stores/game-store";
import { useDeviceId } from "@/hooks/useDeviceId";

function PlayContent() {
  useDeviceId();
  const stats = useGameStore((s) => s.stats);

  return (
    <div className="flex flex-col h-[100dvh] bg-white dark:bg-zinc-950 mx-auto w-full max-w-lg">
      <Header />
      <StatsBar stats={stats} />
      <SwipeStack />
    </div>
  );
}

export default function PlayPage() {
  return (
    <HydrationGuard>
      <PlayContent />
    </HydrationGuard>
  );
}
