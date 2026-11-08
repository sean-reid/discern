"use client";

import { AnimatePresence } from "motion/react";
import { useGameStore } from "@/stores/game-store";
import { CardPill } from "./CardPill";

export function FirstSwipeHint() {
  const hasSeenOnboarding = useGameStore((s) => s.hasSeenOnboarding);

  return (
    <AnimatePresence>
      {!hasSeenOnboarding && (
        <CardPill testId="swipe-hint">
          Swipe left if it&apos;s AI, right if it&apos;s real.
          <span className="hidden pointer-fine:inline"> Arrow keys work too.</span>
        </CardPill>
      )}
    </AnimatePresence>
  );
}
