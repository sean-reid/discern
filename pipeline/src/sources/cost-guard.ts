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
// Real image sources: guards prevent API key revocation.
// Gemini: paid service, cost guard to stay within $1000/year budget.
// Other AI generators: free, external limits handle it.
const DAILY_CAPS: Record<string, number> = {
  "unsplash": 40,          // 50/hr but we only run a few times/day
  "pexels": 6,             // 200/month total, ~6/day to stay within budget
  "pixabay": 300,          // 100/min limit, raised to maximize real image intake
  "gemini": 500,           // ~$0.06/day at 500 images = ~$22/year, well under $1000
  "huggingface": 20,       // ~$0.10/image = $2/day at 20 images = ~$730/year
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
export function hasBudget(source: string): boolean {
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
  if (!hasBudget(source)) return false;
  recordCall(source);
  return true;
}
