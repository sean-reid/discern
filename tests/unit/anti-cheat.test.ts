import { describe, it, expect } from "vitest";
import { validateSwipe } from "@/lib/anti-cheat";

describe("validateSwipe", () => {
  const now = 1712500000000;

  it("rejects response_ms below minimum (too fast)", () => {
    const result = validateSwipe(100, now - 5000, now);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("too fast");
  });

  it("rejects shown_at in the future", () => {
    const result = validateSwipe(2000, now + 60000, now);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("future");
  });

  it("rejects shown_at older than 5 minutes", () => {
    const result = validateSwipe(2000, now - 6 * 60 * 1000, now);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("too long ago");
  });

  it("accepts valid swipe within normal parameters", () => {
    const result = validateSwipe(2000, now - 3000, now);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("accepts swipe right at the minimum response time", () => {
    const result = validateSwipe(300, now - 1000, now);
    expect(result.valid).toBe(true);
  });

  it("tolerates small clock drift (shown_at slightly in future)", () => {
    const result = validateSwipe(2000, now + 3000, now);
    expect(result.valid).toBe(true);
  });
});
