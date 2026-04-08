import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @/lib/db before importing the route handler
vi.mock("@/lib/db", () => {
  const mockImage = {
    id: "test-img-123",
    r2_key: "photos/test-img-123.jpg",
    width: 1024,
    height: 768,
    category_slug: "people",
    // These sensitive fields exist in the DB but must NEVER appear in responses
    is_ai: 1,
    ai_model: "midjourney-v6",
    source: "synthetic-dataset",
  };

  const mockUser = {
    id: "user-abc-456",
    device_id: "device-xyz",
    display_name: null,
    email: null,
    elo_rating: 1200,
    total_played: 10,
    total_correct: 7,
    current_streak: 3,
    best_streak: 5,
    preferred_categories: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    last_active_at: "2025-01-01T00:00:00Z",
  };

  const mockStatement = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(mockUser),
    all: vi.fn().mockResolvedValue({ results: [mockImage] }),
    run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
  };

  return {
    getDb: vi.fn().mockResolvedValue({
      prepare: vi.fn().mockReturnValue(mockStatement),
    }),
    setDb: vi.fn(),
  };
});

// Mock uuid to return predictable values
vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("mock-uuid-1234"),
}));

import { GET } from "@/app/api/images/next/route";

describe("GET /api/images/next - answer leak prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when device_id is missing", async () => {
    const request = new Request("http://localhost:3000/api/images/next");
    const response = await GET(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("returns a valid response with the expected structure", async () => {
    const request = new Request(
      "http://localhost:3000/api/images/next?device_id=device-xyz"
    );
    const response = await GET(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.image).toBeDefined();
    expect(body.session).toBeDefined();
    expect(body.image.id).toBe("test-img-123");
    expect(body.image.width).toBe(1024);
    expect(body.image.height).toBe(768);
    expect(body.image.category).toBe("people");
    expect(typeof body.image.url).toBe("string");
    expect(typeof body.session.shown_at).toBe("number");
  });

  it("NEVER leaks is_ai in the response", async () => {
    const request = new Request(
      "http://localhost:3000/api/images/next?device_id=device-xyz"
    );
    const response = await GET(request);
    const body = await response.json();
    const jsonString = JSON.stringify(body);

    expect(body.image.is_ai).toBeUndefined();
    expect(body.is_ai).toBeUndefined();
    // Also check the raw JSON string in case it's nested somewhere unexpected
    expect(jsonString).not.toContain('"is_ai"');
  });

  it("NEVER leaks ai_model in the response", async () => {
    const request = new Request(
      "http://localhost:3000/api/images/next?device_id=device-xyz"
    );
    const response = await GET(request);
    const body = await response.json();
    const jsonString = JSON.stringify(body);

    expect(body.image.ai_model).toBeUndefined();
    expect(body.ai_model).toBeUndefined();
    expect(jsonString).not.toContain('"ai_model"');
  });

  it("NEVER leaks source in the response", async () => {
    const request = new Request(
      "http://localhost:3000/api/images/next?device_id=device-xyz"
    );
    const response = await GET(request);
    const body = await response.json();
    const jsonString = JSON.stringify(body);

    expect(body.image.source).toBeUndefined();
    expect(body.source).toBeUndefined();
    expect(jsonString).not.toContain('"source"');
  });

  it("response contains ONLY the allowed fields", async () => {
    const request = new Request(
      "http://localhost:3000/api/images/next?device_id=device-xyz"
    );
    const response = await GET(request);
    const body = await response.json();

    // Verify image has exactly the expected keys
    const imageKeys = Object.keys(body.image).sort();
    expect(imageKeys).toEqual(["category", "height", "id", "url", "width"]);

    // Verify session has exactly the expected keys
    const sessionKeys = Object.keys(body.session).sort();
    expect(sessionKeys).toEqual(["shown_at"]);

    // Verify top-level has exactly the expected keys
    const topKeys = Object.keys(body).sort();
    expect(topKeys).toEqual(["image", "session"]);
  });
});
