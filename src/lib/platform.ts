/**
 * Platform bindings for Cloudflare D1 and R2.
 *
 * Uses OpenNext's getCloudflareContext() which works in both local dev
 * (via initOpenNextCloudflareForDev in next.config.ts) and production.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
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

export function getPlatformEnv(): PlatformEnv {
  const { env } = getCloudflareContext();
  return env as unknown as PlatformEnv;
}
