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
          requestedScope: { kind: "layers", pageId: "p1", layerIds: ["l1"] },
          resolvedScope: { kind: "layers", pageId: "p1", layerIds: ["l1"] },
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

  it("resolves external references when expansion materializes the referenced element", () => {
    const result = mergeScopedSnapshotResults([
      {
        ...snapshot("layers", [
          { id: "p1", index: 0, elements: ["a", "edge"] },
        ]),
        scope: {
          requestedScope: { kind: "layers", pageId: "p1", layerIds: ["focus"] },
          resolvedScope: { kind: "layers", pageId: "p1", layerIds: ["focus"] },
          externalReferences: [
            {
              pageId: "p1",
              elementId: "edge",
              referenceType: "target",
              referencedId: "b",
              referencedPageId: "p1",
              referencedLayerId: "context",
            },
          ],
          contextElementCount: 0,
          requiresScopeExpansion: true,
          conclusive: false,
        },
        pages: [
          {
            id: "p1",
            index: 0,
            layers: [{ id: "focus", index: 0, pageId: "p1" }],
            elements: [
              { id: "a", pageId: "p1", layerId: "focus", type: "vertex" },
              {
                id: "edge",
                pageId: "p1",
                layerId: "focus",
                type: "edge",
                sourceId: "a",
                targetId: "b",
              },
            ],
          },
        ],
      },
      {
        ...snapshot("layers", [{ id: "p1", index: 0, elements: ["b"] }]),
        document: {
          id: "doc-1",
          revisionSignals: {
            contentRevision: "rev-2",
          },
        },
        scope: {
          requestedScope: {
            kind: "layers",
            pageId: "p1",
            layerIds: ["context"],
          },
          resolvedScope: {
            kind: "layers",
            pageId: "p1",
            layerIds: ["context"],
          },
          externalReferences: [],
          contextElementCount: 0,
          requiresScopeExpansion: false,
          conclusive: true,
        },
        pages: [
          {
            id: "p1",
            index: 0,
            layers: [{ id: "context", index: 1, pageId: "p1" }],
            elements: [
              { id: "b", pageId: "p1", layerId: "context", type: "vertex" },
            ],
          },
        ],
      },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected merge success");
    }
    expect(result.snapshot.scope?.externalReferences).toHaveLength(0);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "external-reference-resolved",
    );
    expect(
      result.snapshot.pages?.[0]?.elements?.map((element) => element.id),
    ).toEqual(["a", "b", "edge"]);
  });

  it("resolves duplicate element ids only with exact page and layer context", () => {
    const result = mergeScopedSnapshotResults([
      {
        ...snapshot("layers", [{ id: "p1", index: 0, elements: ["dup", "edge"] }]),
        scope: {
          requestedScope: { kind: "layers", pageId: "p1", layerIds: ["focus"] },
          resolvedScope: { kind: "layers", pageId: "p1", layerIds: ["focus"] },
          externalReferences: [
            {
              pageId: "p1",
              elementId: "edge",
              referenceType: "target",
              referencedId: "dup",
              referencedPageId: "p2",
              referencedLayerId: "l2",
            },
          ],
        },
      },
      {
        ...snapshot("layers", [{ id: "p2", index: 1, elements: ["dup"] }]),
        document: {
          id: "doc-1",
          revisionSignals: {
            contentRevision: "rev-2",
          },
        },
        pages: [
          {
            id: "p2",
            index: 1,
            layers: [{ id: "l2", index: 0, pageId: "p2" }],
            elements: [{ id: "dup", pageId: "p2", layerId: "l2" }],
          },
        ],
        scope: {
          requestedScope: { kind: "layers", pageId: "p2", layerIds: ["l2"] },
          resolvedScope: { kind: "layers", pageId: "p2", layerIds: ["l2"] },
          externalReferences: [],
        },
      },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected merge success");
    }
    expect(result.snapshot.scope?.externalReferences).toHaveLength(0);
  });

  it("preserves ambiguous external references when layer context is missing", () => {
    const result = mergeScopedSnapshotResults([
      {
        ...snapshot("layers", [{ id: "p1", index: 0, elements: ["edge"] }]),
        scope: {
          requestedScope: { kind: "layers", pageId: "p1", layerIds: ["focus"] },
          resolvedScope: { kind: "layers", pageId: "p1", layerIds: ["focus"] },
          externalReferences: [
            {
              pageId: "p1",
              elementId: "edge",
              referenceType: "target",
              referencedId: "dup",
              referencedPageId: "p1",
            },
          ],
        },
        pages: [
          {
            id: "p1",
            index: 0,
            layers: [
              { id: "focus", index: 0, pageId: "p1" },
              { id: "context", index: 1, pageId: "p1" },
            ],
            elements: [
              { id: "edge", pageId: "p1", layerId: "focus", type: "edge" },
              { id: "dup", pageId: "p1", layerId: "focus", type: "vertex" },
            ],
          },
        ],
      },
      {
        ...snapshot("layers", [{ id: "p1", index: 0, elements: ["dup"] }]),
        document: {
          id: "doc-1",
          revisionSignals: {
            contentRevision: "rev-2",
          },
        },
        pages: [
          {
            id: "p1",
            index: 0,
            layers: [{ id: "context", index: 1, pageId: "p1" }],
            elements: [
              { id: "dup", pageId: "p1", layerId: "context", type: "vertex" },
            ],
          },
        ],
        scope: {
          requestedScope: {
            kind: "layers",
            pageId: "p1",
            layerIds: ["context"],
          },
          resolvedScope: {
            kind: "layers",
            pageId: "p1",
            layerIds: ["context"],
          },
          externalReferences: [],
        },
      },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected merge success");
    }
    expect(result.snapshot.scope?.externalReferences).toHaveLength(1);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain(
      "external-reference-resolved",
    );
  });

  it("resolves duplicate same-page ids when target layer is explicit", () => {
    const result = mergeScopedSnapshotResults([
      {
        ...snapshot("layers", [{ id: "p1", index: 0, elements: ["edge"] }]),
        scope: {
          requestedScope: { kind: "layers", pageId: "p1", layerIds: ["focus"] },
          resolvedScope: { kind: "layers", pageId: "p1", layerIds: ["focus"] },
          externalReferences: [
            {
              pageId: "p1",
              elementId: "edge",
              referenceType: "target",
              referencedId: "dup",
              referencedPageId: "p1",
              referencedLayerId: "context",
            },
          ],
        },
        pages: [
          {
            id: "p1",
            index: 0,
            layers: [
              { id: "focus", index: 0, pageId: "p1" },
              { id: "context", index: 1, pageId: "p1" },
            ],
            elements: [
              { id: "edge", pageId: "p1", layerId: "focus", type: "edge" },
              { id: "dup", pageId: "p1", layerId: "focus", type: "vertex" },
            ],
          },
        ],
      },
      {
        ...snapshot("layers", [{ id: "p1", index: 0, elements: ["dup"] }]),
        document: {
          id: "doc-1",
          revisionSignals: {
            contentRevision: "rev-2",
          },
        },
        pages: [
          {
            id: "p1",
            index: 0,
            layers: [{ id: "context", index: 1, pageId: "p1" }],
            elements: [
              { id: "dup", pageId: "p1", layerId: "context", type: "vertex" },
            ],
          },
        ],
        scope: {
          requestedScope: {
            kind: "layers",
            pageId: "p1",
            layerIds: ["context"],
          },
          resolvedScope: {
            kind: "layers",
            pageId: "p1",
            layerIds: ["context"],
          },
          externalReferences: [],
        },
      },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected merge success");
    }
    expect(result.snapshot.scope?.externalReferences).toHaveLength(0);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "external-reference-resolved",
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

  it("accepts different scope revisions when document identity is compatible", () => {
    const result = mergeScopedSnapshotResults([
      {
        ...snapshot("layers", [{ id: "p1", index: 0, elements: ["a"] }]),
        document: {
          id: "doc-1",
          revisionSignals: {
            contentRevision: "rev-1",
          },
        },
        scope: {
          requestedScope: { kind: "layers", pageId: "p1", layerIds: ["focus"] },
          resolvedScope: { kind: "layers", pageId: "p1", layerIds: ["focus"] },
          externalReferences: [],
        },
      },
      {
        ...snapshot("layers", [{ id: "p1", index: 0, elements: ["b"] }]),
        document: {
          id: "doc-1",
          revisionSignals: {
            contentRevision: "rev-2",
          },
        },
        scope: {
          requestedScope: {
            kind: "layers",
            pageId: "p1",
            layerIds: ["context"],
          },
          resolvedScope: {
            kind: "layers",
            pageId: "p1",
            layerIds: ["context"],
          },
          externalReferences: [],
        },
      },
    ]);

    expect(result).toMatchObject({ ok: true });
  });

  it("rejects different scope revisions when shared document revision changes", () => {
    const result = mergeScopedSnapshotResults([
      {
        ...snapshot("layers", [{ id: "p1", index: 0, elements: ["a"] }]),
        document: {
          id: "doc-1",
          revisionSignals: {
            contentRevision: "rev-1",
            documentRevision: "doc-rev-1",
          },
        },
        scope: {
          requestedScope: { kind: "layers", pageId: "p1", layerIds: ["focus"] },
          resolvedScope: { kind: "layers", pageId: "p1", layerIds: ["focus"] },
          externalReferences: [],
        },
      },
      {
        ...snapshot("layers", [{ id: "p1", index: 0, elements: ["b"] }]),
        document: {
          id: "doc-1",
          revisionSignals: {
            contentRevision: "rev-2",
            documentRevision: "doc-rev-2",
          },
        },
        scope: {
          requestedScope: {
            kind: "layers",
            pageId: "p1",
            layerIds: ["context"],
          },
          resolvedScope: {
            kind: "layers",
            pageId: "p1",
            layerIds: ["context"],
          },
          externalReferences: [],
        },
      },
    ]);

    expect(result).toMatchObject({
      ok: false,
      code: "revision-incompatible",
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
