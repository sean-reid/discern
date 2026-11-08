"use client";

import { useEffect } from "react";
import { AnimatePresence } from "motion/react";
import { useGameStore } from "@/stores/game-store";
import { RESULT_PILL_DURATION_MS } from "@/lib/constants";
import { CardPill } from "./CardPill";

export function ResultPill() {
  const result = useGameStore((s) => s.lastResult);
  const setLastResult = useGameStore((s) => s.setLastResult);

  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setLastResult(null), RESULT_PILL_DURATION_MS);
    return () => clearTimeout(timer);
  }, [result, setLastResult]);

  return (
    <AnimatePresence>
      {result && (
        <CardPill
          key={result.key}
          testId="result-flash"
          tone={result.correct ? "green" : "red"}
        >
          {result.caption}
          {result.detail && (
            <span className="block text-xs font-normal text-fg/70">
              {result.detail}
            </span>
          )}
        </CardPill>
      )}
    </AnimatePresence>
  );
}
