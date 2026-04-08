// ============================================================
// Content hash for image deduplication
//
// Since we can't use sharp or canvas in Workers, we use SHA-256
// of the raw image bytes for exact-match dedup. This won't catch
// near-duplicates the way a perceptual hash would, but it handles
// the common case of the same image being fetched twice from the
// same source.
//
// The seed scripts (which run locally with Node.js) can use a
// proper perceptual hash via sharp.
// ============================================================

/**
 * Compute a SHA-256 hex digest of the image bytes.
 * Uses the Web Crypto API (available in Workers and Node 18+).
 */
export async function computeContentHash(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);

  // Convert to hex string
  let hex = "";
  for (let i = 0; i < hashArray.length; i++) {
    hex += hashArray[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Check if a hash already exists in the database.
 * Returns the existing image ID if found, null otherwise.
 */
export async function isDuplicate(
  db: D1Database,
  hash: string
): Promise<string | null> {
  const result = await db
    .prepare("SELECT id FROM images WHERE phash = ? LIMIT 1")
    .bind(hash)
    .first<{ id: string }>();

  return result ? result.id : null;
}
