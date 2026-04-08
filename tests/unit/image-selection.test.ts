import { describe, it, expect, vi } from "vitest";
import { selectNextImage } from "@/lib/image-selection";
import type { DB, PreparedStatement } from "@/lib/db";

/**
 * Creates a mock D1-style database that returns the given results
 * from the prepare().bind().all() chain.
 */
function createMockDb(results: unknown[] = []): DB {
  const mockStatement: PreparedStatement = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(results[0] ?? null),
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
    expect(result!.width).toBe(1024);
    expect(result!.height).toBe(768);
    expect(result!.category_slug).toBe("people");
  });

  it("does not include category in bindings when category is 'all'", async () => {
    const image = {
      id: "img-1",
      r2_key: "photos/img-1.jpg",
      width: 1024,
      height: 768,
      category_slug: "people",
    };
    const db = createMockDb([image]);
    await selectNextImage(db, "user-1", 1200, "all");

    // The first call to prepare (Elo-matched range) should be checked.
    // bind is called with [eloMin, eloMax, userId] -- no category.
    const stmt = db.prepare("") as unknown as PreparedStatement;
    // Access the actual mock returned by db.prepare
    const prepareCall = vi.mocked(db.prepare);
    expect(prepareCall).toHaveBeenCalled();

    // The query should NOT contain "AND c.slug = ?"
    const firstQuery = prepareCall.mock.calls[0][0];
    expect(firstQuery).not.toContain("AND c.slug = ?");

    // bind should have been called with 3 args (eloMin, eloMax, userId)
    const bindMock = vi.mocked(
      (db.prepare("") as unknown as PreparedStatement).bind
    );
    const firstBindArgs = bindMock.mock.calls[0];
    expect(firstBindArgs).toHaveLength(3);
  });

  it("passes category to query when category is not 'all'", async () => {
    const image = {
      id: "img-2",
      r2_key: "photos/img-2.jpg",
      width: 800,
      height: 600,
      category_slug: "animals",
    };
    const db = createMockDb([image]);
    await selectNextImage(db, "user-1", 1200, "animals");

    const prepareCall = vi.mocked(db.prepare);
    expect(prepareCall).toHaveBeenCalled();

    // The query SHOULD contain category filter
    const firstQuery = prepareCall.mock.calls[0][0];
    expect(firstQuery).toContain("AND c.slug = ?");

    // bind should have been called with 4 args (eloMin, eloMax, userId, category)
    const bindMock = vi.mocked(
      (db.prepare("") as unknown as PreparedStatement).bind
    );
    const firstBindArgs = bindMock.mock.calls[0];
    expect(firstBindArgs).toHaveLength(4);
    expect(firstBindArgs[3]).toBe("animals");
  });

  it("falls back to wider Elo ranges when first range has no results", async () => {
    let callCount = 0;
    const image = {
      id: "img-fallback",
      r2_key: "photos/fallback.jpg",
      width: 640,
      height: 480,
      category_slug: "landscapes",
    };

    // Return empty on first two calls, then return image on the third
    const mockStatement: PreparedStatement = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
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
    // Should have been called 3 times (3 Elo ranges)
    expect(vi.mocked(mockStatement.all).mock.calls).toHaveLength(3);
  });
});
