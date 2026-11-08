// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FirstSwipeHint } from "@/components/FirstSwipeHint";
import { useGameStore } from "@/stores/game-store";

function seed(hasSeenOnboarding: boolean, totalPlayed: number) {
  useGameStore.setState((s) => ({
    hasSeenOnboarding,
    stats: { ...s.stats, totalPlayed },
  }));
}

describe("FirstSwipeHint", () => {
  beforeEach(() => seed(false, 0));

  it("shows on a first visit", () => {
    render(<FirstSwipeHint />);
    expect(screen.getByTestId("swipe-hint").textContent).toContain("Swipe left if it's AI");
  });

  it("stays hidden for a returning player whose flag was never set", () => {
    seed(false, 37);
    render(<FirstSwipeHint />);
    expect(screen.queryByTestId("swipe-hint")).toBeNull();
  });

  it("stays hidden once the first swipe sets the flag", () => {
    seed(true, 0);
    render(<FirstSwipeHint />);
    expect(screen.queryByTestId("swipe-hint")).toBeNull();
  });
});
