// ============================================================
// Pixabay API: fetch free stock photos
// Free tier: 100 requests/min, must cache 24hrs (we never re-fetch)
// ============================================================

import type { SourceImage } from "./unsplash";
import { isCoolingDown, coolDown } from "./rate-limiter";
import { tryUse } from "./cost-guard";

interface PixabayHit {
  id: number;
  imageWidth: number;
  imageHeight: number;
  user: string;
  pageURL: string;
  largeImageURL: string; // 1280px wide
  tags: string;
}

interface PixabaySearchResponse {
  total: number;
  totalHits: number;
  hits: PixabayHit[];
}

// Pixabay uses its own category names
const CATEGORY_MAP: Record<string, string> = {
  people: "people",
  landscapes: "nature",
  animals: "animals",
  food: "food",
  architecture: "buildings",
  art: "education",
  street: "places",
};

/**
 * Fetch photos from the Pixabay search API.
 * Free tier: 100 req/min, up to 200 photos per request.
 */
export async function fetchPixabayImages(
  apiKey: string,
  query: string,
  count: number,
  categorySlug?: string
): Promise<SourceImage[]> {
  if (!apiKey || isCoolingDown("pixabay") || !tryUse("pixabay")) return [];

  const perPage = Math.min(Math.max(count, 3), 200); // Pixabay minimum is 3
  const page = Math.floor(Math.random() * 10) + 1;

  const url = new URL("https://pixabay.com/api/");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("page", String(page));
  url.searchParams.set("safesearch", "true");
  url.searchParams.set("min_width", "800");
  url.searchParams.set("min_height", "600");

  if (categorySlug && CATEGORY_MAP[categorySlug]) {
    url.searchParams.set("category", CATEGORY_MAP[categorySlug]);
  }

  const response = await fetch(url.toString());

  if (response.status === 429) {
    coolDown("pixabay", 60_000);
    return [];
  }

  if (!response.ok) {
    console.log(`Pixabay API error ${response.status}`);
    return [];
  }

  const data: PixabaySearchResponse = await response.json();

  return data.hits.map((hit) => ({
    url: hit.largeImageURL,
    photographer: hit.user,
    sourceId: String(hit.id),
    sourceUrl: hit.pageURL,
    width: hit.imageWidth,
    height: hit.imageHeight,
  }));
}
