"use client";

import { motion } from "motion/react";
import { HydrationGuard } from "@/components/HydrationGuard";
import { Header } from "@/components/Header";
import { useGameStore } from "@/stores/game-store";
import Link from "next/link";

function StatsContent() {
  const stats = useGameStore((s) => s.stats);
  const accuracyPct = Math.round(stats.accuracy * 100);

  return (
    <div className="flex flex-col min-h-[100dvh] mx-auto w-full max-w-lg">
      <Header />

      <div className="flex-1 px-5 py-6">
        {/* Elo */}
        <div className="text-center mb-8">
          <p className="text-[10px] text-muted uppercase tracking-widest mb-1">
            rating
          </p>
          <p className="text-5xl font-black tabular-nums">{Math.round(stats.elo)}</p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <StatCard label="played" value={stats.totalPlayed} delay={0} />
          <StatCard label="correct" value={stats.totalCorrect} delay={0.05} />
          <StatCard label="accuracy" value={`${accuracyPct}%`} delay={0.1} />
          <StatCard label="best streak" value={stats.bestStreak} delay={0.15} />
        </div>

        {/* Streak */}
        {stats.currentStreak > 0 && (
          <motion.div
            className="rounded-xl border border-green/20 bg-green/5 p-4 text-center mb-8"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-[10px] text-green/70 uppercase tracking-widest">
              current streak
            </p>
            <p className="text-3xl font-bold text-green tabular-nums">
              {stats.currentStreak}
            </p>
          </motion.div>
        )}

        <Link
          href="/play"
          className="block w-full py-3 text-center bg-fg text-bg rounded-lg font-semibold text-sm transition-transform active:scale-[0.98]"
        >
          Keep playing
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  delay,
}: {
  label: string;
  value: string | number;
  delay: number;
}) {
  return (
    <motion.div
      className="rounded-xl border border-card-border bg-card p-4 text-center"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <p className="text-[10px] text-muted uppercase tracking-widest mb-1">
        {label}
      </p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </motion.div>
  );
}

export default function StatsPage() {
  return (
    <HydrationGuard>
      <StatsContent />
    </HydrationGuard>
  );
}
