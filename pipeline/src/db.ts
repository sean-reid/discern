// ============================================================
// D1 helper functions for the pipeline worker
// ============================================================

export interface InsertImageParams {
  id: string;
  r2Key: string;
  isAi: boolean;
  categoryId: number;
  source: string;
  sourceId: string | null;
  sourceUrl: string | null;
  photographer: string | null;
  aiModel: string | null;
  phash: string | null;
  width: number;
  height: number;
  fileSizeBytes: number;
  exifConfidence: number;
  status?: string;
}

export interface ImageForEloRecalc {
  id: string;
  elo_rating: number;
  times_shown: number;
  times_correct: number;
  times_fooled: number;
  is_ai: number;
}

/**
 * Insert a new image record into D1.
 */
export async function insertImage(
  db: D1Database,
  params: InsertImageParams
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO images (
        id, r2_key, is_ai, category_id, source, source_id, source_url,
        photographer, ai_model, phash, width, height, file_size_bytes,
        exif_confidence, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      params.id,
      params.r2Key,
      params.isAi ? 1 : 0,
      params.categoryId,
      params.source,
      params.sourceId,
      params.sourceUrl,
      params.photographer,
      params.aiModel,
      params.phash,
      params.width,
      params.height,
      params.fileSizeBytes,
      params.exifConfidence,
      params.status || "approved"
    )
    .run();
}

/**
 * Update an image's Elo rating.
 */
export async function updateImageElo(
  db: D1Database,
  imageId: string,
  newElo: number
): Promise<void> {
  await db
    .prepare(
      `UPDATE images SET elo_rating = ?, updated_at = datetime('now') WHERE id = ?`
    )
    .bind(newElo, imageId)
    .run();
}

/**
 * Get images with enough answers for Elo recalculation.
 * Only considers approved images with 20+ total responses.
 */
export async function getImagesForEloRecalc(
  db: D1Database,
  minAnswers: number = 20
): Promise<ImageForEloRecalc[]> {
  const result = await db
    .prepare(
      `SELECT id, elo_rating, times_shown, times_correct, times_fooled, is_ai
       FROM images
       WHERE status = 'approved'
         AND (times_correct + times_fooled) >= ?
       ORDER BY times_shown DESC`
    )
    .bind(minAnswers)
    .all<ImageForEloRecalc>();

  return result.results;
}

/**
 * Check if a source image already exists (by source + sourceId).
 */
export async function sourceImageExists(
  db: D1Database,
  source: string,
  sourceId: string
): Promise<boolean> {
  const result = await db
    .prepare("SELECT 1 FROM images WHERE source = ? AND source_id = ? LIMIT 1")
    .bind(source, sourceId)
    .first();

  return result !== null;
}

/**
 * Look up a category by slug and return its ID.
 */
export async function getCategoryId(
  db: D1Database,
  slug: string
): Promise<number | null> {
  const result = await db
    .prepare("SELECT id FROM categories WHERE slug = ? AND active = 1")
    .bind(slug)
    .first<{ id: number }>();

  return result?.id ?? null;
}

/**
 * Log an ingestion batch.
 */
export async function logIngestionBatch(
  db: D1Database,
  batchId: string,
  source: string,
  fetched: number,
  approved: number,
  rejected: number,
  duplicate: number,
  errors: string | null
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO image_ingestion_log
        (batch_id, source, total_fetched, total_approved, total_rejected,
         total_duplicate, errors, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(batchId, source, fetched, approved, rejected, duplicate, errors)
    .run();
}
