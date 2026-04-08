/**
 * Platform bindings for Cloudflare D1 and R2.
 *
 * Production: bindings come from the Worker environment.
 * Local dev: bindings come from wrangler's getPlatformProxy().
 *
 * This module initializes once and caches the result.
 */

import type { DB } from "./db";

interface R2Object {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
}

export interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
}

interface PlatformEnv {
  DB: DB;
  R2: R2Bucket;
}

let _env: PlatformEnv | null = null;
let _initPromise: Promise<PlatformEnv> | null = null;

async function init(): Promise<PlatformEnv> {
  // Try Cloudflare Workers (production via OpenNext)
  try {
    // Dynamic import - module only exists when deployed to Cloudflare
    const mod = await (new Function(
      'return import("@opennextjs/cloudflare")'
    )() as Promise<{ getCloudflareContext: () => Promise<{ env: unknown }> }>);
    const ctx = await mod.getCloudflareContext();
    return ctx.env as unknown as PlatformEnv;
  } catch {
    // Not in Workers
  }

  // Local dev: use wrangler's getPlatformProxy
  const { getPlatformProxy } = await import("wrangler");
  const proxy = await getPlatformProxy({ configPath: "wrangler.jsonc" });
  return proxy.env as unknown as PlatformEnv;
}

/**
 * Get platform environment (D1, R2 bindings). Cached after first call.
 */
export async function getPlatformEnv(): Promise<PlatformEnv> {
  if (_env) return _env;
  if (!_initPromise) {
    _initPromise = init().then((env) => {
      _env = env;
      return env;
    });
  }
  return _initPromise;
}
