import { applyLimits } from "./limits.js";
import { createSafeRecord, safeNumber, safeString, sanitizeAttributes, sanitizeJson } from "./safe-json.js";
import { parseStyle } from "./style.js";
import type {
  CanonicalDiagramInput,
  CanonicalElementInput,
  CanonicalLayerInput,
  CanonicalPageInput,
  ElementKind,
  Geometry,
  JsonValue,
  NormalizeOptions,
  SourceRef,
} from "./types.js";
import { normalizeDiagram } from "./normalize.js";

export type LegacyCellRefInput =
  | string
  | {
      readonly id?: unknown;
    };

export type LegacyCellInput = {
  readonly id?: unknown;
  readonly mxObjectId?: unknown;
  readonly value?: unknown;
  readonly geometry?: unknown;
  readonly style?: unknown;
  readonly edge?: unknown;
  readonly vertex?: unknown;
  readonly parent?: LegacyCellRefInput | null;
  readonly source?: LegacyCellRefInput | null;
  readonly target?: LegacyCellRefInput | null;
  readonly layer?: {
    readonly id?: unknown;
    readonly name?: unknown;
  } | null;
  readonly tags?: unknown;
  readonly childIds?: unknown;
  readonly [key: string]: unknown;
};

export type LegacyLayerInput = {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly visible?: unknown;
  readonly locked?: unknown;
};

export type LegacyPagedModelPage = {
  readonly page?: {
    readonly id?: unknown;
    readonly index?: unknown;
    readonly name?: unknown;
  };
  readonly layers?: readonly LegacyLayerInput[];
  readonly cells?: readonly LegacyCellInput[] | { readonly cells?: readonly LegacyCellInput[] };
};

export type LegacyPagedModelInput = {
  readonly documentId?: unknown;
  readonly pages?: readonly LegacyPagedModelPage[];
};

const LEGACY_SOURCE: SourceRef = {
  kind: "adapter",
  sourceName: "legacy-paged-model",
};

export function fromLegacyPagedModel(
  input: LegacyPagedModelInput,
  options: NormalizeOptions = {},
) {
  return normalizeDiagram(toCanonicalDiagramInput(input, options), {
    ...options,
    source: {
      ...LEGACY_SOURCE,
      ...options.source,
    },
  });
}

export function toCanonicalDiagramInput(
  input: LegacyPagedModelInput,
  options: NormalizeOptions = {},
): CanonicalDiagramInput {
  const limits = applyLimits(options.limits);
  return {
    documentId: input.documentId,
    source: LEGACY_SOURCE,
    pages: (input.pages ?? []).map((page, fallbackIndex): CanonicalPageInput => {
      const layers = (page.layers ?? []).map(toCanonicalLayer);
      const layerIds = new Set(
        layers
          .map((layer) => safeString(layer.layerExternalId, limits.maxStringLength))
          .filter((id): id is string => id !== undefined),
      );
      const cells = getCells(page.cells);
      return {
        pageExternalId: page.page?.id,
        index: page.page?.index ?? fallbackIndex,
        name: page.page?.name,
        source: LEGACY_SOURCE,
        layers,
        elements: cells.map((cell) => toCanonicalElement(cell, layerIds, limits)),
      };
    }),
  };
}

function toCanonicalLayer(layer: LegacyLayerInput): CanonicalLayerInput {
  return {
    layerExternalId: layer.id,
    name: layer.name,
    visible: layer.visible,
    locked: layer.locked,
    source: LEGACY_SOURCE,
  };
}

function toCanonicalElement(
  cell: LegacyCellInput,
  layerIds: ReadonlySet<string>,
  limits: ReturnType<typeof applyLimits>,
): CanonicalElementInput {
  const style = parseStyle(cell.style, limits);
  const explicitLayerExternalId =
    cell.layer && typeof cell.layer === "object"
      ? safeString(cell.layer.id, limits.maxStringLength)
      : undefined;
  const parentExternalId = refId(cell.parent, limits);
  const parentPointsToLayer =
    parentExternalId !== undefined && layerIds.has(parentExternalId);
  const layerExternalId = explicitLayerExternalId ?? (parentPointsToLayer ? parentExternalId : undefined);
  const containmentParentExternalId = parentPointsToLayer ? undefined : parentExternalId;
  const sourceExternalId = refId(cell.source, limits);
  const targetExternalId = refId(cell.target, limits);
  const externalId = safeString(cell.id, limits.maxStringLength);

  return {
    externalId,
    kind: detectKind(cell, style),
    layerExternalId,
    parentExternalId: containmentParentExternalId,
    sourceExternalId,
    targetExternalId,
    childExternalIds: childExternalIds(cell.childIds, limits),
    label: normalizeLabel(cell.value, style, limits),
    ...(style ? { style } : {}),
    geometry: normalizeGeometry(cell.geometry, limits),
    metadata: normalizeMetadata(cell.value, cell.tags, limits),
    raw: sanitizeJson(
      {
        mxObjectId: cell.mxObjectId,
        edge: cell.edge,
        vertex: cell.vertex,
        childIds: cell.childIds,
      },
      limits,
    ),
    source: {
      ...LEGACY_SOURCE,
      ...(externalId ? { drawioId: externalId } : {}),
      ...(sourceExternalId ? { sourceExternalId } : {}),
      ...(targetExternalId ? { targetExternalId } : {}),
    },
  };
}

function getCells(
  value: LegacyPagedModelPage["cells"],
): readonly LegacyCellInput[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (isCellsObject(value) && Array.isArray(value.cells)) {
    return value.cells;
  }
  return [];
}

function isCellsObject(
  value: LegacyPagedModelPage["cells"],
): value is { readonly cells?: readonly LegacyCellInput[] } {
  return value !== undefined && !Array.isArray(value) && typeof value === "object";
}

function detectKind(
  cell: LegacyCellInput,
  style: ReturnType<typeof parseStyle>,
): ElementKind {
  if (cell.edge === true || cell.edge === 1) {
    return "edge";
  }
  if (style?.raw === "group" || style?.uninterpreted?.includes("group")) {
    return "group";
  }
  if (cell.vertex === false && cell.edge !== false) {
    return "unknown";
  }
  return "node";
}

function refId(
  value: LegacyCellRefInput | null | undefined,
  limits: ReturnType<typeof applyLimits>,
): string | undefined {
  if (typeof value === "string") {
    return safeString(value, limits.maxStringLength);
  }
  if (value && typeof value === "object") {
    return safeString(value.id, limits.maxStringLength);
  }
  return undefined;
}

function normalizeLabel(
  value: unknown,
  style: ReturnType<typeof parseStyle>,
  limits: ReturnType<typeof applyLimits>,
) {
  if (typeof value === "string") {
    const text = safeString(value, limits.maxStringLength);
    const isHtml = style?.properties.html === "1" || /<\/?[a-z][\s\S]*>/i.test(value);
    return isHtml && text !== undefined
      ? { format: "html" as const, text: stripHtml(text), html: text }
      : { format: "plain" as const, text };
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const attributes = (value as { attributes?: unknown }).attributes;
    if (attributes && typeof attributes === "object") {
      const label = (attributes as Record<string, unknown>).label;
      if (label !== undefined) {
        const rawLabel = safeString(label, limits.maxStringLength);
        if (style?.properties.html === "1" && rawLabel !== undefined) {
          return { format: "html" as const, text: stripHtml(rawLabel), html: rawLabel };
        }
        return { format: "plain" as const, text: rawLabel };
      }
    }
    return { format: "unknown" as const };
  }

  return undefined;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

function normalizeMetadata(
  value: unknown,
  tags: unknown,
  limits: ReturnType<typeof applyLimits>,
): Record<string, JsonValue> | undefined {
  const metadata = createSafeRecord<JsonValue>();
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const attributes = sanitizeAttributes(
      (value as { attributes?: unknown }).attributes,
      limits,
    );
    if (attributes) {
      for (const [key, entry] of Object.entries(attributes)) {
        if (key !== "label") {
          metadata[key] = entry;
        }
      }
    }
  }

  const safeTags = sanitizeJson(tags, limits);
  if (Array.isArray(safeTags) && safeTags.length > 0) {
    metadata.tags = safeTags;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function normalizeGeometry(
  value: unknown,
  limits: ReturnType<typeof applyLimits>,
): Geometry | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const pointsInput = Array.isArray(raw.points) ? raw.points : [];
  const points = pointsInput
    .slice(0, limits.maxArrayItems)
    .map((point) => {
      if (!point || typeof point !== "object") {
        return undefined;
      }
      const x = safeNumber((point as Record<string, unknown>).x);
      const y = safeNumber((point as Record<string, unknown>).y);
      return x !== undefined && y !== undefined ? { x, y } : undefined;
    })
    .filter((point): point is { x: number; y: number } => point !== undefined);

  return {
    ...(safeNumber(raw.x) !== undefined ? { x: safeNumber(raw.x) } : {}),
    ...(safeNumber(raw.y) !== undefined ? { y: safeNumber(raw.y) } : {}),
    ...(safeNumber(raw.width) !== undefined ? { width: safeNumber(raw.width) } : {}),
    ...(safeNumber(raw.height) !== undefined ? { height: safeNumber(raw.height) } : {}),
    ...(typeof raw.relative === "boolean" ? { relative: raw.relative } : {}),
    ...(points.length > 0 ? { points } : {}),
    raw: sanitizeJson(raw, limits),
  };
}

function childExternalIds(
  value: unknown,
  limits: ReturnType<typeof applyLimits>,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .slice(0, limits.maxArrayItems)
    .map((entry) => safeString(entry, limits.maxStringLength))
    .filter((entry): entry is string => entry !== undefined && entry.length > 0);
}
