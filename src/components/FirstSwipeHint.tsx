"use client";

import { AnimatePresence } from "motion/react";
import { selectIsFirstVisit, useGameStore } from "@/stores/game-store";
import { CardPill } from "./CardPill";

export function FirstSwipeHint() {
  const isFirstVisit = useGameStore(selectIsFirstVisit);

  return (
    <AnimatePresence>
      {isFirstVisit && (
        <CardPill testId="swipe-hint">
          Swipe left if it&apos;s AI, right if it&apos;s real.
          <span className="hidden pointer-fine:inline"> Arrow keys work too.</span>
        </CardPill>
      )}
    </AnimatePresence>
  );
}
