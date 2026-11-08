// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { ResultPill } from "@/components/ResultPill";
import { useGameStore } from "@/stores/game-store";
import { RESULT_PILL_DURATION_MS } from "@/lib/constants";

function showResult(key: number, caption: string, detail: string | null = null) {
  act(() => {
    useGameStore.setState({ lastResult: { key, correct: false, caption, detail } });
  });
}

describe("ResultPill", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGameStore.setState({ lastResult: null });
  });
  afterEach(() => vi.useRealTimers());

  it("shows the caption and detail, then clears after the duration", () => {
    render(<ResultPill />);
    showResult(1, "Nope, that was AI.", "Fools 7 in 10 players.");

    const pill = screen.getByTestId("result-flash");
    expect(pill.textContent).toContain("Nope, that was AI.");
    expect(pill.textContent).toContain("Fools 7 in 10 players.");

    act(() => vi.advanceTimersByTime(RESULT_PILL_DURATION_MS));
    expect(useGameStore.getState().lastResult).toBeNull();
  });

  it("restarts the timer when a new result arrives before the old one clears", () => {
    render(<ResultPill />);
    showResult(1, "Nope, that was AI.");
    act(() => vi.advanceTimersByTime(RESULT_PILL_DURATION_MS - 100));
    showResult(2, "Right, that was a real photo.");

    act(() => vi.advanceTimersByTime(200));
    expect(useGameStore.getState().lastResult?.key).toBe(2);

    act(() => vi.advanceTimersByTime(RESULT_PILL_DURATION_MS));
    expect(useGameStore.getState().lastResult).toBeNull();
  });
});
