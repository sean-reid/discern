// ============================================================
// Unsplash API: fetch random photos
// Free tier: 50 requests/hour
// ============================================================

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
  if (!apiKey) {
    console.warn("Unsplash API key not configured, skipping");
    return [];
  }

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

  if (!response.ok) {
    const text = await response.text();
    console.error(
      `Unsplash API error ${response.status}: ${text.slice(0, 200)}`
    );
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
