// ============================================================
// Discern Pipeline Worker
//
// 03:00, 15:00 UTC — Real image ingestion (self-chained by category)
// 04:00 UTC — Elo recalculation
// 09:00, 21:00 UTC — AI image generation
// ============================================================

import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import { fetchUnsplashImages } from "./sources/unsplash";
import { fetchPexelsImages } from "./sources/pexels";
import { fetchPixabayImages } from "./sources/pixabay";
import {
  generateWithPollinations,
  generateWithWorkersAI,
  generateWithHuggingFace,
  randomCategory,
  type GeneratedImage,
} from "./sources/ai-generators";
import { isCoolingDown } from "./sources/rate-limiter";
import { validateImage } from "./processing/validator";
import { computeContentHash, isDuplicate } from "./processing/hasher";
import { analyzeExif } from "./processing/exif-analyzer";
import {
  insertImage,
  updateImageElo,
  getImagesForEloRecalc,
  sourceImageExists,
  getCategoryId,
  logIngestionBatch,
} from "./db";
import type { SourceImage } from "./sources/unsplash";

// ---- Env bindings ----

interface Env {
  DB: D1Database;
  R2: R2Bucket;
  AI?: unknown;
  UNSPLASH_ACCESS_KEY: string;
  PEXELS_API_KEY: string;
  PIXABAY_API_KEY: string;
  HF_TOKEN?: string;
}

// ---- Config ----

const WORKER_URL = "https://discern-pipeline.seanreid.workers.dev";

const CATEGORY_QUERIES: Record<string, string[]> = {
  people: ["portrait photography", "candid people"],
  landscapes: ["landscape photography", "nature scenery"],
  animals: ["wildlife photography", "animals in nature"],
  food: ["food photography", "gourmet dish"],
  architecture: ["architecture photography", "building exterior"],
  art: ["fine art photography", "gallery artwork"],
  street: ["street photography", "urban candid"],
};

const CATEGORY_SLUGS = Object.keys(CATEGORY_QUERIES);
const IMAGES_PER_SOURCE = 2;
const AI_BATCH_SIZE = 5; // attempts per invocation to stay under time limit

// ---- Hono app ----

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.json({ status: "ok", service: "discern-pipeline" }));
app.get("/health", (c) => c.json({ status: "healthy" }));

// Each trigger processes one small batch. No chaining — external cron
// (cron-job.org) fires these frequently instead.
const REAL_BATCH_SIZE = 3; // categories per trigger (stays under 50 subrequests)

app.get("/trigger/real", (c) => {
  const env = c.env;

  c.executionCtx.waitUntil((async () => {
    // Pick 3 random categories each trigger
    const shuffled = [...CATEGORY_SLUGS].sort(() => Math.random() - 0.5);
    const batch = shuffled.slice(0, REAL_BATCH_SIZE);

    for (const slug of batch) {
      const idx = CATEGORY_SLUGS.indexOf(slug);
      await ingestCategory(env, idx);
    }
    console.log(`[Ingestion] Batch complete: ${batch.join(", ")}`);
  })());

  return c.json({ type: "real", status: "started" });
});

app.get("/trigger/ai", (c) => {
  const env = c.env;
  const batchId = uuidv4();

  c.executionCtx.waitUntil((async () => {
    const result = await runAiBatch(env, AI_BATCH_SIZE, 0);
    await logIngestionBatch(env.DB, batchId, "ai", AI_BATCH_SIZE, result.approved, result.rejected, 0, null);
    console.log(`[AI-Gen] Batch: approved=${result.approved} rejected=${result.rejected}`);
  })());

  return c.json({ type: "ai", status: "started" });
});

app.get("/trigger/elo", (c) => {
  c.executionCtx.waitUntil(runEloRecalculation(c.env));
  return c.json({ started: "elo-recalculation" });
});

// ---- Cron handler ----

const worker = {
  fetch: app.fetch,

  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    const hour = new Date(event.scheduledTime).getUTCHours();

    switch (hour) {
      case 3:
      case 15:
        ctx.waitUntil(fetch(`${WORKER_URL}/trigger/real`).catch(() => {}));
        break;
      case 4:
        ctx.waitUntil(runEloRecalculation(env));
        break;
      case 9:
      case 21:
        ctx.waitUntil(fetch(`${WORKER_URL}/trigger/ai`).catch(() => {}));
        break;
      default:
        console.log(`No task configured for hour ${hour} UTC`);
    }
  },
};

export default worker;

// ============================================================
// Real Image Ingestion — one category per invocation, self-chaining
// ============================================================

async function ingestCategory(env: Env, offset: number): Promise<void> {
  const categorySlug = CATEGORY_SLUGS[offset];
  if (!categorySlug) return;

  const batchId = uuidv4();
  console.log(`[Ingestion] Category ${offset + 1}/${CATEGORY_SLUGS.length}: ${categorySlug}`);

  let fetched = 0;
  let approved = 0;
  let rejected = 0;
  let duplicate = 0;
  const errors: string[] = [];

  const categoryId = await getCategoryId(env.DB, categorySlug);
  if (!categoryId) {
    console.warn(`[Ingestion] Category "${categorySlug}" not found`);
    return;
  }

  const queries = CATEGORY_QUERIES[categorySlug];
  const query = queries[Math.floor(Math.random() * queries.length)];

  const sourceResults: Array<{ source: string; images: SourceImage[] }> = [];

  try {
    const imgs = await fetchUnsplashImages(env.UNSPLASH_ACCESS_KEY, query, IMAGES_PER_SOURCE);
    sourceResults.push({ source: "unsplash", images: imgs });
  } catch (err) {
    errors.push(`Unsplash: ${err}`);
  }

  try {
    const imgs = await fetchPexelsImages(env.PEXELS_API_KEY, query, IMAGES_PER_SOURCE);
    sourceResults.push({ source: "pexels", images: imgs });
  } catch (err) {
    errors.push(`Pexels: ${err}`);
  }

  try {
    const imgs = await fetchPixabayImages(env.PIXABAY_API_KEY, query, IMAGES_PER_SOURCE, categorySlug);
    sourceResults.push({ source: "pixabay", images: imgs });
  } catch (err) {
    errors.push(`Pixabay: ${err}`);
  }

  for (const { source, images } of sourceResults) {
    for (const img of images) {
      fetched++;
      try {
        if (img.sourceId && await sourceImageExists(env.DB, source, img.sourceId)) {
          duplicate++;
          continue;
        }

        const response = await fetch(img.url);
        if (!response.ok) { rejected++; continue; }

        const imageData = await response.arrayBuffer();
        const validation = validateImage(imageData);
        if (!validation.valid) {
          console.log(`[Ingestion] Rejected ${source}/${img.sourceId}: ${validation.reason}`);
          rejected++;
          continue;
        }

        const hash = await computeContentHash(imageData);
        if (await isDuplicate(env.DB, hash)) { duplicate++; continue; }

        const exif = analyzeExif(imageData);
        const imageId = uuidv4();
        const ext = validation.format === "jpeg" ? "jpg" : validation.format;
        const r2Key = `real/${categorySlug}/${imageId}.${ext}`;

        await env.R2.put(r2Key, imageData, {
          httpMetadata: { contentType: `image/${validation.format === "jpeg" ? "jpeg" : validation.format}` },
          customMetadata: { source, sourceId: img.sourceId || "", photographer: img.photographer || "" },
        });

        await insertImage(env.DB, {
          id: imageId, r2Key, isAi: false, categoryId, source,
          sourceId: img.sourceId, sourceUrl: img.sourceUrl,
          photographer: img.photographer, aiModel: null, aiPrompt: null, phash: hash,
          width: validation.width, height: validation.height,
          fileSizeBytes: validation.fileSize, exifConfidence: exif.confidence,
          status: "approved",
        });

        approved++;
        console.log(`[Ingestion] Added ${source}/${img.sourceId} as ${imageId} (${categorySlug})`);
      } catch (err) {
        errors.push(`${source}/${img.sourceId}: ${err}`);
        rejected++;
      }
    }
  }

  await logIngestionBatch(
    env.DB, batchId, categorySlug,
    fetched, approved, rejected, duplicate,
    errors.length > 0 ? errors.join("\n") : null
  );

  console.log(`[Ingestion] ${categorySlug}: approved=${approved} rejected=${rejected} duplicate=${duplicate}`);
}

// ============================================================
// AI Image Generation
// ============================================================

async function runAiBatch(
  env: Env,
  maxAttempts: number,
  startAttempt: number
): Promise<{ approved: number; rejected: number }> {
  console.log(`[AI-Gen] Batch starting at attempt ${startAttempt}, max ${maxAttempts}`);

  let approved = 0;
  let rejected = 0;

  for (let i = 0; i < maxAttempts; i++) {
    const category = randomCategory();
    const categoryId = await getCategoryId(env.DB, category);
    if (!categoryId) continue;

    // Build list of available generators — skip cooled-down/exhausted sources
    const available: Array<{ name: string; fn: () => Promise<GeneratedImage | null> }> = [];
    if (!isCoolingDown("huggingface")) {
      available.push({ name: "huggingface", fn: () => generateWithHuggingFace(env.HF_TOKEN, category) });
    }
    if (!isCoolingDown("workers-ai")) {
      available.push({ name: "workers-ai", fn: () => generateWithWorkersAI(env.AI, category) });
    }
    if (!isCoolingDown("pollinations")) {
      available.push({ name: "pollinations", fn: () => generateWithPollinations(category) });
    }

    if (available.length === 0) {
      console.log("[AI-Gen] All generators cooled down, stopping batch");
      break;
    }

    let generated: GeneratedImage | null = null;
    for (const gen of available) {
      console.log(`[AI-Gen] Attempt ${startAttempt + i + 1}: trying ${gen.name} for ${category}`);
      generated = await gen.fn();
      if (generated) {
        console.log(`[AI-Gen] ${gen.name}: ${Math.round(generated.data.byteLength / 1024)}KB`);
        break;
      }
    }

    if (!generated) { rejected++; continue; }

    try {
      const validation = validateImage(generated.data);
      if (!validation.valid) {
        console.log(`[AI-Gen] Rejected: ${validation.reason}`);
        rejected++;
        continue;
      }

      const hash = await computeContentHash(generated.data);
      if (await isDuplicate(env.DB, hash)) continue;

      const imageId = uuidv4();
      const ext = validation.format === "jpeg" ? "jpg" : validation.format;
      const r2Key = `ai/${category}/${imageId}.${ext}`;

      await env.R2.put(r2Key, generated.data, {
        httpMetadata: { contentType: `image/${validation.format === "jpeg" ? "jpeg" : validation.format}` },
        customMetadata: { model: generated.model },
      });

      await insertImage(env.DB, {
        id: imageId, r2Key, isAi: true, categoryId,
        source: generated.model, sourceId: null, sourceUrl: null,
        photographer: null, aiModel: generated.model, aiPrompt: generated.prompt, phash: hash,
        width: validation.width, height: validation.height,
        fileSizeBytes: validation.fileSize, exifConfidence: 0,
        status: "approved",
      });

      approved++;
      console.log(`[AI-Gen] Saved ${imageId} (${generated.model}, ${category})`);
    } catch (err) {
      console.error(`[AI-Gen] Error: ${err}`);
      rejected++;
    }
  }

  return { approved, rejected };
}

// ============================================================
// Elo Recalculation
// ============================================================

const ELO_DEFAULT = 1200;
const ELO_MIN = 400;
const ELO_MAX = 2400;
const ELO_BLEND_FACTOR = 0.3;

function empiricalElo(timesFooled: number, timesShown: number): number {
  if (timesShown === 0) return ELO_DEFAULT;
  const foolRate = timesFooled / timesShown;
  return Math.max(ELO_MIN, Math.min(ELO_MAX, 600 + foolRate * 1200));
}

async function runEloRecalculation(env: Env): Promise<void> {
  console.log("[Elo] Starting recalculation");

  const images = await getImagesForEloRecalc(env.DB, 20);
  console.log(`[Elo] Found ${images.length} images with 20+ answers`);

  let updated = 0;

  for (const img of images) {
    const totalAnswers = img.times_correct + img.times_fooled;
    if (totalAnswers === 0) continue;

    const empElo = empiricalElo(img.times_fooled, totalAnswers);
    const blended = img.elo_rating * (1 - ELO_BLEND_FACTOR) + empElo * ELO_BLEND_FACTOR;
    const newElo = Math.max(ELO_MIN, Math.min(ELO_MAX, Math.round(blended)));

    if (Math.abs(newElo - img.elo_rating) > 1) {
      await updateImageElo(env.DB, img.id, newElo);
      updated++;
    }
  }

  console.log(`[Elo] Complete: updated ${updated}/${images.length} images`);
}
