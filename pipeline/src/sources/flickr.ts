// ============================================================
// Flickr API: fetch Creative Commons photos
// Free tier: 3600 requests/hour
// We filter for pre-2021 uploads to get authentic camera photos
// ============================================================

import type { SourceImage } from "./unsplash";

interface FlickrPhoto {
  id: string;
  owner: string;
  ownername: string;
  title: string;
  url_l?: string; // large 1024
  url_o?: string; // original
  url_c?: string; // medium 800
  width_l?: string;
  height_l?: string;
  width_o?: string;
  height_o?: string;
  width_c?: string;
  height_c?: string;
}

interface FlickrSearchResponse {
  photos: {
    photo: FlickrPhoto[];
    page: number;
    pages: number;
    total: number;
  };
  stat: string;
}

// License IDs for Creative Commons (free to use)
// 1=CC BY-NC-SA, 2=CC BY-NC, 3=CC BY-NC-ND, 4=CC BY, 5=CC BY-SA, 6=CC BY-ND, 9=CC0, 10=PDM
const CC_LICENSES = "1,2,3,4,5,6,9,10";

// Unix timestamp for Jan 1 2021 -- we want photos uploaded before this
// to increase the likelihood they are real camera photos, not AI-generated
const PRE_2021_TIMESTAMP = "1609459200";

/**
 * Fetch CC-licensed photos from Flickr.
 * Filters to pre-2021 uploads to avoid AI-generated content.
 */
export async function fetchFlickrImages(
  apiKey: string,
  query: string,
  count: number
): Promise<SourceImage[]> {
  if (!apiKey) {
    console.warn("Flickr API key not configured, skipping");
    return [];
  }

  const perPage = Math.min(count, 100);
  // Random page for variety across runs
  const page = Math.floor(Math.random() * 20) + 1;

  const url = new URL("https://www.flickr.com/services/rest/");
  url.searchParams.set("method", "flickr.photos.search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("text", query);
  url.searchParams.set("license", CC_LICENSES);
  url.searchParams.set("media", "photos");
  url.searchParams.set("content_type", "1"); // photos only
  url.searchParams.set("min_upload_date", "1262304000"); // Jan 1, 2010
  url.searchParams.set("max_upload_date", PRE_2021_TIMESTAMP);
  url.searchParams.set("extras", "url_l,url_o,url_c,owner_name");
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("page", String(page));
  url.searchParams.set("sort", "interestingness-desc");
  url.searchParams.set("format", "json");
  url.searchParams.set("nojsoncallback", "1");

  const response = await fetch(url.toString());

  if (!response.ok) {
    const text = await response.text();
    console.error(
      `Flickr API error ${response.status}: ${text.slice(0, 200)}`
    );
    return [];
  }

  const data: FlickrSearchResponse = await response.json();

  if (data.stat !== "ok") {
    console.error("Flickr API returned non-ok status:", data.stat);
    return [];
  }

  return data.photos.photo
    .filter((photo) => {
      // Must have at least one usable URL
      return photo.url_l || photo.url_o || photo.url_c;
    })
    .map((photo) => {
      // Prefer large (1024), fall back to original, then medium 800
      const url = photo.url_l || photo.url_o || photo.url_c!;
      const width = parseInt(
        photo.width_l || photo.width_o || photo.width_c || "1024",
        10
      );
      const height = parseInt(
        photo.height_l || photo.height_o || photo.height_c || "768",
        10
      );

      return {
        url,
        photographer: photo.ownername || photo.owner,
        sourceId: photo.id,
        sourceUrl: `https://www.flickr.com/photos/${photo.owner}/${photo.id}`,
        width,
        height,
      };
    });
}
