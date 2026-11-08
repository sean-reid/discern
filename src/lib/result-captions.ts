const CORRECT_AI = [
  "Right, that was AI.",
  "Correct, AI made that one.",
  "Yes, that was generated.",
  "Good call, not a real photo.",
];

const CORRECT_REAL = [
  "Right, that was a real photo.",
  "Correct, a camera took that.",
  "Yes, that one was real.",
  "Good call, real photo.",
];

const WRONG_AI = [
  "Nope, that was AI.",
  "Not quite, AI made that one.",
  "That one was generated.",
  "Wrong, not a real photo.",
];

const WRONG_REAL = [
  "Nope, that was a real photo.",
  "Not quite, a camera took that.",
  "That one was real.",
  "Wrong, real photo.",
];

// Minimum plays before a fool rate says anything about the image.
export const FOOL_RATE_MIN_SHOWN = 5;

const lastIndex = new Map<string, number>();

function pick(pool: readonly string[], key: string, random: () => number): string {
  let i = Math.floor(random() * pool.length);
  if (pool.length > 1 && i === lastIndex.get(key)) i = (i + 1) % pool.length;
  lastIndex.set(key, i);
  return pool[i];
}

export function resultCaption(
  correct: boolean,
  isAi: boolean,
  random: () => number = Math.random
): string {
  const pool = correct
    ? isAi
      ? CORRECT_AI
      : CORRECT_REAL
    : isAi
      ? WRONG_AI
      : WRONG_REAL;
  return pick(pool, `${correct}:${isAi}`, random);
}

export function foolRateLine(foolRate: number, timesShown: number): string | null {
  if (timesShown < FOOL_RATE_MIN_SHOWN) return null;
  const n = Math.round(foolRate * 10);
  if (n <= 0) return "Hardly anyone misses this one.";
  if (n >= 10) return "Almost everyone misses this one.";
  return `Fools ${n} in 10 players.`;
}
