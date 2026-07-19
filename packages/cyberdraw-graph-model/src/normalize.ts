import { provisionalDiagramId, provisionalElementId, provisionalLayerId, provisionalPageId } from "./identity.js";
import { applyLimits } from "./limits.js";
import { createSafeRecord, safeString, sanitizeJson } from "./safe-json.js";
import type {
  BrokenReferenceFinding,
  CanonicalDiagramInput,
  CanonicalElementInput,
  CanonicalLayerInput,
  CanonicalPageInput,
  DiagramSnapshot,
  GraphElement,
  GraphIndexes,
  InternalId,
  JsonValue,
  LayerSnapshot,
  NormalizeOptions,
  PageSnapshot,
  SourceRef,
} from "./types.js";

type PendingElement = GraphElement & {
  readonly refs: {
    readonly parentExternalId?: string;
    readonly sourceExternalId?: string;
    readonly targetExternalId?: string;
    readonly layerExternalId?: string;
    readonly childExternalIds: readonly string[];
  };
};

type MutableIndexes = {
  byInternalId: Map<InternalId, GraphElement>;
  byDrawioId: Map<string, string[]>;
  elementsByPage: Map<string, string[]>;
  elementsByLayer: Map<string, string[]>;
  incomingEdges: Map<string, string[]>;
  outgoingEdges: Map<string, string[]>;
};

export function normalizeDiagram(
  input: CanonicalDiagramInput,
  options: NormalizeOptions = {},
): DiagramSnapshot {
  const limits = applyLimits(options.limits);
  const documentId = safeString(input.documentId, limits.maxStringLength);
  const source: SourceRef = {
    kind: "external-snapshot",
    ...options.source,
    ...input.source,
    ...(documentId ? { documentId } : {}),
  };
  const allPages = getPages(input);
  const pagesInput = allPages.slice(0, limits.maxPages);
  const pages: PageSnapshot[] = [];
  const layers: LayerSnapshot[] = [];
  const pendingElements: PendingElement[] = [];
  const diagnostics: BrokenReferenceFinding[] = [];
  const pageByInternalId = new Map<string, PageSnapshot>();
  const layerByPageAndExternalId = new Map<string, string[]>();
  const elementIdsByPageAndExternalId = new Map<string, string[]>();

  if (allPages.length > pagesInput.length) {
    diagnostics.push(truncationDiagnostic("page", allPages.length, pagesInput.length));
  }

  pagesInput.forEach((pageInput, pagePosition) => {
    const pageIndex = normalizeIndex(pageInput.index, pagePosition);
    const pageExternalId = safeString(pageInput.pageExternalId, limits.maxStringLength);
    const pageInternalId = provisionalPageId({ pageIndex, pageExternalId });
    const pageSource = mergeSource(source, pageInput.source, {
      pageIndex,
      pageId: pageExternalId,
    });
    const allPageLayers = pageInput.layers ?? [];
    const pageLayers = normalizeLayers(
      allPageLayers,
      pageIndex,
      pageExternalId,
      pageInternalId,
      pageSource,
      limits.maxLayersPerPage,
      limits.maxStringLength,
    );
    const pageLayerIds = pageLayers.map((layer) => layer.internalId);
    const pageElementIds: string[] = [];

    if (allPageLayers.length > pageLayers.length) {
      diagnostics.push(
        truncationDiagnostic("layer", allPageLayers.length, pageLayers.length, pageInternalId),
      );
    }

    for (const layer of pageLayers) {
      layers.push(layer);
      if (layer.drawioId) {
        pushMap(
          layerByPageAndExternalId,
          scopedKey(pageInternalId, layer.drawioId),
          layer.internalId,
        );
      }
    }

    const allElements = pageInput.elements ?? [];
    const elements = allElements.slice(0, limits.maxElementsPerPage);
    if (allElements.length > elements.length) {
      diagnostics.push(
        truncationDiagnostic("element", allElements.length, elements.length, pageInternalId),
      );
    }

    elements.forEach((element, appearanceIndex) => {
      const pending = normalizeElement({
        element,
        appearanceIndex,
        pageIndex,
        pageExternalId,
        pageInternalId,
        pageSource,
        limits,
      });
      pendingElements.push(pending);
      pageElementIds.push(pending.internalId);
      if (pending.drawioId) {
        pushMap(
          elementIdsByPageAndExternalId,
          scopedKey(pageInternalId, pending.drawioId),
          pending.internalId,
        );
      }
    });

    const page: PageSnapshot = {
      internalId: pageInternalId,
      ...(pageExternalId ? { drawioId: pageExternalId } : {}),
      index: pageIndex,
      name:
        safeString(pageInput.name, limits.maxStringLength) ??
        `Page-${pageIndex + 1}`,
      layerIds: pageLayerIds,
      elementIds: pageElementIds,
      source: pageSource,
    };
    pages.push(page);
    pageByInternalId.set(page.internalId, page);
  });

  const resolvedElements = pendingElements.map((element) =>
    resolveElementReferences(
      element,
      pageByInternalId,
      layerByPageAndExternalId,
      elementIdsByPageAndExternalId,
      diagnostics,
    ),
  );

  diagnostics.push(...detectDuplicateDrawioIds(resolvedElements, pageByInternalId));
  diagnostics.push(...detectParentCycles(resolvedElements, pageByInternalId));

  return {
    schemaVersion: "0.1-spike",
    internalId: provisionalDiagramId(documentId),
    source,
    pages,
    layers,
    elements: resolvedElements,
    indexes: buildIndexes(resolvedElements),
    findings: diagnostics,
  };
}

function getPages(input: CanonicalDiagramInput): readonly CanonicalPageInput[] {
  if (Array.isArray(input.pages) && input.pages.length > 0) {
    return input.pages;
  }

  return [
    {
      index: 0,
      pageExternalId: "page-0",
      name: "Page-1",
      elements: Array.isArray(input.elements) ? input.elements : [],
      layers: [],
    },
  ];
}

function normalizeIndex(value: unknown, fallback: number): number {
  if (Number.isInteger(value) && Number(value) >= 0) {
    return Number(value);
  }
  return fallback;
}

function normalizeLayers(
  inputs: readonly CanonicalLayerInput[],
  pageIndex: number,
  pageExternalId: string | undefined,
  pageInternalId: string,
  source: SourceRef,
  maxLayers: number,
  maxStringLength: number,
): LayerSnapshot[] {
  return inputs.slice(0, maxLayers).map((layer, index) => {
    const layerExternalId = safeString(layer.layerExternalId, maxStringLength);
    return {
      internalId: provisionalLayerId({
        pageIndex,
        pageExternalId,
        layerExternalId,
        appearanceIndex: index,
      }),
      ...(layerExternalId ? { drawioId: layerExternalId } : {}),
      pageId: pageInternalId,
      name: safeString(layer.name, maxStringLength) ?? `Layer ${index}`,
      ...(typeof layer.visible === "boolean" ? { visible: layer.visible } : {}),
      ...(typeof layer.locked === "boolean" ? { locked: layer.locked } : {}),
      source: mergeSource(source, layer.source),
    };
  });
}

function normalizeElement({
  element,
  appearanceIndex,
  pageIndex,
  pageExternalId,
  pageInternalId,
  pageSource,
  limits,
}: {
  element: CanonicalElementInput;
  appearanceIndex: number;
  pageIndex: number;
  pageExternalId: string | undefined;
  pageInternalId: string;
  pageSource: SourceRef;
  limits: ReturnType<typeof applyLimits>;
}): PendingElement {
  const externalId = safeString(element.externalId, limits.maxStringLength);
  const layerExternalId = safeString(element.layerExternalId, limits.maxStringLength);
  const parentExternalId = safeString(element.parentExternalId, limits.maxStringLength);
  const sourceExternalId = safeString(element.sourceExternalId, limits.maxStringLength);
  const targetExternalId = safeString(element.targetExternalId, limits.maxStringLength);
  const internalId = provisionalElementId({
    pageIndex,
    pageExternalId,
    elementExternalId: externalId,
    appearanceIndex,
  });
  const source = mergeSource(pageSource, element.source, {
    drawioId: externalId,
    sourceExternalId,
    targetExternalId,
  });
  const base = {
    internalId,
    ...(externalId ? { drawioId: externalId } : {}),
    kind: element.kind ?? "unknown",
    pageId: pageInternalId,
    ...(element.label ? { label: element.label } : {}),
    ...(element.style ? { style: element.style } : {}),
    ...(element.metadata ? { metadata: sanitizeMetadata(element.metadata, limits) } : {}),
    source,
    ...(element.raw ? { raw: sanitizeJson(element.raw, limits) } : {}),
    refs: {
      parentExternalId,
      sourceExternalId,
      targetExternalId,
      layerExternalId,
      childExternalIds: childExternalIds(element.childExternalIds, limits),
    },
  };

  if (base.kind === "edge") {
    return {
      ...base,
      ...(element.geometry ? { geometry: element.geometry } : {}),
    } satisfies PendingElement;
  }

  if (base.kind === "node" || base.kind === "group") {
    return {
      ...base,
      ...(element.geometry ? { geometry: element.geometry } : {}),
    } satisfies PendingElement;
  }

  return base satisfies PendingElement;
}

function sanitizeMetadata(
  value: Readonly<Record<string, JsonValue>>,
  limits: ReturnType<typeof applyLimits>,
): Readonly<Record<string, JsonValue>> {
  const sanitized = sanitizeJson(value, limits);
  return sanitized && !Array.isArray(sanitized) && typeof sanitized === "object"
    ? sanitized
    : createSafeRecord<JsonValue>();
}

function childExternalIds(
  value: readonly unknown[] | undefined,
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

function resolveElementReferences(
  element: PendingElement,
  pages: ReadonlyMap<string, PageSnapshot>,
  layerByPageAndExternalId: ReadonlyMap<string, readonly string[]>,
  elementByPageAndExternalId: ReadonlyMap<string, readonly string[]>,
  findings: BrokenReferenceFinding[],
): GraphElement {
  const page = pages.get(element.pageId);
  if (!page) {
    findings.push(finding("missing_page", element, "page"));
  }

  const layerId = resolveExternalReference(
    element,
    "layer",
    element.refs.layerExternalId,
    layerByPageAndExternalId,
    findings,
  );
  const parentId = resolveExternalReference(
    element,
    "parent",
    element.refs.parentExternalId,
    elementByPageAndExternalId,
    findings,
  );

  for (const childExternalId of element.refs.childExternalIds) {
    const childMatches = elementByPageAndExternalId.get(
      scopedKey(element.pageId, childExternalId),
    );
    if (!childMatches || childMatches.length === 0) {
      findings.push(finding("missing_child", element, "child", childExternalId));
    } else if (childMatches.length > 1) {
      findings.push(
        finding("ambiguous_drawio_reference", element, "child", childExternalId),
      );
    }
  }

  const base = stripPending({
    ...element,
    ...(parentId ? { parentId } : {}),
    ...(layerId ? { layerId } : {}),
  });

  if (base.kind !== "edge") {
    return base;
  }

  const sourceId = resolveExternalReference(
    element,
    "source",
    element.refs.sourceExternalId,
    elementByPageAndExternalId,
    findings,
    { preserveMissing: true },
  );
  const targetId = resolveExternalReference(
    element,
    "target",
    element.refs.targetExternalId,
    elementByPageAndExternalId,
    findings,
    { preserveMissing: true },
  );

  return {
    ...base,
    ...(sourceId ? { sourceId } : {}),
    ...(targetId ? { targetId } : {}),
  };
}

function resolveExternalReference(
  element: PendingElement,
  referenceType: "source" | "target" | "parent" | "layer",
  externalId: string | undefined,
  lookup: ReadonlyMap<string, readonly string[]>,
  findings: BrokenReferenceFinding[],
  options: { readonly preserveMissing?: boolean } = {},
): string | undefined {
  if (!externalId) {
    return undefined;
  }

  const matches = lookup.get(scopedKey(element.pageId, externalId)) ?? [];
  if (matches.length === 1) {
    return matches[0];
  }

  const code =
    matches.length > 1
      ? "ambiguous_drawio_reference"
      : referenceType === "source"
        ? "missing_edge_source"
        : referenceType === "target"
          ? "missing_edge_target"
          : referenceType === "parent"
            ? "missing_parent"
            : "missing_layer";
  findings.push(finding(code, element, referenceType, externalId));
  return matches.length === 0 && options.preserveMissing ? externalId : undefined;
}

function stripPending(element: PendingElement): GraphElement {
  const { refs: _refs, ...rest } = element;
  return rest;
}

function detectDuplicateDrawioIds(
  elements: readonly GraphElement[],
  pages: ReadonlyMap<string, PageSnapshot>,
): BrokenReferenceFinding[] {
  const byPageAndDrawio = new Map<string, GraphElement[]>();
  for (const element of elements) {
    if (element.drawioId) {
      pushMap(byPageAndDrawio, scopedKey(element.pageId, element.drawioId), element);
    }
  }

  const findings: BrokenReferenceFinding[] = [];
  for (const duplicateElements of byPageAndDrawio.values()) {
    if (duplicateElements.length < 2) {
      continue;
    }
    for (const element of duplicateElements) {
      findings.push({
        category: "normalization-diagnostic",
        code: "duplicate_drawio_id",
        message: `Duplicate draw.io id '${element.drawioId}' on page '${element.pageId}'`,
        elementInternalId: element.internalId,
        referenceType: "drawioId",
        referencedDrawioId: element.drawioId,
        referencedExternalId: element.drawioId,
        page: pageEvidence(pages.get(element.pageId)),
        evidence: {
          duplicateInternalIds: duplicateElements.map((entry) => entry.internalId),
        },
      });
    }
  }
  return findings;
}

function detectParentCycles(
  elements: readonly GraphElement[],
  pages: ReadonlyMap<string, PageSnapshot>,
): BrokenReferenceFinding[] {
  const byId = new Map(elements.map((element) => [element.internalId, element]));
  const findings: BrokenReferenceFinding[] = [];
  for (const element of elements) {
    const seen = new Set<string>();
    let current: GraphElement | undefined = element;
    while (current?.parentId) {
      if (seen.has(current.parentId)) {
        findings.push({
          category: "broken-reference",
          code: "parent_cycle",
          message: `Parent cycle includes '${element.internalId}'`,
          elementInternalId: element.internalId,
          referenceType: "parent",
          referencedInternalId: current.parentId,
          page: pageEvidence(pages.get(element.pageId)),
          evidence: { cycleAt: current.parentId },
        });
        break;
      }
      seen.add(current.internalId);
      current = byId.get(current.parentId);
    }
  }
  return findings;
}

function buildIndexes(elements: readonly GraphElement[]): GraphIndexes {
  const indexes: MutableIndexes = {
    byInternalId: new Map(),
    byDrawioId: new Map(),
    elementsByPage: new Map(),
    elementsByLayer: new Map(),
    incomingEdges: new Map(),
    outgoingEdges: new Map(),
  };

  for (const element of elements) {
    indexes.byInternalId.set(element.internalId, element);
    pushMap(indexes.elementsByPage, element.pageId, element.internalId);
    if (element.drawioId) {
      pushMap(indexes.byDrawioId, element.drawioId, element.internalId);
    }
    if (element.layerId) {
      pushMap(indexes.elementsByLayer, element.layerId, element.internalId);
    }
  }

  for (const element of elements) {
    if (element.kind !== "edge") {
      continue;
    }
    if (element.sourceId) {
      pushMap(indexes.outgoingEdges, element.sourceId, element.internalId);
    }
    if (element.targetId) {
      pushMap(indexes.incomingEdges, element.targetId, element.internalId);
    }
  }

  return indexes;
}

function finding(
  code: BrokenReferenceFinding["code"],
  element: PendingElement,
  referenceType: BrokenReferenceFinding["referenceType"],
  externalId?: string,
): BrokenReferenceFinding {
  const category =
    code === "duplicate_drawio_id" || code === "input_truncated"
      ? "normalization-diagnostic"
      : "broken-reference";
  return {
    category,
    code,
    message: `${code} for ${referenceType} on '${element.internalId}'`,
    elementInternalId: element.internalId,
    referenceType,
    ...(externalId ? { referencedDrawioId: externalId, referencedExternalId: externalId } : {}),
    evidence: {
      pageId: element.pageId,
      drawioId: element.drawioId ?? null,
    },
  };
}

function truncationDiagnostic(
  scope: string,
  originalCount: number,
  retainedCount: number,
  pageInternalId?: string,
): BrokenReferenceFinding {
  return {
    category: "normalization-diagnostic",
    code: "input_truncated",
    message: `Input ${scope} count ${originalCount} exceeded normalization limit; retained ${retainedCount}`,
    referenceType: "page",
    evidence: {
      scope,
      originalCount,
      retainedCount,
      ...(pageInternalId ? { pageInternalId } : {}),
    },
  };
}

function pageEvidence(page: PageSnapshot | undefined) {
  return page
    ? {
        internalId: page.internalId,
        ...(page.drawioId ? { drawioId: page.drawioId } : {}),
        index: page.index,
        name: page.name,
      }
    : undefined;
}

function mergeSource(
  base: SourceRef,
  override?: SourceRef,
  observed?: {
    readonly pageIndex?: number;
    readonly pageId?: string;
    readonly drawioId?: string;
    readonly sourceExternalId?: string;
    readonly targetExternalId?: string;
  },
): SourceRef {
  return {
    ...base,
    ...override,
    ...(observed?.pageIndex !== undefined ? { pageIndex: observed.pageIndex } : {}),
    ...(observed?.pageId ? { pageId: observed.pageId } : {}),
    ...(observed?.drawioId ? { drawioId: observed.drawioId } : {}),
    ...(observed?.sourceExternalId ? { sourceExternalId: observed.sourceExternalId } : {}),
    ...(observed?.targetExternalId ? { targetExternalId: observed.targetExternalId } : {}),
  };
}

function scopedKey(scope: string, externalId: string): string {
  return `${scope}\u0000${externalId}`;
}

function pushMap<T>(map: Map<string, T[]>, key: string, value: T): void {
  const values = map.get(key);
  if (values) {
    values.push(value);
  } else {
    map.set(key, [value]);
  }
}
