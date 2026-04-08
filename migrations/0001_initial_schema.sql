-- ============================================================
-- DISCERN: Complete Database Schema
-- D1/SQLite — deployed via `wrangler d1 execute`
-- ============================================================

PRAGMA foreign_keys = ON;

-- ----- CATEGORIES -----
CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  icon       TEXT,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----- IMAGES -----
CREATE TABLE IF NOT EXISTS images (
  id              TEXT PRIMARY KEY,
  r2_key          TEXT NOT NULL UNIQUE,
  is_ai           INTEGER NOT NULL,
  category_id     INTEGER NOT NULL REFERENCES categories(id),
  source          TEXT NOT NULL,
  source_id       TEXT,
  source_url      TEXT,
  photographer    TEXT,
  ai_model        TEXT,
  ai_prompt       TEXT,
  phash           TEXT,
  width           INTEGER NOT NULL,
  height          INTEGER NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  exif_confidence REAL DEFAULT 0.0,
  nsfw_score      REAL DEFAULT 0.0,
  elo_rating      REAL NOT NULL DEFAULT 1200.0,
  times_shown     INTEGER NOT NULL DEFAULT 0,
  times_correct   INTEGER NOT NULL DEFAULT 0,
  times_fooled    INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending',
  retired_reason  TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_images_status_category ON images(status, category_id);
CREATE INDEX IF NOT EXISTS idx_images_elo ON images(elo_rating) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_images_is_ai ON images(is_ai) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_images_source ON images(source, source_id);
CREATE INDEX IF NOT EXISTS idx_images_phash ON images(phash) WHERE phash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_images_times_shown ON images(times_shown) WHERE status = 'approved';

-- ----- USERS -----
CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  device_id         TEXT UNIQUE,
  display_name      TEXT,
  email             TEXT UNIQUE,
  elo_rating        REAL NOT NULL DEFAULT 1200.0,
  total_played      INTEGER NOT NULL DEFAULT 0,
  total_correct     INTEGER NOT NULL DEFAULT 0,
  current_streak    INTEGER NOT NULL DEFAULT 0,
  best_streak       INTEGER NOT NULL DEFAULT 0,
  preferred_categories TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  last_active_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_device_id ON users(device_id);
CREATE INDEX IF NOT EXISTS idx_users_elo ON users(elo_rating);

-- ----- ANSWERS (swipe log) -----
CREATE TABLE IF NOT EXISTS answers (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id),
  image_id         TEXT NOT NULL REFERENCES images(id),
  guessed_ai       INTEGER NOT NULL,
  correct          INTEGER NOT NULL,
  response_ms      INTEGER NOT NULL,
  user_elo_before  REAL NOT NULL,
  user_elo_after   REAL NOT NULL,
  image_elo_before REAL NOT NULL,
  image_elo_after  REAL NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_answers_user_id ON answers(user_id);
CREATE INDEX IF NOT EXISTS idx_answers_image_id ON answers(image_id);
CREATE INDEX IF NOT EXISTS idx_answers_user_image ON answers(user_id, image_id);

-- ----- USER_IMAGE_HISTORY (prevent re-showing) -----
CREATE TABLE IF NOT EXISTS user_image_history (
  user_id  TEXT NOT NULL REFERENCES users(id),
  image_id TEXT NOT NULL REFERENCES images(id),
  shown_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, image_id)
);

CREATE INDEX IF NOT EXISTS idx_uih_user ON user_image_history(user_id);

-- ----- DAILY_STATS (analytics, future leaderboard) -----
CREATE TABLE IF NOT EXISTS daily_stats (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id),
  date        TEXT NOT NULL,
  games_played INTEGER NOT NULL DEFAULT 0,
  correct     INTEGER NOT NULL DEFAULT 0,
  elo_start   REAL NOT NULL,
  elo_end     REAL NOT NULL,
  best_streak INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);

-- ----- IMAGE_INGESTION_LOG -----
CREATE TABLE IF NOT EXISTS image_ingestion_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id        TEXT NOT NULL,
  source          TEXT NOT NULL,
  total_fetched   INTEGER NOT NULL DEFAULT 0,
  total_approved  INTEGER NOT NULL DEFAULT 0,
  total_rejected  INTEGER NOT NULL DEFAULT 0,
  total_duplicate INTEGER NOT NULL DEFAULT 0,
  errors          TEXT,
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at    TEXT
);
