// ============================================================
// Pexels API: fetch curated/search photos
// Free tier: 200 requests/month
// ============================================================

import type { SourceImage } from "./unsplash";
import { isCoolingDown, coolDown } from "./rate-limiter";

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  photographer: string;
  url: string; // page URL
  src: {
    original: string;
    large2x: string;
    large: string;
  };
}

interface PexelsSearchResponse {
  photos: PexelsPhoto[];
  total_results: number;
  next_page?: string;
}

/**
 * Fetch photos from the Pexels search API.
 * Free tier: 200 req/month, up to 80 photos per request.
 */
export async function fetchPexelsImages(
  apiKey: string,
  query: string,
  count: number
): Promise<SourceImage[]> {
  if (!apiKey || isCoolingDown("pexels")) return [];

  const perPage = Math.min(count, 80);
  // Pick a random page offset to get variety across runs
  const page = Math.floor(Math.random() * 10) + 1;

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("page", String(page));
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("size", "large");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: apiKey,
    },
  });

  if (response.status === 429) {
    coolDown("pexels", 3600_000);
    return [];
  }

  if (!response.ok) {
    console.log(`Pexels API error ${response.status}`);
    return [];
  }

  const data: PexelsSearchResponse = await response.json();

  return data.photos.map((photo) => ({
    url: photo.src.large2x, // 2x resolution, good quality
    photographer: photo.photographer,
    sourceId: String(photo.id),
    sourceUrl: photo.url,
    width: photo.width,
    height: photo.height,
  }));
}
