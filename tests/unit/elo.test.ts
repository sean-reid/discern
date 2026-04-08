import { describe, it, expect } from "vitest";
import { expectedScore, computeEloUpdate } from "@/lib/elo";

describe("expectedScore", () => {
  it("returns 0.5 for equal Elos", () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5);
  });

  it("returns higher value when user Elo is above image Elo", () => {
    const score = expectedScore(1400, 1200);
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeCloseTo(0.76, 1);
  });

  it("returns lower value when user Elo is below image Elo", () => {
    const score = expectedScore(1200, 1400);
    expect(score).toBeLessThan(0.5);
    expect(score).toBeCloseTo(0.24, 1);
  });
});

describe("computeEloUpdate", () => {
  it("increases user Elo and decreases image Elo on correct guess", () => {
    const result = computeEloUpdate(1200, 1200, true, 50);
    expect(result.newUserElo).toBeGreaterThan(1200);
    expect(result.newImageElo).toBeLessThan(1200);
    expect(result.userDelta).toBeGreaterThan(0);
    expect(result.imageDelta).toBeLessThan(0);
  });

  it("decreases user Elo and increases image Elo on wrong guess", () => {
    const result = computeEloUpdate(1200, 1200, false, 50);
    expect(result.newUserElo).toBeLessThan(1200);
    expect(result.newImageElo).toBeGreaterThan(1200);
    expect(result.userDelta).toBeLessThan(0);
    expect(result.imageDelta).toBeGreaterThan(0);
  });

  it("gives small delta for expected outcomes", () => {
    // High-rated user correctly guesses easy image: expected, small gain
    const result = computeEloUpdate(1500, 1100, true, 50);
    expect(Math.abs(result.userDelta)).toBeLessThan(5);
  });

  it("gives large delta for upsets", () => {
    // High-rated user gets easy image wrong: unexpected, big loss
    const result = computeEloUpdate(1500, 1100, false, 50);
    expect(Math.abs(result.userDelta)).toBeGreaterThan(25);
  });

  it("uses provisional K-factor for new users (first 30 games)", () => {
    const provisional = computeEloUpdate(1200, 1200, true, 5);
    const established = computeEloUpdate(1200, 1200, true, 50);
    // Provisional K=48 vs established K=32, so provisional delta should be larger
    expect(Math.abs(provisional.userDelta)).toBeGreaterThan(
      Math.abs(established.userDelta)
    );
  });

  it("clamps Elo to minimum of 400", () => {
    const result = computeEloUpdate(410, 2000, false, 50);
    expect(result.newUserElo).toBeGreaterThanOrEqual(400);
  });

  it("clamps Elo to maximum of 2400", () => {
    const result = computeEloUpdate(2390, 800, true, 50);
    expect(result.newUserElo).toBeLessThanOrEqual(2400);
  });
});
