import { describe, it, expect } from "vitest";
import {
  resultCaption,
  foolRateLine,
  FOOL_RATE_MIN_SHOWN,
} from "@/lib/result-captions";

describe("resultCaption", () => {
  it("names the truth, not the guess", () => {
    expect(resultCaption(true, true, () => 0)).toMatch(/AI/);
    expect(resultCaption(true, false, () => 0)).toMatch(/real/);
    expect(resultCaption(false, true, () => 0)).toMatch(/AI/);
    expect(resultCaption(false, false, () => 0)).toMatch(/real/);
  });

  it("never repeats the previous caption for the same outcome", () => {
    const first = resultCaption(true, true, () => 0.1);
    const second = resultCaption(true, true, () => 0.1);
    expect(second).not.toBe(first);
  });

  it("opens with a verdict the player can read at a glance", () => {
    for (let i = 0; i < 20; i++) {
      expect(resultCaption(true, i % 2 === 0)).toMatch(/^(Right|Correct|Yes|Good call)/);
      expect(resultCaption(false, i % 2 === 0)).toMatch(/^(Nope|Not quite|That one|Wrong)/);
    }
  });
});

describe("foolRateLine", () => {
  it("stays quiet until the image has enough plays", () => {
    expect(foolRateLine(0.9, FOOL_RATE_MIN_SHOWN - 1)).toBeNull();
    expect(foolRateLine(0.9, FOOL_RATE_MIN_SHOWN)).not.toBeNull();
  });

  it("rounds to tenths and handles the extremes", () => {
    expect(foolRateLine(0.72, 50)).toBe("Fools 7 in 10 players.");
    expect(foolRateLine(0.04, 50)).toBe("Hardly anyone misses this one.");
    expect(foolRateLine(0.97, 50)).toBe("Almost everyone misses this one.");
  });
});
