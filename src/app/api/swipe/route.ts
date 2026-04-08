import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/db";
import { computeEloUpdate } from "@/lib/elo";
import { validateSwipe } from "@/lib/anti-cheat";
import type { SwipeRequest, SwipeResponse, UserRow, ImageRow } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/swipe
 *
 * Submit a swipe guess and return the result with updated Elo ratings.
 * The answer (is_ai) is looked up server-side — never from client input.
 */
export async function POST(request: Request) {
  let body: SwipeRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { device_id, image_id, guessed_ai, response_ms, shown_at } = body;

  if (!device_id || !image_id || guessed_ai === undefined || !response_ms || !shown_at) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Anti-cheat validation
  const validation = validateSwipe(response_ms, shown_at);
  if (!validation.valid) {
    return Response.json({ error: validation.reason }, { status: 400 });
  }

  const db = await getDb();

  // Look up user
  const user = await db
    .prepare("SELECT * FROM users WHERE device_id = ?")
    .bind(device_id)
    .first<UserRow>();

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  // Look up image — answer comes from server DB, never from client
  const image = await db
    .prepare("SELECT * FROM images WHERE id = ? AND status = 'approved'")
    .bind(image_id)
    .first<ImageRow>();

  if (!image) {
    return Response.json({ error: "Image not found" }, { status: 404 });
  }

  // Check this image was actually shown to this user
  const history = await db
    .prepare(
      "SELECT 1 FROM user_image_history WHERE user_id = ? AND image_id = ?"
    )
    .bind(user.id, image_id)
    .first();

  if (!history) {
    return Response.json(
      { error: "Image was not served to this user" },
      { status: 400 }
    );
  }

  // Check for duplicate swipe
  const existingAnswer = await db
    .prepare(
      "SELECT 1 FROM answers WHERE user_id = ? AND image_id = ?"
    )
    .bind(user.id, image_id)
    .first();

  if (existingAnswer) {
    return Response.json(
      { error: "Already answered this image" },
      { status: 409 }
    );
  }

  // Determine correctness
  const isAi = image.is_ai === 1;
  const correct = guessed_ai === isAi;

  // Compute Elo updates
  const elo = computeEloUpdate(
    user.elo_rating,
    image.elo_rating,
    correct,
    user.total_played
  );

  // Calculate new streaks
  const newStreak = correct ? user.current_streak + 1 : 0;
  const newBestStreak = Math.max(user.best_streak, newStreak);
  const newTotalPlayed = user.total_played + 1;
  const newTotalCorrect = user.total_correct + (correct ? 1 : 0);

  // Write answer
  await db
    .prepare(
      `INSERT INTO answers (id, user_id, image_id, guessed_ai, correct, response_ms,
         user_elo_before, user_elo_after, image_elo_before, image_elo_after)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      uuidv4(),
      user.id,
      image_id,
      guessed_ai ? 1 : 0,
      correct ? 1 : 0,
      response_ms,
      user.elo_rating,
      elo.newUserElo,
      image.elo_rating,
      elo.newImageElo
    )
    .run();

  // Update user
  await db
    .prepare(
      `UPDATE users SET
         elo_rating = ?, total_played = ?, total_correct = ?,
         current_streak = ?, best_streak = ?,
         updated_at = datetime('now'), last_active_at = datetime('now')
       WHERE id = ?`
    )
    .bind(
      elo.newUserElo,
      newTotalPlayed,
      newTotalCorrect,
      newStreak,
      newBestStreak,
      user.id
    )
    .run();

  // Update image stats — skip Elo update during user's provisional period
  // to prevent spam/testing from corrupting image difficulty ratings
  const isProvisional = user.total_played < 30;
  const timesShown = image.times_shown + 1;
  const timesCorrect = image.times_correct + (correct ? 1 : 0);
  const timesFooled = image.times_fooled + (correct ? 0 : 1);
  const imageElo = isProvisional ? image.elo_rating : elo.newImageElo;

  await db
    .prepare(
      `UPDATE images SET
         elo_rating = ?, times_shown = ?, times_correct = ?, times_fooled = ?,
         updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(imageElo, timesShown, timesCorrect, timesFooled, image_id)
    .run();

  // Upsert daily stats
  const today = new Date().toISOString().split("T")[0];
  await db
    .prepare(
      `INSERT INTO daily_stats (user_id, date, games_played, correct, elo_start, elo_end, best_streak)
       VALUES (?, ?, 1, ?, ?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET
         games_played = games_played + 1,
         correct = correct + ?,
         elo_end = ?,
         best_streak = MAX(best_streak, ?)`
    )
    .bind(
      user.id,
      today,
      correct ? 1 : 0,
      user.elo_rating,
      elo.newUserElo,
      newStreak,
      correct ? 1 : 0,
      elo.newUserElo,
      newStreak
    )
    .run();

  const response: SwipeResponse = {
    correct,
    is_ai: isAi,
    user: {
      elo_rating: elo.newUserElo,
      elo_delta: elo.userDelta,
      total_played: newTotalPlayed,
      total_correct: newTotalCorrect,
      current_streak: newStreak,
      best_streak: newBestStreak,
      accuracy: newTotalPlayed > 0 ? newTotalCorrect / newTotalPlayed : 0,
    },
    image: {
      elo_rating: elo.newImageElo,
      times_shown: timesShown,
      fool_rate: timesShown > 0 ? timesFooled / timesShown : 0,
    },
  };

  return Response.json(response);
}
