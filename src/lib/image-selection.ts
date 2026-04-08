import { ELO_MATCH_RANGE } from "./constants";

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

interface ImageCandidate {
  id: string;
  r2_key: string;
  width: number;
  height: number;
  category_slug: string;
}

/**
 * Select the next image for a user, matched to their Elo rating.
 *
 * Rules:
 * - Image must be approved
 * - Image must NOT be in user's history (no repeats)
 * - Image Elo within ±MATCH_RANGE of user's Elo (with fallback to wider range)
 * - Balanced 50/50 real vs AI (checks what user has seen recently, picks the underrepresented type)
 * - Prefer less-shown images
 * - Respect category filter
 */
export async function selectNextImage(
  db: D1Database,
  userId: string,
  userElo: number,
  category: string
): Promise<ImageCandidate | null> {
  // Figure out which type to show next (real or AI) to maintain 50/50 balance.
  // Count what this user has seen recently and pick the underrepresented type.
  const balance = await db
    .prepare(
      `SELECT
        SUM(CASE WHEN i.is_ai = 1 THEN 1 ELSE 0 END) as ai_count,
        SUM(CASE WHEN i.is_ai = 0 THEN 1 ELSE 0 END) as real_count
       FROM user_image_history h
       JOIN images i ON i.id = h.image_id
       WHERE h.user_id = ?`
    )
    .bind(userId)
    .first<{ ai_count: number; real_count: number }>();

  const aiCount = balance?.ai_count ?? 0;
  const realCount = balance?.real_count ?? 0;

  // Pick the underrepresented type, or random if tied
  let preferAi: number;
  if (aiCount < realCount) {
    preferAi = 1;
  } else if (realCount < aiCount) {
    preferAi = 0;
  } else {
    preferAi = Math.random() < 0.5 ? 1 : 0;
  }

  const eloMin = userElo - ELO_MATCH_RANGE;
  const eloMax = userElo + ELO_MATCH_RANGE;

  // Try preferred type first, then fall back to any type.
  // Within each type preference, try Elo-matched, then wider ranges.
  for (const isAiFilter of [preferAi, null]) {
    for (const range of [
      [eloMin, eloMax],
      [eloMin - 200, eloMax + 200],
      [0, 9999],
    ]) {
      const categoryClause =
        category === "all" ? "" : "AND c.slug = ?";
      const aiClause =
        isAiFilter !== null ? "AND i.is_ai = ?" : "";

      const query = `
        SELECT i.id, i.r2_key, i.width, i.height, c.slug as category_slug
        FROM images i
        JOIN categories c ON c.id = i.category_id
        WHERE i.status = 'approved'
          AND i.elo_rating BETWEEN ? AND ?
          AND i.id NOT IN (
            SELECT image_id FROM user_image_history WHERE user_id = ?
          )
          ${aiClause}
          ${categoryClause}
        ORDER BY i.times_shown ASC, RANDOM()
        LIMIT 5
      `;

      const bindings: unknown[] = [range[0], range[1], userId];
      if (isAiFilter !== null) {
        bindings.push(isAiFilter);
      }
      if (category !== "all") {
        bindings.push(category);
      }

      const result = await db
        .prepare(query)
        .bind(...bindings)
        .all<ImageCandidate>();

      if (result.results.length > 0) {
        const idx = Math.floor(Math.random() * result.results.length);
        return result.results[idx];
      }
    }
  }

  return null;
}
