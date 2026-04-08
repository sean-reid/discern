"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SwipeCard, type SwipeCardHandle } from "./SwipeCard";
import { useGameStore } from "@/stores/game-store";
import { usePreloader } from "@/hooks/usePreloader";
import { RESULT_FLASH_DURATION_MS } from "@/lib/constants";
import type { SwipeResponse } from "@/lib/types";

export function SwipeStack() {
  const deviceId = useGameStore((s) => s.deviceId);
  const updateStats = useGameStore((s) => s.updateStats);
  const [showResult, setShowResult] = useState<{
    correct: boolean;
    isAi: boolean;
  } | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const [dragAbs, setDragAbs] = useState(0);
  const cardRef = useRef<SwipeCardHandle>(null);

  const { currentImage, nextImage, onImageConsumed, isLoading } =
    usePreloader();

  // API submission — called after card exit animation
  const submitSwipe = useCallback(
    async (direction: "left" | "right") => {
      if (!currentImage || !deviceId) return;

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
        // Network error — skip result, move to next image
        onImageConsumed(currentImage.id);
        setIsSwiping(false);
      }
    },
    [currentImage, deviceId, updateStats, onImageConsumed]
  );

  // Initiate swipe — guards then triggers card fly-out animation
  const initiateSwipe = useCallback(
    (direction: "left" | "right") => {
      if (!currentImage || !deviceId || isSwiping || showResult) return;
      setIsSwiping(true);
      setDragAbs(1);
      cardRef.current?.flyOut(direction);
    },
    [currentImage, deviceId, isSwiping, showResult]
  );

  const handleResultComplete = useCallback(() => {
    if (currentImage) {
      onImageConsumed(currentImage.id);
    }
    setShowResult(null);
    setIsSwiping(false);
    setDragAbs(0);
  }, [currentImage, onImageConsumed]);

  // Auto-advance after result glow
  useEffect(() => {
    if (!showResult) return;
    const timer = setTimeout(handleResultComplete, RESULT_FLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [showResult, handleResultComplete]);

  // Keyboard controls
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        initiateSwipe("left");
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        initiateSwipe("right");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [initiateSwipe]);

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

  const resultColor = showResult?.correct ? "52,211,153" : "248,113,113";

  return (
    <div className="flex-1 flex flex-col">
      {/* Card area */}
      <div
        className="relative flex-1 mx-4 my-2 rounded-xl"
        data-testid="swipe-card"
      >
        {/* Result glow — single clean pulse, green=correct, red=wrong */}
        <AnimatePresence>
          {showResult && (
            <motion.div
              data-testid="result-flash"
              className="absolute inset-0 rounded-xl pointer-events-none z-30"
              style={{
                boxShadow: `0 0 4px rgba(${resultColor}, 0.9), 0 0 30px rgba(${resultColor}, 0.5), 0 0 60px rgba(${resultColor}, 0.3), inset 0 0 40px rgba(${resultColor}, 0.15)`,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            />
          )}
        </AnimatePresence>

        {/* Next card (behind) */}
        {nextImage && (
          <SwipeCard
            imageUrl={nextImage.url}
            isTop={false}
            onSwipe={() => {}}
            overlayOpacity={1 - Math.pow(Math.max(0, dragAbs - 0.4) / 0.6, 2)}
          />
        )}

        {/* Current card (interactive) */}
        {!showResult && (
          <SwipeCard
            ref={cardRef}
            key={currentImage.id}
            imageUrl={currentImage.url}
            isTop={true}
            onSwipe={submitSwipe}
            onDragProgress={setDragAbs}
          />
        )}
      </div>

      {/* Bottom safe area spacer on mobile */}
      <div className="h-2" />
    </div>
  );
}
