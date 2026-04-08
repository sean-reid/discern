/**
 * Cost guard: hard limits on API calls per day.
 *
 * Prevents runaway usage. All services used are free tier,
 * but this ensures we never accidentally exceed limits
 * even if something loops or gets triggered repeatedly.
 *
 * Counts reset when the Worker restarts (which happens
 * at least daily on Cloudflare). For persistent tracking,
 * we'd need D1, but in-memory is sufficient since Workers
 * restart on each deployment and at least once per day.
 */

interface DailyCounters {
  date: string;
  counts: Record<string, number>;
}

const state: DailyCounters = {
  date: "",
  counts: {},
};

// Hard daily caps per source. These are conservative -
// well below the actual free tier limits.
const DAILY_CAPS: Record<string, number> = {
  "workers-ai": 15,       // ~10K neurons/day, each image ~700 neurons
  "huggingface": 100,      // unclear limit, stay conservative
  "pollinations": 100,     // no published limit, be respectful
  "unsplash": 40,          // 50/hr but we only run a few times/day
  "pexels": 150,           // 200/month, spread across days
};

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function ensureToday(): void {
  const d = today();
  if (state.date !== d) {
    state.date = d;
    state.counts = {};
  }
}

/**
 * Check if a source has budget remaining today.
 */
export function hasbudget(source: string): boolean {
  ensureToday();
  const cap = DAILY_CAPS[source];
  if (cap === undefined) return true; // unknown source, no cap
  const used = state.counts[source] || 0;
  return used < cap;
}

/**
 * Record one API call to a source.
 */
export function recordCall(source: string): void {
  ensureToday();
  state.counts[source] = (state.counts[source] || 0) + 1;
}

/**
 * Get remaining budget for a source.
 */
export function remaining(source: string): number {
  ensureToday();
  const cap = DAILY_CAPS[source] ?? Infinity;
  const used = state.counts[source] || 0;
  return Math.max(0, cap - used);
}

/**
 * Check budget and record a call in one step. Returns false if over budget.
 */
export function tryUse(source: string): boolean {
  if (!hasbudget(source)) return false;
  recordCall(source);
  return true;
}
