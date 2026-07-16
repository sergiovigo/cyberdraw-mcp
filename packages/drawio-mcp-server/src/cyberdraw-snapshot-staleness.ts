import type {
  RuntimeSnapshot,
  RuntimeSnapshotScope,
} from "cyberdraw-runtime-contract";
import { stableStringify } from "cyberdraw-runtime-contract";

export type SnapshotFreshness =
  | { readonly status: "fresh" }
  | {
      readonly status: "stale";
      readonly reason:
        | "content-changed"
        | "snapshot-partial"
        | "document-changed"
        | "scope-changed"
        | "contract-changed"
        | "limits-changed";
    }
  | {
      readonly status: "unknown";
      readonly reason:
        | "document-disconnected"
        | "peer-incompatible"
        | "timeout"
        | "capture-failed"
        | "revision-missing";
    };

export function compareRuntimeSnapshotFreshness(
  expected: RuntimeSnapshot,
  current: RuntimeSnapshot,
): SnapshotFreshness {
  if (
    expected.schemaVersion !== current.schemaVersion ||
    expected.contractVersion !== current.contractVersion
  ) {
    return { status: "stale", reason: "contract-changed" };
  }
  const expectedDocumentId =
    expected.document.revisionSignals.documentId ?? expected.document.id;
  const currentDocumentId =
    current.document.revisionSignals.documentId ?? current.document.id;
  if (!expectedDocumentId || !currentDocumentId) {
    return { status: "unknown", reason: "revision-missing" };
  }
  if (expectedDocumentId !== currentDocumentId) {
    return { status: "stale", reason: "document-changed" };
  }
  if (
    !sameScope(
      expected.document.revisionSignals.scope,
      current.document.revisionSignals.scope,
    )
  ) {
    return { status: "stale", reason: "scope-changed" };
  }
  if (stableStringify(expected.limits) !== stableStringify(current.limits)) {
    return { status: "stale", reason: "limits-changed" };
  }
  if (
    expected.completeness.status !== "complete" ||
    current.completeness.status !== "complete" ||
    expected.document.revisionSignals.complete !== true ||
    current.document.revisionSignals.complete !== true
  ) {
    return { status: "stale", reason: "snapshot-partial" };
  }
  if (
    !expected.document.revisionSignals.contentRevision ||
    !current.document.revisionSignals.contentRevision
  ) {
    return { status: "unknown", reason: "revision-missing" };
  }
  if (
    expected.document.revisionSignals.contentRevision !==
    current.document.revisionSignals.contentRevision
  ) {
    return { status: "stale", reason: "content-changed" };
  }
  return { status: "fresh" };
}

export function classifyRuntimeSnapshotCaptureError(
  error: unknown,
): SnapshotFreshness {
  const message = error instanceof Error ? error.message : String(error);
  if (/does not support cyberdraw\.runtimeSnapshot\.v1/.test(message)) {
    return { status: "unknown", reason: "peer-incompatible" };
  }
  if (/Timed out waiting for reply/.test(message)) {
    return { status: "unknown", reason: "timeout" };
  }
  if (
    /no longer connected|No connected Draw\.io documents|was not found/.test(
      message,
    )
  ) {
    return { status: "unknown", reason: "document-disconnected" };
  }
  return { status: "unknown", reason: "capture-failed" };
}

function sameScope(
  left: RuntimeSnapshotScope,
  right: RuntimeSnapshotScope,
): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  if (left.kind === "document" && right.kind === "document") {
    return true;
  }
  const leftIds = [...(left.pageIds ?? [])].sort();
  const rightIds = [...(right.pageIds ?? [])].sort();
  return (
    leftIds.length === rightIds.length &&
    leftIds.every((id, index) => id === rightIds[index])
  );
}
