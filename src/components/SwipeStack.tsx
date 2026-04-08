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
    setDragProgress(0);
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
      <div className="flex-1 flex flex-col">
        <div className="relative flex-1 mx-4 my-2">
          <div className="absolute inset-0 rounded-xl shimmer" />
        </div>
        <div className="h-14" />
      </div>
    );
  }

  if (!currentImage) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm text-muted">No more images right now</p>
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
        {!showResult && (
          <SwipeCard
            key={currentImage.id}
            imageUrl={currentImage.url}
            isTop={true}
            onSwipe={handleSwipe}
            onDragProgress={setDragProgress}
          />
        )}

        {/* Overlay labels - only during active drag, not during exit animation */}
        {!showResult && !isSwiping && <SwipeOverlay progress={dragProgress} />}

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

      {/* Bottom safe area spacer on mobile */}
      <div className="h-2" />
    </div>
  );
}
