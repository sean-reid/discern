#!/usr/bin/env npx tsx
// ============================================================
// Validate Corpus
//
// Checks every image in the database:
//   1. R2 file exists and is accessible
//   2. Dimensions meet minimum requirements
//   3. No duplicate hashes
//   4. Reports any issues found
//
// Usage:
//   npx tsx scripts/validate-corpus.ts [--fix]
//
// With --fix, will retire images that have issues.
// ============================================================

import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

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

const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;

// ---- CLI args ----

const shouldFix = process.argv.includes("--fix");

// ---- D1 operations ----

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

// ---- R2 operations ----

async function getR2Client() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

async function checkR2FileExists(client: any, key: string): Promise<boolean> {
  try {
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
    await client.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
}

async function downloadR2File(client: any, key: string): Promise<Buffer | null> {
  try {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const response = await client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      })
    );

    if (!response.Body) return null;

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    const reader = response.Body as AsyncIterable<Uint8Array>;
    for await (const chunk of reader) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}

// ---- Types ----

interface ImageRecord {
  id: string;
  r2_key: string;
  is_ai: number;
  phash: string | null;
  width: number;
  height: number;
  status: string;
  source: string;
  ai_model: string | null;
}

interface Issue {
  imageId: string;
  r2Key: string;
  type: "missing_r2" | "bad_dimensions" | "duplicate_hash" | "corrupt";
  detail: string;
}

// ---- Main ----

async function main(): Promise<void> {
  console.log("=== Discern: Corpus Validation ===\n");
  if (shouldFix) {
    console.log("Running in FIX mode: will retire images with issues.\n");
  }

  // Fetch all images from DB
  const result = await d1Query(
    `SELECT id, r2_key, is_ai, phash, width, height, status, source, ai_model
     FROM images
     ORDER BY created_at DESC`
  );

  const images: ImageRecord[] = result?.results || [];
  console.log(`Found ${images.length} images in database.\n`);

  if (images.length === 0) {
    console.log("Nothing to validate.");
    return;
  }

  const issues: Issue[] = [];
  const hashMap = new Map<string, string[]>(); // hash -> image IDs

  // Build hash index for duplicate detection
  for (const img of images) {
    if (img.phash) {
      const ids = hashMap.get(img.phash) || [];
      ids.push(img.id);
      hashMap.set(img.phash, ids);
    }
  }

  // Check for duplicate hashes
  let duplicateCount = 0;
  for (const [hash, ids] of hashMap.entries()) {
    if (ids.length > 1) {
      duplicateCount += ids.length - 1;
      for (const id of ids.slice(1)) {
        issues.push({
          imageId: id,
          r2Key: images.find((img) => img.id === id)?.r2_key || "",
          type: "duplicate_hash",
          detail: `Duplicate hash ${hash.slice(0, 12)}... shared with ${ids[0]}`,
        });
      }
    }
  }

  // Check R2 files and dimensions
  let r2Client: any = null;
  if (R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
    r2Client = await getR2Client();
  } else {
    console.warn("R2 credentials not configured. Skipping R2 file checks.\n");
  }

  let checked = 0;
  const total = images.length;

  for (const img of images) {
    checked++;
    if (checked % 50 === 0 || checked === total) {
      process.stdout.write(`\rChecking images: ${checked}/${total}`);
    }

    // Check DB dimensions
    if (img.width < MIN_WIDTH || img.height < MIN_HEIGHT) {
      issues.push({
        imageId: img.id,
        r2Key: img.r2_key,
        type: "bad_dimensions",
        detail: `Dimensions ${img.width}x${img.height} below minimum ${MIN_WIDTH}x${MIN_HEIGHT}`,
      });
    }

    // Check R2 file exists
    if (r2Client) {
      const exists = await checkR2FileExists(r2Client, img.r2_key);
      if (!exists) {
        issues.push({
          imageId: img.id,
          r2Key: img.r2_key,
          type: "missing_r2",
          detail: `R2 file not found: ${img.r2_key}`,
        });
        continue; // Can't check further without the file
      }

      // Spot-check: download and verify a sample of images (every 10th)
      if (checked % 10 === 0) {
        const buffer = await downloadR2File(r2Client, img.r2_key);
        if (!buffer) {
          issues.push({
            imageId: img.id,
            r2Key: img.r2_key,
            type: "corrupt",
            detail: "Could not download file from R2",
          });
          continue;
        }

        try {
          const metadata = await sharp(buffer).metadata();
          if (!metadata.width || !metadata.height) {
            issues.push({
              imageId: img.id,
              r2Key: img.r2_key,
              type: "corrupt",
              detail: "Could not read image dimensions (file may be corrupt)",
            });
          }
        } catch {
          issues.push({
            imageId: img.id,
            r2Key: img.r2_key,
            type: "corrupt",
            detail: "sharp could not parse image (file is corrupt or not a valid image)",
          });
        }
      }
    }
  }

  console.log("\n");

  // Report results
  const byType = {
    missing_r2: issues.filter((i) => i.type === "missing_r2"),
    bad_dimensions: issues.filter((i) => i.type === "bad_dimensions"),
    duplicate_hash: issues.filter((i) => i.type === "duplicate_hash"),
    corrupt: issues.filter((i) => i.type === "corrupt"),
  };

  console.log("=== Validation Results ===\n");
  console.log(`Total images checked: ${images.length}`);
  console.log(`Total issues found:   ${issues.length}`);
  console.log(`  Missing R2 files:   ${byType.missing_r2.length}`);
  console.log(`  Bad dimensions:     ${byType.bad_dimensions.length}`);
  console.log(`  Duplicate hashes:   ${byType.duplicate_hash.length}`);
  console.log(`  Corrupt files:      ${byType.corrupt.length}`);

  if (issues.length > 0) {
    console.log("\n--- Issue Details ---\n");

    for (const issue of issues.slice(0, 50)) {
      const typeLabel = {
        missing_r2: "MISSING",
        bad_dimensions: "DIMENSIONS",
        duplicate_hash: "DUPLICATE",
        corrupt: "CORRUPT",
      }[issue.type];

      console.log(`  [${typeLabel}] ${issue.imageId.slice(0, 8)}... ${issue.detail}`);
    }

    if (issues.length > 50) {
      console.log(`  ... and ${issues.length - 50} more issues`);
    }
  }

  // Fix mode: retire problematic images
  if (shouldFix && issues.length > 0) {
    console.log("\n--- Applying Fixes ---\n");

    let fixed = 0;
    for (const issue of issues) {
      try {
        await d1Query(
          `UPDATE images SET status = 'retired', retired_reason = ?, updated_at = datetime('now') WHERE id = ?`,
          [`Validation: ${issue.type} - ${issue.detail}`, issue.imageId]
        );
        fixed++;
      } catch (err) {
        console.error(`Failed to retire ${issue.imageId}:`, err);
      }
    }

    console.log(`Retired ${fixed} images.`);
  } else if (issues.length > 0 && !shouldFix) {
    console.log("\nRun with --fix to retire images that have issues.");
  }

  // Summary stats
  console.log("\n--- Corpus Stats ---\n");

  const statResult = await d1Query(`
    SELECT
      status,
      is_ai,
      COUNT(*) as count
    FROM images
    GROUP BY status, is_ai
    ORDER BY status, is_ai
  `);

  if (statResult?.results) {
    for (const row of statResult.results) {
      const type = row.is_ai ? "AI" : "Real";
      console.log(`  ${row.status} / ${type}: ${row.count}`);
    }
  }

  const catResult = await d1Query(`
    SELECT
      c.slug,
      COUNT(*) as count,
      SUM(CASE WHEN i.is_ai = 1 THEN 1 ELSE 0 END) as ai_count,
      SUM(CASE WHEN i.is_ai = 0 THEN 1 ELSE 0 END) as real_count
    FROM images i
    JOIN categories c ON c.id = i.category_id
    WHERE i.status = 'approved'
    GROUP BY c.slug
    ORDER BY c.slug
  `);

  if (catResult?.results) {
    console.log("\n  By category (approved only):");
    for (const row of catResult.results) {
      console.log(
        `    ${row.slug}: ${row.count} total (${row.real_count} real, ${row.ai_count} AI)`
      );
    }
  }

  console.log("\nValidation complete.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
