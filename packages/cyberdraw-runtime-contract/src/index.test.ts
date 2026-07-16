import { describe, expect, it } from "@jest/globals";

import {
  CYBERDRAW_CONTENT_REVISION_PREFIX,
  CYBERDRAW_RUNTIME_SNAPSHOT_CAPABILITY,
  computeContentRevision,
  createRuntimeCapabilities,
  DEFAULT_RUNTIME_SNAPSHOT_LIMITS,
  findRuntimeSnapshotCapability,
  stableStringify,
  validateRuntimeSnapshot,
} from "./index.js";

describe("cyberdraw runtime contract", () => {
  it("creates and validates runtime snapshot capabilities", () => {
    const capabilities = createRuntimeCapabilities();
    const capability = findRuntimeSnapshotCapability(capabilities);

    expect(capability?.name).toBe(CYBERDRAW_RUNTIME_SNAPSHOT_CAPABILITY);
    expect(capability?.snapshotVersion).toBe(1);
    expect(capability?.features.contentRevision).toBe(true);
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
