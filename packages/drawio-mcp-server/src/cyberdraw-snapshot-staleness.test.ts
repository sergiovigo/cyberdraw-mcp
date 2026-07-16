import { describe, expect, it } from "@jest/globals";

import {
  classifyRuntimeSnapshotCaptureError,
  compareRuntimeSnapshotFreshness,
} from "./cyberdraw-snapshot-staleness.js";
import type { RuntimeSnapshot } from "cyberdraw-runtime-contract";

describe("cyberdraw runtime snapshot staleness", () => {
  it("classifies equal complete snapshots as fresh", () => {
    expect(compareRuntimeSnapshotFreshness(snapshot(), snapshot())).toEqual({
      status: "fresh",
    });
  });

  it("classifies changed content revision as stale", () => {
    expect(
      compareRuntimeSnapshotFreshness(
        snapshot(),
        snapshot({ revision: "cyberdraw-content-v1:fnv1a64:0000000000000002" }),
      ),
    ).toEqual({ status: "stale", reason: "content-changed" });
  });

  it("classifies partial snapshots as stale", () => {
    expect(
      compareRuntimeSnapshotFreshness(
        snapshot(),
        snapshot({ completeness: { status: "partial", reason: "soft-limit" } }),
      ),
    ).toEqual({ status: "stale", reason: "snapshot-partial" });
  });

  it("classifies scope changes as stale", () => {
    expect(
      compareRuntimeSnapshotFreshness(
        snapshot(),
        snapshot({ scope: { kind: "pages", pageIds: ["p1"] } }),
      ),
    ).toEqual({ status: "stale", reason: "scope-changed" });
  });

  it("does not classify snapshots without document evidence as fresh", () => {
    expect(
      compareRuntimeSnapshotFreshness(
        snapshot({ documentId: undefined }),
        snapshot({ documentId: undefined }),
      ),
    ).toEqual({ status: "unknown", reason: "revision-missing" });
  });

  it("classifies changed limits as stale even when revisions match", () => {
    const base = snapshot();
    const current = {
      ...base,
      limits: {
        ...base.limits,
        maxElementsPerPage: base.limits.maxElementsPerPage + 1,
      },
    } as RuntimeSnapshot;

    expect(compareRuntimeSnapshotFreshness(snapshot(), current)).toEqual({
      status: "stale",
      reason: "limits-changed",
    });
  });

  it("classifies contract changes as stale", () => {
    const current = {
      ...snapshot(),
      contractVersion: 2,
    } as unknown as RuntimeSnapshot;

    expect(compareRuntimeSnapshotFreshness(snapshot(), current)).toEqual({
      status: "stale",
      reason: "contract-changed",
    });
  });

  it("classifies capture errors for future recapture paths", () => {
    expect(
      classifyRuntimeSnapshotCaptureError(
        new Error(
          "Connected Draw.io peer does not support cyberdraw.runtimeSnapshot.v1",
        ),
      ),
    ).toEqual({ status: "unknown", reason: "peer-incompatible" });
    expect(
      classifyRuntimeSnapshotCaptureError(
        new Error(
          "Timed out waiting for reply to `cyberdraw.runtimeSnapshot.v1`",
        ),
      ),
    ).toEqual({ status: "unknown", reason: "timeout" });
  });
});

function snapshot(
  overrides: {
    readonly revision?: string;
    readonly documentId?: string | undefined;
    readonly scope?: RuntimeSnapshot["document"]["revisionSignals"]["scope"];
    readonly completeness?: RuntimeSnapshot["completeness"];
  } = {},
): RuntimeSnapshot {
  const hasDocumentIdOverride = Object.prototype.hasOwnProperty.call(
    overrides,
    "documentId",
  );
  const documentId = hasDocumentIdOverride ? overrides.documentId : "doc-1";
  const scope = overrides.scope ?? { kind: "document" };
  const completeness = overrides.completeness ?? { status: "complete" };
  return {
    schemaVersion: "cyberdraw.runtime-snapshot.v1",
    contractVersion: 1,
    document: {
      id: documentId,
      pageCount: 1,
      capturedAt: "2026-07-16T00:00:00.000Z",
      revisionSignals: {
        documentId,
        pageIds: ["p1"],
        scope,
        complete: completeness.status === "complete",
        contentRevision:
          overrides.revision ?? "cyberdraw-content-v1:fnv1a64:0000000000000001",
      },
    },
    pages: [],
    diagnostics: [],
    completeness,
    truncated: completeness.status !== "complete",
    limits: {
      maxPages: 100,
      maxLayersPerPage: 100,
      maxElementsPerPage: 25_000,
      maxLabelLength: 8_192,
      maxStyleLength: 8_192,
      maxMetadataKeys: 64,
      maxMetadataStringLength: 8_192,
      maxRawDepth: 4,
      maxRawKeys: 64,
      maxArrayItems: 1_000,
      softSnapshotBytes: 12,
      hardSnapshotBytes: 16,
    },
    payload: {
      approximateJsonBytes: 0,
      softLimitBytes: 12,
      hardLimitBytes: 16,
    },
    performance: {
      extractionMs: 0,
      serializationMs: 0,
      approximateJsonBytes: 0,
    },
  };
}
