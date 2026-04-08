import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/db";
import { selectNextImage } from "@/lib/image-selection";
import { IMAGE_BASE_URL, ELO_DEFAULT } from "@/lib/constants";
import type { UserRow } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/images/next?device_id=xxx&category=all
 *
 * Returns the next image for the user to judge.
 * CRITICAL: Response NEVER contains is_ai, source, ai_model, or any answer.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get("device_id");
  const category = searchParams.get("category") || "all";

  if (!deviceId) {
    return Response.json({ error: "device_id required" }, { status: 400 });
  }

  const db = await getDb();

  // Look up or create user
  let user = await db
    .prepare("SELECT * FROM users WHERE device_id = ?")
    .bind(deviceId)
    .first<UserRow>();

  if (!user) {
    const userId = uuidv4();
    await db
      .prepare(
        "INSERT INTO users (id, device_id, elo_rating) VALUES (?, ?, ?)"
      )
      .bind(userId, deviceId, ELO_DEFAULT)
      .run();
    user = await db
      .prepare("SELECT * FROM users WHERE id = ?")
      .bind(userId)
      .first<UserRow>();
  }

  if (!user) {
    return Response.json({ error: "Failed to create user" }, { status: 500 });
  }

  // Select next image
  const image = await selectNextImage(db, user.id, user.elo_rating, category);

  if (!image) {
    return Response.json(
      { error: "No images available. Check back later!" },
      { status: 404 }
    );
  }

  // Record in history
  await db
    .prepare(
      "INSERT OR IGNORE INTO user_image_history (user_id, image_id) VALUES (?, ?)"
    )
    .bind(user.id, image.id)
    .run();

  // Return ONLY safe fields — no is_ai, no source, no ai_model
  return Response.json({
    image: {
      id: image.id,
      url: `${IMAGE_BASE_URL}/${image.r2_key}`,
      width: image.width,
      height: image.height,
      category: image.category_slug,
    },
    session: {
      shown_at: Date.now(),
    },
  });
}
