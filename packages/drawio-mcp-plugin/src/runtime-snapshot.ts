import {
  get_cell_tags,
  prepare_target_page_execution,
  serialize_document_info,
  serialize_page_info,
} from "./drawio-tools.js";

export const CYBERDRAW_RUNTIME_SNAPSHOT_EVENT =
  "cyberdraw.runtimeSnapshot.v1";

export type RuntimeSnapshotLimits = {
  readonly maxPages: number;
  readonly maxLayersPerPage: number;
  readonly maxElementsPerPage: number;
  readonly maxLabelLength: number;
  readonly maxStyleLength: number;
  readonly maxMetadataKeys: number;
  readonly maxMetadataStringLength: number;
  readonly maxRawDepth: number;
  readonly maxRawKeys: number;
  readonly maxArrayItems: number;
  readonly maxSnapshotBytes: number;
};

export type RuntimeSnapshotOptions = {
  readonly target_document?: { readonly id?: string };
  readonly limits?: Partial<RuntimeSnapshotLimits>;
  readonly includeRaw?: boolean;
};

export type RuntimeSnapshotDiagnostic = {
  readonly code:
    | "page_limit_reached"
    | "layer_limit_reached"
    | "element_limit_reached"
    | "string_truncated"
    | "metadata_limit_reached"
    | "raw_limit_reached"
    | "snapshot_size_limit_reached"
    | "page_extraction_failed"
    | "semantic_revision_deferred";
  readonly message: string;
  readonly pageId?: string;
  readonly elementId?: string;
  readonly limit?: number;
  readonly observed?: number;
};

export type RuntimeSnapshot = {
  readonly schemaVersion: "cyberdraw.runtime-snapshot.v1";
  readonly document: {
    readonly id?: string;
    readonly title?: string;
    readonly mode?: string;
    readonly fileUrl?: string;
    readonly fileHash?: string;
    readonly pageCount: number;
    readonly currentPageId?: string;
    readonly runtimeVersion?: string;
    readonly extractedAt: string;
    readonly revisionSignals: {
      readonly documentId?: string;
      readonly fileHash?: string;
      readonly pageIds: readonly string[];
      readonly contentRevision: string;
      readonly semanticRevision?: string;
    };
  };
  readonly pages: readonly RuntimeSnapshotPage[];
  readonly diagnostics: readonly RuntimeSnapshotDiagnostic[];
  readonly truncated: boolean;
  readonly limits: RuntimeSnapshotLimits;
  readonly performance: {
    readonly extractionMs: number;
    readonly serializationMs: number;
    readonly approximateJsonBytes: number;
  };
};

export type RuntimeSnapshotPage = {
  readonly id: string;
  readonly index: number;
  readonly name: string;
  readonly visible: boolean;
  readonly background: boolean;
  readonly metadata?: JsonRecord;
  readonly layers: readonly RuntimeSnapshotLayer[];
  readonly elements: readonly RuntimeSnapshotElement[];
};

export type RuntimeSnapshotLayer = {
  readonly id: string;
  readonly name: string;
  readonly visible?: boolean;
  readonly locked?: boolean;
  readonly pageId: string;
  readonly index: number;
  readonly metadata?: JsonRecord;
};

export type RuntimeSnapshotElement = {
  readonly id: string;
  readonly pageId: string;
  readonly layerId?: string;
  readonly parentId?: string;
  readonly sourceId?: string;
  readonly targetId?: string;
  readonly type: "edge" | "vertex" | "group" | "unknown";
  readonly label?: {
    readonly format: "plain" | "html" | "unknown";
    readonly text?: string;
    readonly html?: string;
  };
  readonly style?: {
    readonly raw?: string;
    readonly properties: JsonRecord;
    readonly uninterpreted?: readonly string[];
  };
  readonly geometry?: JsonRecord;
  readonly waypoints?: readonly JsonRecord[];
  readonly relativeGeometry?: boolean;
  readonly tags?: readonly string[];
  readonly customAttributes?: JsonRecord;
  readonly raw?: JsonRecord;
};

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | JsonRecord;
type JsonRecord = { readonly [key: string]: JsonValue };

const DEFAULT_LIMITS: RuntimeSnapshotLimits = {
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
  maxSnapshotBytes: 16 * 1024 * 1024,
};

const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const MIN_LIMITS: RuntimeSnapshotLimits = {
  maxPages: 1,
  maxLayersPerPage: 1,
  maxElementsPerPage: 1,
  maxLabelLength: 1,
  maxStyleLength: 1,
  maxMetadataKeys: 1,
  maxMetadataStringLength: 1,
  maxRawDepth: 1,
  maxRawKeys: 1,
  maxArrayItems: 1,
  maxSnapshotBytes: 1,
};

export function extract_runtime_snapshot(
  ui: any,
  options: RuntimeSnapshotOptions = {},
): RuntimeSnapshot {
  const started = now();
  const limits = applyLimits(options.limits);
  const diagnostics: RuntimeSnapshotDiagnostic[] = [];
  const pages = Array.isArray(ui?.pages) ? ui.pages : [];
  const selectedIds = getSelectionIds(ui?.editor?.graph);
  const currentPageId = getCurrentPageId(ui);
  const pageInputs = pages.slice(0, limits.maxPages);
  const extractedPages: RuntimeSnapshotPage[] = [];

  if (pages.length > pageInputs.length) {
    diagnostics.push({
      code: "page_limit_reached",
      message: `Runtime snapshot included ${pageInputs.length} of ${pages.length} pages.`,
      limit: limits.maxPages,
      observed: pages.length,
    });
  }

  for (let index = 0; index < pageInputs.length; index += 1) {
    const page = pageInputs[index];
    const pageInfo = serialize_page_info(ui, page, index);
    let execution: ReturnType<typeof prepare_target_page_execution> | undefined;
    try {
      execution = prepare_target_page_execution(ui, { id: pageInfo.id }, {
        prefer_background: true,
        sync_live_current_page_state: true,
      });
      extractedPages.push(
        extractPage(execution.ui, pageInfo, currentPageId, limits, diagnostics, options),
      );
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

  diagnostics.push({
    code: "semantic_revision_deferred",
    message:
      "semanticRevision is deferred because runtime extraction cannot yet prove which visual or metadata changes are semantically irrelevant.",
  });

  const documentInfo =
    typeof options.target_document?.id === "string"
      ? serialize_document_info(ui, options.target_document.id)
      : undefined;
  const extractionMs = now() - started;
  const revisionBase = {
    document: {
      id: documentInfo?.id,
      title: documentInfo?.title ?? undefined,
      mode: documentInfo?.mode ?? undefined,
      fileUrl: documentInfo?.file_url ?? undefined,
      fileHash: documentInfo?.hash ?? undefined,
      pageCount: pages.length,
      runtimeVersion: runtimeVersion(),
    },
    pages: extractedPages.map(contentRevisionPage),
    limits,
    diagnostics: contentRevisionDiagnostics(diagnostics),
    truncated: hasTruncation(diagnostics),
  };
  let contentRevision = deterministicHash(stableStringify(revisionBase));
  const snapshotWithoutPerformance = {
    schemaVersion: "cyberdraw.runtime-snapshot.v1" as const,
    document: {
      ...revisionBase.document,
      currentPageId: currentPageId ?? undefined,
      extractedAt: new Date().toISOString(),
      revisionSignals: {
        documentId: documentInfo?.id,
        fileHash: documentInfo?.hash ?? undefined,
        pageIds: extractedPages.map((page) => page.id),
        contentRevision,
      },
    },
    pages: extractedPages,
    diagnostics,
    truncated: hasTruncation(diagnostics),
    limits,
  };
  const serializationStarted = now();
  const approximateJsonBytes = stableStringify(snapshotWithoutPerformance).length;
  const serializationMs = now() - serializationStarted;

  if (approximateJsonBytes > limits.maxSnapshotBytes) {
    diagnostics.push({
      code: "snapshot_size_limit_reached",
      message: `Runtime snapshot is approximately ${approximateJsonBytes} bytes, above the configured ${limits.maxSnapshotBytes} byte limit.`,
      limit: limits.maxSnapshotBytes,
      observed: approximateJsonBytes,
    });
    contentRevision = deterministicHash(
      stableStringify({
        ...revisionBase,
        diagnostics: contentRevisionDiagnostics(diagnostics),
        truncated: true,
      }),
    );
    snapshotWithoutPerformance.document.revisionSignals.contentRevision =
      contentRevision;
  }

  return {
    ...snapshotWithoutPerformance,
    truncated:
      snapshotWithoutPerformance.truncated ||
      hasTruncation(diagnostics),
    diagnostics,
    performance: {
      extractionMs,
      serializationMs,
      approximateJsonBytes,
    },
  };
}

function extractPage(
  ui: any,
  pageInfo: ReturnType<typeof serialize_page_info>,
  currentPageId: string | null,
  limits: RuntimeSnapshotLimits,
  diagnostics: RuntimeSnapshotDiagnostic[],
  options: RuntimeSnapshotOptions,
): RuntimeSnapshotPage {
  const graph = ui?.editor?.graph;
  const model = graph?.getModel?.();
  const root = model?.getRoot?.();
  const layers = extractLayers(model, root, pageInfo.id, limits, diagnostics);
  const elements = extractElements(graph, model, root, pageInfo.id, limits, diagnostics, options);

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
): RuntimeSnapshotLayer[] {
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
    layers.push(
      safeRecord({
        id: safeString(layer?.getId?.() ?? layer?.id, limits.maxMetadataStringLength, diagnostics, pageId) ?? `layer-${index}`,
        name: safeString(layer?.getValue?.() ?? layer?.value ?? `Layer ${index}`, limits.maxMetadataStringLength, diagnostics, pageId) ?? `Layer ${index}`,
        visible: typeof layer?.isVisible === "function" ? Boolean(layer.isVisible()) : undefined,
        locked: typeof layer?.isConnectable === "function" ? !Boolean(layer.isConnectable()) : undefined,
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
): RuntimeSnapshotElement[] {
  const collected = collectElementCells(model, root, limits.maxElementsPerPage);
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

  return included.map((cell) =>
    extractElement(graph, model, cell, pageId, limits, diagnostics, options),
  );
}

function extractElement(
  graph: any,
  model: any,
  cell: any,
  pageId: string,
  limits: RuntimeSnapshotLimits,
  diagnostics: RuntimeSnapshotDiagnostic[],
  options: RuntimeSnapshotOptions,
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
      observed += 1;
      if (cells.length < maxElements) {
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
  const requested = {
    ...DEFAULT_LIMITS,
    ...overrides,
  };
  return {
    maxPages: boundedInteger(requested.maxPages, MIN_LIMITS.maxPages),
    maxLayersPerPage: boundedInteger(requested.maxLayersPerPage, MIN_LIMITS.maxLayersPerPage),
    maxElementsPerPage: boundedInteger(requested.maxElementsPerPage, MIN_LIMITS.maxElementsPerPage),
    maxLabelLength: boundedInteger(requested.maxLabelLength, MIN_LIMITS.maxLabelLength),
    maxStyleLength: boundedInteger(requested.maxStyleLength, MIN_LIMITS.maxStyleLength),
    maxMetadataKeys: boundedInteger(requested.maxMetadataKeys, MIN_LIMITS.maxMetadataKeys),
    maxMetadataStringLength: boundedInteger(requested.maxMetadataStringLength, MIN_LIMITS.maxMetadataStringLength),
    maxRawDepth: boundedInteger(requested.maxRawDepth, MIN_LIMITS.maxRawDepth),
    maxRawKeys: boundedInteger(requested.maxRawKeys, MIN_LIMITS.maxRawKeys),
    maxArrayItems: boundedInteger(requested.maxArrayItems, MIN_LIMITS.maxArrayItems),
    maxSnapshotBytes: boundedInteger(requested.maxSnapshotBytes, MIN_LIMITS.maxSnapshotBytes),
  };
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
    ? sanitized
    : undefined;
}

function boundedInteger(value: unknown, minimum: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(minimum, Math.floor(value))
    : minimum;
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
    }));
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

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function deterministicHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
