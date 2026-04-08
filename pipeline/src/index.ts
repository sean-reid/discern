// ============================================================
// Discern Pipeline Worker
// Cloudflare Worker with scheduled (cron) triggers
//
// 03:00 UTC -- Image ingestion from Unsplash/Pexels + AI generation
// 04:00 UTC -- Nightly Elo recalculation
// 05:00 UTC -- Image retirement
// 12:00, 20:00 UTC -- AI-only generation to maintain balance
// ============================================================

import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import { fetchUnsplashImages } from "./sources/unsplash";
import { fetchPexelsImages } from "./sources/pexels";
// Flickr API requires Pro subscription, removed
import {
  generateWithPollinations,
  generateWithWorkersAI,
  generateWithHuggingFace,
  randomCategory,
} from "./sources/ai-generators";
import { validateImage } from "./processing/validator";
import { computeContentHash, isDuplicate } from "./processing/hasher";
import { analyzeExif } from "./processing/exif-analyzer";
import {
  insertImage,
  updateImageElo,
  retireImage,
  getImagesForEloRecalc,
  getImagesForRetirementCheck,
  getActiveUsersInEloBracket,
  getUniqueViewersForImage,
  sourceImageExists,
  getCategoryId,
  logIngestionBatch,
} from "./db";
import type { SourceImage } from "./sources/unsplash";

// ---- Env bindings ----

interface Env {
  DB: D1Database;
  R2: R2Bucket;
  AI?: unknown; // Cloudflare Workers AI binding (free tier)
  UNSPLASH_ACCESS_KEY: string;
  PEXELS_API_KEY: string;
  HF_TOKEN?: string; // Hugging Face API token (free tier)
}

// ---- Hono app (for HTTP routes if needed, e.g. health check) ----

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => {
  return c.json({ status: "ok", service: "discern-pipeline" });
});

app.get("/health", (c) => {
  return c.json({ status: "healthy" });
});

// Manual trigger routes (for local dev / testing)
app.get("/trigger/ingest", (c) => {
  c.executionCtx.waitUntil(runImageIngestion(c.env));
  return c.json({ started: "image-ingestion" });
});

app.get("/trigger/elo", (c) => {
  c.executionCtx.waitUntil(runEloRecalculation(c.env));
  return c.json({ started: "elo-recalculation" });
});

app.get("/trigger/retire", (c) => {
  c.executionCtx.waitUntil(runImageRetirement(c.env));
  return c.json({ started: "image-retirement" });
});

app.get("/trigger/ai", (c) => {
  c.executionCtx.waitUntil(runAiOnlyGeneration(c.env));
  return c.json({ started: "ai-generation" });
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
        ctx.waitUntil(runImageIngestion(env));
        break;
      case 4:
        ctx.waitUntil(runEloRecalculation(env));
        break;
      case 5:
        // Retirement disabled — per-user history prevents repeats,
        // no need to shrink library until it exceeds 5000+ images
        console.log("Image retirement is disabled — re-enable when library exceeds 5000 images");
        break;
      case 12:
      case 20:
        ctx.waitUntil(runAiOnlyGeneration(env));
        break;
      default:
        console.log(`No task configured for hour ${hour} UTC`);
    }
  },
};

export default worker;

// ============================================================
// 03:00 UTC -- Image Ingestion
// ============================================================

// Map queries to category slugs. Each source fetches these categories.
const CATEGORY_QUERIES: Record<string, string[]> = {
  people: ["portrait photography", "candid people"],
  landscapes: ["landscape photography", "nature scenery"],
  animals: ["wildlife photography", "animals in nature"],
  food: ["food photography", "gourmet dish"],
  architecture: ["architecture photography", "building exterior"],
  art: ["fine art photography", "gallery artwork"],
  street: ["street photography", "urban candid"],
};

// How many images to request per source per category (keep within free tiers)
const IMAGES_PER_SOURCE = 2;

async function runImageIngestion(env: Env): Promise<void> {
  const batchId = uuidv4();
  console.log(`[Ingestion] Starting batch ${batchId}`);

  let totalFetched = 0;
  let totalApproved = 0;
  let totalRejected = 0;
  let totalDuplicate = 0;
  const errors: string[] = [];

  for (const [categorySlug, queries] of Object.entries(CATEGORY_QUERIES)) {
    const categoryId = await getCategoryId(env.DB, categorySlug);
    if (!categoryId) {
      console.warn(`[Ingestion] Category "${categorySlug}" not found, skipping`);
      continue;
    }

    // Pick one random query for this category per run
    const query = queries[Math.floor(Math.random() * queries.length)];

    // Fetch from all three sources
    const sourceResults: Array<{
      source: string;
      images: SourceImage[];
    }> = [];

    try {
      const unsplashImages = await fetchUnsplashImages(
        env.UNSPLASH_ACCESS_KEY,
        query,
        IMAGES_PER_SOURCE
      );
      sourceResults.push({ source: "unsplash", images: unsplashImages });
    } catch (err) {
      const msg = `Unsplash error for "${query}": ${err}`;
      console.error(msg);
      errors.push(msg);
    }

    try {
      const pexelsImages = await fetchPexelsImages(
        env.PEXELS_API_KEY,
        query,
        IMAGES_PER_SOURCE
      );
      sourceResults.push({ source: "pexels", images: pexelsImages });
    } catch (err) {
      const msg = `Pexels error for "${query}": ${err}`;
      console.error(msg);
      errors.push(msg);
    }


    // Process each image
    for (const { source, images } of sourceResults) {
      for (const img of images) {
        totalFetched++;

        try {
          // Check if we already have this source image
          if (img.sourceId) {
            const exists = await sourceImageExists(env.DB, source, img.sourceId);
            if (exists) {
              totalDuplicate++;
              continue;
            }
          }

          // Download the image
          const response = await fetch(img.url);
          if (!response.ok) {
            totalRejected++;
            continue;
          }

          const imageData = await response.arrayBuffer();

          // Validate format, dimensions, file size
          const validation = validateImage(imageData);
          if (!validation.valid) {
            console.log(
              `[Ingestion] Rejected ${source}/${img.sourceId}: ${validation.reason}`
            );
            totalRejected++;
            continue;
          }

          // Compute content hash for dedup
          const hash = await computeContentHash(imageData);
          const existingId = await isDuplicate(env.DB, hash);
          if (existingId) {
            totalDuplicate++;
            continue;
          }

          // Analyze EXIF for real-camera confidence
          const exif = analyzeExif(imageData);

          // Upload to R2
          const imageId = uuidv4();
          const ext = validation.format === "jpeg" ? "jpg" : validation.format;
          const r2Key = `real/${categorySlug}/${imageId}.${ext}`;

          await env.R2.put(r2Key, imageData, {
            httpMetadata: {
              contentType: `image/${validation.format === "jpeg" ? "jpeg" : validation.format}`,
            },
            customMetadata: {
              source,
              sourceId: img.sourceId || "",
              photographer: img.photographer || "",
            },
          });

          // Insert into D1
          await insertImage(env.DB, {
            id: imageId,
            r2Key,
            isAi: false,
            categoryId,
            source,
            sourceId: img.sourceId,
            sourceUrl: img.sourceUrl,
            photographer: img.photographer,
            aiModel: null,
            phash: hash,
            width: validation.width,
            height: validation.height,
            fileSizeBytes: validation.fileSize,
            exifConfidence: exif.confidence,
            status: "approved",
          });

          totalApproved++;
          console.log(
            `[Ingestion] Added ${source}/${img.sourceId} as ${imageId} (${categorySlug})`
          );
        } catch (err) {
          const msg = `Error processing ${source}/${img.sourceId}: ${err}`;
          console.error(msg);
          errors.push(msg);
          totalRejected++;
        }
      }
    }
  }

  // --- AI Image Generation ---
  // Generate AI images to maintain a balanced real/AI ratio.
  // Uses Pollinations.ai (free, no key) and Cloudflare Workers AI (free tier).
  const AI_TARGET = 28;
  const AI_MAX_ATTEMPTS = 60;
  const aiApproved = 0;
  let aiAttempts = 0;
  console.log(`[Ingestion] Generating AI images (target: ${AI_TARGET}, max attempts: ${AI_MAX_ATTEMPTS})`);

  while (aiApproved < AI_TARGET && aiAttempts < AI_MAX_ATTEMPTS) {
    const i = aiAttempts;
    aiAttempts++;
    const category = randomCategory();
    const categoryId = await getCategoryId(env.DB, category);
    if (!categoryId) continue;

    // Try each generator in order, skip to next on failure
    const generators = [
      () => generateWithWorkersAI(env.AI, category),
      () => generateWithHuggingFace(env.HF_TOKEN, category),
      () => generateWithPollinations(category),
    ];
    // Rotate starting position for diversity
    const start = i % generators.length;

    let generated = null;
    for (let g = 0; g < generators.length; g++) {
      const idx = (start + g) % generators.length;
      generated = await generators[idx]();
      if (generated) break;
    }

    if (!generated) {
      totalRejected++;
      continue;
    }

    totalFetched++;

    try {
      // Validate the generated image
      const validation = validateImage(generated.data);
      if (!validation.valid) {
        console.log(`[Ingestion] AI image rejected: ${validation.reason}`);
        totalRejected++;
        continue;
      }

      // Hash for dedup
      const hash = await computeContentHash(generated.data);
      const existingId = await isDuplicate(env.DB, hash);
      if (existingId) {
        totalDuplicate++;
        continue;
      }

      // Upload to R2
      const imageId = uuidv4();
      const ext = validation.format === "jpeg" ? "jpg" : validation.format;
      const r2Key = `ai/${category}/${imageId}.${ext}`;

      await env.R2.put(r2Key, generated.data, {
        httpMetadata: {
          contentType: `image/${validation.format === "jpeg" ? "jpeg" : validation.format}`,
        },
        customMetadata: {
          model: generated.model,
        },
      });

      // Insert into D1 as AI-generated
      await insertImage(env.DB, {
        id: imageId,
        r2Key,
        isAi: true,
        categoryId,
        source: generated.model,
        sourceId: null,
        sourceUrl: null,
        photographer: null,
        aiModel: generated.model,
        phash: hash,
        width: validation.width,
        height: validation.height,
        fileSizeBytes: validation.fileSize,
        exifConfidence: 0,
        status: "approved",
      });

      totalApproved++;
      console.log(
        `[Ingestion] Generated AI image ${imageId} (${generated.model}, ${category})`
      );
    } catch (err) {
      const msg = `Error processing AI image: ${err}`;
      console.error(msg);
      errors.push(msg);
      totalRejected++;
    }
  }

  // Log the batch
  await logIngestionBatch(
    env.DB,
    batchId,
    "all",
    totalFetched,
    totalApproved,
    totalRejected,
    totalDuplicate,
    errors.length > 0 ? errors.join("\n") : null
  );

  console.log(
    `[Ingestion] Batch ${batchId} complete: ` +
      `fetched=${totalFetched} approved=${totalApproved} ` +
      `rejected=${totalRejected} duplicate=${totalDuplicate}`
  );
}

// ============================================================
// AI-Only Generation (runs 3x daily to keep real/AI balanced)
// ============================================================

const AI_ONLY_TARGET = 20;
const AI_ONLY_MAX_ATTEMPTS = 50;

async function runAiOnlyGeneration(env: Env): Promise<void> {
  console.log(`[AI-Gen] Starting AI-only batch (target: ${AI_ONLY_TARGET}, max attempts: ${AI_ONLY_MAX_ATTEMPTS})`);

  let approved = 0;
  let rejected = 0;
  let attempts = 0;

  while (approved < AI_ONLY_TARGET && attempts < AI_ONLY_MAX_ATTEMPTS) {
    const i = attempts;
    attempts++;
    const category = randomCategory();
    const categoryId = await getCategoryId(env.DB, category);
    if (!categoryId) continue;

    const generators = [
      () => generateWithWorkersAI(env.AI, category),
      () => generateWithHuggingFace(env.HF_TOKEN, category),
      () => generateWithPollinations(category),
    ];
    const start = i % generators.length;

    const names = ["workers-ai", "huggingface", "pollinations"];
    let generated = null;
    for (let g = 0; g < generators.length; g++) {
      const idx = (start + g) % generators.length;
      console.log(`[AI-Gen] Attempt ${attempts}: trying ${names[idx]} for ${category}`);
      generated = await generators[idx]();
      if (generated) {
        const kb = Math.round(generated.data.byteLength / 1024);
        console.log(`[AI-Gen] ${names[idx]} generated ${kb}KB image (${generated.model})`);
        break;
      }
      console.log(`[AI-Gen] ${names[idx]} returned nothing`);
    }

    if (!generated) {
      console.log(`[AI-Gen] Attempt ${attempts}: all generators failed`);
      rejected++;
      continue;
    }

    try {
      const validation = validateImage(generated.data);
      if (!validation.valid) {
        console.log(`[AI-Gen] Rejected: ${validation.reason}`);
        rejected++;
        continue;
      }

      const hash = await computeContentHash(generated.data);
      const dup = await isDuplicate(env.DB, hash);
      if (dup) continue;

      const imageId = uuidv4();
      const ext = validation.format === "jpeg" ? "jpg" : validation.format;
      const r2Key = `ai/${category}/${imageId}.${ext}`;

      await env.R2.put(r2Key, generated.data, {
        httpMetadata: {
          contentType: `image/${validation.format === "jpeg" ? "jpeg" : validation.format}`,
        },
      });

      await insertImage(env.DB, {
        id: imageId,
        r2Key,
        isAi: true,
        categoryId,
        source: generated.model,
        sourceId: null,
        sourceUrl: null,
        photographer: null,
        aiModel: generated.model,
        phash: hash,
        width: validation.width,
        height: validation.height,
        fileSizeBytes: validation.fileSize,
        exifConfidence: 0,
        status: "approved",
      });

      approved++;
      console.log(`[AI-Gen] Saved ${imageId} (${generated.model}, ${category}, ${validation.width}x${validation.height}) [${approved}/${AI_ONLY_TARGET}]`);
    } catch (err) {
      console.error(`[AI-Gen] Error: ${err}`);
      rejected++;
    }
  }

  console.log(`[AI-Gen] Batch complete: approved=${approved}/${AI_ONLY_TARGET} in ${attempts} attempts (${rejected} rejected)`);
}

// ============================================================
// 04:00 UTC -- Nightly Elo Recalculation
// ============================================================

// Elo constants (mirrors src/lib/constants.ts)
const ELO_DEFAULT = 1200;
const ELO_MIN = 400;
const ELO_MAX = 2400;

// Blend factor: how much weight to give the empirical Elo vs. the current one
// 0.3 = 30% empirical, 70% current (smooth adjustment, no wild swings)
const ELO_BLEND_FACTOR = 0.3;

/**
 * Compute an empirical Elo from the image's observed fool rate.
 *
 * The idea: an image that fools most users is "harder" and should
 * have a higher Elo. An image that everyone gets right is "easier"
 * and should have a lower Elo.
 *
 * For real images: fooled = user said "AI" but it was real
 * For AI images:   fooled = user said "real" but it was AI
 *
 * Fool rate 0.5 = perfectly balanced = default Elo (1200)
 * Fool rate 1.0 = fools everyone = max-ish Elo
 * Fool rate 0.0 = fools nobody = min-ish Elo
 */
function empiricalElo(
  timesFooled: number,
  timesShown: number
): number {
  if (timesShown === 0) return ELO_DEFAULT;

  const foolRate = timesFooled / timesShown;

  // Map fool rate [0, 1] to Elo range [600, 1800]
  // 0.5 maps to 1200 (default)
  const elo = 600 + foolRate * 1200;

  return Math.max(ELO_MIN, Math.min(ELO_MAX, elo));
}

async function runEloRecalculation(env: Env): Promise<void> {
  console.log("[Elo] Starting nightly recalculation");

  const images = await getImagesForEloRecalc(env.DB, 20);
  console.log(`[Elo] Found ${images.length} images with 20+ answers`);

  let updated = 0;

  for (const img of images) {
    const totalAnswers = img.times_correct + img.times_fooled;
    if (totalAnswers === 0) continue;

    const empElo = empiricalElo(img.times_fooled, totalAnswers);

    // Blend: move the current Elo toward the empirical Elo
    const blended =
      img.elo_rating * (1 - ELO_BLEND_FACTOR) + empElo * ELO_BLEND_FACTOR;

    const newElo = Math.max(ELO_MIN, Math.min(ELO_MAX, Math.round(blended)));

    // Only update if the change is meaningful (more than 1 point)
    if (Math.abs(newElo - img.elo_rating) > 1) {
      await updateImageElo(env.DB, img.id, newElo);
      updated++;
    }
  }

  console.log(`[Elo] Recalculation complete: updated ${updated}/${images.length} images`);
}

// ============================================================
// 05:00 UTC -- Image Retirement
// ============================================================

// Elo bracket size for retirement checks
const ELO_BRACKET_SIZE = 200;

// Retire if shown to more than this fraction of active users in the bracket
const RETIREMENT_THRESHOLD = 0.8;

async function runImageRetirement(env: Env): Promise<void> {
  console.log("[Retirement] Starting nightly check");

  const images = await getImagesForRetirementCheck(env.DB);
  console.log(`[Retirement] Checking ${images.length} active images`);

  let retired = 0;

  for (const img of images) {
    // Determine this image's Elo bracket
    const bracketMin =
      Math.floor(img.elo_rating / ELO_BRACKET_SIZE) * ELO_BRACKET_SIZE;
    const bracketMax = bracketMin + ELO_BRACKET_SIZE;

    // How many active users are in this bracket?
    const usersInBracket = await getActiveUsersInEloBracket(
      env.DB,
      bracketMin,
      bracketMax
    );

    // If there are very few users, don't retire (not enough data)
    if (usersInBracket < 5) continue;

    // How many unique users have seen this image?
    const uniqueViewers = await getUniqueViewersForImage(env.DB, img.id);

    const viewRate = uniqueViewers / usersInBracket;

    if (viewRate > RETIREMENT_THRESHOLD) {
      await retireImage(
        env.DB,
        img.id,
        `Shown to ${Math.round(viewRate * 100)}% of active users in Elo bracket ${bracketMin}-${bracketMax}`
      );
      retired++;
      console.log(
        `[Retirement] Retired image ${img.id} (${Math.round(viewRate * 100)}% exposure in bracket ${bracketMin}-${bracketMax})`
      );
    }
  }

  console.log(`[Retirement] Complete: retired ${retired} images`);
}
