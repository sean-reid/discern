# DISCERN — Complete Implementation Plan

## Context

Building "Discern" — a mobile-first Tinder-style web app where users see a photo and swipe right (real) or left (AI-generated). Endless mode only: no rounds, no game over. Elo rating adjusts continuously per swipe. Budget: $0 (all free tiers).

## Architecture Overview

Single monorepo deployed to Cloudflare's edge. The Next.js 15 app (frontend + game API routes) deploys as a Cloudflare Worker via OpenNext adapter. A separate Cloudflare Worker handles image pipeline cron tasks. Both share the same D1 database and R2 bucket.

- **Frontend:** Next.js 15 App Router + Framer Motion 12 (`motion/react`) + Tailwind CSS 4 + Zustand
- **Backend:** Next.js Route Handlers on Cloudflare Workers (via `@opennextjs/cloudflare`)
- **Pipeline:** Separate Hono worker for cron tasks (Elo recalc, image retirement)
- **Database:** Cloudflare D1 (SQLite)
- **Image Storage:** Cloudflare R2 (zero egress, public bucket)
- **Cache:** Upstash Redis free tier
- **Image Processing:** Local scripts / GitHub Actions (sharp needs native bindings, can't run in Workers)

---

## 1. Project Structure

```
discern/
├── .github/workflows/
│   ├── ci.yml                      # Lint, typecheck, unit tests, audit
│   └── deploy.yml                  # Build + deploy to Cloudflare on main push
├── public/
│   ├── manifest.json               # PWA manifest
│   └── icons/                      # PWA icons
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout: meta, fonts, Zustand hydration
│   │   ├── page.tsx                # Landing / start screen
│   │   ├── globals.css             # Tailwind v4 imports + @theme tokens
│   │   ├── play/
│   │   │   └── page.tsx            # Main game screen (client component)
│   │   ├── stats/
│   │   │   └── page.tsx            # User stats page
│   │   └── api/
│   │       ├── images/next/route.ts  # GET: next image (NEVER leaks answer)
│   │       ├── swipe/route.ts        # POST: submit swipe, return result + Elo
│   │       ├── stats/route.ts        # GET: user stats
│   │       └── health/route.ts       # GET: health check
│   ├── components/
│   │   ├── SwipeCard.tsx           # Draggable card with Framer Motion
│   │   ├── SwipeStack.tsx          # Card stack manager, preloading, transitions
│   │   ├── SwipeOverlay.tsx        # "REAL"/"AI" text fading in on drag
│   │   ├── ResultFlash.tsx         # Correct/incorrect flash animation
│   │   ├── StatsBar.tsx            # Top bar: Elo, streak, accuracy
│   │   ├── CategoryPicker.tsx      # Horizontal category filter pills
│   │   ├── Header.tsx              # App header
│   │   ├── HowToPlay.tsx           # First-visit onboarding overlay
│   │   └── HydrationGuard.tsx      # Zustand hydration mismatch prevention
│   ├── lib/
│   │   ├── elo.ts                  # Elo formulas: expectedScore, computeEloUpdate
│   │   ├── db.ts                   # D1 helper via getCloudflareContext()
│   │   ├── r2.ts                   # R2 helper
│   │   ├── redis.ts                # Upstash Redis client
│   │   ├── image-selection.ts      # Elo-matched image selection algorithm
│   │   ├── anti-cheat.ts           # Response timing validation
│   │   ├── device-id.ts            # Device ID generation + persistence
│   │   ├── constants.ts            # Game constants (K-factors, Elo bounds, etc.)
│   │   └── types.ts                # Shared TypeScript interfaces
│   ├── stores/
│   │   └── game-store.ts           # Zustand: game state, user profile, image queue
│   └── hooks/
│       ├── useSwipe.ts             # Drag gesture logic wrapper
│       ├── usePreloader.ts         # Image preloading queue (3 ahead)
│       └── useDeviceId.ts          # Device ID initialization
├── pipeline/                       # Separate Cloudflare Worker
│   ├── src/
│   │   ├── index.ts                # Hono app: cron handlers
│   │   ├── sources/
│   │   │   ├── unsplash.ts         # Unsplash API fetcher
│   │   │   ├── pexels.ts           # Pexels API fetcher
│   │   │   └── flickr.ts           # Flickr API (pre-2021 filter)
│   │   ├── processing/
│   │   │   ├── validator.ts        # Dimension check, corruption detect
│   │   │   ├── hasher.ts           # Perceptual hash for dedup
│   │   │   └── exif-analyzer.ts    # EXIF confidence scoring
│   │   └── db.ts                   # D1 operations for pipeline
│   ├── wrangler.toml               # Cron triggers config
│   └── package.json
├── scripts/
│   ├── seed-real-images.ts         # One-time: pull real images from APIs
│   ├── seed-ai-images.ts           # Register pre-generated AI images
│   ├── validate-corpus.ts          # Run validation on all images
│   └── nightly-elo-recalc.ts       # Batch Elo recalculation
├── migrations/
│   ├── 0001_initial_schema.sql     # Full DDL
│   └── 0002_seed_categories.sql    # Seed categories
├── tests/
│   ├── unit/
│   │   ├── elo.test.ts
│   │   ├── image-selection.test.ts
│   │   ├── anti-cheat.test.ts
│   │   └── device-id.test.ts
│   ├── integration/
│   │   ├── api-images-next.test.ts # CRITICAL: never leaks answer
│   │   ├── api-swipe.test.ts
│   │   └── api-stats.test.ts
│   └── e2e/
│       └── game-flow.spec.ts       # Playwright: swipe 5 times
├── wrangler.jsonc                  # Main app Worker config
├── open-next.config.ts             # OpenNext Cloudflare adapter
├── next.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── package.json
└── PLAN.md                         # Copy of this plan
```

---

## 2. Database Schema

**File: `migrations/0001_initial_schema.sql`**

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  icon       TEXT,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS images (
  id              TEXT PRIMARY KEY,              -- UUID v4
  r2_key          TEXT NOT NULL UNIQUE,          -- 'img/{uuid}.webp'
  is_ai           INTEGER NOT NULL,              -- 0=real, 1=AI
  category_id     INTEGER NOT NULL REFERENCES categories(id),
  source          TEXT NOT NULL,                 -- 'unsplash','pexels','flickr','dalle3','leonardo','playground'
  source_id       TEXT,
  source_url      TEXT,
  photographer    TEXT,
  ai_model        TEXT,
  ai_prompt       TEXT,
  phash           TEXT,                          -- Perceptual hash hex
  width           INTEGER NOT NULL,
  height          INTEGER NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  exif_confidence REAL DEFAULT 0.0,              -- 0-1, real-photo confidence from EXIF
  nsfw_score      REAL DEFAULT 0.0,
  elo_rating      REAL NOT NULL DEFAULT 1200.0,
  times_shown     INTEGER NOT NULL DEFAULT 0,
  times_correct   INTEGER NOT NULL DEFAULT 0,
  times_fooled    INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending/approved/rejected/retired
  retired_reason  TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_images_status_category ON images(status, category_id);
CREATE INDEX idx_images_elo ON images(elo_rating) WHERE status = 'approved';
CREATE INDEX idx_images_is_ai ON images(is_ai) WHERE status = 'approved';
CREATE INDEX idx_images_source ON images(source, source_id);
CREATE INDEX idx_images_phash ON images(phash) WHERE phash IS NOT NULL;
CREATE INDEX idx_images_times_shown ON images(times_shown) WHERE status = 'approved';

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
  preferred_categories TEXT,                    -- JSON array or NULL=all
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  last_active_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_device_id ON users(device_id);
CREATE INDEX idx_users_elo ON users(elo_rating);

CREATE TABLE IF NOT EXISTS answers (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id),
  image_id         TEXT NOT NULL REFERENCES images(id),
  guessed_ai       INTEGER NOT NULL,            -- 0=guessed real, 1=guessed AI
  correct          INTEGER NOT NULL,
  response_ms      INTEGER NOT NULL,
  user_elo_before  REAL NOT NULL,
  user_elo_after   REAL NOT NULL,
  image_elo_before REAL NOT NULL,
  image_elo_after  REAL NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_answers_user_id ON answers(user_id);
CREATE INDEX idx_answers_image_id ON answers(image_id);
CREATE INDEX idx_answers_user_image ON answers(user_id, image_id);

CREATE TABLE IF NOT EXISTS user_image_history (
  user_id  TEXT NOT NULL REFERENCES users(id),
  image_id TEXT NOT NULL REFERENCES images(id),
  shown_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, image_id)
);

CREATE INDEX idx_uih_user ON user_image_history(user_id);

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
```

**File: `migrations/0002_seed_categories.sql`**

```sql
INSERT INTO categories (slug, name, icon) VALUES
  ('people',       'People',        '👤'),
  ('landscapes',   'Landscapes',    '🏔️'),
  ('animals',      'Animals',       '🐾'),
  ('food',         'Food',          '🍕'),
  ('architecture', 'Architecture',  '🏛️'),
  ('art',          'Art',           '🎨'),
  ('street',       'Street',        '🚶');
```

---

## 3. API Endpoints

### `GET /api/images/next?device_id={str}&category={slug|"all"}`

**Response:** `{ image: { id, url, width, height, category }, session: { shown_at } }`

**NEVER returns:** `is_ai`, `source`, `ai_model`, or any field revealing the answer.

**Logic:**
1. Lookup/create user from device_id
2. `selectNextImage(userId, userElo, category)`:
   - Query approved images with `elo_rating BETWEEN (userElo - 200) AND (userElo + 200)`
   - Exclude images in `user_image_history` for this user
   - Balance 50/50 real vs AI
   - Prefer less-shown images: `ORDER BY times_shown ASC, RANDOM() LIMIT 5`
3. Insert into `user_image_history`
4. Return image (no answer)

### `POST /api/swipe`

**Request:** `{ device_id, image_id, guessed_ai: bool, response_ms, shown_at }`

**Response:** `{ correct, is_ai, user: { elo_rating, elo_delta, total_played, total_correct, current_streak, best_streak, accuracy }, image: { elo_rating, times_shown, fool_rate } }`

**Logic:**
1. Validate: image exists, user exists, image_id in user_image_history, response_ms >= 300 (anti-bot), shown_at reasonable
2. Look up `images.is_ai` from DB (answer from server only)
3. Compute Elo updates
4. Write to `answers`, update `users`, update `images`, upsert `daily_stats`
5. Return result

### `GET /api/stats?device_id={str}`

Returns: elo, totals, accuracy, streak, category breakdown, recent 20 answers.

### `GET /api/health`

Returns: `{ status: "ok", db, r2, timestamp }`

---

## 4. Elo System

**File: `src/lib/elo.ts`**

Constants:
- `ELO_DEFAULT = 1200`, `ELO_K_USER = 32`, `ELO_K_IMAGE = 16`
- `ELO_MIN = 400`, `ELO_MAX = 2400`, `ELO_MATCH_RANGE = 200`
- `ELO_PROVISIONAL_GAMES = 30`, `ELO_K_USER_PROVISIONAL = 48`

```
expectedScore(userElo, imageElo) = 1 / (1 + 10^((imageElo - userElo) / 400))

On swipe:
  kUser = totalPlayed < 30 ? 48 : 32
  userDelta = kUser * (actual - expected)       // actual = 1 if correct, 0 if wrong
  imageDelta = 16 * (expected - actual)         // inverse: correct = image easier, wrong = harder
  newUserElo = clamp(userElo + userDelta, 400, 2400)
  newImageElo = clamp(imageElo + imageDelta, 400, 2400)
```

**Nightly batch recalculation** (for images with 20+ answers):
- Empirical Elo = `1200 + 400 * log10(fool_rate / (1 - fool_rate))`
- Blended: `new_elo = 0.8 * current_elo + 0.2 * empirical_elo`

---

## 5. Swipe Mechanics (Framer Motion)

**SwipeCard.tsx** uses `motion/react`:
- `drag="x"` with `dragSnapToOrigin` for snap-back
- `useMotionValue(0)` for x position
- `useTransform(x, [-300, 0, 300], [-15, 0, 15])` for rotation
- Swipe threshold: 120px displacement OR 500px/s velocity
- Exit animation: `x: ±500, opacity: 0, duration: 0.3s`
- `touch-none` CSS class for iOS Safari compatibility

**SwipeOverlay.tsx:**
- "AI" text (red) opacity mapped to leftward drag progress
- "REAL" text (green) opacity mapped to rightward drag progress
- Progress = `Math.abs(x) / SWIPE_THRESHOLD`, clamped to [0, 1]

**ResultFlash.tsx:**
- Green + checkmark for correct, Red + X for incorrect
- Shows "It was {REAL/AI}" text
- Auto-dismisses after 1.2s, then next card scales up

**Keyboard fallback:** ArrowLeft/A = AI, ArrowRight/D = Real
**Button fallback:** Two buttons below card for tap interaction

---

## 6. Image Preloading

**usePreloader hook** maintains 3 images ahead:
- Positions: [Current: rendered] [+1: rendered behind] [+2: decoded in memory] [+3: fetched in cache]
- After swipe: shift queue, fetch new image to refill
- On network failure: retry 3x with exponential backoff (1s, 2s, 4s)
- All images served as WebP, quality 80, max 1200px longest side (~80-150KB each)

---

## 7. Image Pipeline

### Real Images (automated)

Seeding scripts run locally or in GitHub Actions (need sharp for processing):

1. Fetch from Unsplash (30/category), Pexels (15/category), Flickr CC pre-2021 (30/category)
2. For each image:
   - EXIF analysis: camera make/model (+0.4), lens (+0.2), GPS (+0.2), software (+0.1)
   - Dimension check: min 800x600, max 6000x6000
   - Corruption check via sharp decode
   - NSFW check (NudeNet, reject > 0.3)
   - Perceptual hash, reject if Hamming distance < 10 from existing
   - Re-encode: WebP quality 80, max 1200px longest side
   - Strip ALL EXIF metadata
   - Apply random transforms: 1-3% crop, ±3% brightness/saturation, ±0.5deg rotation
   - Upload to R2 as `img/{uuid}.webp`
   - Insert into `images` table

### AI Images (manual generation + automated registration)

Generate weekly using free tools:
- Bing Image Creator (~15/day, DALL-E 3)
- Leonardo.ai free tier (~30/day)
- Playground AI free tier (~100/batch)

Register via `scripts/seed-ai-images.ts` (same processing pipeline, status='pending' for manual review).

### Anti-Cheat (all images)
- Strip ALL EXIF/metadata
- Opaque UUID filenames: `img/{uuid}.webp`
- Same format/quality for all images
- Random crop/color/rotation to defeat reverse image search
- No `/ai/` or `/real/` in URLs or headers
- Answer ONLY sent after swipe submission

### Content Freshness
- Automated daily pulls from Unsplash/Pexels/Flickr via pipeline cron (03:00 UTC)
- Buffer pool target: 2000+ approved images
- Auto-retire images shown to >80% of active users in their Elo bracket (05:00 UTC cron)
- Nightly Elo recalculation (04:00 UTC cron)

---

## 8. Testing Plan

### Day 1 Unit Tests (Vitest)

**`tests/unit/elo.test.ts`**: expectedScore returns 0.5 for equal Elos; correct guess raises user/lowers image; wrong guess lowers user/raises image; clamping works; provisional K-factor applied for first 30 games.

**`tests/unit/image-selection.test.ts`**: excludes seen images; respects Elo range; balances real/AI; prefers less-shown; handles empty pool; respects category filter.

**`tests/unit/anti-cheat.test.ts`**: rejects response_ms < 300; rejects future shown_at; rejects shown_at > 5min old; rejects unknown image_id; accepts valid params.

### Day 1 Integration Tests

**`tests/integration/api-images-next.test.ts`** (THE CRITICAL TEST): response NEVER contains `is_ai`, `ai_model`, `source`, or any answer-revealing field. URL path has no `ai`/`real`. Returns only: id, url, width, height, category.

**`tests/integration/api-swipe.test.ts`**: correct/incorrect detection works; Elo updates applied; streak updates; rejects duplicate swipe; rejects missing fields.

### Day 1 E2E Test (Playwright)

**`tests/e2e/game-flow.spec.ts`**: Load /play, dismiss onboarding, swipe 5 times via keyboard, verify stats update, verify no console errors. Targets: Mobile Chrome, Mobile Safari, Desktop Chrome.

### Image Quality Testing

**`scripts/validate-corpus.ts`**:
- sharp: decode test (corruption), dimension validation
- NudeNet: NSFW detection (reject > 0.3)
- Perceptual hash: duplicate detection (Hamming < 10 = duplicate)
- EXIF check: no AI-tool metadata leaking in served images
- Filename check: no `ai_`/`real_` patterns

---

## 9. CI/CD

**`.github/workflows/ci.yml`** on PR/push:
- lint + typecheck
- unit tests (vitest)
- integration tests (vitest)
- e2e tests (playwright, chromium only)
- npm audit --audit-level=high

**`.github/workflows/deploy.yml`** on push to main:
- Build + deploy main app via wrangler
- Deploy pipeline worker
- Run migrations

---

## 10. Content Seeding Plan (Pre-Launch)

### Real Images (500 target)
- Unsplash: 30/category x 7 = 210
- Pexels: 15/category x 7 = 105
- Flickr CC pre-2021: 30/category x 7 = 210
- ~5% rejection rate = ~500 approved

### AI Images (500 target, over 1-2 weeks)
- Bing Image Creator: ~15/day x 14 days = 210
- Leonardo.ai: ~30/day x 7 days = 210
- Playground AI: ~100 for remaining gap
- Record: model name, exact prompt, settings for each
- Vary models across categories to prevent fingerprint learning

---

## 11. Monitoring (Free)

- Cloudflare Analytics (built-in): request volume, error rates, D1/R2 metrics
- UptimeRobot (free): ping /api/health every 5 min, email alerts
- Application metrics in D1: daily_stats table, image_ingestion_log
- Key alerts: API error rate > 1%, average accuracy < 0.3 or > 0.8 (calibration issue), image pool < 500

---

## 12. Implementation Order

### Sprint 0: Scaffolding (Day 1, ~4hr)
Create Next.js project, configure wrangler/OpenNext, create D1 + R2, run migrations, verify local dev works, push to GitHub.

### Sprint 1: Core Backend (Days 2-3, ~12hr)
`types.ts` → `constants.ts` → `db.ts` → `elo.ts` → `device-id.ts` → `image-selection.ts` → `anti-cheat.ts` → API routes (health, images/next, swipe, stats) → unit tests alongside.

### Sprint 2: Core Frontend (Days 2-4, ~16hr)
`game-store.ts` → `HydrationGuard` → `useDeviceId` → `SwipeCard` (hardest) → `SwipeOverlay` → `ResultFlash` → `SwipeStack` → `usePreloader` → `StatsBar` → `CategoryPicker` → `Header` → `play/page.tsx` → `HowToPlay` → landing page → stats page → keyboard controls.

### Sprint 3: Image Pipeline (Days 3-5, ~12hr)
Pipeline worker setup → source fetchers (Unsplash/Pexels/Flickr) → processing scripts (validator, hasher, EXIF analyzer) → R2 upload → seed scripts.

### Sprint 4: Content Seeding (Days 5-6, ~8hr)
Run seed-real-images.ts → generate AI images manually → run seed-ai-images.ts → manual review → validate corpus.

### Sprint 5: Testing & Polish (Days 6-7, ~8hr)
Integration tests → E2E test → mobile Safari testing → Lighthouse audit → PWA manifest → error boundaries → Redis integration.

### Sprint 6: Deploy & Monitor (Day 7-8, ~4hr)
Deploy both workers → configure custom domain → verify crons → set up UptimeRobot → run E2E against production.

---

## 13. Future Features (Hooks Built Into MVP)

- **Daily Challenge:** `daily_stats` table ready; add `daily_challenges` + `daily_challenge_results` tables later. Reserve "Daily" slot in CategoryPicker.
- **Leaderboards:** `users.elo_rating` indexed. Add `/leaderboard` route showing "Coming Soon".
- **Social Sharing:** `ShareCard` component stubbed. Meta tags for OG cards in layout.tsx.
- **Accounts:** `users.email`/`display_name` columns ready. "Save Progress" CTA in stats page.
- **Multiplayer:** Elo system supports PvP. Cloudflare Durable Objects for future real-time rooms.

---

## Verification

After implementation, verify end-to-end:
1. `npm run dev` — game loads, swipe works, stats update
2. `npm run test:unit` — all Elo/selection/anti-cheat tests pass
3. `npm run test:integration` — especially api-images-next never leaks answers
4. `npx playwright test` — E2E flow completes on mobile viewports
5. `wrangler dev` — verify D1/R2 bindings work in Worker environment
6. Deploy to Cloudflare, verify production URL works
7. Check Cloudflare dashboard for D1/R2/Worker metrics within free tier limits
