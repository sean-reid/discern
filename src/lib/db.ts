/**
 * Database access layer.
 *
 * Production: D1 via Cloudflare Worker bindings.
 * Local dev: D1 via wrangler's getPlatformProxy().
 * Tests: inject a mock via setDb().
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

/** Set the database instance (used in tests). */
export function setDb(db: DB) {
  _db = db;
}

/** Get the current database instance. */
export async function getDb(): Promise<DB> {
  if (_db) return _db;

  // Try Cloudflare Workers environment (production)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await (Function('return import("@opennextjs/cloudflare")')() as Promise<any>);
    const ctx = await mod.getCloudflareContext();
    const db = (ctx.env as Record<string, unknown>).DB as DB;
    if (db) {
      _db = db;
      return db;
    }
  } catch {
    // Not in Cloudflare Workers
  }

  // Local dev: use wrangler's getPlatformProxy
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrangler = await (Function('return import("wrangler")')() as Promise<any>);
    const proxy = await wrangler.getPlatformProxy({
      configPath: "wrangler.jsonc",
    });
    const db = proxy.env.DB as DB;
    if (db) {
      _db = db;
      return db;
    }
  } catch {
    // wrangler not available
  }

  throw new Error(
    "No database available. Run with `npm run dev` or deploy to Cloudflare."
  );
}
