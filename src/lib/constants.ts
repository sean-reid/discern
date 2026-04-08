// ============================================================
// Discern: Game Constants
// ============================================================

// --- Elo System ---
export const ELO_DEFAULT = 1200;
export const ELO_K_USER = 32;
export const ELO_K_IMAGE = 16;
export const ELO_MIN = 400;
export const ELO_MAX = 2400;
export const ELO_MATCH_RANGE = 200;
export const ELO_PROVISIONAL_GAMES = 30;
export const ELO_K_USER_PROVISIONAL = 48;
export const ELO_DECAY = 0.005; // regression toward ELO_DEFAULT per game

// --- Swipe Mechanics ---
export const SWIPE_THRESHOLD_PX = 120;
export const SWIPE_VELOCITY_THRESHOLD = 500;
export const RESULT_FLASH_DURATION_MS = 150;

// --- Image Preloading ---
export const PRELOAD_QUEUE_SIZE = 5;
export const IMAGE_BASE_URL =
  process.env.NEXT_PUBLIC_IMAGE_BASE_URL || "/api/image-proxy";

// --- Anti-Cheat ---
export const MIN_RESPONSE_MS = 300;
export const MAX_RESPONSE_AGE_MS = 5 * 60 * 1000; // 5 minutes

// --- Categories ---
export const CATEGORIES = [
  { slug: "all", name: "All", icon: "🎯" },
  { slug: "people", name: "People", icon: "👤" },
  { slug: "landscapes", name: "Landscapes", icon: "🏔️" },
  { slug: "animals", name: "Animals", icon: "🐾" },
  { slug: "food", name: "Food", icon: "🍕" },
  { slug: "architecture", name: "Architecture", icon: "🏛️" },
  { slug: "art", name: "Art", icon: "🎨" },
  { slug: "street", name: "Street", icon: "🚶" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];
