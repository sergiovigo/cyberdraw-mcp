import {
  get_cell_tags,
  prepare_target_page_execution,
  serialize_document_info,
  serialize_page_info,
} from "./drawio-tools.js";
import {
  CYBERDRAW_RUNTIME_CONTRACT_VERSION,
  CYBERDRAW_RUNTIME_SNAPSHOT_EVENT,
  CYBERDRAW_RUNTIME_SNAPSHOT_SCHEMA_VERSION,
  computeContentRevision,
  normalizeRuntimeSnapshotScope,
  normalizeRuntimeSnapshotLimits,
  stableStringify,
  type JsonRecord,
  type JsonValue,
  type RuntimeSnapshot,
  type RuntimeSnapshotDiagnostic,
  type RuntimeSnapshotElement,
  type RuntimeSnapshotExternalReference,
  type RuntimeSnapshotLimits,
  type RuntimeSnapshotOptions,
  type RuntimeSnapshotPage,
  type RuntimeSnapshotLayer,
  type RuntimeSnapshotScope,
  type RuntimeSnapshotScopeMetadata,
} from "cyberdraw-runtime-contract";

const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export function extract_runtime_snapshot(
  ui: any,
  options: RuntimeSnapshotOptions = {},
): RuntimeSnapshot | Promise<RuntimeSnapshot> {
  if (options.measureMainThreadImpact !== true) {
    return extractRuntimeSnapshotSync(ui, options);
  }

  const impact = createMainThreadImpactProbe();
  let snapshot: RuntimeSnapshot;
  try {
    snapshot = extractRuntimeSnapshotSync(ui, options);
  } catch (error) {
    impact.dispose();
    throw error;
  }

  return impact
    .finish()
    .then((mainThreadImpact) => ({
      ...snapshot,
      performance: {
        ...snapshot.performance,
        ...mainThreadImpact,
      },
    }))
    .finally(() => {
      impact.dispose();
    });
}

export function extractRuntimeSnapshotSync(
  ui: any,
  options: RuntimeSnapshotOptions = {},
): RuntimeSnapshot {
  const started = now();
  const scopeStarted = now();
  const limits = applyLimits(options.limits);
  const diagnostics: RuntimeSnapshotDiagnostic[] = [];
  const pages = Array.isArray(ui?.pages) ? ui.pages : [];
  const selectedIds = getSelectionIds(ui?.editor?.graph);
  const currentPageId = getCurrentPageId(ui);
  const requestedScope = normalizeScope(options.scope, diagnostics);
  const allPageInfos = pages.map((page: any, index: number) => ({
    page,
    pageInfo: serialize_page_info(ui, page, index),
  }));
  const scopePlan = planScope(
    allPageInfos,
    requestedScope,
    currentPageId,
    ui?.editor?.graph,
    diagnostics,
  );
  const scopeResolutionMs = now() - scopeStarted;
  const pageCandidates = scopePlan.pageCandidates;
  const pageInputs = pageCandidates.slice(0, limits.maxPages);
  const extractedPages: RuntimeSnapshotPage[] = [];
  const externalReferences: RuntimeSnapshotExternalReference[] = [];
  const budget = createPayloadBudget(limits, diagnostics);

  if (pageCandidates.length > pageInputs.length) {
    diagnostics.push({
      code: "page_limit_reached",
      message: `Runtime snapshot included ${pageInputs.length} of ${pageCandidates.length} pages in requested scope.`,
      limit: limits.maxPages,
      observed: pageCandidates.length,
    });
  }

  const traversalStarted = now();
  for (let index = 0; index < pageInputs.length; index += 1) {
    const { pageInfo } = pageInputs[index];
    let execution: ReturnType<typeof prepare_target_page_execution> | undefined;
    try {
      execution = prepare_target_page_execution(ui, { id: pageInfo.id }, {
        prefer_background: true,
        sync_live_current_page_state: true,
      });
      const extracted = extractPage(
        execution.ui,
        pageInfo,
        currentPageId,
        limits,
        diagnostics,
        options,
        scopePlan,
        externalReferences,
        budget,
      );
      if (extracted) {
        extractedPages.push(extracted);
      }
      if (budget.hardLimitReached) {
        break;
      }
    } catch (error) {
      diagnostics.push({
        code: "page_extraction_failed",
        message: safeErrorMessage(error),
        pageId: pageInfo.id,
      });
    } finally {
      execution?.cleanup();
      restoreSelection(ui?.editor?.graph, selectedIds);
    }
  }
  const traversalMs = now() - traversalStarted;

  diagnostics.push({
    code: "semantic_revision_deferred",
    message:
      "semanticRevision is deferred because runtime extraction cannot yet prove which visual or metadata changes are semantically irrelevant.",
  });

  const assemblyStarted = now();
  const documentInfo =
    typeof options.target_document?.id === "string"
      ? serialize_document_info(ui, options.target_document.id)
      : undefined;
  const scopeMetadata = buildScopeMetadata(
    requestedScope,
    scopePlan,
    extractedPages,
    externalReferences,
    diagnostics,
  );
  const selectionRevision =
    requestedScope.kind === "selection"
      ? computeContentRevision({
          algorithm: "cyberdraw-selection-v1",
          scope: requestedScope,
          currentPageId,
          selectedIds,
          includedPages: extractedPages.map((page) => page.id),
          includedElements: extractedPages.flatMap((page) =>
            page.elements.map((element) => element.id),
          ),
        } as JsonValue)
      : undefined;
  const completeness = completenessFromDiagnostics(diagnostics);
  const revisionStarted = now();
  const revisionBase = {
    contractVersion: CYBERDRAW_RUNTIME_CONTRACT_VERSION,
    schemaVersion: CYBERDRAW_RUNTIME_SNAPSHOT_SCHEMA_VERSION,
    document: {
      id: documentInfo?.id,
      title: documentInfo?.title ?? undefined,
      mode: documentInfo?.mode ?? undefined,
      fileUrl: documentInfo?.file_url ?? undefined,
      fileHash: documentInfo?.hash ?? undefined,
      pageCount: pages.length,
      runtimeVersion: runtimeVersion(),
    },
    scopeAlgorithm: "cyberdraw-scope-v1",
    requestedScope,
    resolvedScope: scopeMetadata.resolvedScope,
    scopeMetadata: {
      includedPages: scopeMetadata.includedPages,
      includedLayers: scopeMetadata.includedLayers,
      includedElementCount: scopeMetadata.includedElementCount,
      contextElementCount: scopeMetadata.contextElementCount,
      externalReferences: scopeMetadata.externalReferences,
      missingPageIds: scopeMetadata.missingPageIds,
      missingLayerIds: scopeMetadata.missingLayerIds,
      conclusive: scopeMetadata.conclusive,
    },
    pages: extractedPages.map(contentRevisionPage),
    limits,
    diagnostics: contentRevisionDiagnostics(diagnostics),
    complete: completeness.status === "complete",
    selectionRevision,
  };
  let contentRevision = computeContentRevision(revisionBase as JsonValue);
  const revisionMs = now() - revisionStarted;
  const snapshotAssemblyMs = now() - assemblyStarted;
  const extractionMs = now() - started;
  type RuntimeSnapshotWithoutPerformance = Omit<RuntimeSnapshot, "performance">;
  const snapshotWithoutPerformance: RuntimeSnapshotWithoutPerformance = {
    schemaVersion: CYBERDRAW_RUNTIME_SNAPSHOT_SCHEMA_VERSION,
    contractVersion: CYBERDRAW_RUNTIME_CONTRACT_VERSION,
    document: {
      ...revisionBase.document,
      currentPageId: currentPageId ?? undefined,
      capturedAt: new Date().toISOString(),
      extractedAt: new Date().toISOString(),
      revisionSignals: {
        documentId: documentInfo?.id,
        fileHash: documentInfo?.hash ?? undefined,
        pageIds: extractedPages.map((page) => page.id),
        scope: cloneScope(scopeMetadata.resolvedScope),
        requestedScope: cloneScope(requestedScope),
        resolvedScope: cloneScope(scopeMetadata.resolvedScope),
        complete: completeness.status === "complete",
        contentRevision,
        selectionRevision,
      },
    },
    scope: cloneScopeMetadata(scopeMetadata),
    pages: extractedPages,
    diagnostics,
    completeness,
    truncated: completeness.status !== "complete",
    limits,
    payload: {
      approximateJsonBytes: budget.approximateBytes,
      softLimitBytes: limits.softSnapshotBytes,
      hardLimitBytes: limits.hardSnapshotBytes,
    },
  };
  const serializationStarted = now();
  const approximateJsonBytes = stableStringify(snapshotWithoutPerformance).length;
  const serializationMs = now() - serializationStarted;
  const mutableSnapshot = snapshotWithoutPerformance as {
    document: {
      revisionSignals: {
        contentRevision: string;
        complete: boolean;
      };
    };
    completeness: RuntimeSnapshot["completeness"];
    truncated: boolean;
    payload: RuntimeSnapshot["payload"];
  };

  if (approximateJsonBytes > limits.hardSnapshotBytes) {
    throw new Error(
      `Runtime snapshot payload exceeded hard limit after serialization (${approximateJsonBytes}/${limits.hardSnapshotBytes} bytes).`,
    );
  }
  mutableSnapshot.payload = {
    approximateJsonBytes,
    measuredJsonBytes: approximateJsonBytes,
    softLimitBytes: limits.softSnapshotBytes,
    hardLimitBytes: limits.hardSnapshotBytes,
  };

  return {
    ...snapshotWithoutPerformance,
    truncated: snapshotWithoutPerformance.truncated,
    diagnostics,
    performance: {
      extractionMs,
      serializationMs,
      approximateJsonBytes,
      scopeResolutionMs,
      traversalMs,
      snapshotAssemblyMs,
      revisionMs,
      totalPluginMs: now() - started,
    },
  };
}

export type MainThreadImpactProbe = {
  readonly finish: () => Promise<{
    readonly mainThreadTimerDriftMs: number;
    readonly mainThreadRafDelayMs?: number;
    readonly longTaskCount?: number;
  }>;
  readonly dispose: () => void;
};

export function createMainThreadImpactProbe(): MainThreadImpactProbe {
  const started = now();
  let timerFiredAt: number | undefined;
  let rafFiredAt: number | undefined;
  let longTaskCount: number | undefined;
  let observer: PerformanceObserver | undefined;
  let disposed = false;
  let finished = false;
  let initialTimerId: ReturnType<typeof setTimeout> | undefined;
  let finishTimerId: ReturnType<typeof setTimeout> | undefined;
  let animationFrameId: number | undefined;
  let resolveFinish:
    | ((
        value: {
          readonly mainThreadTimerDriftMs: number;
          readonly mainThreadRafDelayMs?: number;
          readonly longTaskCount?: number;
        },
      ) => void)
    | undefined;

  initialTimerId = setTimeout(() => {
    initialTimerId = undefined;
    timerFiredAt = now();
  }, 0);

  const runtimeWindow = (globalThis as { window?: any }).window;
  const requestFrame = runtimeWindow?.requestAnimationFrame;
  if (typeof requestFrame === "function") {
    animationFrameId = requestFrame.call(runtimeWindow, () => {
      animationFrameId = undefined;
      rafFiredAt = now();
    });
  }

  const PerformanceObserverCtor = runtimeWindow?.PerformanceObserver;
  if (typeof PerformanceObserverCtor === "function") {
    try {
      longTaskCount = 0;
      const createdObserver = new PerformanceObserverCtor((list: PerformanceObserverEntryList) => {
        longTaskCount = (longTaskCount ?? 0) + list.getEntries().length;
      });
      createdObserver.observe({ entryTypes: ["longtask"] });
      observer = createdObserver;
    } catch {
      longTaskCount = undefined;
      observer = undefined;
    }
  }

  const cleanup = () => {
    if (initialTimerId !== undefined) {
      clearTimeout(initialTimerId);
      initialTimerId = undefined;
    }
    if (finishTimerId !== undefined) {
      clearTimeout(finishTimerId);
      finishTimerId = undefined;
    }
    const cancelFrame = runtimeWindow?.cancelAnimationFrame;
    if (
      animationFrameId !== undefined &&
      typeof cancelFrame === "function"
    ) {
      cancelFrame.call(runtimeWindow, animationFrameId);
      animationFrameId = undefined;
    }
    observer?.disconnect();
    observer = undefined;
  };

  const currentImpact = () => {
    const completed = now();
    return {
      mainThreadTimerDriftMs: Math.max(
        0,
        (timerFiredAt ?? completed) - started,
      ),
      mainThreadRafDelayMs:
        rafFiredAt === undefined ? undefined : Math.max(0, rafFiredAt - started),
      longTaskCount,
    };
  };

  const finish = () =>
    new Promise<{
      readonly mainThreadTimerDriftMs: number;
      readonly mainThreadRafDelayMs?: number;
      readonly longTaskCount?: number;
    }>((resolve) => {
      if (disposed || finished) {
        resolve(currentImpact());
        return;
      }
      resolveFinish = resolve;
      finishTimerId = setTimeout(() => {
        const completedFinishTimerId = finishTimerId;
        finishTimerId = undefined;
        if (completedFinishTimerId !== undefined) {
          clearTimeout(completedFinishTimerId);
        }
        finished = true;
        const impact = currentImpact();
        cleanup();
        resolve(impact);
      }, 0);
    });

  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    cleanup();
    if (resolveFinish) {
      const resolve = resolveFinish;
      resolveFinish = undefined;
      resolve(currentImpact());
    }
  };

  return { finish, dispose };
}

function extractPage(
  ui: any,
  pageInfo: ReturnType<typeof serialize_page_info>,
  currentPageId: string | null,
  limits: RuntimeSnapshotLimits,
  diagnostics: RuntimeSnapshotDiagnostic[],
  options: RuntimeSnapshotOptions,
  scopePlan: ScopePlan,
  externalReferences: RuntimeSnapshotExternalReference[],
  budget: PayloadBudget,
): RuntimeSnapshotPage | undefined {
  const graph = ui?.editor?.graph;
  const model = graph?.getModel?.();
  const root = model?.getRoot?.();
  const layerFilter = scopePlan.layersByPage.get(pageInfo.id);
  const layers = extractLayers(
    model,
    root,
    pageInfo.id,
    limits,
    diagnostics,
    layerFilter,
  );
  if (!budget.tryInclude(layers, pageInfo.id)) {
    return undefined;
  }
  recordMissingLayers(pageInfo.id, layerFilter, layers, scopePlan, diagnostics);
  const elements = extractElements(
    graph,
    model,
    root,
    pageInfo.id,
    limits,
    diagnostics,
    options,
    scopePlan,
    externalReferences,
    budget,
  );

  return safeRecord({
    id: pageInfo.id,
    index: pageInfo.index,
    name: pageInfo.name,
    visible: pageInfo.id === currentPageId,
    background: pageInfo.id !== currentPageId,
    metadata: sanitizeJson(
      {
        is_current: pageInfo.is_current,
      },
      limits,
      diagnostics,
      pageInfo.id,
    ),
    layers,
    elements,
  }) as RuntimeSnapshotPage;
}

function extractLayers(
  model: any,
  root: any,
  pageId: string,
  limits: RuntimeSnapshotLimits,
  diagnostics: RuntimeSnapshotDiagnostic[],
  layerFilter: ReadonlySet<string> | undefined,
): RuntimeSnapshotLayer[] {
  reportMissingApi(
    typeof model?.getChildCount === "function",
    "mxGraphModel.getChildCount",
    diagnostics,
    pageId,
  );
  reportMissingApi(
    typeof model?.getChildAt === "function",
    "mxGraphModel.getChildAt",
    diagnostics,
    pageId,
  );
  const count = typeof model?.getChildCount === "function" ? model.getChildCount(root) : 0;
  const included = Math.min(count, limits.maxLayersPerPage);
  if (count > included) {
    diagnostics.push({
      code: "layer_limit_reached",
      message: `Runtime snapshot included ${included} of ${count} layers on page ${pageId}.`,
      pageId,
      limit: limits.maxLayersPerPage,
      observed: count,
    });
  }

  const layers: RuntimeSnapshotLayer[] = [];
  for (let index = 0; index < included; index += 1) {
    const layer = model.getChildAt(root, index);
    const layerId = safeCellId(layer) ?? `layer-${index}`;
    if (layerFilter && !layerFilter.has(layerId)) {
      continue;
    }
    const hasLockedApi = typeof layer?.isConnectable === "function";
    reportMissingApi(
      hasLockedApi,
      "mxCell.isConnectable",
      diagnostics,
      pageId,
    );
    layers.push(
      safeRecord({
        id: safeString(layer?.getId?.() ?? layer?.id, limits.maxMetadataStringLength, diagnostics, pageId) ?? `layer-${index}`,
        name: safeString(layer?.getValue?.() ?? layer?.value ?? `Layer ${index}`, limits.maxMetadataStringLength, diagnostics, pageId) ?? `Layer ${index}`,
        visible: typeof layer?.isVisible === "function" ? Boolean(layer.isVisible()) : undefined,
        locked: hasLockedApi ? !Boolean(layer.isConnectable()) : undefined,
        pageId,
        index,
      }) as RuntimeSnapshotLayer,
    );
  }
  return layers;
}

function extractElements(
  graph: any,
  model: any,
  root: any,
  pageId: string,
  limits: RuntimeSnapshotLimits,
  diagnostics: RuntimeSnapshotDiagnostic[],
  options: RuntimeSnapshotOptions,
  scopePlan: ScopePlan,
  externalReferences: RuntimeSnapshotExternalReference[],
  budget: PayloadBudget,
): RuntimeSnapshotElement[] {
  const collected = collectElementCells(
    model,
    root,
    limits.maxElementsPerPage,
    scopePlan,
    graph,
    pageId,
  );
  const included = collected.cells;
  if (collected.observed > included.length) {
    diagnostics.push({
      code: "element_limit_reached",
      message: `Runtime snapshot included ${included.length} of ${collected.observed} elements on page ${pageId}.`,
      pageId,
      limit: limits.maxElementsPerPage,
      observed: collected.observed,
    });
  }

  const elements: RuntimeSnapshotElement[] = [];
  for (const cell of included) {
    const element = extractElement(
      graph,
      model,
      cell,
      pageId,
      limits,
      diagnostics,
      options,
      scopePlan.contextElementIds.has(safeCellId(cell) ?? ""),
    );
    if (!budget.tryInclude(element, pageId, element.id)) {
      break;
    }
    elements.push(element);
  }
  recordExternalReferences(scopePlan, elements, externalReferences);
  return elements;
}

function extractElement(
  graph: any,
  model: any,
  cell: any,
  pageId: string,
  limits: RuntimeSnapshotLimits,
  diagnostics: RuntimeSnapshotDiagnostic[],
  options: RuntimeSnapshotOptions,
  contextOnly: boolean,
): RuntimeSnapshotElement {
  const style = parseStyle(cell?.style, limits, diagnostics, pageId, cell?.id);
  const geometry = extractGeometry(cell?.geometry, limits, diagnostics, pageId, cell?.id);
  const customAttributes = extractCustomAttributes(cell?.value, limits, diagnostics, pageId, cell?.id);
  const label = extractLabel(cell?.value, style?.properties, limits, diagnostics, pageId, cell?.id);
  const layer = safeCellId(getLayerForCell(graph, cell));
  const raw = options.includeRaw === false
    ? undefined
    : sanitizeJson(
        {
          mxObjectId: cell?.mxObjectId,
          vertex: cell?.vertex,
          edge: cell?.edge,
          connectable: cell?.connectable,
        visible: cell?.visible,
        collapsed: cell?.collapsed,
        contextOnly: contextOnly || undefined,
      },
        limits,
        diagnostics,
        pageId,
        cell?.id,
      );

  return safeRecord({
    id: safeCellId(cell) ?? "",
    pageId,
    layerId: layer,
    parentId: safeCellId(cell?.parent),
    sourceId: safeCellId(cell?.source),
    targetId: safeCellId(cell?.target),
    type: detectType(cell, style),
    label,
    style,
    geometry,
    waypoints: Array.isArray(cell?.geometry?.points)
      ? cell.geometry.points.slice(0, limits.maxArrayItems).map((point: any) => pointRecord(point)).filter(Boolean)
      : undefined,
    relativeGeometry:
      typeof cell?.geometry?.relative === "boolean"
        ? cell.geometry.relative
        : undefined,
    tags: get_cell_tags(graph, cell)
      .slice(0, limits.maxArrayItems)
      .map((tag) => safeString(tag, limits.maxMetadataStringLength, diagnostics, pageId, cell?.id))
      .filter((tag): tag is string => tag !== undefined),
    customAttributes,
    raw,
  }) as RuntimeSnapshotElement;
}

function collectElementCells(
  model: any,
  root: any,
  maxElements: number,
  scopePlan: ScopePlan,
  graph: any,
  pageId: string,
): { cells: any[]; observed: number } {
  const cells: any[] = [];
  const seen = new Set<any>();
  let observed = 0;
  const visit = (cell: any) => {
    if (!cell || seen.has(cell)) {
      return;
    }
    seen.add(cell);
    if (!isRoot(cell, root) && !isLayer(model, root, cell)) {
      const include = shouldIncludeCell(cell, scopePlan, graph, pageId);
      if (include) {
        observed += 1;
      }
      if (include && cells.length < maxElements) {
        cells.push(cell);
      }
    }
    const count = typeof model?.getChildCount === "function" ? model.getChildCount(cell) : 0;
    for (let index = 0; index < count; index += 1) {
      visit(model.getChildAt(cell, index));
    }
  };
  visit(root);
  return { cells, observed };
}

function extractGeometry(
  geometry: any,
  limits: RuntimeSnapshotLimits,
  diagnostics: RuntimeSnapshotDiagnostic[],
  pageId: string,
  elementId: string | undefined,
): JsonRecord | undefined {
  if (!geometry || typeof geometry !== "object") {
    return undefined;
  }
  return jsonRecord(
    {
      x: finiteNumber(geometry.x),
      y: finiteNumber(geometry.y),
      width: finiteNumber(geometry.width),
      height: finiteNumber(geometry.height),
      relative: typeof geometry.relative === "boolean" ? geometry.relative : undefined,
      sourcePoint: pointRecord(geometry.sourcePoint),
      targetPoint: pointRecord(geometry.targetPoint),
      offset: pointRecord(geometry.offset),
      alternateBounds: sanitizeJson(
        geometry.alternateBounds,
        limits,
        diagnostics,
        pageId,
        elementId,
      ),
    },
    limits,
    diagnostics,
    pageId,
    elementId,
  );
}

function pointRecord(point: any): JsonRecord | undefined {
  if (!point || typeof point !== "object") {
    return undefined;
  }
  const x = finiteNumber(point.x);
  const y = finiteNumber(point.y);
  if (x === undefined || y === undefined) {
    return undefined;
  }
  return safeRecord({ x, y }) as JsonRecord;
}

function extractLabel(
  value: any,
  styleProperties: JsonRecord | undefined,
  limits: RuntimeSnapshotLimits,
  diagnostics: RuntimeSnapshotDiagnostic[],
  pageId: string,
  elementId: string | undefined,
): RuntimeSnapshotElement["label"] {
  if (typeof value === "string") {
    const text = safeString(value, limits.maxLabelLength, diagnostics, pageId, elementId);
    if (text === undefined) {
      return undefined;
    }
    const isHtml = styleProperties?.html === "1" || /<\/?[a-z][\s\S]*>/i.test(text);
    return isHtml
      ? safeRecord({ format: "html", text: stripHtml(text), html: text }) as RuntimeSnapshotElement["label"]
      : safeRecord({ format: "plain", text }) as RuntimeSnapshotElement["label"];
  }

  if (value && typeof value === "object" && value.attributes) {
    const attrs = namedNodeMapToRecord(value.attributes, limits, diagnostics, pageId, elementId);
    const label = attrs.label;
    if (typeof label === "string") {
      return safeRecord({ format: styleProperties?.html === "1" ? "html" : "plain", text: stripHtml(label), html: styleProperties?.html === "1" ? label : undefined }) as RuntimeSnapshotElement["label"];
    }
    return safeRecord({ format: "unknown" }) as RuntimeSnapshotElement["label"];
  }

  return undefined;
}

function extractCustomAttributes(
  value: any,
  limits: RuntimeSnapshotLimits,
  diagnostics: RuntimeSnapshotDiagnostic[],
  pageId: string,
  elementId: string | undefined,
): JsonRecord | undefined {
  if (!value || typeof value !== "object" || !value.attributes) {
    return undefined;
  }
  const attrs = namedNodeMapToRecord(value.attributes, limits, diagnostics, pageId, elementId);
  delete (attrs as Record<string, JsonValue>).label;
  return Object.keys(attrs).length > 0 ? attrs : undefined;
}

function namedNodeMapToRecord(
  attributes: any,
  limits: RuntimeSnapshotLimits,
  diagnostics: RuntimeSnapshotDiagnostic[],
  pageId: string,
  elementId: string | undefined,
): JsonRecord {
  const result = safeRecord({}) as Record<string, JsonValue>;
  const length = typeof attributes?.length === "number" ? attributes.length : 0;
  const included = Math.min(length, limits.maxMetadataKeys);
  if (length > included) {
    diagnostics.push({
      code: "metadata_limit_reached",
      message: `Runtime snapshot included ${included} of ${length} metadata attributes.`,
      pageId,
      elementId,
      limit: limits.maxMetadataKeys,
      observed: length,
    });
  }
  for (let index = 0; index < included; index += 1) {
    const attr = attributes[index];
    const name = typeof attr?.name === "string" ? attr.name : undefined;
    if (!name || DANGEROUS_KEYS.has(name)) {
      continue;
    }
    const value = safeString(attr.value, limits.maxMetadataStringLength, diagnostics, pageId, elementId);
    if (value !== undefined) {
      result[name] = value;
    }
  }
  return result;
}

function parseStyle(
  rawStyle: unknown,
  limits: RuntimeSnapshotLimits,
  diagnostics: RuntimeSnapshotDiagnostic[],
  pageId: string,
  elementId: string | undefined,
): RuntimeSnapshotElement["style"] | undefined {
  const raw = safeString(rawStyle, limits.maxStyleLength, diagnostics, pageId, elementId);
  if (!raw) {
    return undefined;
  }
  const properties = safeRecord({}) as Record<string, JsonValue>;
  const uninterpreted: string[] = [];
  for (const token of raw.split(";")) {
    const trimmed = token.trim();
    if (!trimmed) {
      continue;
    }
    const equals = trimmed.indexOf("=");
    if (equals === -1) {
      uninterpreted.push(trimmed);
      continue;
    }
    const key = trimmed.slice(0, equals).trim();
    if (key && !DANGEROUS_KEYS.has(key)) {
      properties[key] = trimmed.slice(equals + 1).trim();
    }
  }
  return safeRecord({
    raw,
    properties,
    uninterpreted: uninterpreted.length > 0 ? uninterpreted : undefined,
  }) as RuntimeSnapshotElement["style"];
}

function detectType(
  cell: any,
  style: RuntimeSnapshotElement["style"] | undefined,
): RuntimeSnapshotElement["type"] {
  if (cell?.edge === true || cell?.edge === 1) {
    return "edge";
  }
  if (style?.raw === "group" || style?.uninterpreted?.includes("group")) {
    return "group";
  }
  if (cell?.vertex === true || cell?.vertex === 1) {
    return "vertex";
  }
  return "unknown";
}

function getLayerForCell(graph: any, cell: any): any {
  try {
    return graph?.getLayerForCell?.(cell) ?? null;
  } catch {
    return null;
  }
}

function isRoot(cell: any, root: any): boolean {
  return cell === root;
}

function isLayer(model: any, root: any, cell: any): boolean {
  return cell != null && model?.getParent?.(cell) === root;
}

function safeCellId(cell: any): string | undefined {
  const id = cell?.getId?.() ?? cell?.id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

function getCurrentPageId(ui: any): string | null {
  try {
    return ui?.currentPage ? serialize_page_info(ui, ui.currentPage, 0).id : null;
  } catch {
    return null;
  }
}

function getSelectionIds(graph: any): string[] {
  try {
    const cells = graph?.getSelectionCells?.() ?? [];
    return Array.isArray(cells)
      ? cells.map((cell) => safeCellId(cell)).filter((id): id is string => id !== undefined)
      : [];
  } catch {
    return [];
  }
}

function restoreSelection(graph: any, ids: readonly string[]) {
  if (!graph || typeof graph.setSelectionCells !== "function") {
    return;
  }
  try {
    const model = graph.getModel?.();
    const cells = ids
      .map((id) => model?.getCell?.(id))
      .filter((cell: any) => cell != null);
    graph.setSelectionCells(cells);
  } catch {
    // Snapshot extraction is read-only; selection restoration is best effort.
  }
}

function runtimeVersion(): string | undefined {
  const runtimeWindow = (globalThis as { window?: any }).window;
  return (
    stringOrUndefined(runtimeWindow?.EditorUi?.VERSION) ??
    stringOrUndefined(runtimeWindow?.Draw?.VERSION) ??
    stringOrUndefined(runtimeWindow?.mxClient?.VERSION)
  );
}

function contentRevisionPage(page: RuntimeSnapshotPage) {
  return {
    id: page.id,
    index: page.index,
    name: page.name,
    layers: page.layers,
    elements: page.elements,
  };
}

function applyLimits(
  overrides: Partial<RuntimeSnapshotLimits> | undefined,
): RuntimeSnapshotLimits {
  const legacyMaxSnapshotBytes =
    overrides && "maxSnapshotBytes" in overrides
      ? Number((overrides as { readonly maxSnapshotBytes?: unknown }).maxSnapshotBytes)
      : undefined;
  const hasLegacyMaxSnapshotBytes = Number.isFinite(legacyMaxSnapshotBytes);
  return normalizeRuntimeSnapshotLimits({
    ...overrides,
    ...(hasLegacyMaxSnapshotBytes
      ? {
          hardSnapshotBytes: legacyMaxSnapshotBytes as number,
          softSnapshotBytes: Math.floor((legacyMaxSnapshotBytes as number) * 0.75),
        }
      : {}),
  });
}

function sanitizeJson(
  value: unknown,
  limits: RuntimeSnapshotLimits,
  diagnostics?: RuntimeSnapshotDiagnostic[],
  pageId?: string,
  elementId?: string,
  depth = 0,
  seen = new WeakSet<object>(),
): JsonValue | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    if (value.length > limits.maxMetadataStringLength) {
      diagnostics?.push({
        code: "string_truncated",
        message: `Runtime snapshot truncated a raw string from ${value.length} to ${limits.maxMetadataStringLength} characters.`,
        pageId,
        elementId,
        limit: limits.maxMetadataStringLength,
        observed: value.length,
      });
      return value.slice(0, limits.maxMetadataStringLength);
    }
    return value;
  }
  if (typeof value === "function" || typeof value !== "object") {
    return undefined;
  }
  if (seen.has(value)) {
    diagnostics?.push({
      code: "raw_limit_reached",
      message: "Runtime snapshot omitted a cyclic raw value.",
      pageId,
      elementId,
      limit: limits.maxRawDepth,
      observed: depth,
    });
    return undefined;
  }
  if (depth >= limits.maxRawDepth) {
    diagnostics?.push({
      code: "raw_limit_reached",
      message: `Runtime snapshot omitted raw data deeper than ${limits.maxRawDepth}.`,
      pageId,
      elementId,
      limit: limits.maxRawDepth,
      observed: depth,
    });
    return undefined;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    if (value.length > limits.maxArrayItems) {
      diagnostics?.push({
        code: "raw_limit_reached",
        message: `Runtime snapshot included ${limits.maxArrayItems} of ${value.length} raw array items.`,
        pageId,
        elementId,
        limit: limits.maxArrayItems,
        observed: value.length,
      });
    }
    return value
      .slice(0, limits.maxArrayItems)
      .map((entry) =>
        sanitizeJson(entry, limits, diagnostics, pageId, elementId, depth + 1, seen),
      )
      .filter((entry): entry is JsonValue => entry !== undefined);
  }
  const result = safeRecord({}) as Record<string, JsonValue>;
  let count = 0;
  const entries = safeEntries(value, diagnostics, pageId, elementId);
  for (const [key, entry] of entries) {
    if (DANGEROUS_KEYS.has(key)) {
      continue;
    }
    if (count >= limits.maxRawKeys) {
      diagnostics?.push({
        code: "raw_limit_reached",
        message: `Runtime snapshot included ${limits.maxRawKeys} raw keys from an object with ${entries.length} enumerable keys.`,
        pageId,
        elementId,
        limit: limits.maxRawKeys,
        observed: entries.length,
      });
      break;
    }
    const sanitized = sanitizeJson(
      entry,
      limits,
      diagnostics,
      pageId,
      elementId,
      depth + 1,
      seen,
    );
    if (sanitized !== undefined) {
      result[key] = sanitized;
      count += 1;
    }
  }
  return result;
}

function jsonRecord(
  value: Record<string, unknown>,
  limits: RuntimeSnapshotLimits,
  diagnostics?: RuntimeSnapshotDiagnostic[],
  pageId?: string,
  elementId?: string,
): JsonRecord | undefined {
  const sanitized = sanitizeJson(value, limits, diagnostics, pageId, elementId);
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
    ? (sanitized as JsonRecord)
    : undefined;
}

function safeEntries(
  value: object,
  diagnostics?: RuntimeSnapshotDiagnostic[],
  pageId?: string,
  elementId?: string,
): [string, unknown][] {
  try {
    return Object.entries(value);
  } catch {
    diagnostics?.push({
      code: "raw_limit_reached",
      message: "Runtime snapshot omitted raw object entries that could not be enumerated safely.",
      pageId,
      elementId,
    });
    return [];
  }
}

function hasTruncation(
  diagnostics: readonly RuntimeSnapshotDiagnostic[],
): boolean {
  return diagnostics.some(
    (diagnostic) =>
      diagnostic.code.endsWith("_limit_reached") ||
      diagnostic.code === "string_truncated",
  );
}

function contentRevisionDiagnostics(
  diagnostics: readonly RuntimeSnapshotDiagnostic[],
) {
  return diagnostics
    .filter((diagnostic) => diagnostic.code !== "semantic_revision_deferred")
    .map((diagnostic) => ({
      code: diagnostic.code,
      pageId: diagnostic.pageId,
      elementId: diagnostic.elementId,
      limit: diagnostic.limit,
      observed: diagnostic.observed,
      api: diagnostic.api,
    }));
}

type PayloadBudget = {
  readonly approximateBytes: number;
  readonly hardLimitReached: boolean;
  tryInclude: (value: unknown, pageId?: string, elementId?: string) => boolean;
};

function createPayloadBudget(
  limits: RuntimeSnapshotLimits,
  diagnostics: RuntimeSnapshotDiagnostic[],
): PayloadBudget {
  let approximateBytes = 0;
  let softLimitReached = false;
  let hardLimitReached = false;
  return {
    get approximateBytes() {
      return approximateBytes;
    },
    get hardLimitReached() {
      return hardLimitReached;
    },
    tryInclude(value, pageId, elementId) {
      if (hardLimitReached) {
        return false;
      }
      const bytes = stableStringify(value).length;
      const next = approximateBytes + bytes;
      if (next > limits.hardSnapshotBytes) {
        hardLimitReached = true;
        diagnostics.push({
          code: "snapshot_hard_limit_reached",
          message: `Runtime snapshot stopped before adding data that would exceed the ${limits.hardSnapshotBytes} byte hard limit.`,
          pageId,
          elementId,
          limit: limits.hardSnapshotBytes,
          observed: next,
        });
        return false;
      }
      approximateBytes = next;
      if (!softLimitReached && approximateBytes > limits.softSnapshotBytes) {
        softLimitReached = true;
        diagnostics.push({
          code: "snapshot_soft_limit_reached",
          message: `Runtime snapshot exceeded the ${limits.softSnapshotBytes} byte soft limit and is marked partial.`,
          pageId,
          elementId,
          limit: limits.softSnapshotBytes,
          observed: approximateBytes,
        });
      }
      return true;
    },
  };
}

type PageCandidate = {
  readonly page: any;
  readonly pageInfo: ReturnType<typeof serialize_page_info>;
};

type ScopePlan = {
  readonly requestedScope: RuntimeSnapshotScope;
  readonly resolvedScope: RuntimeSnapshotScope;
  readonly pageCandidates: readonly PageCandidate[];
  readonly layersByPage: ReadonlyMap<string, ReadonlySet<string>>;
  readonly selectionIds: ReadonlySet<string>;
  readonly contextElementIds: ReadonlySet<string>;
  readonly missingPageIds: readonly string[];
  readonly missingLayerIds: readonly {
    readonly pageId: string;
    readonly layerIds: readonly string[];
  }[];
};

function normalizeScope(
  scope: RuntimeSnapshotOptions["scope"],
  diagnostics: RuntimeSnapshotDiagnostic[],
): RuntimeSnapshotScope {
  const result = normalizeRuntimeSnapshotScope(scope);
  if (result.ok) {
    return result.scope;
  }
  diagnostics.push({
    code: result.code,
    message: result.error,
  });
  return { kind: "document" };
}

function planScope(
  allPages: readonly PageCandidate[],
  requestedScope: RuntimeSnapshotScope,
  currentPageId: string | null,
  graph: any,
  diagnostics: RuntimeSnapshotDiagnostic[],
): ScopePlan {
  const pagesById = new Map(allPages.map((candidate) => [candidate.pageInfo.id, candidate]));
  const missingPageIds: string[] = [];
  const missingLayerIds: Array<{ pageId: string; layerIds: readonly string[] }> = [];
  const layersByPage = new Map<string, ReadonlySet<string>>();
  const contextElementIds = new Set<string>();
  let pageCandidates: readonly PageCandidate[] = allPages;
  let resolvedScope = requestedScope;
  if (requestedScope.kind === "pages") {
    pageCandidates = allPages.filter((candidate) =>
      requestedScope.pageIds.includes(candidate.pageInfo.id),
    );
    for (const pageId of requestedScope.pageIds) {
      if (!pagesById.has(pageId)) {
        missingPageIds.push(pageId);
        diagnostics.push({
          code: "page_not_found",
          message: "Runtime snapshot requested a page that does not exist.",
          pageId,
        });
      }
    }
    resolvedScope = {
      kind: "pages",
      pageIds: pageCandidates.map((candidate) => candidate.pageInfo.id),
    };
  }

  if (requestedScope.kind === "layers") {
    const candidate = pagesById.get(requestedScope.pageId);
    pageCandidates = candidate ? [candidate] : [];
    if (!candidate) {
      missingPageIds.push(requestedScope.pageId);
      diagnostics.push({
        code: "page_not_found",
        message: "Runtime snapshot requested a page that does not exist.",
        pageId: requestedScope.pageId,
      });
      resolvedScope = { kind: "layers", pageId: requestedScope.pageId, layerIds: [] };
    } else {
      const requestedLayerIds = new Set(requestedScope.layerIds);
      layersByPage.set(requestedScope.pageId, requestedLayerIds);
      resolvedScope = requestedScope;
    }
  }

  if (requestedScope.kind === "selection") {
    const selectionPageId = requestedScope.pageId ?? currentPageId ?? undefined;
    const candidate = selectionPageId ? pagesById.get(selectionPageId) : undefined;
    pageCandidates = candidate ? [candidate] : [];
    if (!selectionPageId || !candidate) {
      diagnostics.push({
        code: "page_not_found",
        message: "Runtime snapshot selection scope could not resolve the visible page.",
        pageId: selectionPageId,
      });
      resolvedScope = selectionPageId
        ? { kind: "selection", pageId: selectionPageId }
        : { kind: "selection" };
    } else {
      resolvedScope = { kind: "selection", pageId: selectionPageId };
    }
  }

  const selectionIds = requestedScope.kind === "selection"
    ? new Set(getSelectionIds(graph))
    : new Set<string>();
  if (requestedScope.kind === "selection" && selectionIds.size === 0) {
    diagnostics.push({
      code: "selection_empty",
      message: "Runtime snapshot selection scope resolved an empty selection.",
      pageId: requestedScope.pageId ?? currentPageId ?? undefined,
    });
  }

  return {
    requestedScope,
    resolvedScope,
    pageCandidates,
    layersByPage,
    selectionIds,
    contextElementIds,
    missingPageIds,
    missingLayerIds,
  };
}

function shouldIncludeCell(
  cell: any,
  scopePlan: ScopePlan,
  graph: any,
  pageId: string,
): boolean {
  if (scopePlan.requestedScope.kind === "document" || scopePlan.requestedScope.kind === "pages") {
    return true;
  }
  const id = safeCellId(cell);
  if (!id) {
    return false;
  }
  if (scopePlan.requestedScope.kind === "selection") {
    if (scopePlan.selectionIds.has(id)) {
      markAncestors(cell, scopePlan.contextElementIds);
      return true;
    }
    return scopePlan.contextElementIds.has(id);
  }
  const layerFilter = scopePlan.layersByPage.get(pageId);
  if (!layerFilter) {
    return false;
  }
  const layerId = safeCellId(getLayerForCell(graph, cell));
  if (layerId && layerFilter.has(layerId)) {
    markAncestors(cell, scopePlan.contextElementIds);
    return true;
  }
  return scopePlan.contextElementIds.has(id);
}

function markAncestors(cell: any, contextElementIds: ReadonlySet<string>) {
  const mutable = contextElementIds as Set<string>;
  let current = cell?.parent;
  while (current) {
    const id = safeCellId(current);
    if (id) {
      mutable.add(id);
    }
    current = current.parent;
  }
}

function recordMissingLayers(
  pageId: string,
  requestedLayerIds: ReadonlySet<string> | undefined,
  layers: readonly RuntimeSnapshotLayer[],
  scopePlan: ScopePlan,
  diagnostics: RuntimeSnapshotDiagnostic[],
) {
  if (!requestedLayerIds) {
    return;
  }
  const included = new Set(layers.map((layer) => layer.id));
  const missing = [...requestedLayerIds].filter((id) => !included.has(id));
  if (missing.length === 0) {
    return;
  }
  (scopePlan.missingLayerIds as Array<{ pageId: string; layerIds: readonly string[] }>).push({
    pageId,
    layerIds: missing,
  });
  for (const layerId of missing) {
    diagnostics.push({
      code: "layer_not_found",
      message: "Runtime snapshot requested a layer that does not exist on the resolved page.",
      pageId,
      layerId,
    });
  }
}

function recordExternalReferences(
  scopePlan: ScopePlan,
  elements: readonly RuntimeSnapshotElement[],
  externalReferences: RuntimeSnapshotExternalReference[],
) {
  if (
    scopePlan.requestedScope.kind !== "layers" &&
    scopePlan.requestedScope.kind !== "selection"
  ) {
    return;
  }
  const included = new Set(elements.map((element) => element.id));
  for (const element of elements) {
    const references: Array<["parent" | "source" | "target", string | undefined]> = [
      ["parent", element.parentId],
      ["source", element.sourceId],
      ["target", element.targetId],
    ];
    for (const [referenceType, referencedId] of references) {
      if (!referencedId || included.has(referencedId)) {
        continue;
      }
      externalReferences.push({
        pageId: element.pageId,
        elementId: element.id,
        referenceType,
        referencedId,
      });
    }
  }
}

function buildScopeMetadata(
  requestedScope: RuntimeSnapshotScope,
  scopePlan: ScopePlan,
  pages: readonly RuntimeSnapshotPage[],
  externalReferences: readonly RuntimeSnapshotExternalReference[],
  diagnostics: RuntimeSnapshotDiagnostic[],
): RuntimeSnapshotScopeMetadata {
  const contextElementCount = pages.reduce(
    (sum, page) =>
      sum + page.elements.filter((element) => element.raw?.contextOnly === true).length,
    0,
  );
  for (const reference of externalReferences.slice(0, 100)) {
    diagnostics.push({
      code: "external_reference_omitted",
      message: "Runtime snapshot omitted a referenced element outside the requested scope.",
      pageId: reference.pageId,
      elementId: reference.elementId,
      referenceType: reference.referenceType,
      referencedId: reference.referencedId,
    });
  }
  if (contextElementCount > 0) {
    diagnostics.push({
      code: "context_element_included",
      message: "Runtime snapshot included minimal ancestor context for scoped extraction.",
      observed: contextElementCount,
    });
  }
  const includedLayers = pages.map((page) => ({
    pageId: page.id,
    layerIds: page.layers.map((layer) => layer.id),
  }));
  const includedElementCount = pages.reduce(
    (sum, page) => sum + page.elements.length,
    0,
  );
  const missingScope =
    scopePlan.missingPageIds.length > 0 || scopePlan.missingLayerIds.length > 0;
  const resolvedScope = resolveIncludedScope(requestedScope, scopePlan, pages);
  return {
    requestedScope,
    resolvedScope,
    includedPages: pages.map((page) => page.id),
    includedLayers,
    includedElementCount,
    contextElementCount,
    externalReferences,
    missingPageIds: scopePlan.missingPageIds,
    missingLayerIds: scopePlan.missingLayerIds,
    includedContext: contextElementCount > 0,
    requiresScopeExpansion: externalReferences.length > 0 || missingScope,
    conclusive:
      !missingScope &&
      externalReferences.length === 0 &&
      !hasTruncation(diagnostics),
  };
}

function resolveIncludedScope(
  requestedScope: RuntimeSnapshotScope,
  scopePlan: ScopePlan,
  pages: readonly RuntimeSnapshotPage[],
): RuntimeSnapshotScope {
  if (requestedScope.kind === "document") {
    return { kind: "document" };
  }
  if (requestedScope.kind === "pages") {
    return { kind: "pages", pageIds: pages.map((page) => page.id) };
  }
  if (requestedScope.kind === "layers") {
    const pageId = requestedScope.pageId;
    const includedPage = pages.find((page) => page.id === pageId);
    return {
      kind: "layers",
      pageId,
      layerIds: includedPage?.layers.map((layer) => layer.id) ?? [],
    };
  }
  return scopePlan.resolvedScope;
}

function cloneScope(scope: RuntimeSnapshotScope): RuntimeSnapshotScope {
  switch (scope.kind) {
    case "document":
      return { kind: "document" };
    case "pages":
      return { kind: "pages", pageIds: [...scope.pageIds] };
    case "layers":
      return {
        kind: "layers",
        pageId: scope.pageId,
        layerIds: [...scope.layerIds],
      };
    case "selection":
      return scope.pageId
        ? { kind: "selection", pageId: scope.pageId }
        : { kind: "selection" };
  }
}

function cloneScopeMetadata(
  scope: RuntimeSnapshotScopeMetadata,
): RuntimeSnapshotScopeMetadata {
  return {
    requestedScope: cloneScope(scope.requestedScope),
    resolvedScope: cloneScope(scope.resolvedScope),
    includedPages: [...scope.includedPages],
    includedLayers: scope.includedLayers.map((entry) => ({
      pageId: entry.pageId,
      layerIds: [...entry.layerIds],
    })),
    includedElementCount: scope.includedElementCount,
    contextElementCount: scope.contextElementCount,
    externalReferences: scope.externalReferences.map((reference) => ({
      pageId: reference.pageId,
      elementId: reference.elementId,
      referenceType: reference.referenceType,
      referencedId: reference.referencedId,
    })),
    missingPageIds: [...scope.missingPageIds],
    missingLayerIds: scope.missingLayerIds.map((entry) => ({
      pageId: entry.pageId,
      layerIds: [...entry.layerIds],
    })),
    includedContext: scope.includedContext,
    requiresScopeExpansion: scope.requiresScopeExpansion,
    conclusive: scope.conclusive,
  };
}

function completenessFromDiagnostics(
  diagnostics: readonly RuntimeSnapshotDiagnostic[],
): RuntimeSnapshot["completeness"] {
  if (diagnostics.some((diagnostic) => diagnostic.code === "snapshot_hard_limit_reached")) {
    return { status: "partial", reason: "hard-limit" };
  }
  if (diagnostics.some((diagnostic) => diagnostic.code === "snapshot_soft_limit_reached")) {
    return { status: "partial", reason: "soft-limit" };
  }
  if (diagnostics.some((diagnostic) => diagnostic.code === "page_extraction_failed")) {
    return { status: "partial", reason: "page-error" };
  }
  if (
    diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "page_not_found" ||
        diagnostic.code === "layer_not_found" ||
        diagnostic.code === "scope_empty" ||
        diagnostic.code === "scope_invalid",
    )
  ) {
    return { status: "partial", reason: "missing-scope" };
  }
  if (hasTruncation(diagnostics)) {
    return { status: "partial", reason: "count-limit" };
  }
  return { status: "complete" };
}

function reportMissingApi(
  present: boolean,
  api: string,
  diagnostics: RuntimeSnapshotDiagnostic[],
  pageId?: string,
) {
  if (present) {
    return;
  }
  if (
    diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "compatibility_api_missing" &&
        diagnostic.api === api &&
        diagnostic.pageId === pageId,
    )
  ) {
    return;
  }
  diagnostics.push({
    code: "compatibility_api_missing",
    message: `Runtime snapshot compatibility guard used a fallback because ${api} is unavailable.`,
    pageId,
    api,
    runtimeVersion: runtimeVersion(),
  });
}

function safeString(
  value: unknown,
  maxLength: number,
  diagnostics: RuntimeSnapshotDiagnostic[],
  pageId?: string,
  elementId?: string,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const text = String(value);
  if (text.length <= maxLength) {
    return text;
  }
  diagnostics.push({
    code: "string_truncated",
    message: `Runtime snapshot truncated a string from ${text.length} to ${maxLength} characters.`,
    pageId,
    elementId,
    limit: maxLength,
    observed: text.length,
  });
  return text.slice(0, maxLength);
}

function safeRecord<T extends Record<string, unknown>>(input: T): T {
  const result = Object.create(null) as Record<string, unknown>;
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && !DANGEROUS_KEYS.has(key)) {
      result[key] = value;
    }
  }
  return result as T;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : "Unknown runtime snapshot extraction error";
}

function now(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}
