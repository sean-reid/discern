"use client";

import { motion, AnimatePresence } from "motion/react";
import type { UserStats } from "@/lib/types";

interface StatsBarProps {
  stats: UserStats;
}

export function StatsBar({ stats }: StatsBarProps) {
  const accuracyPct = Math.round(stats.accuracy * 100);

  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      {/* Elo Rating */}
      <div className="flex flex-col items-center">
        <span className="text-xs text-zinc-500 uppercase tracking-wider">
          Rating
        </span>
        <div className="flex items-center gap-1">
          <span className="text-lg font-bold" data-testid="elo-rating">
            {Math.round(stats.elo)}
          </span>
          <AnimatePresence mode="wait">
            {stats.eloDelta !== null && stats.eloDelta !== 0 && (
              <motion.span
                key={stats.eloDelta}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`text-xs font-medium ${
                  stats.eloDelta > 0 ? "text-emerald-500" : "text-red-500"
                }`}
              >
                {stats.eloDelta > 0 ? "+" : ""}
                {Math.round(stats.eloDelta)}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Streak */}
      <div className="flex flex-col items-center">
        <span className="text-xs text-zinc-500 uppercase tracking-wider">
          Streak
        </span>
        <span className="text-lg font-bold" data-testid="streak">
          {stats.currentStreak}
        </span>
      </div>

      {/* Accuracy */}
      <div className="flex flex-col items-center">
        <span className="text-xs text-zinc-500 uppercase tracking-wider">
          Accuracy
        </span>
        <span className="text-lg font-bold">{accuracyPct}%</span>
      </div>

      {/* Total Played */}
      <div className="flex flex-col items-center">
        <span className="text-xs text-zinc-500 uppercase tracking-wider">
          Played
        </span>
        <span className="text-lg font-bold" data-testid="total-played">
          {stats.totalPlayed}
        </span>
      </div>
    </div>
  );
}
