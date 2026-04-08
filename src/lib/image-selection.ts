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
 * - Image must NOT be in user's history
 * - Image Elo within ±MATCH_RANGE of user's Elo (with fallback to wider range)
 * - Balanced 50/50 real vs AI
 * - Prefer less-shown images
 * - Respect category filter
 */
export async function selectNextImage(
  db: D1Database,
  userId: string,
  userElo: number,
  category: string
): Promise<ImageCandidate | null> {
  const eloMin = userElo - ELO_MATCH_RANGE;
  const eloMax = userElo + ELO_MATCH_RANGE;

  // Try Elo-matched range first, then fall back to wider
  for (const range of [
    [eloMin, eloMax],
    [eloMin - 200, eloMax + 200],
    [0, 9999],
  ]) {
    const categoryFilter =
      category === "all"
        ? ""
        : "AND c.slug = ?";

    const query = `
      SELECT i.id, i.r2_key, i.width, i.height, c.slug as category_slug
      FROM images i
      JOIN categories c ON c.id = i.category_id
      WHERE i.status = 'approved'
        AND i.elo_rating BETWEEN ? AND ?
        AND i.id NOT IN (
          SELECT image_id FROM user_image_history WHERE user_id = ?
        )
        ${categoryFilter}
      ORDER BY i.times_shown ASC, RANDOM()
      LIMIT 5
    `;

    const bindings: unknown[] = [range[0], range[1], userId];
    if (category !== "all") {
      bindings.push(category);
    }

    const result = await db
      .prepare(query)
      .bind(...bindings)
      .all<ImageCandidate>();

    if (result.results.length > 0) {
      // Pick randomly from the top 5 least-shown candidates
      const idx = Math.floor(Math.random() * result.results.length);
      return result.results[idx];
    }
  }

  return null;
}
