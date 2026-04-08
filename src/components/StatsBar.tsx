"use client";

import { motion, AnimatePresence } from "motion/react";
import { useGameStore } from "@/stores/game-store";
import type { UserStats } from "@/lib/types";

interface StatsBarProps {
  stats: UserStats;
}

export function StatsBar({ stats }: StatsBarProps) {
  const updateStats = useGameStore((s) => s.updateStats);
  const accuracyPct = Math.round(stats.accuracy * 100);

  return (
    <div className="flex items-center justify-center gap-6 px-5 py-2">
      <Stat label="elo" value={Math.round(stats.elo)} testId="elo-rating">
        <AnimatePresence mode="wait">
          {stats.eloDelta !== null && stats.eloDelta !== 0 && (
            <motion.span
              key={stats.eloDelta}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onAnimationComplete={() => updateStats({ eloDelta: null })}
              className={`text-[10px] font-medium ml-1 ${
                stats.eloDelta > 0 ? "text-green" : "text-red"
              }`}
            >
              {stats.eloDelta > 0 ? "+" : ""}
              {Math.round(stats.eloDelta)}
            </motion.span>
          )}
        </AnimatePresence>
      </Stat>
      <Stat label="streak" value={stats.currentStreak} testId="streak" />
      <Stat label="acc" value={`${accuracyPct}%`} />
      <Stat label="played" value={stats.totalPlayed} testId="total-played" />
    </div>
  );
}

function Stat({
  label,
  value,
  testId,
  children,
}: {
  label: string;
  value: string | number;
  testId?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[10px] text-muted uppercase tracking-widest">
        {label}
      </span>
      <div className="flex items-baseline">
        <span className="text-sm font-semibold text-fg" data-testid={testId}>
          {value}
        </span>
        {children}
      </div>
    </div>
  );
}
