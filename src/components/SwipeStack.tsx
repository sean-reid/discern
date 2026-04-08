"use client";

import { useState, useCallback, useEffect } from "react";
import { AnimatePresence } from "motion/react";
import { SwipeCard } from "./SwipeCard";
import { SwipeOverlay } from "./SwipeOverlay";
import { ResultFlash } from "./ResultFlash";
import { useGameStore } from "@/stores/game-store";
import { usePreloader } from "@/hooks/usePreloader";
import type { SwipeResponse } from "@/lib/types";

export function SwipeStack() {
  const deviceId = useGameStore((s) => s.deviceId);
  const updateStats = useGameStore((s) => s.updateStats);
  const [dragProgress, setDragProgress] = useState(0);
  const [showResult, setShowResult] = useState<{
    correct: boolean;
    isAi: boolean;
  } | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);

  const { currentImage, nextImage, onImageConsumed, isLoading } =
    usePreloader();

  const handleSwipe = useCallback(
    async (direction: "left" | "right") => {
      if (!currentImage || !deviceId || isSwiping) return;
      setIsSwiping(true);
      setDragProgress(0);

      const guessedAi = direction === "left";

      try {
        const res = await fetch("/api/swipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_id: deviceId,
            image_id: currentImage.id,
            guessed_ai: guessedAi,
            response_ms: Date.now() - currentImage.shownAt,
            shown_at: currentImage.shownAt,
          }),
        });

        if (res.ok) {
          const data: SwipeResponse = await res.json();
          setShowResult({ correct: data.correct, isAi: data.is_ai });
          updateStats({
            elo: data.user.elo_rating,
            eloDelta: data.user.elo_delta,
            totalPlayed: data.user.total_played,
            totalCorrect: data.user.total_correct,
            currentStreak: data.user.current_streak,
            bestStreak: data.user.best_streak,
            accuracy: data.user.accuracy,
          });
        }
      } catch {
        // Network error — skip result flash, move to next image
        onImageConsumed(currentImage.id);
        setIsSwiping(false);
      }
    },
    [currentImage, deviceId, isSwiping, updateStats, onImageConsumed]
  );

  const handleResultComplete = useCallback(() => {
    if (currentImage) {
      onImageConsumed(currentImage.id);
    }
    setShowResult(null);
    setIsSwiping(false);
  }, [currentImage, onImageConsumed]);

  // Keyboard controls
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (showResult || isSwiping) return;

      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        handleSwipe("left");
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        handleSwipe("right");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSwipe, showResult, isSwiping]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-zinc-200 border-t-zinc-800 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Loading images...</p>
        </div>
      </div>
    );
  }

  if (!currentImage) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-xl font-semibold mb-2">No more images!</p>
          <p className="text-zinc-500">
            We&apos;re adding more. Check back soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Card area */}
      <div
        className="relative flex-1 mx-4 my-2"
        data-testid="swipe-card"
      >
        {/* Next card (behind) */}
        {nextImage && (
          <SwipeCard
            imageUrl={nextImage.url}
            isTop={false}
            onSwipe={() => {}}
            onDragProgress={() => {}}
          />
        )}

        {/* Current card (interactive) */}
        <AnimatePresence mode="wait">
          {!showResult && (
            <SwipeCard
              key={currentImage.id}
              imageUrl={currentImage.url}
              isTop={true}
              onSwipe={handleSwipe}
              onDragProgress={setDragProgress}
            />
          )}
        </AnimatePresence>

        {/* Overlay labels */}
        {!showResult && <SwipeOverlay progress={dragProgress} />}

        {/* Result flash */}
        <AnimatePresence>
          {showResult && (
            <ResultFlash
              correct={showResult.correct}
              isAi={showResult.isAi}
              onComplete={handleResultComplete}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Button fallback for desktop/accessibility */}
      <div className="flex gap-4 justify-center px-4 pb-4">
        <button
          onClick={() => handleSwipe("left")}
          disabled={isSwiping || !!showResult}
          className="flex-1 max-w-[160px] py-3 rounded-full bg-red-100 text-red-600 font-bold text-lg transition-all active:scale-95 disabled:opacity-50 dark:bg-red-900/30 dark:text-red-400"
          aria-label="This is AI-generated"
        >
          AI
        </button>
        <button
          onClick={() => handleSwipe("right")}
          disabled={isSwiping || !!showResult}
          className="flex-1 max-w-[160px] py-3 rounded-full bg-emerald-100 text-emerald-600 font-bold text-lg transition-all active:scale-95 disabled:opacity-50 dark:bg-emerald-900/30 dark:text-emerald-400"
          aria-label="This is a real photo"
        >
          REAL
        </button>
      </div>
    </div>
  );
}
