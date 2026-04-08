#!/usr/bin/env npx tsx
// ============================================================
// Seed Real Images
//
// Pulls photos from Unsplash/Pexels/Flickr, processes them
// locally (resize, convert to WebP, strip EXIF), computes a
// perceptual hash, uploads to R2 via S3-compatible API, and
// inserts metadata into D1.
//
// Usage:
//   npx tsx scripts/seed-real-images.ts
//
// Reads config from .env in the project root.
// ============================================================

import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

// ---- Config from environment ----

function loadEnv(): void {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) {
    console.error("Missing .env file. Copy .env.example to .env and fill in your keys.");
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv();

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || "";
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || "";
const FLICKR_API_KEY = process.env.FLICKR_API_KEY || "";
const R2_ENDPOINT = process.env.R2_S3_ENDPOINT || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET = process.env.R2_BUCKET || "discern-images";
const D1_API_URL = process.env.D1_API_URL || "";
const D1_API_TOKEN = process.env.D1_API_TOKEN || "";
const D1_DATABASE_ID = process.env.D1_DATABASE_ID || "";

// ---- Types ----

interface SourceImage {
  url: string;
  photographer: string;
  sourceId: string;
  sourceUrl: string;
}

interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  hash: string;
}

// ---- Category config ----

const CATEGORY_QUERIES: Record<string, string[]> = {
  people: ["portrait photography", "candid people street"],
  landscapes: ["landscape nature scenery", "mountain lake sunset"],
  animals: ["wildlife photography", "animals nature"],
  food: ["food photography plating", "gourmet dish restaurant"],
  architecture: ["architecture building exterior", "modern architecture"],
  art: ["fine art photography", "sculpture painting gallery"],
  street: ["street photography urban", "city life candid"],
};

const IMAGES_PER_SOURCE_PER_CATEGORY = 5;

// ---- Source fetchers ----

async function fetchUnsplash(query: string, count: number): Promise<SourceImage[]> {
  if (!UNSPLASH_ACCESS_KEY) return [];

  const url = new URL("https://api.unsplash.com/photos/random");
  url.searchParams.set("query", query);
  url.searchParams.set("count", String(Math.min(count, 30)));
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("content_filter", "high");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
  });

  if (!res.ok) {
    console.warn(`Unsplash ${res.status}: ${(await res.text()).slice(0, 100)}`);
    return [];
  }

  const photos = (await res.json()) as Array<{
    urls: { regular: string };
    user: { name: string };
    id: string;
    links: { html: string };
  }>;
  return photos.map((p) => ({
    url: p.urls.regular,
    photographer: p.user.name,
    sourceId: p.id,
    sourceUrl: p.links.html,
  }));
}

async function fetchPexels(query: string, count: number): Promise<SourceImage[]> {
  if (!PEXELS_API_KEY) return [];

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(Math.min(count, 80)));
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("size", "large");

  const res = await fetch(url.toString(), {
    headers: { Authorization: PEXELS_API_KEY },
  });

  if (!res.ok) {
    console.warn(`Pexels ${res.status}: ${(await res.text()).slice(0, 100)}`);
    return [];
  }

  const data = (await res.json()) as {
    photos?: Array<{
      src: { large2x: string };
      photographer: string;
      id: number;
      url: string;
    }>;
  };
  return (data.photos || []).map((p) => ({
    url: p.src.large2x,
    photographer: p.photographer,
    sourceId: String(p.id),
    sourceUrl: p.url,
  }));
}

async function fetchFlickr(query: string, count: number): Promise<SourceImage[]> {
  if (!FLICKR_API_KEY) return [];

  const url = new URL("https://www.flickr.com/services/rest/");
  url.searchParams.set("method", "flickr.photos.search");
  url.searchParams.set("api_key", FLICKR_API_KEY);
  url.searchParams.set("text", query);
  url.searchParams.set("license", "1,2,3,4,5,6,9,10");
  url.searchParams.set("media", "photos");
  url.searchParams.set("content_type", "1");
  url.searchParams.set("max_upload_date", "1609459200"); // pre-2021
  url.searchParams.set("extras", "url_l,owner_name");
  url.searchParams.set("per_page", String(Math.min(count, 100)));
  url.searchParams.set("sort", "interestingness-desc");
  url.searchParams.set("format", "json");
  url.searchParams.set("nojsoncallback", "1");

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.warn(`Flickr ${res.status}: ${(await res.text()).slice(0, 100)}`);
    return [];
  }

  interface FlickrPhoto {
    url_l?: string;
    ownername?: string;
    owner: string;
    id: string;
  }
  const data = (await res.json()) as {
    stat: string;
    photos?: { photo?: FlickrPhoto[] };
  };
  if (data.stat !== "ok") return [];

  return (data.photos?.photo || [])
    .filter((p) => p.url_l)
    .map((p) => ({
      url: p.url_l!,
      photographer: p.ownername || p.owner,
      sourceId: p.id,
      sourceUrl: `https://www.flickr.com/photos/${p.owner}/${p.id}`,
    }));
}

// ---- Image processing ----

/**
 * Process an image: resize to max 1200px, convert to WebP quality 80,
 * strip all EXIF/metadata, compute perceptual hash.
 */
async function processImage(imageBuffer: Buffer): Promise<ProcessedImage | null> {
  try {
    const metadata = await sharp(imageBuffer).metadata();

    if (!metadata.width || !metadata.height) return null;
    if (metadata.width < 800 || metadata.height < 600) return null;

    // Resize to fit within 1200px on the longest side, strip metadata
    const processed = sharp(imageBuffer)
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .removeAlpha()
      .webp({ quality: 80 })
      .withMetadata({}); // strip EXIF

    const outputBuffer = await processed.toBuffer();
    const outputMeta = await sharp(outputBuffer).metadata();

    // Compute perceptual hash (average hash approach)
    // Resize to 8x8 grayscale, compare each pixel to the mean
    const hashBuffer = await sharp(imageBuffer)
      .resize(8, 8, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer();

    const pixels = Array.from(hashBuffer);
    const mean = pixels.reduce((a, b) => a + b, 0) / pixels.length;

    let hashBits = "";
    for (const px of pixels) {
      hashBits += px >= mean ? "1" : "0";
    }

    // Convert 64-bit binary string to 16-char hex
    const hashHex = BigInt("0b" + hashBits).toString(16).padStart(16, "0");

    return {
      buffer: outputBuffer,
      width: outputMeta.width || 0,
      height: outputMeta.height || 0,
      hash: hashHex,
    };
  } catch (err) {
    console.error("Processing error:", err);
    return null;
  }
}

// ---- R2 upload via S3-compatible API ----

async function uploadToR2(key: string, data: Buffer, contentType: string): Promise<boolean> {
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error("R2 credentials not configured. Set R2_S3_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env");
    return false;
  }

  // Simple S3 PUT -- in practice you may want to use an S3 SDK
  // For this script, we use the @aws-sdk/client-s3 pattern via fetch
  // with presigned or basic auth. For simplicity, using the S3 REST API.
  try {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: data,
        ContentType: contentType,
      })
    );
    return true;
  } catch (err) {
    console.error(`R2 upload failed for ${key}:`, err);
    return false;
  }
}

// ---- D1 operations via REST API ----

interface D1Result {
  results?: Array<Record<string, unknown>>;
}

interface D1Response {
  result?: D1Result[];
}

async function d1Query(sql: string, params: (string | number | null)[] = []): Promise<D1Result | null> {
  if (!D1_API_URL || !D1_API_TOKEN || !D1_DATABASE_ID) {
    console.error(
      "D1 API not configured. Set D1_API_URL, D1_API_TOKEN, D1_DATABASE_ID in .env"
    );
    return null;
  }

  const url = `${D1_API_URL}/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${D1_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`D1 API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as D1Response;
  return data.result?.[0] || null;
}

async function getCategoryIdLocal(slug: string): Promise<number | null> {
  const result = await d1Query(
    "SELECT id FROM categories WHERE slug = ? AND active = 1",
    [slug]
  );
  return (result?.results?.[0]?.id as number | undefined) ?? null;
}

async function sourceExistsLocal(source: string, sourceId: string): Promise<boolean> {
  const result = await d1Query(
    "SELECT 1 FROM images WHERE source = ? AND source_id = ? LIMIT 1",
    [source, sourceId]
  );
  return (result?.results?.length ?? 0) > 0;
}

async function hashExistsLocal(hash: string): Promise<boolean> {
  const result = await d1Query(
    "SELECT 1 FROM images WHERE phash = ? LIMIT 1",
    [hash]
  );
  return (result?.results?.length ?? 0) > 0;
}

async function insertImageLocal(params: {
  id: string;
  r2Key: string;
  isAi: number;
  categoryId: number;
  source: string;
  sourceId: string;
  sourceUrl: string;
  photographer: string;
  phash: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  exifConfidence: number;
}): Promise<void> {
  await d1Query(
    `INSERT INTO images (
      id, r2_key, is_ai, category_id, source, source_id, source_url,
      photographer, ai_model, phash, width, height, file_size_bytes,
      exif_confidence, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, 'approved')`,
    [
      params.id,
      params.r2Key,
      params.isAi,
      params.categoryId,
      params.source,
      params.sourceId,
      params.sourceUrl,
      params.photographer,
      params.phash,
      params.width,
      params.height,
      params.fileSizeBytes,
      params.exifConfidence,
    ]
  );
}

// ---- Main ----

async function main(): Promise<void> {
  console.log("=== Discern: Seeding Real Images ===\n");

  const missingKeys: string[] = [];
  if (!UNSPLASH_ACCESS_KEY && !PEXELS_API_KEY && !FLICKR_API_KEY) {
    console.error(
      "No API keys configured. Set at least one of UNSPLASH_ACCESS_KEY, PEXELS_API_KEY, FLICKR_API_KEY in .env"
    );
    process.exit(1);
  }

  if (!UNSPLASH_ACCESS_KEY) missingKeys.push("UNSPLASH_ACCESS_KEY");
  if (!PEXELS_API_KEY) missingKeys.push("PEXELS_API_KEY");
  if (!FLICKR_API_KEY) missingKeys.push("FLICKR_API_KEY");
  if (missingKeys.length > 0) {
    console.warn(`Note: ${missingKeys.join(", ")} not set, those sources will be skipped.\n`);
  }

  let totalProcessed = 0;
  let totalUploaded = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const [categorySlug, queries] of Object.entries(CATEGORY_QUERIES)) {
    const categoryId = await getCategoryIdLocal(categorySlug);
    if (!categoryId) {
      console.warn(`Category "${categorySlug}" not found in DB, skipping`);
      continue;
    }

    console.log(`\n--- Category: ${categorySlug} ---`);
    const query = queries[Math.floor(Math.random() * queries.length)];
    console.log(`  Query: "${query}"`);

    // Collect images from all sources
    const allImages: Array<{ source: string; img: SourceImage }> = [];

    const [unsplash, pexels, flickr] = await Promise.all([
      fetchUnsplash(query, IMAGES_PER_SOURCE_PER_CATEGORY),
      fetchPexels(query, IMAGES_PER_SOURCE_PER_CATEGORY),
      fetchFlickr(query, IMAGES_PER_SOURCE_PER_CATEGORY),
    ]);

    for (const img of unsplash) allImages.push({ source: "unsplash", img });
    for (const img of pexels) allImages.push({ source: "pexels", img });
    for (const img of flickr) allImages.push({ source: "flickr", img });

    console.log(`  Fetched ${allImages.length} image URLs`);

    for (const { source, img } of allImages) {
      totalProcessed++;

      try {
        // Dedup by source
        if (await sourceExistsLocal(source, img.sourceId)) {
          totalSkipped++;
          continue;
        }

        // Download
        const res = await fetch(img.url);
        if (!res.ok) {
          totalErrors++;
          continue;
        }

        const rawBuffer = Buffer.from(await res.arrayBuffer());

        // Process (resize, WebP, strip EXIF, hash)
        const processed = await processImage(rawBuffer);
        if (!processed) {
          totalSkipped++;
          continue;
        }

        // Dedup by hash
        if (await hashExistsLocal(processed.hash)) {
          totalSkipped++;
          continue;
        }

        // Upload to R2
        const imageId = uuidv4();
        const r2Key = `real/${categorySlug}/${imageId}.webp`;

        const uploaded = await uploadToR2(r2Key, processed.buffer, "image/webp");
        if (!uploaded) {
          totalErrors++;
          continue;
        }

        // Insert into D1
        await insertImageLocal({
          id: imageId,
          r2Key,
          isAi: 0,
          categoryId,
          source,
          sourceId: img.sourceId,
          sourceUrl: img.sourceUrl,
          photographer: img.photographer,
          phash: processed.hash,
          width: processed.width,
          height: processed.height,
          fileSizeBytes: processed.buffer.length,
          exifConfidence: 0.0, // stripped during processing
        });

        totalUploaded++;
        console.log(`  Uploaded: ${source}/${img.sourceId} -> ${r2Key}`);
      } catch (err) {
        console.error(`  Error processing ${source}/${img.sourceId}:`, err);
        totalErrors++;
      }
    }
  }

  console.log("\n=== Seeding Complete ===");
  console.log(`  Processed: ${totalProcessed}`);
  console.log(`  Uploaded:  ${totalUploaded}`);
  console.log(`  Skipped:   ${totalSkipped}`);
  console.log(`  Errors:    ${totalErrors}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
