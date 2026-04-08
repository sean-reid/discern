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
  const [dragAbs, setDragAbs] = useState(0);
  const cardRef = useRef<SwipeCardHandle>(null);

  // Monotonic counter — ensures stale API responses don't regress stats
  const swipeCounter = useRef(0);
  const lastAppliedCounter = useRef(0);

  const { currentImage, nextImage, onImageConsumed, isLoading } =
    usePreloader();

  // Non-blocking API submission — fires immediately on swipe commit
  const submitSwipe = useCallback(
    (direction: "left" | "right") => {
      if (!currentImage || !deviceId) return;

      const thisSwipe = ++swipeCounter.current;
      const imageId = currentImage.id;
      const responseMs = Date.now() - currentImage.shownAt;
      const shownAt = currentImage.shownAt;
      const guessedAi = direction === "left";

      // Advance queue immediately — next card becomes interactive
      onImageConsumed(imageId);
      setDragAbs(0);

      // Fire API call async — don't block
      fetch("/api/swipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: deviceId,
          image_id: imageId,
          guessed_ai: guessedAi,
          response_ms: responseMs,
          shown_at: shownAt,
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: SwipeResponse | null) => {
          if (!data) return;

          // Only apply if this is the latest or newest response
          if (thisSwipe < lastAppliedCounter.current) return;
          lastAppliedCounter.current = thisSwipe;

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
        })
        .catch(() => {
          // Network error — silently skip
        });
    },
    [currentImage, deviceId, updateStats, onImageConsumed]
  );

  // Auto-clear result glow
  useEffect(() => {
    if (!showResult) return;
    const timer = setTimeout(() => setShowResult(null), RESULT_FLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [showResult]);

  // Keyboard controls
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!currentImage || !deviceId) return;

      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        setDragAbs(1);
        cardRef.current?.flyOut("left");
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        setDragAbs(1);
        cardRef.current?.flyOut("right");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentImage, deviceId]);

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
        {/* Result glow — non-blocking, fades independently */}
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
              transition={{ duration: 0.2 }}
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

        {/* Current card — always interactive, not gated by showResult */}
        <SwipeCard
          ref={cardRef}
          key={currentImage.id}
          imageUrl={currentImage.url}
          isTop={true}
          onSwipe={submitSwipe}
          onDragProgress={setDragAbs}
        />
      </div>

      {/* Bottom safe area spacer on mobile */}
      <div className="h-2" />
    </div>
  );
}
