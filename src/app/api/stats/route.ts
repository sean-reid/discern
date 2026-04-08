import { getDb } from "@/lib/db";
import type { UserRow, UserStatsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/stats?device_id=xxx
 *
 * Returns user stats including category breakdown.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get("device_id");

  if (!deviceId) {
    return Response.json({ error: "device_id required" }, { status: 400 });
  }

  const db = await getDb();

  const user = await db
    .prepare("SELECT * FROM users WHERE device_id = ?")
    .bind(deviceId)
    .first<UserRow>();

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  // Category breakdown
  const categoryData = await db
    .prepare(
      `SELECT c.slug, COUNT(*) as played, SUM(a.correct) as correct
       FROM answers a
       JOIN images i ON i.id = a.image_id
       JOIN categories c ON c.id = i.category_id
       WHERE a.user_id = ?
       GROUP BY c.slug`
    )
    .bind(user.id)
    .all<{ slug: string; played: number; correct: number }>();

  const categoryBreakdown: UserStatsResponse["category_breakdown"] = {};
  for (const row of categoryData.results) {
    categoryBreakdown[row.slug] = {
      played: row.played,
      correct: row.correct,
      accuracy: row.played > 0 ? row.correct / row.played : 0,
    };
  }

  const response: UserStatsResponse = {
    elo_rating: user.elo_rating,
    total_played: user.total_played,
    total_correct: user.total_correct,
    accuracy:
      user.total_played > 0 ? user.total_correct / user.total_played : 0,
    current_streak: user.current_streak,
    best_streak: user.best_streak,
    category_breakdown: categoryBreakdown,
  };

  return Response.json(response);
}
