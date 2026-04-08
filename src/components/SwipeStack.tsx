"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { SwipeCard, type SwipeCardHandle } from "./SwipeCard";
import { useGameStore } from "@/stores/game-store";
import { usePreloader } from "@/hooks/usePreloader";
import type { SwipeResponse } from "@/lib/types";

export function SwipeStack() {
  const deviceId = useGameStore((s) => s.deviceId);
  const updateStats = useGameStore((s) => s.updateStats);
  const [dragAbs, setDragAbs] = useState(0);
  const cardRef = useRef<SwipeCardHandle>(null);

  const swipeCounter = useRef(0);
  const lastAppliedCounter = useRef(0);
  const lastSwipedId = useRef<string | null>(null);

  const { currentImage, nextImage, onImageConsumed, isLoading } =
    usePreloader();

  const submitSwipe = useCallback(
    (direction: "left" | "right") => {
      if (!currentImage || !deviceId) return;
      if (currentImage.id === lastSwipedId.current) return;
      lastSwipedId.current = currentImage.id;

      const thisSwipe = ++swipeCounter.current;
      const imageId = currentImage.id;
      const responseMs = Date.now() - currentImage.shownAt;
      const shownAt = currentImage.shownAt;
      const guessedAi = direction === "left";

      setTimeout(() => {
        onImageConsumed(imageId);
        setDragAbs(0);
      }, 150);

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
          if (thisSwipe < lastAppliedCounter.current) return;
          lastAppliedCounter.current = thisSwipe;

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
        .catch(() => {});
    },
    [currentImage, deviceId, updateStats, onImageConsumed]
  );

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

  return (
    <div className="flex-1 flex flex-col">
      <div
        className="relative flex-1 mx-4 my-2 rounded-xl"
        data-testid="swipe-card"
      >
        {nextImage && (
          <SwipeCard
            imageUrl={nextImage.url}
            isTop={false}
            onSwipe={() => {}}
            overlayOpacity={1 - Math.pow(Math.max(0, dragAbs - 0.4) / 0.6, 2)}
          />
        )}

        <SwipeCard
          ref={cardRef}
          key={currentImage.id}
          imageUrl={currentImage.url}
          isTop={true}
          onSwipe={submitSwipe}
          onDragProgress={setDragAbs}
        />
      </div>

      <div className="h-2" />
    </div>
  );
}
