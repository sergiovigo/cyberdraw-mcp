import { describe, expect, it } from "@jest/globals";

import { mergeScopedSnapshotResults } from "./index.js";
import type { RuntimeSnapshotInput } from "./runtime-snapshot-adapter.js";

describe("scoped snapshot merge", () => {
  it("merges page, layer and selection snapshots with canonical order", () => {
    const result = mergeScopedSnapshotResults([
      snapshot("pages", [{ id: "p2", index: 1, elements: ["b"] }]),
      snapshot("layers", [{ id: "p1", index: 0, elements: ["a"] }]),
      snapshot("selection", [{ id: "p1", index: 0, elements: ["c"] }]),
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected merge success");
    }
    expect(result.snapshot.pages?.map((page) => page.id)).toEqual(["p1", "p2"]);
    expect(
      result.snapshot.pages?.[0]?.elements?.map((element) => element.id),
    ).toEqual(["a", "c"]);
  });

  it("deduplicates elements and layers without assuming stable identity beyond scope context", () => {
    const result = mergeScopedSnapshotResults([
      snapshot("pages", [{ id: "p1", index: 0, elements: ["a", "a"] }]),
      snapshot("layers", [{ id: "p1", index: 0, elements: ["a"] }]),
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected merge success");
    }
    expect(result.snapshot.pages?.[0]?.elements).toHaveLength(1);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "duplicate-element-deduplicated",
    );
  });

  it("preserves contextOnly and external references", () => {
    const result = mergeScopedSnapshotResults([
      {
        ...snapshot("layers", [{ id: "p1", index: 0, elements: ["edge"] }]),
        scope: {
          externalReferences: [
            {
              pageId: "p1",
              elementId: "edge",
              referenceType: "target",
              referencedId: "outside",
            },
          ],
        },
        pages: [
          {
            id: "p1",
            index: 0,
            layers: [{ id: "l1", index: 0 }],
            elements: [
              { id: "group", pageId: "p1", raw: { contextOnly: true } },
            ],
          },
        ],
      },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected merge success");
    }
    expect(result.snapshot.scope?.externalReferences).toHaveLength(1);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "context-only-preserved",
        "external-reference-preserved",
      ]),
    );
  });

  it("rejects incompatible revisions and documents", () => {
    const revision = mergeScopedSnapshotResults([
      snapshot("pages", [{ id: "p1", index: 0, elements: ["a"] }]),
      {
        ...snapshot("pages", [{ id: "p2", index: 1, elements: ["b"] }]),
        document: {
          id: "doc-1",
          revisionSignals: {
            contentRevision: "rev-2",
          },
        },
      },
    ]);
    const document = mergeScopedSnapshotResults([
      snapshot("pages", [{ id: "p1", index: 0, elements: ["a"] }]),
      {
        ...snapshot("pages", [{ id: "p2", index: 1, elements: ["b"] }]),
        document: {
          id: "doc-2",
          revisionSignals: {
            contentRevision: "rev-1",
          },
        },
      },
    ]);

    expect(revision).toMatchObject({
      ok: false,
      code: "revision-incompatible",
    });
    expect(document).toMatchObject({
      ok: false,
      code: "document-incompatible",
    });
  });

  it("accepts a fresh complete snapshot", () => {
    const result = mergeScopedSnapshotResults([
      snapshot("pages", [{ id: "p1", index: 0, elements: ["a"] }]),
    ]);

    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.snapshot.truncated).toBe(false);
    }
  });

  it("accepts a fresh truncated snapshot and preserves partial state", () => {
    const result = mergeScopedSnapshotResults([
      {
        ...snapshot("pages", [{ id: "p1", index: 0, elements: ["a"] }]),
        truncated: true,
        diagnostics: [{ code: "snapshot_soft_limit_reached" }],
      },
    ]);

    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.snapshot.truncated).toBe(true);
      expect(result.snapshot.diagnostics).toEqual([
        { code: "snapshot_soft_limit_reached" },
      ]);
    }
  });

  it("rejects a stale complete snapshot only with explicit stale evidence", () => {
    const result = mergeScopedSnapshotResults(
      [snapshot("pages", [{ id: "p1", index: 0, elements: ["a"] }])],
      { staleSnapshotIndexes: [0] },
    );

    expect(result).toMatchObject({
      ok: false,
      code: "stale-snapshot-rejected",
    });
  });

  it("rejects a stale truncated snapshot only with explicit stale evidence", () => {
    const result = mergeScopedSnapshotResults(
      [
        {
          ...snapshot("pages", [{ id: "p1", index: 0, elements: ["a"] }]),
          truncated: true,
        },
      ],
      { staleSnapshotIndexes: [0] },
    );

    expect(result).toMatchObject({
      ok: false,
      code: "stale-snapshot-rejected",
    });
  });
});

function snapshot(
  kind: string,
  pages: readonly {
    readonly id: string;
    readonly index: number;
    readonly elements: readonly string[];
  }[],
): RuntimeSnapshotInput {
  return {
    schemaVersion: "cyberdraw.runtime-snapshot.v1",
    document: {
      id: "doc-1",
      revisionSignals: {
        contentRevision: "rev-1",
      },
    },
    scope: {
      requestedScope: { kind },
      resolvedScope: { kind },
      externalReferences: [],
      contextElementCount: 0,
      requiresScopeExpansion: false,
      conclusive: true,
    },
    pages: pages.map((page) => ({
      id: page.id,
      index: page.index,
      name: page.id,
      layers: [{ id: "l1", index: 0, pageId: page.id }],
      elements: page.elements.map((id) => ({
        id,
        pageId: page.id,
        layerId: "l1",
        type: "vertex",
      })),
    })),
    diagnostics: [],
    truncated: false,
  };
}
