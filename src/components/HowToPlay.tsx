"use client";

import { motion } from "motion/react";
import { useGameStore } from "@/stores/game-store";

export function HowToPlay() {
  const hasSeenOnboarding = useGameStore((s) => s.hasSeenOnboarding);
  const setHasSeenOnboarding = useGameStore((s) => s.setHasSeenOnboarding);

  if (hasSeenOnboarding) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      data-testid="onboarding-overlay"
    >
      <motion.div
        className="bg-white dark:bg-zinc-900 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
      >
        <h2 className="text-2xl font-bold mb-6">How to Play</h2>

        <div className="space-y-4 mb-8 text-left">
          <div>
            <p className="font-semibold text-red-500">Swipe Left</p>
            <p className="text-sm text-zinc-500">
              If you think it&apos;s fake
            </p>
          </div>

          <div>
            <p className="font-semibold text-emerald-500">Swipe Right</p>
            <p className="text-sm text-zinc-500">
              If you think it&apos;s real
            </p>
          </div>

          <div>
            <p className="font-semibold">It gets harder</p>
            <p className="text-sm text-zinc-500">
              The better you do, the trickier the photos
            </p>
          </div>
        </div>

        <button
          onClick={setHasSeenOnboarding}
          className="w-full py-3 px-6 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full font-semibold text-lg transition-transform active:scale-95"
          data-testid="onboarding-dismiss"
        >
          Let&apos;s go
        </button>
      </motion.div>
    </motion.div>
  );
}
