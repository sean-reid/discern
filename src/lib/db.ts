/**
 * Database access layer.
 * Uses platform bindings from platform.ts.
 * Tests can inject a mock via setDb().
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

let _testDb: DB | null = null;

/** Inject a mock database (for tests only). */
export function setDb(db: DB) {
  _testDb = db;
}

/** Get the D1 database instance. */
export async function getDb(): Promise<DB> {
  if (_testDb) return _testDb;
  const { getPlatformEnv } = await import("./platform");
  const env = getPlatformEnv();
  return env.DB;
}
