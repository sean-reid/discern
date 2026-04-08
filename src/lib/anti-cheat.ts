import { MIN_RESPONSE_MS, MAX_RESPONSE_AGE_MS } from "./constants";

export interface SwipeValidation {
  valid: boolean;
  reason?: string;
}

/**
 * Validates a swipe submission for cheating signals.
 */
export function validateSwipe(
  responseMs: number,
  shownAt: number,
  now: number = Date.now()
): SwipeValidation {
  if (responseMs < MIN_RESPONSE_MS) {
    return { valid: false, reason: "Response too fast — likely automated" };
  }

  if (shownAt > now + 5000) {
    // 5s tolerance for clock drift
    return { valid: false, reason: "shown_at is in the future" };
  }

  const age = now - shownAt;
  if (age > MAX_RESPONSE_AGE_MS) {
    return { valid: false, reason: "Image shown too long ago" };
  }

  return { valid: true };
}
