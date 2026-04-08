#!/usr/bin/env npx tsx
// ============================================================
// Seed AI Images
//
// Reads pre-generated AI images from a local directory, processes
// them (resize, WebP, strip EXIF, light augmentation), uploads
// to R2, and inserts into D1 with is_ai=1.
//
// Expected directory structure:
//   ai-images/{model-name}/{filename}.{ext}
//
// Example:
//   ai-images/midjourney-v5/landscape-001.png
//   ai-images/stable-diffusion-xl/portrait-042.jpg
//   ai-images/dall-e-3/food-017.webp
//
// Usage:
//   npx tsx scripts/seed-ai-images.ts [--dir ./ai-images] [--category people]
//
// Reads config from .env in the project root.
// ============================================================

import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

// ---- Config ----

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

const R2_ENDPOINT = process.env.R2_S3_ENDPOINT || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET = process.env.R2_BUCKET || "discern-images";
const D1_API_URL = process.env.D1_API_URL || "";
const D1_API_TOKEN = process.env.D1_API_TOKEN || "";
const D1_DATABASE_ID = process.env.D1_DATABASE_ID || "";

// ---- CLI args ----

function parseArgs(): { dir: string; category: string | null } {
  const args = process.argv.slice(2);
  let dir = path.resolve("ai-images");
  let category: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dir" && args[i + 1]) {
      dir = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === "--category" && args[i + 1]) {
      category = args[i + 1];
      i++;
    }
  }

  return { dir, category };
}

// ---- Image extensions we accept ----

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".tiff", ".bmp"]);

// ---- Category detection from filename or path ----

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  people: ["portrait", "person", "people", "face", "human", "selfie"],
  landscapes: ["landscape", "nature", "mountain", "sunset", "scenery", "ocean", "forest"],
  animals: ["animal", "wildlife", "dog", "cat", "bird", "fish", "pet"],
  food: ["food", "dish", "meal", "cuisine", "plate", "restaurant", "cooking"],
  architecture: ["architecture", "building", "house", "tower", "bridge", "interior"],
  art: ["art", "painting", "sculpture", "abstract", "gallery", "illustration"],
  street: ["street", "urban", "city", "downtown", "alley", "sidewalk"],
};

function guessCategory(filename: string): string {
  const lower = filename.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) return category;
    }
  }
  // Default to "art" for AI images with no clear category
  return "art";
}

// ---- Image processing with augmentation ----

/**
 * Process an AI image:
 * - Resize to max 1200px
 * - Convert to WebP quality 80
 * - Strip all EXIF/metadata
 * - Random crop 1-3% (to break exact-match detection)
 * - Random brightness/saturation shift of +/-3%
 * - Compute perceptual hash
 */
async function processAiImage(
  inputBuffer: Buffer
): Promise<{ buffer: Buffer; width: number; height: number; hash: string } | null> {
  try {
    const metadata = await sharp(inputBuffer).metadata();
    if (!metadata.width || !metadata.height) return null;

    // Random crop: 1-3% from each edge
    const cropPercent = 0.01 + Math.random() * 0.02;
    const cropLeft = Math.floor(metadata.width * cropPercent);
    const cropTop = Math.floor(metadata.height * cropPercent);
    const cropWidth = metadata.width - cropLeft * 2;
    const cropHeight = metadata.height - cropTop * 2;

    if (cropWidth < 800 || cropHeight < 600) {
      // Image too small after cropping; skip the crop
      if (metadata.width < 800 || metadata.height < 600) return null;
    }

    // Random brightness shift: -3% to +3%
    const brightnessShift = 0.97 + Math.random() * 0.06; // 0.97 to 1.03

    // Random saturation shift: -3% to +3%
    const saturationShift = 0.97 + Math.random() * 0.06;

    let pipeline = sharp(inputBuffer);

    // Apply crop if image is large enough
    if (cropWidth >= 800 && cropHeight >= 600) {
      pipeline = pipeline.extract({
        left: cropLeft,
        top: cropTop,
        width: cropWidth,
        height: cropHeight,
      });
    }

    // Resize, adjust colors, convert to WebP
    pipeline = pipeline
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .modulate({ brightness: brightnessShift, saturation: saturationShift })
      .removeAlpha()
      .webp({ quality: 80 })
      .withMetadata({}); // strip metadata

    const outputBuffer = await pipeline.toBuffer();
    const outputMeta = await sharp(outputBuffer).metadata();

    // Compute perceptual hash (average hash)
    const hashBuffer = await sharp(inputBuffer)
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

// ---- R2 upload ----

async function uploadToR2(key: string, data: Buffer, contentType: string): Promise<boolean> {
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error("R2 credentials not configured.");
    return false;
  }

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

async function d1Query(sql: string, params: any[] = []): Promise<any> {
  if (!D1_API_URL || !D1_API_TOKEN || !D1_DATABASE_ID) {
    console.error("D1 API not configured.");
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

  const data: any = await res.json();
  return data.result?.[0] || null;
}

async function getCategoryIdLocal(slug: string): Promise<number | null> {
  const result = await d1Query(
    "SELECT id FROM categories WHERE slug = ? AND active = 1",
    [slug]
  );
  return result?.results?.[0]?.id ?? null;
}

async function hashExistsLocal(hash: string): Promise<boolean> {
  const result = await d1Query(
    "SELECT 1 FROM images WHERE phash = ? LIMIT 1",
    [hash]
  );
  return (result?.results?.length ?? 0) > 0;
}

async function insertAiImage(params: {
  id: string;
  r2Key: string;
  categoryId: number;
  aiModel: string;
  phash: string;
  width: number;
  height: number;
  fileSizeBytes: number;
}): Promise<void> {
  await d1Query(
    `INSERT INTO images (
      id, r2_key, is_ai, category_id, source, source_id, source_url,
      photographer, ai_model, phash, width, height, file_size_bytes,
      exif_confidence, status
    ) VALUES (?, ?, 1, ?, 'ai-generated', NULL, NULL, NULL, ?, ?, ?, ?, ?, 0.0, 'approved')`,
    [
      params.id,
      params.r2Key,
      params.categoryId,
      params.aiModel,
      params.phash,
      params.width,
      params.height,
      params.fileSizeBytes,
    ]
  );
}

// ---- Main ----

async function main(): Promise<void> {
  const { dir, category: filterCategory } = parseArgs();

  console.log("=== Discern: Seeding AI Images ===\n");
  console.log(`Source directory: ${dir}`);
  if (filterCategory) console.log(`Category filter: ${filterCategory}`);

  if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    console.error(
      "Create the directory and add AI images organized as: ai-images/{model-name}/{filename}.{ext}"
    );
    process.exit(1);
  }

  // Scan for model directories
  const modelDirs = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (modelDirs.length === 0) {
    console.error("No model subdirectories found. Expected structure: ai-images/{model-name}/");
    process.exit(1);
  }

  console.log(`Found model directories: ${modelDirs.join(", ")}\n`);

  let totalProcessed = 0;
  let totalUploaded = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const modelName of modelDirs) {
    const modelDir = path.join(dir, modelName);
    console.log(`\n--- Model: ${modelName} ---`);

    const files = fs
      .readdirSync(modelDir)
      .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()));

    console.log(`  Found ${files.length} image files`);

    for (const filename of files) {
      totalProcessed++;
      const filePath = path.join(modelDir, filename);

      try {
        // Determine category
        const categorySlug = filterCategory || guessCategory(filename);
        const categoryId = await getCategoryIdLocal(categorySlug);

        if (!categoryId) {
          console.warn(`  Category "${categorySlug}" not found for ${filename}, trying "art"`);
          const fallbackId = await getCategoryIdLocal("art");
          if (!fallbackId) {
            console.error(`  No "art" category either, skipping ${filename}`);
            totalSkipped++;
            continue;
          }
        }

        const finalCategoryId = categoryId || (await getCategoryIdLocal("art"))!;

        // Read and process the image
        const rawBuffer = fs.readFileSync(filePath);
        const processed = await processAiImage(rawBuffer);

        if (!processed) {
          console.warn(`  Skipped ${filename}: could not process (too small or invalid)`);
          totalSkipped++;
          continue;
        }

        // Dedup check
        if (await hashExistsLocal(processed.hash)) {
          console.log(`  Skipped ${filename}: duplicate hash`);
          totalSkipped++;
          continue;
        }

        // Upload to R2
        const imageId = uuidv4();
        const r2Key = `ai/${modelName}/${imageId}.webp`;

        const uploaded = await uploadToR2(r2Key, processed.buffer, "image/webp");
        if (!uploaded) {
          totalErrors++;
          continue;
        }

        // Insert into D1
        await insertAiImage({
          id: imageId,
          r2Key,
          categoryId: finalCategoryId,
          aiModel: modelName,
          phash: processed.hash,
          width: processed.width,
          height: processed.height,
          fileSizeBytes: processed.buffer.length,
        });

        totalUploaded++;
        console.log(`  Uploaded: ${filename} -> ${r2Key} (${categorySlug})`);
      } catch (err) {
        console.error(`  Error processing ${filename}:`, err);
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
