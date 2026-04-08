/**
 * Platform bindings for Cloudflare D1 and R2.
 *
 * Local dev: wrangler's getPlatformProxy() provides D1/R2 bindings.
 * Production: will use OpenNext's Cloudflare context (added when deploying).
 *
 * wrangler is in serverExternalPackages (next.config.ts) so Next.js
 * won't try to bundle it.
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

export async function getPlatformEnv(): Promise<PlatformEnv> {
  if (_env) return _env;

  const { getPlatformProxy } = await import("wrangler");
  const proxy = await getPlatformProxy({ configPath: "wrangler.jsonc" });
  _env = proxy.env as unknown as PlatformEnv;
  return _env;
}
