// ============================================================
// Discern: Shared TypeScript Types
// ============================================================

// --- Database Row Types ---

export interface CategoryRow {
  id: number;
  slug: string;
  name: string;
  icon: string | null;
  active: number; // 0 or 1
  created_at: string;
}

export interface ImageRow {
  id: string;
  r2_key: string;
  is_ai: number; // 0=real, 1=AI
  category_id: number;
  source: string;
  source_id: string | null;
  source_url: string | null;
  photographer: string | null;
  ai_model: string | null;
  ai_prompt: string | null;
  phash: string | null;
  width: number;
  height: number;
  file_size_bytes: number;
  exif_confidence: number;
  nsfw_score: number;
  elo_rating: number;
  times_shown: number;
  times_correct: number;
  times_fooled: number;
  status: "pending" | "approved" | "rejected" | "retired";
  retired_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRow {
  id: string;
  device_id: string | null;
  display_name: string | null;
  email: string | null;
  elo_rating: number;
  total_played: number;
  total_correct: number;
  current_streak: number;
  best_streak: number;
  preferred_categories: string | null;
  created_at: string;
  updated_at: string;
  last_active_at: string;
}

export interface AnswerRow {
  id: string;
  user_id: string;
  image_id: string;
  guessed_ai: number;
  correct: number;
  response_ms: number;
  user_elo_before: number;
  user_elo_after: number;
  image_elo_before: number;
  image_elo_after: number;
  created_at: string;
}

// --- API Types ---

export interface ImageForClient {
  id: string;
  url: string;
  width: number;
  height: number;
  category: string;
}

export interface NextImageResponse {
  image: ImageForClient;
  session: {
    shown_at: number;
  };
}

export interface SwipeRequest {
  device_id: string;
  image_id: string;
  guessed_ai: boolean;
  response_ms: number;
  shown_at: number;
}

export interface SwipeResponse {
  correct: boolean;
  is_ai: boolean;
  user: {
    elo_rating: number;
    elo_delta: number;
    total_played: number;
    total_correct: number;
    current_streak: number;
    best_streak: number;
    accuracy: number;
  };
  image: {
    elo_rating: number;
    times_shown: number;
    fool_rate: number;
  };
}

export interface UserStatsResponse {
  elo_rating: number;
  total_played: number;
  total_correct: number;
  accuracy: number;
  current_streak: number;
  best_streak: number;
  category_breakdown: Record<
    string,
    { played: number; correct: number; accuracy: number }
  >;
}

// --- Game Store Types ---

export interface GameImage {
  id: string;
  url: string;
  width: number;
  height: number;
  category: string;
  shownAt: number;
}

export interface UserStats {
  elo: number;
  eloDelta: number | null;
  totalPlayed: number;
  totalCorrect: number;
  currentStreak: number;
  bestStreak: number;
  accuracy: number;
}
