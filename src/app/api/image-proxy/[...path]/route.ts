import { getPlatformEnv } from "@/lib/platform";

export const dynamic = "force-dynamic";

/**
 * GET /api/image-proxy/{r2_key}
 *
 * Serves images from R2. In local dev this reads from wrangler's
 * local R2 emulation. In production, you'd point IMAGE_BASE_URL
 * to the R2 public domain and bypass this route entirely.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const r2Key = Array.isArray(path) ? path.join("/") : path;

  const env = getPlatformEnv();
  const object = await env.R2.get(r2Key);

  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(object.body as unknown as BodyInit, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
