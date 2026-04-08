// ============================================================
// Unsplash API: fetch random photos
// Free tier: 50 requests/hour
// ============================================================

import { isCoolingDown, coolDown } from "./rate-limiter";
import { tryUse } from "./cost-guard";

export interface SourceImage {
  url: string;
  photographer: string;
  sourceId: string;
  sourceUrl: string;
  width: number;
  height: number;
}

interface UnsplashPhoto {
  id: string;
  urls: {
    regular: string;
    full: string;
  };
  width: number;
  height: number;
  user: {
    name: string;
    links: {
      html: string;
    };
  };
  links: {
    html: string;
  };
}

/**
 * Fetch random photos from the Unsplash API.
 * Uses the /photos/random endpoint with a query filter.
 *
 * Rate limit: 50 req/hr on free tier.
 * We request up to 30 images per call (API max).
 */
export async function fetchUnsplashImages(
  apiKey: string,
  query: string,
  count: number
): Promise<SourceImage[]> {
  if (!apiKey || isCoolingDown("unsplash") || !tryUse("unsplash")) return [];

  // Unsplash caps per-request count at 30
  const perRequest = Math.min(count, 30);
  const url = new URL("https://api.unsplash.com/photos/random");
  url.searchParams.set("query", query);
  url.searchParams.set("count", String(perRequest));
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("content_filter", "high"); // SFW only

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Client-ID ${apiKey}`,
      "Accept-Version": "v1",
    },
  });

  if (response.status === 429 || response.status === 403) {
    coolDown("unsplash", 3600_000); // 1 hour, they rate limit aggressively
    return [];
  }

  if (!response.ok) {
    console.log(`Unsplash API error ${response.status}`);
    return [];
  }

  const photos: UnsplashPhoto[] = await response.json();

  return photos.map((photo) => ({
    url: photo.urls.regular, // 1080px wide, good quality
    photographer: photo.user.name,
    sourceId: photo.id,
    sourceUrl: photo.links.html,
    width: photo.width,
    height: photo.height,
  }));
}
