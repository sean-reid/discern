"use client";

import { HydrationGuard } from "@/components/HydrationGuard";
import { Header } from "@/components/Header";
import { useGameStore } from "@/stores/game-store";
import Link from "next/link";

function StatsContent() {
  const stats = useGameStore((s) => s.stats);
  const accuracyPct = Math.round(stats.accuracy * 100);

  return (
    <div className="flex flex-col min-h-[100dvh] bg-white dark:bg-zinc-950 mx-auto w-full max-w-lg">
      <Header />

      <div className="flex-1 px-6 py-8">
        <h1 className="text-2xl font-bold mb-8">Your Stats</h1>

        {/* Elo Rating - large */}
        <div className="text-center mb-8">
          <p className="text-sm text-zinc-500 uppercase tracking-wider mb-1">
            Rating
          </p>
          <p className="text-6xl font-black">{Math.round(stats.elo)}</p>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <StatCard label="Played" value={stats.totalPlayed.toString()} />
          <StatCard label="Correct" value={stats.totalCorrect.toString()} />
          <StatCard label="Accuracy" value={`${accuracyPct}%`} />
          <StatCard
            label="Best Streak"
            value={stats.bestStreak.toString()}
          />
        </div>

        {/* Current streak */}
        {stats.currentStreak > 0 && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center mb-8">
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              Current Streak
            </p>
            <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
              {stats.currentStreak}
            </p>
          </div>
        )}

        <Link
          href="/play"
          className="block w-full py-3 text-center bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full font-semibold transition-transform active:scale-95"
        >
          Keep Playing
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4 text-center">
      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

export default function StatsPage() {
  return (
    <HydrationGuard>
      <StatsContent />
    </HydrationGuard>
  );
}
