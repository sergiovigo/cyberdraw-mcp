import { describe, expect, it } from "@jest/globals";

import {
  CYBERDRAW_CONTENT_REVISION_PREFIX,
  CYBERDRAW_RUNTIME_SNAPSHOT_CAPABILITY,
  computeContentRevision,
  createRuntimeCapabilities,
  DEFAULT_RUNTIME_SNAPSHOT_LIMITS,
  findRuntimeSnapshotCapability,
  normalizeRuntimeSnapshotScope,
  stableStringify,
  validateRuntimeSnapshot,
  validateRuntimeSnapshotResponseForRequest,
} from "./index.js";

describe("cyberdraw runtime contract", () => {
  it("creates and validates runtime snapshot capabilities", () => {
    const capabilities = createRuntimeCapabilities();
    const capability = findRuntimeSnapshotCapability(capabilities);

    expect(capability?.name).toBe(CYBERDRAW_RUNTIME_SNAPSHOT_CAPABILITY);
    expect(capability?.snapshotVersion).toBe(1);
    expect(capability?.features.contentRevision).toBe(true);
    expect(capability?.scopes).toEqual([
      "document",
      "pages",
      "layers",
      "selection",
    ]);
  });

  it("treats old M4 capabilities without scopes as document-only", () => {
    const capability = findRuntimeSnapshotCapability({
      capabilities: [
        {
          name: CYBERDRAW_RUNTIME_SNAPSHOT_CAPABILITY,
          contractVersion: 1,
          snapshotVersion: 1,
          limits: DEFAULT_RUNTIME_SNAPSHOT_LIMITS,
          features: {
            contentRevision: true,
            backgroundPages: true,
            truncationDiagnostics: true,
          },
        },
      ],
    });

    expect(capability?.scopes).toEqual(["document"]);
  });

  it("normalizes runtime snapshot scopes deterministically", () => {
    expect(
      normalizeRuntimeSnapshotScope({
        kind: "pages",
        pageIds: ["p2", "p1", "p1", " "],
      }),
    ).toEqual({
      ok: true,
      scope: { kind: "pages", pageIds: ["p1", "p2"] },
    });
    expect(
      normalizeRuntimeSnapshotScope({
        kind: "layers",
        pageId: "p1",
        layerIds: ["l2", "l1", "l2"],
      }),
    ).toEqual({
      ok: true,
      scope: { kind: "layers", pageId: "p1", layerIds: ["l1", "l2"] },
    });
    expect(normalizeRuntimeSnapshotScope({ kind: "selection" })).toEqual({
      ok: true,
      scope: { kind: "selection" },
    });
  });

  it("rejects malformed runtime snapshot scopes", () => {
    expect(normalizeRuntimeSnapshotScope({ kind: "pages", pageIds: [] })).toEqual({
      ok: false,
      code: "scope_empty",
      error: "Runtime snapshot scope must include at least one id",
    });
    expect(
      normalizeRuntimeSnapshotScope({ kind: "layers", pageId: "", layerIds: ["l1"] }),
    ).toMatchObject({ ok: false, code: "scope_invalid" });
    expect(
      normalizeRuntimeSnapshotScope({
        kind: "pages",
        pageIds: Array.from({ length: 1_001 }, (_, index) => `p${index}`),
      }),
    ).toMatchObject({ ok: false, code: "scope_too_many_ids" });
  });

  it("rejects absent, malformed, and unsupported capabilities", () => {
    expect(findRuntimeSnapshotCapability(undefined)).toBeNull();
    expect(findRuntimeSnapshotCapability({ capabilities: [{}] })).toBeNull();
    expect(
      findRuntimeSnapshotCapability({
        capabilities: [
          {
            name: CYBERDRAW_RUNTIME_SNAPSHOT_CAPABILITY,
            contractVersion: 999,
            snapshotVersion: 1,
            features: {
              contentRevision: true,
              backgroundPages: true,
              truncationDiagnostics: true,
            },
          },
        ],
      }),
    ).toBeNull();
  });

  it("stable stringifies objects independent of key order", () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe(
      stableStringify({ a: 1, b: 2 }),
    );
  });

  it("keeps array order semantically relevant", () => {
    expect(stableStringify({ ids: ["a", "b"] })).not.toBe(
      stableStringify({ ids: ["b", "a"] }),
    );
  });

  it("computes deterministic versioned content revisions", () => {
    const left = computeContentRevision({ label: "A", geometry: { x: 1 } });
    const right = computeContentRevision({ geometry: { x: 1 }, label: "A" });

    expect(left).toBe(right);
    expect(left).toMatch(
      new RegExp(`^${CYBERDRAW_CONTENT_REVISION_PREFIX}:fnv1a64:[0-9a-f]{16}$`),
    );
  });

  it("uses the known FNV-1a 64-bit vector for empty canonical input", () => {
    expect(computeContentRevision("")).toBe(
      `${CYBERDRAW_CONTENT_REVISION_PREFIX}:fnv1a64:07cc7607b4949e25`,
    );
  });

  it("rejects malformed snapshot payloads before trusting nested data", () => {
    const snapshot = validSnapshot();

    expect(validateRuntimeSnapshot(snapshot).ok).toBe(true);
    expect(
      validateRuntimeSnapshot({
        ...snapshot,
        pages: [{ ...snapshot.pages[0], elements: [{}], layers: [{}] }],
      }).ok,
    ).toBe(true);
    expect(
      validateRuntimeSnapshot({
        ...snapshot,
        scope: {
          ...snapshot.scope,
          resolvedScope: { kind: "pages", pageIds: ["p1"] },
        },
        document: {
          ...snapshot.document,
          revisionSignals: {
            ...snapshot.document.revisionSignals,
            scope: { kind: "document" },
          },
        },
      }),
    ).toEqual({
      ok: false,
      error: "Runtime snapshot revision scope does not match resolved scope",
    });
    expect(
      validateRuntimeSnapshotResponseForRequest(snapshot, {
        kind: "pages",
        pageIds: ["p1"],
      }),
    ).toEqual({
      ok: false,
      error: "Runtime snapshot response requested scope does not match request",
    });
    expect(
      validateRuntimeSnapshot({
        ...snapshot,
        payload: {
          ...snapshot.payload,
          measuredJsonBytes: snapshot.limits.hardSnapshotBytes + 1,
        },
      }),
    ).toEqual({
      ok: false,
      error: "Runtime snapshot payload exceeds hard limit",
    });
    expect(
      validateRuntimeSnapshot({
        ...snapshot,
        pages: Array.from({ length: snapshot.limits.maxPages + 1 }, () => snapshot.pages[0]),
      }),
    ).toEqual({
      ok: false,
      error: "Runtime snapshot pages exceed declared limit",
    });
    expect(
      validateRuntimeSnapshot({
        ...snapshot,
        pages: [Object.create(null)],
      }),
    ).toEqual({
      ok: false,
      error: "Runtime snapshot page collections are missing",
    });
  });
});

function validSnapshot() {
  return {
    schemaVersion: "cyberdraw.runtime-snapshot.v1",
    contractVersion: 1,
    document: {
      id: "doc-1",
      pageCount: 1,
      capturedAt: "2026-07-16T00:00:00.000Z",
      revisionSignals: {
        documentId: "doc-1",
        pageIds: ["p1"],
        scope: { kind: "document" },
        complete: true,
        contentRevision: "cyberdraw-content-v1:fnv1a64:0000000000000001",
      },
    },
    scope: {
      requestedScope: { kind: "document" },
      resolvedScope: { kind: "document" },
      includedPages: ["p1"],
      includedLayers: [{ pageId: "p1", layerIds: [] }],
      includedElementCount: 0,
      contextElementCount: 0,
      externalReferences: [],
      missingPageIds: [],
      missingLayerIds: [],
      includedContext: false,
      requiresScopeExpansion: false,
      conclusive: true,
    },
    pages: [
      {
        id: "p1",
        index: 0,
        name: "Page 1",
        visible: true,
        background: false,
        layers: [],
        elements: [],
      },
    ],
    diagnostics: [],
    completeness: { status: "complete" },
    truncated: false,
    limits: DEFAULT_RUNTIME_SNAPSHOT_LIMITS,
    payload: {
      approximateJsonBytes: 128,
      measuredJsonBytes: 128,
      softLimitBytes: DEFAULT_RUNTIME_SNAPSHOT_LIMITS.softSnapshotBytes,
      hardLimitBytes: DEFAULT_RUNTIME_SNAPSHOT_LIMITS.hardSnapshotBytes,
    },
    performance: {
      extractionMs: 0,
      serializationMs: 0,
      approximateJsonBytes: 128,
    },
  };
}
