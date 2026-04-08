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

export interface ImageForRetirement {
  id: string;
  times_shown: number;
  elo_rating: number;
  category_id: number;
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
 * Retire an image (remove from active rotation).
 */
export async function retireImage(
  db: D1Database,
  imageId: string,
  reason: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE images
       SET status = 'retired', retired_reason = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(reason, imageId)
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
 * Get the count of active users (active in the last 30 days).
 */
export async function getActiveUserCount(db: D1Database): Promise<number> {
  const result = await db
    .prepare(
      `SELECT COUNT(*) as count FROM users
       WHERE last_active_at >= datetime('now', '-30 days')`
    )
    .first<{ count: number }>();

  return result?.count ?? 0;
}

/**
 * Get images that may be ready for retirement.
 * Returns approved images with their show counts.
 */
export async function getImagesForRetirementCheck(
  db: D1Database
): Promise<ImageForRetirement[]> {
  const result = await db
    .prepare(
      `SELECT id, times_shown, elo_rating, category_id
       FROM images
       WHERE status = 'approved'
       ORDER BY times_shown DESC`
    )
    .all<ImageForRetirement>();

  return result.results;
}

/**
 * Get count of users in a given Elo bracket who have been active recently.
 */
export async function getActiveUsersInEloBracket(
  db: D1Database,
  eloMin: number,
  eloMax: number
): Promise<number> {
  const result = await db
    .prepare(
      `SELECT COUNT(*) as count FROM users
       WHERE elo_rating BETWEEN ? AND ?
         AND last_active_at >= datetime('now', '-30 days')`
    )
    .bind(eloMin, eloMax)
    .first<{ count: number }>();

  return result?.count ?? 0;
}

/**
 * Get the number of unique users who have seen a specific image.
 */
export async function getUniqueViewersForImage(
  db: D1Database,
  imageId: string
): Promise<number> {
  const result = await db
    .prepare(
      `SELECT COUNT(*) as count FROM user_image_history WHERE image_id = ?`
    )
    .bind(imageId)
    .first<{ count: number }>();

  return result?.count ?? 0;
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
