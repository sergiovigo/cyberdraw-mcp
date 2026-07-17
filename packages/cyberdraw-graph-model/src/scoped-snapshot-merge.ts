import type { RuntimeSnapshotInput } from "./runtime-snapshot-adapter.js";

export type ScopedSnapshotMergeDiagnosticCode =
  | "duplicate-element-deduplicated"
  | "duplicate-layer-deduplicated"
  | "document-incompatible"
  | "revision-incompatible"
  | "stale-snapshot-rejected"
  | "context-only-preserved"
  | "external-reference-preserved"
  | "canonical-order-applied";

export type ScopedSnapshotMergeDiagnostic = {
  readonly code: ScopedSnapshotMergeDiagnosticCode;
  readonly severity: "debug" | "info" | "warn" | "error";
  readonly pageId?: string;
  readonly layerId?: string;
  readonly elementId?: string;
};

export type ScopedSnapshotMergeResult =
  | {
      readonly ok: true;
      readonly snapshot: RuntimeSnapshotInput;
      readonly diagnostics: readonly ScopedSnapshotMergeDiagnostic[];
    }
  | {
      readonly ok: false;
      readonly code:
        | "document-incompatible"
        | "revision-incompatible"
        | "stale-snapshot-rejected";
      readonly diagnostics: readonly ScopedSnapshotMergeDiagnostic[];
    };

type MergeInput = RuntimeSnapshotInput & {
  readonly document?: RuntimeSnapshotInput["document"] & {
    readonly id?: unknown;
    readonly revisionSignals?: {
      readonly documentId?: unknown;
      readonly contentRevision?: unknown;
      readonly complete?: unknown;
    };
  };
  readonly scope?: RuntimeSnapshotInput["scope"] & {
    readonly externalReferences?: readonly {
      readonly pageId?: unknown;
      readonly elementId?: unknown;
      readonly referenceType?: unknown;
      readonly referencedId?: unknown;
    }[];
  };
  readonly pages?: readonly {
    readonly id?: unknown;
    readonly index?: unknown;
    readonly layers?: readonly {
      readonly id?: unknown;
      readonly index?: unknown;
    }[];
    readonly elements?: readonly {
      readonly id?: unknown;
      readonly pageId?: unknown;
      readonly raw?: unknown;
    }[];
  }[];
};

export function mergeScopedSnapshotResults(
  snapshots: readonly RuntimeSnapshotInput[],
  options: { readonly staleSnapshotIndexes?: readonly number[] } = {},
): ScopedSnapshotMergeResult {
  const diagnostics: ScopedSnapshotMergeDiagnostic[] = [];
  if (snapshots.length === 0) {
    return {
      ok: true,
      snapshot: { pages: [], diagnostics: [], truncated: false },
      diagnostics,
    };
  }
  const first = snapshots[0] as MergeInput;
  const documentId = snapshotDocumentId(first);
  const revision = snapshotRevision(first);
  const pages = new Map<string, MutablePage>();
  const externalReferences = new Map<string, unknown>();
  const staleIndexes = new Set(options.staleSnapshotIndexes ?? []);

  for (const [index, snapshot] of (
    snapshots as readonly MergeInput[]
  ).entries()) {
    if (staleIndexes.has(index)) {
      diagnostics.push({ code: "stale-snapshot-rejected", severity: "error" });
      return { ok: false, code: "stale-snapshot-rejected", diagnostics };
    }
    if (snapshotDocumentId(snapshot) !== documentId) {
      diagnostics.push({ code: "document-incompatible", severity: "error" });
      return { ok: false, code: "document-incompatible", diagnostics };
    }
    if (snapshotRevision(snapshot) !== revision) {
      diagnostics.push({ code: "revision-incompatible", severity: "error" });
      return { ok: false, code: "revision-incompatible", diagnostics };
    }
    for (const reference of snapshot.scope?.externalReferences ?? []) {
      externalReferences.set(referenceKey(reference), reference);
      diagnostics.push({
        code: "external-reference-preserved",
        severity: "debug",
      });
    }
    for (const page of snapshot.pages ?? []) {
      const pageId =
        stringValue(page.id) ?? `page-index-${page.index ?? pages.size}`;
      const existing = pages.get(pageId);
      const target = existing ?? {
        ...page,
        layers: [],
        elements: [],
      };
      const layers = new Map(
        (target.layers ?? []).map((layer) => [
          stringValue(layer.id) ?? "",
          layer,
        ]),
      );
      for (const layer of page.layers ?? []) {
        const layerId = stringValue(layer.id);
        if (!layerId) {
          continue;
        }
        if (layers.has(layerId)) {
          diagnostics.push({
            code: "duplicate-layer-deduplicated",
            severity: "debug",
            pageId,
            layerId,
          });
          continue;
        }
        layers.set(layerId, layer);
      }
      const elements = new Map(
        (target.elements ?? []).map((element) => [
          elementKey(pageId, element),
          element,
        ]),
      );
      for (const element of page.elements ?? []) {
        const key = elementKey(pageId, element);
        if (elements.has(key)) {
          diagnostics.push({
            code: "duplicate-element-deduplicated",
            severity: "debug",
            pageId,
            elementId: stringValue(element.id),
          });
          continue;
        }
        if (hasContextOnlyFlag(element.raw)) {
          diagnostics.push({
            code: "context-only-preserved",
            severity: "debug",
            pageId,
            elementId: stringValue(element.id),
          });
        }
        elements.set(key, element);
      }
      pages.set(pageId, {
        ...target,
        layers: [...layers.values()].sort(byIndexThenId),
        elements: [...elements.values()].sort(byId),
      });
    }
  }

  diagnostics.push({ code: "canonical-order-applied", severity: "debug" });
  return {
    ok: true,
    snapshot: {
      ...first,
      scope: {
        ...first.scope,
        externalReferences: [...externalReferences.values()] as never,
      },
      pages: [...pages.values()].sort(byPageOrder) as never,
      diagnostics: snapshots.flatMap((snapshot) => snapshot.diagnostics ?? []),
      truncated: snapshots.some((snapshot) => snapshot.truncated === true),
    },
    diagnostics,
  };
}

type MutablePage = NonNullable<MergeInput["pages"]>[number] & {
  layers: readonly { readonly id?: unknown; readonly index?: unknown }[];
  elements: readonly {
    readonly id?: unknown;
    readonly pageId?: unknown;
    readonly raw?: unknown;
  }[];
};

function snapshotDocumentId(snapshot: MergeInput): string | undefined {
  return (
    stringValue(snapshot.document?.revisionSignals?.documentId) ??
    stringValue(snapshot.document?.id)
  );
}

function snapshotRevision(snapshot: MergeInput): string | undefined {
  return stringValue(snapshot.document?.revisionSignals?.contentRevision);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function referenceKey(reference: {
  readonly pageId?: unknown;
  readonly elementId?: unknown;
  readonly referenceType?: unknown;
  readonly referencedId?: unknown;
}): string {
  return [
    stringValue(reference.pageId) ?? "",
    stringValue(reference.elementId) ?? "",
    stringValue(reference.referenceType) ?? "",
    stringValue(reference.referencedId) ?? "",
  ].join("\u0000");
}

function elementKey(
  pageId: string,
  element: { readonly id?: unknown; readonly pageId?: unknown },
): string {
  return `${stringValue(element.pageId) ?? pageId}\u0000${stringValue(element.id) ?? ""}`;
}

function hasContextOnlyFlag(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).contextOnly === true
  );
}

function byPageOrder(
  left: { readonly id?: unknown; readonly index?: unknown },
  right: { readonly id?: unknown; readonly index?: unknown },
): number {
  const leftIndex =
    typeof left.index === "number" ? left.index : Number.MAX_SAFE_INTEGER;
  const rightIndex =
    typeof right.index === "number" ? right.index : Number.MAX_SAFE_INTEGER;
  return leftIndex - rightIndex || byId(left, right);
}

function byIndexThenId(
  left: { readonly id?: unknown; readonly index?: unknown },
  right: { readonly id?: unknown; readonly index?: unknown },
): number {
  const leftIndex =
    typeof left.index === "number" ? left.index : Number.MAX_SAFE_INTEGER;
  const rightIndex =
    typeof right.index === "number" ? right.index : Number.MAX_SAFE_INTEGER;
  return leftIndex - rightIndex || byId(left, right);
}

function byId(
  left: { readonly id?: unknown },
  right: { readonly id?: unknown },
): number {
  return (stringValue(left.id) ?? "").localeCompare(
    stringValue(right.id) ?? "",
  );
}
