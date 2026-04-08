/**
 * Database access layer.
 *
 * In production (Cloudflare Workers), this uses D1 via env bindings.
 * For local dev, use wrangler's local D1 emulation.
 * For testing, inject a mock via setDb().
 */

export interface DB {
  prepare(query: string): PreparedStatement;
}

export interface PreparedStatement {
  bind(...values: unknown[]): PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; meta: { changes: number } }>;
}

let _db: DB | null = null;

/** Set the database instance (used by the platform adapter or tests). */
export function setDb(db: DB) {
  _db = db;
}

/** Get the current database instance. */
export async function getDb(): Promise<DB> {
  if (_db) return _db;

  // Try Cloudflare Workers environment (dynamic import, may not exist locally)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await (Function('return import("@opennextjs/cloudflare")')() as Promise<any>);
    const ctx = await mod.getCloudflareContext();
    const db = (ctx.env as Record<string, unknown>).DB as DB;
    if (db) return db;
  } catch {
    // Not in Cloudflare Workers environment
  }

  throw new Error(
    "No database available. Set one with setDb() or run in Cloudflare Workers."
  );
}
