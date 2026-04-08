"use client";

import { useEffect, useCallback, useRef } from "react";
import { useGameStore } from "@/stores/game-store";
import { PRELOAD_QUEUE_SIZE } from "@/lib/constants";
import type { GameImage, NextImageResponse } from "@/lib/types";

/**
 * Preloads the next N images into the game store queue.
 * Fetches from the API and pre-decodes the image in the browser cache.
 */
export function usePreloader() {
  const deviceId = useGameStore((s) => s.deviceId);
  const category = useGameStore((s) => s.selectedCategory);
  const preloadQueue = useGameStore((s) => s.preloadQueue);
  const addToQueue = useGameStore((s) => s.addToQueue);
  const setIsLoading = useGameStore((s) => s.setIsLoading);
  const fetching = useRef(false);

  const fetchNextImage = useCallback(async (): Promise<GameImage | null> => {
    if (!deviceId) return null;

    try {
      const res = await fetch(
        `/api/images/next?device_id=${encodeURIComponent(deviceId)}&category=${encodeURIComponent(category)}`
      );
      if (!res.ok) return null;

      const data: NextImageResponse = await res.json();

      // Pre-decode the image in browser cache
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = data.image.url;
      });

      return {
        id: data.image.id,
        url: data.image.url,
        width: data.image.width,
        height: data.image.height,
        category: data.image.category,
        shownAt: data.session.shown_at,
      };
    } catch {
      return null;
    }
  }, [deviceId, category]);

  const fillQueue = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;

    try {
      // Get current queue length from store
      let currentLength = useGameStore.getState().preloadQueue.length;

      while (currentLength < PRELOAD_QUEUE_SIZE) {
        const image = await fetchNextImage();
        if (!image) break;
        addToQueue(image);
        currentLength = useGameStore.getState().preloadQueue.length;
      }
    } finally {
      fetching.current = false;
      setIsLoading(false);
    }
  }, [fetchNextImage, addToQueue, setIsLoading]);

  // Fill queue on mount and when category changes
  useEffect(() => {
    if (deviceId) {
      setIsLoading(true);
      fillQueue();
    }
  }, [deviceId, category, fillQueue, setIsLoading]);

  // Refill after a swipe consumes an image
  const onImageConsumed = useCallback(
    (imageId: string) => {
      useGameStore.getState().removeFromQueue(imageId);
      fillQueue();
    },
    [fillQueue]
  );

  return {
    currentImage: preloadQueue[0] ?? null,
    nextImage: preloadQueue[1] ?? null,
    onImageConsumed,
    isLoading: preloadQueue.length === 0,
  };
}
