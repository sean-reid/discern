import { describe, it, expect, vi } from "vitest";
import { selectNextImage } from "@/lib/image-selection";
import type { DB, PreparedStatement } from "@/lib/db";

/**
 * Creates a mock D1-style database.
 * first() returns the balance data, all() returns image candidates.
 */
function createMockDb(
  results: unknown[] = [],
  balance: { ai_count: number; real_count: number } = { ai_count: 0, real_count: 0 }
): DB {
  const mockStatement: PreparedStatement = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(balance),
    all: vi.fn().mockResolvedValue({ results }),
    run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 0 } }),
  };

  return {
    prepare: vi.fn().mockReturnValue(mockStatement),
  };
}

describe("selectNextImage", () => {
  it("exists and has the correct signature (db, userId, userElo, category)", () => {
    expect(typeof selectNextImage).toBe("function");
    expect(selectNextImage.length).toBe(4);
  });

  it("returns null when no images are available", async () => {
    const db = createMockDb([]);
    const result = await selectNextImage(db, "user-1", 1200, "all");
    expect(result).toBeNull();
  });

  it("returns an image when candidates are available", async () => {
    const image = {
      id: "img-1",
      r2_key: "photos/img-1.jpg",
      width: 1024,
      height: 768,
      category_slug: "people",
    };
    const db = createMockDb([image]);
    const result = await selectNextImage(db, "user-1", 1200, "all");

    expect(result).not.toBeNull();
    expect(result!.id).toBe("img-1");
    expect(result!.r2_key).toBe("photos/img-1.jpg");
  });

  it("first query is the balance check", async () => {
    const db = createMockDb([{ id: "img-1", r2_key: "x", width: 100, height: 100, category_slug: "people" }]);
    await selectNextImage(db, "user-1", 1200, "all");

    const prepareCall = vi.mocked(db.prepare);
    expect(prepareCall).toHaveBeenCalled();
    // First query should be the balance check
    expect(prepareCall.mock.calls[0][0]).toContain("ai_count");
    expect(prepareCall.mock.calls[0][0]).toContain("real_count");
  });

  it("image selection query includes is_ai filter for balance", async () => {
    const db = createMockDb(
      [{ id: "img-1", r2_key: "x", width: 100, height: 100, category_slug: "people" }],
      { ai_count: 5, real_count: 10 } // more real shown, should prefer AI
    );
    await selectNextImage(db, "user-1", 1200, "all");

    const prepareCall = vi.mocked(db.prepare);
    // Second call is the image selection with is_ai filter
    const selectionQuery = prepareCall.mock.calls[1][0];
    expect(selectionQuery).toContain("AND i.is_ai = ?");
  });

  it("passes category to query when category is not 'all'", async () => {
    const db = createMockDb(
      [{ id: "img-2", r2_key: "x", width: 800, height: 600, category_slug: "animals" }]
    );
    await selectNextImage(db, "user-1", 1200, "animals");

    const prepareCall = vi.mocked(db.prepare);
    // Find the selection query (not the balance query)
    const selectionQueries = prepareCall.mock.calls
      .map((c) => c[0])
      .filter((q: string) => q.includes("FROM images"));
    expect(selectionQueries.length).toBeGreaterThan(0);
    expect(selectionQueries[0]).toContain("AND c.slug = ?");
  });

  it("falls back to wider Elo ranges when first range has no results", async () => {
    let allCallCount = 0;
    const image = {
      id: "img-fallback",
      r2_key: "photos/fallback.jpg",
      width: 640,
      height: 480,
      category_slug: "landscapes",
    };

    const mockStatement: PreparedStatement = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ ai_count: 0, real_count: 0 }),
      all: vi.fn().mockImplementation(() => {
        allCallCount++;
        if (allCallCount < 3) {
          return Promise.resolve({ results: [] });
        }
        return Promise.resolve({ results: [image] });
      }),
      run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 0 } }),
    };

    const db: DB = {
      prepare: vi.fn().mockReturnValue(mockStatement),
    };

    const result = await selectNextImage(db, "user-1", 1200, "all");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("img-fallback");
  });
});
