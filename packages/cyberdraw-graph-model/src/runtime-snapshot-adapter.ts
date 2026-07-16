import { applyLimits } from "./limits.js";
import { createSafeRecord, safeString, sanitizeJson } from "./safe-json.js";
import { parseStyle } from "./style.js";
import type {
  CanonicalDiagramInput,
  CanonicalElementInput,
  CanonicalLayerInput,
  CanonicalPageInput,
  ElementKind,
  Geometry,
  JsonValue,
  Label,
  NormalizeOptions,
  SourceRef,
} from "./types.js";
import { normalizeDiagram } from "./normalize.js";

export type RuntimeSnapshotInput = {
  readonly schemaVersion?: unknown;
  readonly document?: {
    readonly id?: unknown;
    readonly title?: unknown;
    readonly mode?: unknown;
    readonly fileUrl?: unknown;
    readonly fileHash?: unknown;
    readonly runtimeVersion?: unknown;
    readonly revisionSignals?: {
      readonly contentRevision?: unknown;
      readonly semanticRevision?: unknown;
    };
  };
  readonly pages?: readonly RuntimeSnapshotPageInput[];
  readonly diagnostics?: readonly unknown[];
  readonly completeness?: { readonly status?: unknown };
  readonly truncated?: unknown;
};

export type RuntimeSnapshotPageInput = {
  readonly id?: unknown;
  readonly index?: unknown;
  readonly name?: unknown;
  readonly visible?: unknown;
  readonly background?: unknown;
  readonly metadata?: unknown;
  readonly layers?: readonly RuntimeSnapshotLayerInput[];
  readonly elements?: readonly RuntimeSnapshotElementInput[];
};

export type RuntimeSnapshotLayerInput = {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly visible?: unknown;
  readonly locked?: unknown;
  readonly pageId?: unknown;
  readonly index?: unknown;
  readonly metadata?: unknown;
};

export type RuntimeSnapshotElementInput = {
  readonly id?: unknown;
  readonly pageId?: unknown;
  readonly layerId?: unknown;
  readonly parentId?: unknown;
  readonly sourceId?: unknown;
  readonly targetId?: unknown;
  readonly type?: unknown;
  readonly label?: unknown;
  readonly style?: {
    readonly raw?: unknown;
    readonly properties?: unknown;
    readonly uninterpreted?: unknown;
  };
  readonly geometry?: unknown;
  readonly waypoints?: unknown;
  readonly relativeGeometry?: unknown;
  readonly tags?: unknown;
  readonly customAttributes?: unknown;
  readonly raw?: unknown;
};

const RUNTIME_SOURCE: SourceRef = {
  kind: "adapter",
  sourceName: "runtime-snapshot-v1",
};

export function fromRuntimeSnapshot(
  input: RuntimeSnapshotInput,
  options: NormalizeOptions = {},
) {
  return normalizeDiagram(toCanonicalRuntimeSnapshotInput(input, options), {
    ...options,
    source: {
      ...RUNTIME_SOURCE,
      ...options.source,
    },
  });
}

export function toCanonicalRuntimeSnapshotInput(
  input: RuntimeSnapshotInput,
  options: NormalizeOptions = {},
): CanonicalDiagramInput {
  const limits = applyLimits(options.limits);
  const documentId = safeString(input.document?.id, limits.maxStringLength);
  const partialSnapshot = isPartialRuntimeSnapshot(input);
  return {
    documentId,
    source: {
      ...RUNTIME_SOURCE,
      ...(documentId ? { documentId } : {}),
    },
    pages: (input.pages ?? []).map((page, fallbackIndex): CanonicalPageInput => {
      const pageExternalId = safeString(page.id, limits.maxStringLength);
      const pageIndex = Number.isInteger(page.index) && Number(page.index) >= 0
        ? Number(page.index)
        : fallbackIndex;
      const layerIds = new Set(
        (page.layers ?? [])
          .map((layer) => safeString(layer.id, limits.maxStringLength))
          .filter((id): id is string => id !== undefined),
      );
      const pageSource: SourceRef = {
        ...RUNTIME_SOURCE,
        ...(documentId ? { documentId } : {}),
        ...(pageExternalId ? { pageId: pageExternalId } : {}),
        pageIndex,
      };
      return {
        pageExternalId,
        index: pageIndex,
        name: page.name,
        source: pageSource,
        layers: (page.layers ?? []).map((layer) =>
          toCanonicalLayer(layer, pageSource),
        ),
        elements: (page.elements ?? []).map((element) =>
          toCanonicalElement(element, layerIds, pageSource, limits, partialSnapshot),
        ),
      };
    }),
  };
}

function toCanonicalLayer(
  layer: RuntimeSnapshotLayerInput,
  source: SourceRef,
): CanonicalLayerInput {
  return {
    layerExternalId: layer.id,
    name: layer.name,
    visible: layer.visible,
    locked: layer.locked,
    source,
  };
}

function toCanonicalElement(
  element: RuntimeSnapshotElementInput,
  layerIds: ReadonlySet<string>,
  pageSource: SourceRef,
  limits: ReturnType<typeof applyLimits>,
  partialSnapshot: boolean,
): CanonicalElementInput {
  const externalId = safeString(element.id, limits.maxStringLength);
  const parentExternalId = safeString(element.parentId, limits.maxStringLength);
  const explicitLayerExternalId = safeString(element.layerId, limits.maxStringLength);
  const parentPointsToLayer =
    parentExternalId !== undefined && layerIds.has(parentExternalId);
  const layerExternalId =
    partialSnapshot
      ? undefined
      : explicitLayerExternalId ?? (parentPointsToLayer ? parentExternalId : undefined);
  const containmentParentExternalId = parentPointsToLayer
    ? undefined
    : parentExternalId;
  const sourceExternalId = partialSnapshot
    ? undefined
    : safeString(element.sourceId, limits.maxStringLength);
  const targetExternalId = partialSnapshot
    ? undefined
    : safeString(element.targetId, limits.maxStringLength);
  const style = normalizeStyle(element, limits);
  const metadata = normalizeMetadata(element, limits);
  const geometry = normalizeGeometry(element, limits);

  return {
    externalId,
    kind: detectKind(element),
    layerExternalId,
    parentExternalId: partialSnapshot ? undefined : containmentParentExternalId,
    sourceExternalId,
    targetExternalId,
    label: normalizeLabel(element.label, limits),
    ...(style ? { style } : {}),
    ...(geometry ? { geometry } : {}),
    ...(metadata ? { metadata } : {}),
    raw: sanitizeJson(
      {
        type: element.type,
        pageId: element.pageId,
        relativeGeometry: element.relativeGeometry,
        raw: element.raw,
        runtimeSnapshotPartial: partialSnapshot ? true : undefined,
      },
      limits,
    ),
    source: {
      ...pageSource,
      ...(externalId ? { drawioId: externalId } : {}),
      ...(sourceExternalId ? { sourceExternalId } : {}),
      ...(targetExternalId ? { targetExternalId } : {}),
    },
  };
}

function isPartialRuntimeSnapshot(input: RuntimeSnapshotInput): boolean {
  return input.truncated === true || input.completeness?.status === "partial";
}

function detectKind(element: RuntimeSnapshotElementInput): ElementKind {
  switch (element.type) {
    case "edge":
      return "edge";
    case "group":
      return "group";
    case "vertex":
      return "node";
    default:
      return "unknown";
  }
}

function normalizeLabel(
  value: unknown,
  limits: ReturnType<typeof applyLimits>,
): Label | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const format =
    raw.format === "plain" || raw.format === "html" || raw.format === "unknown"
      ? raw.format
      : "unknown";
  const text = safeString(raw.text, limits.maxStringLength);
  const html = safeString(raw.html, limits.maxStringLength);
  return {
    format,
    ...(text !== undefined ? { text } : {}),
    ...(html !== undefined ? { html } : {}),
  };
}

function normalizeStyle(
  element: RuntimeSnapshotElementInput,
  limits: ReturnType<typeof applyLimits>,
) {
  const parsed = parseStyle(element.style?.raw, limits);
  if (parsed) {
    return parsed;
  }
  if (
    element.style?.properties &&
    typeof element.style.properties === "object" &&
    !Array.isArray(element.style.properties)
  ) {
    const properties = createSafeRecord<string>();
    for (const [key, value] of Object.entries(element.style.properties)) {
      const safeKey = safeString(key, limits.maxStringLength);
      const safeValue = safeString(value, limits.maxStringLength);
      if (safeKey && safeValue !== undefined) {
        properties[safeKey] = safeValue;
      }
    }
    return { properties };
  }
  return undefined;
}

function normalizeGeometry(
  element: RuntimeSnapshotElementInput,
  limits: ReturnType<typeof applyLimits>,
): Geometry | undefined {
  const source =
    element.geometry && typeof element.geometry === "object" && !Array.isArray(element.geometry)
      ? (element.geometry as Record<string, unknown>)
      : {};
  const points = Array.isArray(element.waypoints)
    ? element.waypoints
        .slice(0, limits.maxArrayItems)
        .map((point) => {
          if (!point || typeof point !== "object" || Array.isArray(point)) {
            return undefined;
          }
          const x = finiteNumber((point as Record<string, unknown>).x);
          const y = finiteNumber((point as Record<string, unknown>).y);
          return x !== undefined && y !== undefined ? { x, y } : undefined;
        })
        .filter((point): point is { x: number; y: number } => point !== undefined)
    : [];

  const geometry: Geometry = {
    ...(finiteNumber(source.x) !== undefined ? { x: finiteNumber(source.x) } : {}),
    ...(finiteNumber(source.y) !== undefined ? { y: finiteNumber(source.y) } : {}),
    ...(finiteNumber(source.width) !== undefined ? { width: finiteNumber(source.width) } : {}),
    ...(finiteNumber(source.height) !== undefined ? { height: finiteNumber(source.height) } : {}),
    ...(typeof element.relativeGeometry === "boolean"
      ? { relative: element.relativeGeometry }
      : typeof source.relative === "boolean"
        ? { relative: source.relative }
        : {}),
    ...(points.length > 0 ? { points } : {}),
    raw: sanitizeJson(source, limits),
  };

  return Object.keys(geometry).length > 1 || geometry.raw !== undefined
    ? geometry
    : undefined;
}

function normalizeMetadata(
  element: RuntimeSnapshotElementInput,
  limits: ReturnType<typeof applyLimits>,
): Record<string, JsonValue> | undefined {
  const metadata = createSafeRecord<JsonValue>();
  const custom = sanitizeJson(element.customAttributes, limits);
  if (custom && typeof custom === "object" && !Array.isArray(custom)) {
    for (const [key, value] of Object.entries(custom)) {
      metadata[key] = value;
    }
  }

  const tags = sanitizeJson(element.tags, limits);
  if (Array.isArray(tags) && tags.length > 0) {
    metadata.tags = tags;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
