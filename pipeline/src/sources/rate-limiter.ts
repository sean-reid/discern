/**
 * Simple per-source cooldown tracker.
 *
 * When a source hits a rate limit (429) or quota error, it gets
 * cooled down for a period. Subsequent calls check the cooldown
 * before making a request.
 */

const cooldowns: Map<string, number> = new Map();

const DEFAULT_COOLDOWN_MS = 60_000;       // 1 minute for 429s
const EXHAUSTED_COOLDOWN_MS = 3_600_000;  // 1 hour for quota exhaustion

/**
 * Check if a source is currently cooled down.
 */
export function isCoolingDown(source: string): boolean {
  const until = cooldowns.get(source);
  if (!until) return false;
  if (Date.now() >= until) {
    cooldowns.delete(source);
    return false;
  }
  return true;
}

/**
 * Put a source on cooldown after a rate limit or error.
 */
export function coolDown(source: string, durationMs: number = DEFAULT_COOLDOWN_MS): void {
  cooldowns.set(source, Date.now() + durationMs);
  const seconds = Math.round(durationMs / 1000);
  console.log(`[Rate Limit] ${source} cooled down for ${seconds}s`);
}

/**
 * Mark a source as exhausted (longer cooldown).
 */
export function markExhausted(source: string): void {
  coolDown(source, EXHAUSTED_COOLDOWN_MS);
}
