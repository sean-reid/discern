# Discern

<a href="https://www.producthunt.com/products/discern?embed=true&amp;utm_source=badge-featured&amp;utm_medium=badge&amp;utm_campaign=badge-discern" target="_blank" rel="noopener noreferrer"><img alt="Discern - Swipe left for AI, right for real. How good is your eye? | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1120000&amp;theme=light&amp;t=1775759733197"></a>

A swipe game that tests whether you can spot AI-generated photos. See a photo, swipe left for AI or right for real. An Elo system rates both you and the images so the game gets harder as you improve.

## Stack

- **Frontend**: Next.js 16, Framer Motion, Tailwind CSS 4, Zustand
- **Backend**: Cloudflare Workers (via OpenNext), D1 (SQLite), R2 (image storage)
- **Real images**: Unsplash, Pexels, Pixabay
- **AI generators**: Google Gemini Flash, Cloudflare Workers AI (Flux Schnell), HuggingFace (Flux Schnell, SD3 Medium)
- **Difficulty**: Dual Elo rating system (players and images) with regression toward the mean

## Project Structure

```
src/
  app/              # Next.js pages and API routes
    api/            # Game API (images, swipe, health)
    about/          # About page
  components/       # SwipeCard, SwipeStack, StatsBar, Header
  lib/              # Elo engine, anti-cheat, image selection, types
  stores/           # Zustand game state
  hooks/            # Image preloader, device ID
pipeline/           # Cloudflare Worker for automated image ingestion
  src/sources/      # Unsplash, Pexels, Pixabay, Workers AI, HuggingFace, Gemini
  src/processing/   # Image validation, hashing, EXIF analysis
migrations/         # D1 database schema
tests/              # Unit, integration, and E2E tests
```

## Prerequisites

- Node.js 22+
- A Cloudflare account (free tier: https://dash.cloudflare.com/sign-up)
- Wrangler CLI: `npm install -g wrangler`

## Quick Start

```bash
npm install
cd pipeline && npm install && cd ..
npm run dev:setup    # first time: run migrations
npm run dev          # starts app + pipeline
npm run dev:seed     # in another tab: trigger first image pull
```

## Cloudflare Setup

```bash
wrangler login
wrangler d1 create discern-db
wrangler r2 bucket create discern-images
```

Update the `database_id` in both `wrangler.jsonc` and `pipeline/wrangler.toml` with the ID from the output.

Enable R2 public access in the Cloudflare dashboard (R2 > discern-images > Settings > Public Development URL > Enable). Copy the public URL and set it as `IMAGE_BASE_URL` in `wrangler.jsonc` vars and `.dev.vars`.

## API Keys

| Service | URL | Free? |
|---------|-----|-------|
| Unsplash | https://unsplash.com/developers | Yes (50 req/hr) |
| Pexels | https://www.pexels.com/api/ | Yes (200/month) |
| Pixabay | https://pixabay.com/api/docs/ | Yes (100 req/min) |
| HuggingFace | https://huggingface.co/settings/tokens | Paid (~$0.003/image) |
| Google Gemini | https://aistudio.google.com/apikey | Paid (~$0.00013/image) |

Workers AI is included free with Cloudflare (10K neurons/day).

## Environment Variables

For local dev, create `.dev.vars` in the project root (used by the Next.js app):

```
IMAGE_BASE_URL=https://pub-xxxxx.r2.dev
```

And create `pipeline/.dev.vars` (used by the pipeline worker):

```
UNSPLASH_ACCESS_KEY=your_key
PEXELS_API_KEY=your_key
PIXABAY_API_KEY=your_key
HF_TOKEN=your_token
GEMINI_API_KEY=your_key
```

For production, set as secrets:

```bash
cd pipeline
npx wrangler secret put UNSPLASH_ACCESS_KEY --config wrangler.toml
npx wrangler secret put PEXELS_API_KEY --config wrangler.toml
npx wrangler secret put PIXABAY_API_KEY --config wrangler.toml
npx wrangler secret put HF_TOKEN --config wrangler.toml
npx wrangler secret put GEMINI_API_KEY --config wrangler.toml
```

## Deploying

```bash
npm run deploy            # deploys Next.js app to Cloudflare Pages
npm run deploy:pipeline   # deploys pipeline worker
npm run deploy:migrations # runs migrations on production D1
```

## Pipeline Triggers

The pipeline is triggered by external cron ([cron-job.org](https://cron-job.org)) hitting these endpoints:

| Endpoint | What it does | Recommended interval |
|----------|-------------|---------------------|
| `/trigger/real` | Fetches real photos from 3 random categories | Every 15 min |
| `/trigger/ai/workers` | Generates 5 images via Workers AI | Every 5 min |
| `/trigger/ai/hf` | Generates 5 images via HuggingFace | Every 5 min |
| `/trigger/ai/gemini` | Generates 5 images via Gemini Flash | Every 5 min |
| `/trigger/elo` | Recalculates image difficulty | Handled by Cloudflare cron (04:00 UTC) |

Cloudflare crons at 03:00, 04:00, 09:00, 15:00, 21:00 UTC serve as fallback triggers.

## How It Works

1. Real photos are sourced from Unsplash, Pexels, and Pixabay. AI images come from four generators at varying quality levels.
2. Each image gets an Elo difficulty rating that adjusts based on how often players guess correctly.
3. Players get matched with images near their skill level. Both player and image Elo regress toward the mean to prevent inflation.
4. The API never sends the answer to the client until after a guess is submitted.
5. Users who have played fewer than 30 games don't affect image Elo (provisional protection).

## Tests

```bash
npm test              # unit + integration tests
npm run test:e2e      # playwright E2E
npm run typecheck     # typescript
npm run lint          # eslint
```

## Costs

| Resource | Free tier | Paid |
|----------|-----------|------|
| Cloudflare Workers | 100K req/day | Free |
| D1 | 5M reads/day | Free |
| R2 | 10GB storage | Free |
| Workers AI | 10K neurons/day | Free |
| HuggingFace | - | ~$0.003/image |
| Gemini Flash | - | ~$0.00013/image |

Estimated annual cost at current generation rates: ~$250/year.

## License

MIT
