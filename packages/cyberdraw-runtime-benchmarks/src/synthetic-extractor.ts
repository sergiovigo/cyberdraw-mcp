import {
  CYBERDRAW_RUNTIME_CONTRACT_VERSION,
  CYBERDRAW_RUNTIME_SNAPSHOT_SCHEMA_VERSION,
  DEFAULT_RUNTIME_SNAPSHOT_LIMITS,
  computeContentRevision,
  normalizeRuntimeSnapshotLimits,
  stableStringify,
  type JsonValue,
  type RuntimeSnapshot,
  type RuntimeSnapshotDiagnostic,
  type RuntimeSnapshotElement,
  type RuntimeSnapshotExternalReference,
  type RuntimeSnapshotLimits,
  type RuntimeSnapshotPage,
  type RuntimeSnapshotScope,
} from "cyberdraw-runtime-contract";
import type {
  BenchmarkScenario,
  ExtractedSnapshot,
  SyntheticDiagram,
  SyntheticElement,
  SyntheticPage,
} from "./types.js";

export function extractSyntheticRuntimeSnapshot(
  diagram: SyntheticDiagram,
  scenario: BenchmarkScenario,
  options: {
    readonly includeRaw: boolean;
    readonly limits?: Partial<RuntimeSnapshotLimits>;
  },
): ExtractedSnapshot {
  const limits = normalizeRuntimeSnapshotLimits({
    ...DEFAULT_RUNTIME_SNAPSHOT_LIMITS,
    ...options.limits,
  });
  const diagnostics: RuntimeSnapshotDiagnostic[] = [];
  const requestedScope = scenario.scope;
  const selectedIds = selectedIdsForScenario(diagram, scenario);
  const pagePlan = resolvePages(diagram, requestedScope, diagnostics);
  const layerFilters = resolveLayerFilters(pagePlan, requestedScope, diagnostics);
  const extractedPages: RuntimeSnapshotPage[] = [];
  const externalReferences: RuntimeSnapshotExternalReference[] = [];
  let elementsInspected = 0;
  let elementsIncluded = 0;
  let contextOnlyElements = 0;
  let layersVisited = 0;
  let hardLimitOutcome: ExtractedSnapshot["hardLimitOutcome"] = "within-limit";

  for (const page of pagePlan.slice(0, limits.maxPages)) {
    const layerFilter = layerFilters.get(page.id);
    const layers = page.layers
      .slice(0, limits.maxLayersPerPage)
      .filter((layer) => !layerFilter || layerFilter.has(layer.id))
      .map((layer) => ({
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
        pageId: layer.pageId,
        index: layer.index,
      }));
    layersVisited += layers.length;
    const include = includeElementFactory(
      page,
      requestedScope,
      layerFilter,
      selectedIds,
    );
    const elements: RuntimeSnapshotElement[] = [];
    const includedIds = new Set<string>();
    const contextIds = new Set<string>();
    for (const element of page.elements) {
      elementsInspected += 1;
      const decision = include(element);
      if (!decision.include) {
        continue;
      }
      if (elements.length >= limits.maxElementsPerPage) {
        diagnostics.push({
          code: "element_limit_reached",
          message: `Synthetic benchmark included ${elements.length} of ${page.elements.length} elements.`,
          pageId: page.id,
          limit: limits.maxElementsPerPage,
          observed: page.elements.length,
        });
        break;
      }
      includedIds.add(element.id);
      if (decision.contextOnly) {
        contextIds.add(element.id);
        contextOnlyElements += 1;
      }
      elements.push(toRuntimeElement(element, options.includeRaw, decision.contextOnly));
    }
    elementsIncluded += elements.length;
    recordExternalReferences(page, includedIds, externalReferences);
    extractedPages.push({
      id: page.id,
      index: page.index,
      name: page.name,
      visible: page.visible,
      background: page.background,
      metadata: { synthetic: true },
      layers,
      elements,
    });
  }

  if (pagePlan.length > limits.maxPages) {
    diagnostics.push({
      code: "page_limit_reached",
      message: `Synthetic benchmark included ${limits.maxPages} of ${pagePlan.length} pages.`,
      limit: limits.maxPages,
      observed: pagePlan.length,
    });
  }
  diagnostics.push({
    code: "semantic_revision_deferred",
    message: "Synthetic benchmark preserves the runtime contract semantic revision policy.",
  });

  if (scenario.partial) {
    diagnostics.push({
      code: "snapshot_soft_limit_reached",
      message: "Synthetic benchmark partial scenario marks the snapshot non-conclusive.",
      limit: limits.softSnapshotBytes,
      observed: limits.softSnapshotBytes + 1,
    });
  }

  const completeness =
    scenario.partial || diagnostics.some((diagnostic) => diagnostic.code.endsWith("_limit_reached"))
      ? ({ status: "partial", reason: "soft-limit" } as const)
      : ({ status: "complete" } as const);
  const scopeMetadata = {
    requestedScope,
    resolvedScope: requestedScope,
    includedPages: extractedPages.map((page) => page.id),
    includedLayers: extractedPages.map((page) => ({
      pageId: page.id,
      layerIds: page.layers.map((layer) => layer.id),
    })),
    includedElementCount: elementsIncluded,
    contextElementCount: contextOnlyElements,
    externalReferences,
    missingPageIds: missingPageIds(diagram, requestedScope),
    missingLayerIds: [],
    includedContext: contextOnlyElements > 0,
    requiresScopeExpansion: externalReferences.length > 0,
    conclusive: completeness.status === "complete" && externalReferences.length === 0,
  };
  const selectionRevision =
    requestedScope.kind === "selection"
      ? computeContentRevision({
          algorithm: "cyberdraw-selection-v1",
          selectedIds,
          pageIds: extractedPages.map((page) => page.id),
        })
      : undefined;
  const revisionBase = {
    contractVersion: CYBERDRAW_RUNTIME_CONTRACT_VERSION,
    schemaVersion: CYBERDRAW_RUNTIME_SNAPSHOT_SCHEMA_VERSION,
    document: {
      id: diagram.documentId,
      pageCount: diagram.pages.length,
      runtimeVersion: diagram.runtimeVersion,
    },
    scopeAlgorithm: "cyberdraw-scope-v1",
    requestedScope,
    resolvedScope: requestedScope,
    scopeMetadata,
    pages: extractedPages.map((page) => ({
      id: page.id,
      index: page.index,
      name: page.name,
      layers: page.layers,
      elements: page.elements,
    })),
    limits,
    diagnostics: diagnostics
      .filter((diagnostic) => diagnostic.code !== "semantic_revision_deferred")
      .map((diagnostic) => ({
        code: diagnostic.code,
        ...(diagnostic.pageId ? { pageId: diagnostic.pageId } : {}),
      })),
    complete: completeness.status === "complete",
    selectionRevision,
  };
  const contentRevision = computeContentRevision(revisionBase as JsonValue);
  const withoutPerformance = {
    schemaVersion: CYBERDRAW_RUNTIME_SNAPSHOT_SCHEMA_VERSION,
    contractVersion: CYBERDRAW_RUNTIME_CONTRACT_VERSION,
    document: {
      id: diagram.documentId,
      title: `Synthetic ${diagram.fixture}`,
      pageCount: diagram.pages.length,
      currentPageId: diagram.pages[0]?.id,
      runtimeVersion: diagram.runtimeVersion,
      capturedAt: "2026-07-16T00:00:00.000Z",
      revisionSignals: {
        documentId: diagram.documentId,
        pageIds: extractedPages.map((page) => page.id),
        scope: requestedScope,
        requestedScope,
        resolvedScope: requestedScope,
        complete: completeness.status === "complete",
        contentRevision,
        ...(selectionRevision ? { selectionRevision } : {}),
      },
    },
    scope: scopeMetadata,
    pages: extractedPages,
    diagnostics,
    completeness,
    truncated: completeness.status !== "complete",
    limits,
    payload: {
      approximateJsonBytes: 0,
      measuredJsonBytes: 0,
      softLimitBytes: limits.softSnapshotBytes,
      hardLimitBytes: limits.hardSnapshotBytes,
    },
  } satisfies Omit<RuntimeSnapshot, "performance">;
  const jsonBytes = Buffer.byteLength(stableStringify(withoutPerformance), "utf8");
  if (jsonBytes > limits.hardSnapshotBytes) {
    hardLimitOutcome = "hard-limit-error";
    return {
      attemptedJsonBytes: jsonBytes,
      traversal: {
        pagesVisited: pagePlan.length,
        layersVisited,
        elementsInspected,
        elementsIncluded,
        contextOnlyElements,
        externalReferences: externalReferences.length,
      },
      hardLimitOutcome,
    };
  }
  if (jsonBytes > limits.softSnapshotBytes || completeness.status === "partial") {
    hardLimitOutcome = "soft-limit";
  }
  const snapshot: RuntimeSnapshot = {
    ...withoutPerformance,
    payload: {
      approximateJsonBytes: jsonBytes,
      measuredJsonBytes: jsonBytes,
      softLimitBytes: limits.softSnapshotBytes,
      hardLimitBytes: limits.hardSnapshotBytes,
    },
    performance: {
      extractionMs: 0,
      serializationMs: 0,
      approximateJsonBytes: jsonBytes,
    },
  };
  return {
    snapshot,
    attemptedJsonBytes: jsonBytes,
    traversal: {
      pagesVisited: pagePlan.length,
      layersVisited,
      elementsInspected,
      elementsIncluded,
      contextOnlyElements,
      externalReferences: externalReferences.length,
    },
    hardLimitOutcome,
  };
}

function selectedIdsForScenario(
  diagram: SyntheticDiagram,
  scenario: BenchmarkScenario,
): readonly string[] {
  if (scenario.name === "selection-empty") {
    return [];
  }
  if (scenario.name === "selection-one") {
    return diagram.selectedIds.slice(0, 1);
  }
  return diagram.selectedIds;
}

function resolvePages(
  diagram: SyntheticDiagram,
  scope: RuntimeSnapshotScope,
  diagnostics: RuntimeSnapshotDiagnostic[],
): readonly SyntheticPage[] {
  switch (scope.kind) {
    case "document":
      return diagram.pages;
    case "pages":
      return scope.pageIds
        .map((id) => {
          const page = diagram.pages.find((item) => item.id === id);
          if (!page) {
            diagnostics.push({ code: "page_not_found", message: "Synthetic page not found.", pageId: id });
          }
          return page;
        })
        .filter((page): page is SyntheticPage => page !== undefined);
    case "layers":
      return diagram.pages.filter((page) => page.id === scope.pageId);
    case "selection": {
      const pageId = scope.pageId ?? diagram.pages[0]?.id;
      return diagram.pages.filter((page) => page.id === pageId);
    }
  }
}

function resolveLayerFilters(
  pages: readonly SyntheticPage[],
  scope: RuntimeSnapshotScope,
  diagnostics: RuntimeSnapshotDiagnostic[],
): ReadonlyMap<string, ReadonlySet<string>> {
  if (scope.kind !== "layers") {
    return new Map();
  }
  const page = pages.find((item) => item.id === scope.pageId);
  const existing = new Set(page?.layers.map((layer) => layer.id) ?? []);
  const requested = new Set(scope.layerIds);
  for (const id of requested) {
    if (!existing.has(id)) {
      diagnostics.push({ code: "layer_not_found", message: "Synthetic layer not found.", pageId: scope.pageId, layerId: id });
    }
  }
  return new Map([[scope.pageId, requested]]);
}

function includeElementFactory(
  page: SyntheticPage,
  scope: RuntimeSnapshotScope,
  layerFilter: ReadonlySet<string> | undefined,
  selectedIds: readonly string[],
): (element: SyntheticElement) => { include: boolean; contextOnly: boolean } {
  const selected = new Set(selectedIds);
  const ancestors = new Set<string>();
  for (const element of page.elements) {
    if (selected.has(element.id) && element.parentId) {
      ancestors.add(element.parentId);
    }
  }
  return (element) => {
    if (scope.kind === "layers") {
      if (layerFilter?.has(element.layerId)) {
        return { include: true, contextOnly: false };
      }
      if (element.type === "group" && page.elements.some((child) => child.parentId === element.id && layerFilter?.has(child.layerId))) {
        return { include: true, contextOnly: true };
      }
      return { include: false, contextOnly: false };
    }
    if (scope.kind === "selection") {
      if (selected.has(element.id)) {
        return { include: true, contextOnly: false };
      }
      if (ancestors.has(element.id)) {
        return { include: true, contextOnly: true };
      }
      return { include: false, contextOnly: false };
    }
    return { include: true, contextOnly: false };
  };
}

function toRuntimeElement(
  element: SyntheticElement,
  includeRaw: boolean,
  contextOnly: boolean,
): RuntimeSnapshotElement {
  return {
    id: element.id,
    pageId: element.pageId,
    layerId: element.layerId,
    ...(element.parentId ? { parentId: element.parentId } : {}),
    ...(element.sourceId ? { sourceId: element.sourceId } : {}),
    ...(element.targetId ? { targetId: element.targetId } : {}),
    type: element.type,
    label: { format: "plain", text: element.labelText },
    style: {
      raw: element.style,
      properties: Object.fromEntries(
        element.style
          .split(";")
          .filter(Boolean)
          .map((token) => {
            const [key, value = ""] = token.split("=");
            return [key, value];
          }),
      ),
    },
    geometry: element.geometry,
    customAttributes: element.metadata,
    raw: includeRaw
      ? {
          synthetic: true,
          ...(contextOnly ? { contextOnly: true } : {}),
        }
      : undefined,
  };
}

function recordExternalReferences(
  page: SyntheticPage,
  includedIds: ReadonlySet<string>,
  references: RuntimeSnapshotExternalReference[],
): void {
  for (const element of page.elements) {
    if (!includedIds.has(element.id)) {
      continue;
    }
    for (const type of ["parent", "source", "target"] as const) {
      const referencedId =
        type === "parent" ? element.parentId : type === "source" ? element.sourceId : element.targetId;
      if (referencedId && !includedIds.has(referencedId)) {
        references.push({
          pageId: page.id,
          elementId: element.id,
          referenceType: type,
          referencedId,
        });
      }
    }
  }
}

function missingPageIds(
  diagram: SyntheticDiagram,
  scope: RuntimeSnapshotScope,
): readonly string[] {
  if (scope.kind !== "pages") {
    return [];
  }
  const ids = new Set(diagram.pages.map((page) => page.id));
  return scope.pageIds.filter((id) => !ids.has(id));
}
