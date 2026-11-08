// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { selectIsFirstVisit, type GameState } from "@/stores/game-store";

function state(hasSeenOnboarding: boolean, totalPlayed: number): GameState {
  return { hasSeenOnboarding, stats: { totalPlayed } } as GameState;
}

describe("selectIsFirstVisit", () => {
  it("is true only before any play and before the flag is set", () => {
    expect(selectIsFirstVisit(state(false, 0))).toBe(true);
  });

  it("is false for a returning player whose flag was never set", () => {
    expect(selectIsFirstVisit(state(false, 120))).toBe(false);
  });

  it("is false once the first swipe sets the flag", () => {
    expect(selectIsFirstVisit(state(true, 0))).toBe(false);
  });
});
