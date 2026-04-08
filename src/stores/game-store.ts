"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { GameImage, UserStats } from "@/lib/types";

interface GameState {
  // Device identity
  deviceId: string | null;
  setDeviceId: (id: string) => void;

  // User stats (mirrors server state)
  stats: UserStats;
  updateStats: (stats: Partial<UserStats>) => void;

  // Category filter
  selectedCategory: string;
  setCategory: (cat: string) => void;

  // Image queue (managed by preloader)
  preloadQueue: GameImage[];
  addToQueue: (image: GameImage) => void;
  removeFromQueue: (imageId: string) => void;
  clearQueue: () => void;

  // Last result flash
  lastResult: { correct: boolean; isAi: boolean } | null;
  setLastResult: (result: { correct: boolean; isAi: boolean } | null) => void;

  // UI flags
  hasSeenOnboarding: boolean;
  setHasSeenOnboarding: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      deviceId: null,
      setDeviceId: (id) => set({ deviceId: id }),

      stats: {
        elo: 1200,
        eloDelta: null,
        totalPlayed: 0,
        totalCorrect: 0,
        currentStreak: 0,
        bestStreak: 0,
        accuracy: 0,
      },
      updateStats: (newStats) =>
        set((state) => ({ stats: { ...state.stats, ...newStats } })),

      selectedCategory: "all",
      setCategory: (cat) => set({ selectedCategory: cat, preloadQueue: [] }),

      preloadQueue: [],
      addToQueue: (image) =>
        set((state) => ({
          preloadQueue: [...state.preloadQueue, image],
        })),
      removeFromQueue: (imageId) =>
        set((state) => ({
          preloadQueue: state.preloadQueue.filter((img) => img.id !== imageId),
        })),
      clearQueue: () => set({ preloadQueue: [] }),

      lastResult: null,
      setLastResult: (result) => set({ lastResult: result }),

      hasSeenOnboarding: false,
      setHasSeenOnboarding: () => set({ hasSeenOnboarding: true }),
      isLoading: true,
      setIsLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: "discern-game",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        deviceId: state.deviceId,
        stats: state.stats,
        selectedCategory: state.selectedCategory,
        hasSeenOnboarding: state.hasSeenOnboarding,
      }),
    }
  )
);
