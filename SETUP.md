# Discern - Setup Guide

Everything you need to go from code to live game.

## Prerequisites

- Node.js 22+
- A Cloudflare account (free tier: https://dash.cloudflare.com/sign-up)
- Wrangler CLI: `npm install -g wrangler`

## 1. Cloudflare Login

```bash
wrangler login
```

This opens a browser. Authorize, come back.

## 2. Create Cloud Resources

```bash
# Create the database
wrangler d1 create discern-db

# Note the database_id from the output. You'll need it.

# Create the image storage bucket
wrangler r2 bucket create discern-images
```

## 3. Update Config Files

Open `wrangler.jsonc` in the project root. Replace `<FILL_AFTER_CREATION>` with your database_id:

```jsonc
"database_id": "your-actual-id-here"
```

Do the same in `pipeline/wrangler.toml`.

## 4. Run Database Migrations

```bash
npm run dev:setup
```

This runs all migrations on the local D1 database. For production:

```bash
wrangler d1 execute discern-db --remote --file=migrations/0001_initial_schema.sql
wrangler d1 execute discern-db --remote --file=migrations/0002_seed_categories.sql
```

## 5. Get Free API Keys

All free, all take about 2 minutes each.

| Service | URL | What you get |
|---------|-----|-------------|
| Unsplash | https://unsplash.com/developers | Access Key (5000 req/hr) |
| Pexels | https://www.pexels.com/api/ | API Key (200 req/hr) |

AI images are generated automatically via Cloudflare Workers AI and Pollinations.ai (both free, no keys needed).

## 6. Set Environment Variables

For local dev, create `.dev.vars` in the project root:

```
UNSPLASH_ACCESS_KEY=your_key_here
PEXELS_API_KEY=your_key_here
```

For the pipeline worker, create `pipeline/.dev.vars`:

```
UNSPLASH_ACCESS_KEY=your_key_here
PEXELS_API_KEY=your_key_here
```

For production, set these as secrets:

```bash
cd pipeline
wrangler secret put UNSPLASH_ACCESS_KEY
wrangler secret put PEXELS_API_KEY
```

## 7. Set Up R2 Public Access

Go to the Cloudflare dashboard:

1. R2 Object Storage > discern-images > Settings
2. Scroll to "Public Development URL"
3. Click Enable, type `allow`, click Allow

Copy the public URL (looks like `https://pub-xxxxx.r2.dev`).

Add it to `.dev.vars` in the project root:

```
IMAGE_BASE_URL=https://pub-xxxxx.r2.dev
```

And in `wrangler.jsonc` under `vars`:

```jsonc
"IMAGE_BASE_URL": "https://pub-xxxxx.r2.dev"
```

## 8. Optional: Upstash Redis (for caching)

If you want stats caching (not required for MVP):

1. Go to https://console.upstash.com
2. Create a Redis database (free tier)
3. Copy the REST URL and token
4. Add to `.dev.vars` and wrangler config:

```
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
```

## 9. Run Locally

First time only:
```bash
npm install
cd pipeline && npm install && cd ..
npm run dev:setup    # runs migrations on local D1
```

Then to start everything:
```bash
npm run dev
```

This starts both the Next.js app (http://localhost:3000) and the pipeline worker (http://localhost:8788) in one terminal.

You can also run them separately if you prefer:
```bash
npm run dev:app       # just the game
npm run dev:pipeline  # just the pipeline
```

## 10. Trigger Initial Content Seeding

With `npm run dev` running:
```bash
npm run dev:seed
```

This tells the pipeline to start pulling images. Watch the logs in the dev terminal. You can also trigger other jobs:
```bash
curl http://localhost:8788/trigger/elo      # recalculate image difficulty
curl http://localhost:8788/trigger/retire    # retire overexposed images
```

This starts pulling real images from APIs and generating AI images. It's slow on free tiers. First batch might take 30-60 minutes to get ~50 images. It runs daily and accumulates.

## 11. Deploy to Production

```bash
# Deploy the main app
npm run build
wrangler deploy

# Deploy the pipeline worker
cd pipeline
wrangler deploy
```

The pipeline cron triggers automatically after deployment:
- 3:00 UTC: Fetch real images + generate AI images
- 4:00 UTC: Recalculate image difficulty ratings
- 5:00 UTC: Retire overexposed images

## 12. Verify It Works

```bash
# Check health
curl https://your-app.workers.dev/api/health

# Check if images are being served
curl "https://your-app.workers.dev/api/images/next?device_id=test123"
```

Then open the app in your phone browser and start swiping.

## 13. Monitor

- Cloudflare dashboard shows request counts, errors, D1/R2 usage
- Set up free monitoring at https://uptimerobot.com - point it at `/api/health`

## Run Tests

```bash
npm test              # all unit + integration tests
npm run test:unit     # unit tests only
npm run test:e2e      # playwright (needs running dev server with data)
npm run lint          # eslint
npm run typecheck     # typescript check
```

## Costs

Everything is on free tiers. You'll hit zero bills unless you exceed:
- 100K Worker requests/day
- 5M D1 row reads/day
- 10GB R2 storage
- 10M R2 reads/month

At 1K daily users you're well within limits.

## Troubleshooting

**"No images available"** - The pipeline hasn't run yet or hasn't finished. Trigger it manually (step 10) and wait.

**API keys not working** - Double check `.dev.vars` exists (not `.env`). Wrangler uses `.dev.vars` for local secrets.

**D1 errors locally** - Make sure you ran migrations with `--local` flag. The local D1 is separate from remote.

**Images not loading** - Check that R2 public access is enabled and `IMAGE_BASE_URL` points to the right domain.
