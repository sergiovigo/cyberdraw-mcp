export const CYBERDRAW_RUNTIME_CONTRACT_VERSION = 1;
export const CYBERDRAW_RUNTIME_SNAPSHOT_SCHEMA_VERSION =
  "cyberdraw.runtime-snapshot.v1";
export const CYBERDRAW_RUNTIME_SNAPSHOT_CAPABILITY =
  "cyberdraw.runtimeSnapshot.v1";
export const CYBERDRAW_RUNTIME_SNAPSHOT_EVENT = "cyberdraw.runtimeSnapshot.v1";
export const CYBERDRAW_DOCUMENT_STATE_CONTROL = "document-state";
export const CYBERDRAW_SYNC_DOCUMENT_STATE_CONTROL = "sync-document-state";
export const CYBERDRAW_CONTENT_REVISION_PREFIX = "cyberdraw-content-v1";
export const CYBERDRAW_CONTENT_REVISION_ALGORITHM = "fnv1a64";
export const CYBERDRAW_RUNTIME_SCOPE_ALGORITHM = "cyberdraw-scope-v1";

export const SUPPORTED_RUNTIME_SNAPSHOT_SCOPES = [
  "document",
  "pages",
  "layers",
  "selection",
] as const;
export type RuntimeSnapshotScopeKind =
  (typeof SUPPORTED_RUNTIME_SNAPSHOT_SCOPES)[number];
export const MAX_RUNTIME_SCOPE_IDS = 1_000;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
export type JsonRecord = { readonly [key: string]: JsonValue };

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
  readonly softSnapshotBytes: number;
  readonly hardSnapshotBytes: number;
};

export const DEFAULT_RUNTIME_SNAPSHOT_LIMITS: RuntimeSnapshotLimits = {
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
  softSnapshotBytes: 12 * 1024 * 1024,
  hardSnapshotBytes: 16 * 1024 * 1024,
};

export const MIN_RUNTIME_SNAPSHOT_LIMITS: RuntimeSnapshotLimits = {
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
  softSnapshotBytes: 1,
  hardSnapshotBytes: 1,
};

export type RuntimeSnapshotCapability = {
  readonly name: typeof CYBERDRAW_RUNTIME_SNAPSHOT_CAPABILITY;
  readonly contractVersion: typeof CYBERDRAW_RUNTIME_CONTRACT_VERSION;
  readonly snapshotVersion: 1;
  readonly scopes: readonly RuntimeSnapshotScopeKind[];
  readonly limits: RuntimeSnapshotLimits;
  readonly features: {
    readonly contentRevision: true;
    readonly backgroundPages: true;
    readonly truncationDiagnostics: true;
  };
};

export type RuntimeCapabilities = {
  readonly contractVersion: typeof CYBERDRAW_RUNTIME_CONTRACT_VERSION;
  readonly capabilities: readonly RuntimeSnapshotCapability[];
};

export type RuntimeSnapshotOptions = {
  readonly target_document?: { readonly id?: string };
  readonly scope?: RuntimeSnapshotScope;
  readonly limits?: Partial<RuntimeSnapshotLimits>;
  readonly includeRaw?: boolean;
  readonly measureMainThreadImpact?: boolean;
};

export type RuntimeSnapshotScope =
  | { readonly kind: "document" }
  | { readonly kind: "pages"; readonly pageIds: readonly string[] }
  | {
      readonly kind: "layers";
      readonly pageId: string;
      readonly layerIds: readonly string[];
    }
  | { readonly kind: "selection"; readonly pageId?: string };

export type RuntimeSnapshotScopeValidationResult =
  | { readonly ok: true; readonly scope: RuntimeSnapshotScope }
  | {
      readonly ok: false;
      readonly code: "scope_invalid" | "scope_empty" | "scope_too_many_ids";
      readonly error: string;
    };

export type RuntimeSnapshotDiagnosticCode =
  | "page_limit_reached"
  | "layer_limit_reached"
  | "element_limit_reached"
  | "string_truncated"
  | "metadata_limit_reached"
  | "raw_limit_reached"
  | "snapshot_soft_limit_reached"
  | "snapshot_hard_limit_reached"
  | "snapshot_size_limit_reached"
  | "page_extraction_failed"
  | "scope_invalid"
  | "scope_empty"
  | "scope_too_many_ids"
  | "scope_not_supported"
  | "page_not_found"
  | "layer_not_found"
  | "external_reference_omitted"
  | "context_element_included"
  | "selection_empty"
  | "compatibility_api_missing"
  | "semantic_revision_deferred";

export type RuntimeSnapshotDiagnostic = {
  readonly code: RuntimeSnapshotDiagnosticCode;
  readonly message: string;
  readonly pageId?: string;
  readonly layerId?: string;
  readonly elementId?: string;
  readonly referenceType?: "parent" | "source" | "target" | "edge" | "layer";
  readonly referencedId?: string;
  readonly limit?: number;
  readonly observed?: number;
  readonly runtimeVersion?: string;
  readonly api?: string;
};

export type RuntimeSnapshotPayloadMetadata = {
  readonly approximateJsonBytes: number;
  readonly measuredJsonBytes?: number;
  readonly softLimitBytes: number;
  readonly hardLimitBytes: number;
};

export type RuntimeSnapshotCompleteness =
  | { readonly status: "complete" }
  | {
      readonly status: "partial";
      readonly reason:
        | "soft-limit"
        | "hard-limit"
        | "count-limit"
        | "page-error"
        | "missing-scope";
    };

export type RuntimeSnapshotExternalReference = {
  readonly pageId: string;
  readonly elementId: string;
  readonly referenceType: "parent" | "source" | "target" | "edge" | "layer";
  readonly referencedId: string;
  readonly referencedPageId?: string;
  readonly referencedLayerId?: string;
};

export type RuntimeSnapshotScopeMetadata = {
  readonly requestedScope: RuntimeSnapshotScope;
  readonly resolvedScope: RuntimeSnapshotScope;
  readonly includedPages: readonly string[];
  readonly includedLayers: readonly {
    readonly pageId: string;
    readonly layerIds: readonly string[];
  }[];
  readonly includedElementCount: number;
  readonly contextElementCount: number;
  readonly externalReferences: readonly RuntimeSnapshotExternalReference[];
  readonly missingPageIds: readonly string[];
  readonly missingLayerIds: readonly {
    readonly pageId: string;
    readonly layerIds: readonly string[];
  }[];
  readonly includedContext: boolean;
  readonly requiresScopeExpansion: boolean;
  readonly conclusive: boolean;
};

export type RuntimeSnapshotRevisionSignals = {
  readonly documentId?: string;
  readonly fileHash?: string;
  readonly pageIds: readonly string[];
  readonly scope: RuntimeSnapshotScope;
  readonly requestedScope?: RuntimeSnapshotScope;
  readonly resolvedScope?: RuntimeSnapshotScope;
  readonly complete: boolean;
  readonly contentRevision: string;
  readonly documentRevision?: string;
  readonly selectionRevision?: string;
  readonly semanticRevision?: string;
};

export type RuntimeSnapshot = {
  readonly schemaVersion: typeof CYBERDRAW_RUNTIME_SNAPSHOT_SCHEMA_VERSION;
  readonly contractVersion: typeof CYBERDRAW_RUNTIME_CONTRACT_VERSION;
  readonly document: {
    readonly id?: string;
    readonly title?: string;
    readonly mode?: string;
    readonly fileUrl?: string;
    readonly fileHash?: string;
    readonly pageCount: number;
    readonly currentPageId?: string;
    readonly runtimeVersion?: string;
    readonly capturedAt: string;
    readonly extractedAt?: string;
    readonly revisionSignals: RuntimeSnapshotRevisionSignals;
  };
  readonly scope: RuntimeSnapshotScopeMetadata;
  readonly pages: readonly RuntimeSnapshotPage[];
  readonly diagnostics: readonly RuntimeSnapshotDiagnostic[];
  readonly completeness: RuntimeSnapshotCompleteness;
  readonly truncated: boolean;
  readonly limits: RuntimeSnapshotLimits;
  readonly payload: RuntimeSnapshotPayloadMetadata;
  readonly performance: {
    readonly extractionMs: number;
    readonly serializationMs: number;
    readonly approximateJsonBytes: number;
    readonly scopeResolutionMs?: number;
    readonly traversalMs?: number;
    readonly snapshotAssemblyMs?: number;
    readonly revisionMs?: number;
    readonly totalPluginMs?: number;
    readonly mainThreadTimerDriftMs?: number;
    readonly mainThreadRafDelayMs?: number;
    readonly longTaskCount?: number;
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

export type RuntimeSnapshotValidationResult =
  | { readonly ok: true; readonly snapshot: RuntimeSnapshot }
  | { readonly ok: false; readonly error: string };

const CONTENT_REVISION_PATTERN = /^cyberdraw-content-v1:fnv1a64:[0-9a-f]{16}$/;
const MAX_VALIDATION_PAGES = 1_000;
const MAX_VALIDATION_ITEMS_PER_PAGE = 100_000;
const MAX_VALIDATION_DIAGNOSTICS = 100_000;

export function createRuntimeCapabilities(
  limits: RuntimeSnapshotLimits = DEFAULT_RUNTIME_SNAPSHOT_LIMITS,
  scopes: readonly RuntimeSnapshotScopeKind[] = SUPPORTED_RUNTIME_SNAPSHOT_SCOPES,
): RuntimeCapabilities {
  const normalizedScopes = normalizeCapabilityScopes(scopes);
  return {
    contractVersion: CYBERDRAW_RUNTIME_CONTRACT_VERSION,
    capabilities: [
      {
        name: CYBERDRAW_RUNTIME_SNAPSHOT_CAPABILITY,
        contractVersion: CYBERDRAW_RUNTIME_CONTRACT_VERSION,
        snapshotVersion: 1,
        scopes: normalizedScopes,
        limits,
        features: {
          contentRevision: true,
          backgroundPages: true,
          truncationDiagnostics: true,
        },
      },
    ],
  };
}

export function normalizeRuntimeSnapshotScope(
  scope: unknown,
  options: { readonly allowEmptyIds?: boolean } = {},
): RuntimeSnapshotScopeValidationResult {
  if (scope === undefined || scope === null) {
    return { ok: true, scope: { kind: "document" } };
  }
  if (!isPlainRecord(scope) || typeof scope.kind !== "string") {
    return {
      ok: false,
      code: "scope_invalid",
      error: "Runtime snapshot scope is malformed",
    };
  }
  switch (scope.kind) {
    case "document":
      return { ok: true, scope: { kind: "document" } };
    case "pages": {
      const pageIds = normalizeIdArray(scope.pageIds, options);
      if (!pageIds.ok) {
        return pageIds;
      }
      return { ok: true, scope: { kind: "pages", pageIds: pageIds.ids } };
    }
    case "layers": {
      const pageId = normalizeId(scope.pageId);
      const layerIds = normalizeIdArray(scope.layerIds, options);
      if (!pageId) {
        return {
          ok: false,
          code: "scope_invalid",
          error: "Runtime snapshot layers scope pageId is invalid",
        };
      }
      if (!layerIds.ok) {
        return layerIds;
      }
      return {
        ok: true,
        scope: { kind: "layers", pageId, layerIds: layerIds.ids },
      };
    }
    case "selection": {
      const pageId =
        scope.pageId === undefined ? undefined : normalizeId(scope.pageId);
      if (scope.pageId !== undefined && !pageId) {
        return {
          ok: false,
          code: "scope_invalid",
          error: "Runtime snapshot selection scope pageId is invalid",
        };
      }
      return {
        ok: true,
        scope: pageId ? { kind: "selection", pageId } : { kind: "selection" },
      };
    }
    default:
      return {
        ok: false,
        code: "scope_invalid",
        error: "Runtime snapshot scope kind is unsupported",
      };
  }
}

export function runtimeSnapshotScopeKey(scope: RuntimeSnapshotScope): string {
  return stableStringify(scope);
}

export function runtimeSnapshotScopeSupported(
  capability: RuntimeSnapshotCapability,
  scope: RuntimeSnapshotScope,
): boolean {
  return capability.scopes.includes(scope.kind);
}

export function normalizeRuntimeSnapshotLimits(
  overrides: Partial<RuntimeSnapshotLimits> | undefined,
): RuntimeSnapshotLimits {
  const requested = {
    ...DEFAULT_RUNTIME_SNAPSHOT_LIMITS,
    ...overrides,
  };
  const hardSnapshotBytes = boundedInteger(
    requested.hardSnapshotBytes,
    MIN_RUNTIME_SNAPSHOT_LIMITS.hardSnapshotBytes,
  );
  const softSnapshotBytes = Math.min(
    boundedInteger(
      requested.softSnapshotBytes,
      MIN_RUNTIME_SNAPSHOT_LIMITS.softSnapshotBytes,
    ),
    hardSnapshotBytes,
  );
  return {
    maxPages: boundedInteger(
      requested.maxPages,
      MIN_RUNTIME_SNAPSHOT_LIMITS.maxPages,
    ),
    maxLayersPerPage: boundedInteger(
      requested.maxLayersPerPage,
      MIN_RUNTIME_SNAPSHOT_LIMITS.maxLayersPerPage,
    ),
    maxElementsPerPage: boundedInteger(
      requested.maxElementsPerPage,
      MIN_RUNTIME_SNAPSHOT_LIMITS.maxElementsPerPage,
    ),
    maxLabelLength: boundedInteger(
      requested.maxLabelLength,
      MIN_RUNTIME_SNAPSHOT_LIMITS.maxLabelLength,
    ),
    maxStyleLength: boundedInteger(
      requested.maxStyleLength,
      MIN_RUNTIME_SNAPSHOT_LIMITS.maxStyleLength,
    ),
    maxMetadataKeys: boundedInteger(
      requested.maxMetadataKeys,
      MIN_RUNTIME_SNAPSHOT_LIMITS.maxMetadataKeys,
    ),
    maxMetadataStringLength: boundedInteger(
      requested.maxMetadataStringLength,
      MIN_RUNTIME_SNAPSHOT_LIMITS.maxMetadataStringLength,
    ),
    maxRawDepth: boundedInteger(
      requested.maxRawDepth,
      MIN_RUNTIME_SNAPSHOT_LIMITS.maxRawDepth,
    ),
    maxRawKeys: boundedInteger(
      requested.maxRawKeys,
      MIN_RUNTIME_SNAPSHOT_LIMITS.maxRawKeys,
    ),
    maxArrayItems: boundedInteger(
      requested.maxArrayItems,
      MIN_RUNTIME_SNAPSHOT_LIMITS.maxArrayItems,
    ),
    softSnapshotBytes,
    hardSnapshotBytes,
  };
}

export function findRuntimeSnapshotCapability(
  value: unknown,
): RuntimeSnapshotCapability | null {
  if (!isPlainRecord(value)) {
    return null;
  }
  const caps = Array.isArray(value.capabilities) ? value.capabilities : [];
  for (const capability of caps) {
    if (!isPlainRecord(capability)) {
      continue;
    }
    if (
      capability.name !== CYBERDRAW_RUNTIME_SNAPSHOT_CAPABILITY ||
      capability.contractVersion !== CYBERDRAW_RUNTIME_CONTRACT_VERSION ||
      capability.snapshotVersion !== 1 ||
      !hasSnapshotFeatures(capability.features)
    ) {
      continue;
    }
    return {
      name: CYBERDRAW_RUNTIME_SNAPSHOT_CAPABILITY,
      contractVersion: CYBERDRAW_RUNTIME_CONTRACT_VERSION,
      snapshotVersion: 1,
      scopes: normalizeCapabilityScopes(capability.scopes),
      limits: normalizeRuntimeSnapshotLimits(
        isPlainRecord(capability.limits)
          ? (capability.limits as Partial<RuntimeSnapshotLimits>)
          : undefined,
      ),
      features: {
        contentRevision: true,
        backgroundPages: true,
        truncationDiagnostics: true,
      },
    };
  }
  return null;
}

export function validateRuntimeSnapshot(
  value: unknown,
): RuntimeSnapshotValidationResult {
  if (!isPlainRecord(value)) {
    return { ok: false, error: "Runtime snapshot response is not an object" };
  }
  if (value.schemaVersion !== CYBERDRAW_RUNTIME_SNAPSHOT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: "Runtime snapshot schema version is unsupported",
    };
  }
  if (value.contractVersion !== CYBERDRAW_RUNTIME_CONTRACT_VERSION) {
    return {
      ok: false,
      error: "Runtime snapshot contract version is unsupported",
    };
  }
  if (!isPlainRecord(value.document)) {
    return {
      ok: false,
      error: "Runtime snapshot document metadata is missing",
    };
  }
  if (!isPlainRecord(value.document.revisionSignals)) {
    return {
      ok: false,
      error: "Runtime snapshot revision signals are missing",
    };
  }
  if (!isPlainRecord(value.scope)) {
    return { ok: false, error: "Runtime snapshot scope metadata is missing" };
  }
  const scopeResult = validateSnapshotScopeMetadata(value.scope);
  if (!scopeResult.ok) {
    return scopeResult;
  }
  const signalScope = normalizeRuntimeSnapshotScope(
    value.document.revisionSignals.scope,
    { allowEmptyIds: true },
  );
  if (!signalScope.ok) {
    return { ok: false, error: "Runtime snapshot revision scope is invalid" };
  }
  if (
    runtimeSnapshotScopeKey(signalScope.scope) !==
    runtimeSnapshotScopeKey(scopeResult.scope.resolvedScope)
  ) {
    return {
      ok: false,
      error: "Runtime snapshot revision scope does not match resolved scope",
    };
  }
  if (
    typeof value.document.revisionSignals.contentRevision !== "string" ||
    !CONTENT_REVISION_PATTERN.test(
      value.document.revisionSignals.contentRevision,
    )
  ) {
    return { ok: false, error: "Runtime snapshot content revision is invalid" };
  }
  if (
    value.document.revisionSignals.documentRevision !== undefined &&
    (typeof value.document.revisionSignals.documentRevision !== "string" ||
      !CONTENT_REVISION_PATTERN.test(
        value.document.revisionSignals.documentRevision,
      ))
  ) {
    return { ok: false, error: "Runtime snapshot document revision is invalid" };
  }
  if (!Array.isArray(value.pages)) {
    return { ok: false, error: "Runtime snapshot pages are missing" };
  }
  if (!Array.isArray(value.diagnostics)) {
    return { ok: false, error: "Runtime snapshot diagnostics are missing" };
  }
  if (value.diagnostics.length > MAX_VALIDATION_DIAGNOSTICS) {
    return {
      ok: false,
      error: "Runtime snapshot diagnostics exceed validation limit",
    };
  }
  if (!isPlainRecord(value.limits) || !isPlainRecord(value.payload)) {
    return {
      ok: false,
      error: "Runtime snapshot limits or payload metadata are missing",
    };
  }
  const limitsResult = validateSnapshotLimits(value.limits);
  if (!limitsResult.ok) {
    return limitsResult;
  }
  if (
    value.pages.length >
    Math.min(limitsResult.limits.maxPages, MAX_VALIDATION_PAGES)
  ) {
    return { ok: false, error: "Runtime snapshot pages exceed declared limit" };
  }
  for (const page of value.pages) {
    const pageResult = validateSnapshotPage(page, limitsResult.limits);
    if (!pageResult.ok) {
      return pageResult;
    }
  }
  const payloadResult = validatePayloadMetadata(
    value.payload,
    limitsResult.limits,
  );
  if (!payloadResult.ok) {
    return payloadResult;
  }
  if (
    !isPlainRecord(value.completeness) ||
    (value.completeness.status !== "complete" &&
      value.completeness.status !== "partial")
  ) {
    return { ok: false, error: "Runtime snapshot completeness is invalid" };
  }
  if (value.truncated !== (value.completeness.status !== "complete")) {
    return {
      ok: false,
      error: "Runtime snapshot truncation state is inconsistent",
    };
  }
  return { ok: true, snapshot: value as RuntimeSnapshot };
}

export function validateRuntimeSnapshotResponseForRequest(
  value: unknown,
  requestedScope: RuntimeSnapshotScope,
): RuntimeSnapshotValidationResult {
  const validation = validateRuntimeSnapshot(value);
  if (!validation.ok) {
    return validation;
  }
  const snapshot = validation.snapshot;
  if (
    runtimeSnapshotScopeKey(snapshot.scope.requestedScope) !==
    runtimeSnapshotScopeKey(requestedScope)
  ) {
    return {
      ok: false,
      error: "Runtime snapshot response requested scope does not match request",
    };
  }
  if (snapshot.scope.resolvedScope.kind !== requestedScope.kind) {
    return {
      ok: false,
      error:
        "Runtime snapshot response resolved scope kind does not match request",
    };
  }
  return validation;
}

export function computeContentRevision(base: JsonValue): string {
  const canonical = stableStringify(base);
  return `${CYBERDRAW_CONTENT_REVISION_PREFIX}:${CYBERDRAW_CONTENT_REVISION_ALGORITHM}:${fnv1a64(canonical)}`;
}

export function stableStringify(value: unknown): string {
  return stringifyCanonical(value, new WeakSet<object>());
}

function stringifyCanonical(value: unknown, seen: WeakSet<object>): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? JSON.stringify(value) : "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyCanonical(item, seen)).join(",")}]`;
  }
  if (isPlainRecord(value)) {
    if (seen.has(value)) {
      return '"[Circular]"';
    }
    seen.add(value);
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => compareCodeUnits(left, right));
    const result = `{${entries
      .map(
        ([key, item]) =>
          `${JSON.stringify(key)}:${stringifyCanonical(item, seen)}`,
      )
      .join(",")}}`;
    seen.delete(value);
    return result;
  }
  return "null";
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

type ValidationFailure = { readonly ok: false; readonly error: string };

function validateSnapshotLimits(
  value: Record<string, unknown>,
):
  | ValidationFailure
  | { readonly ok: true; readonly limits: RuntimeSnapshotLimits } {
  const limits: {
    -readonly [Key in keyof RuntimeSnapshotLimits]?: RuntimeSnapshotLimits[Key];
  } = {};
  for (const key of Object.keys(DEFAULT_RUNTIME_SNAPSHOT_LIMITS) as Array<
    keyof RuntimeSnapshotLimits
  >) {
    const item = value[key];
    if (
      typeof item !== "number" ||
      !Number.isInteger(item) ||
      item < MIN_RUNTIME_SNAPSHOT_LIMITS[key]
    ) {
      return { ok: false, error: `Runtime snapshot limit ${key} is invalid` };
    }
    limits[key] = item;
  }
  if (limits.softSnapshotBytes! > limits.hardSnapshotBytes!) {
    return {
      ok: false,
      error: "Runtime snapshot soft limit exceeds hard limit",
    };
  }
  return { ok: true, limits: limits as RuntimeSnapshotLimits };
}

function validatePayloadMetadata(
  value: Record<string, unknown>,
  limits: RuntimeSnapshotLimits,
): ValidationFailure | { readonly ok: true } {
  const approximateJsonBytes = value.approximateJsonBytes;
  const measuredJsonBytes = value.measuredJsonBytes;
  if (
    typeof approximateJsonBytes !== "number" ||
    !Number.isInteger(approximateJsonBytes) ||
    approximateJsonBytes < 0
  ) {
    return { ok: false, error: "Runtime snapshot payload size is invalid" };
  }
  if (
    measuredJsonBytes !== undefined &&
    (typeof measuredJsonBytes !== "number" ||
      !Number.isInteger(measuredJsonBytes) ||
      measuredJsonBytes < 0)
  ) {
    return {
      ok: false,
      error: "Runtime snapshot measured payload size is invalid",
    };
  }
  const observedBytes =
    typeof measuredJsonBytes === "number"
      ? measuredJsonBytes
      : approximateJsonBytes;
  if (observedBytes > limits.hardSnapshotBytes) {
    return { ok: false, error: "Runtime snapshot payload exceeds hard limit" };
  }
  if (
    value.softLimitBytes !== limits.softSnapshotBytes ||
    value.hardLimitBytes !== limits.hardSnapshotBytes
  ) {
    return {
      ok: false,
      error: "Runtime snapshot payload limits are inconsistent",
    };
  }
  return { ok: true };
}

function validateSnapshotPage(
  value: unknown,
  limits: RuntimeSnapshotLimits,
): ValidationFailure | { readonly ok: true } {
  if (!isPlainRecord(value)) {
    return { ok: false, error: "Runtime snapshot page is malformed" };
  }
  if (!Array.isArray(value.layers) || !Array.isArray(value.elements)) {
    return {
      ok: false,
      error: "Runtime snapshot page collections are missing",
    };
  }
  if (
    value.layers.length >
      Math.min(limits.maxLayersPerPage, MAX_VALIDATION_ITEMS_PER_PAGE) ||
    value.elements.length >
      Math.min(limits.maxElementsPerPage, MAX_VALIDATION_ITEMS_PER_PAGE)
  ) {
    return {
      ok: false,
      error: "Runtime snapshot page exceeds declared limits",
    };
  }
  for (const layer of value.layers) {
    if (!isPlainRecord(layer)) {
      return { ok: false, error: "Runtime snapshot layer is malformed" };
    }
  }
  for (const element of value.elements) {
    if (!isPlainRecord(element)) {
      return { ok: false, error: "Runtime snapshot element is malformed" };
    }
  }
  return { ok: true };
}

function boundedInteger(value: unknown, min: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) {
    return min;
  }
  return Math.floor(parsed);
}

function hasSnapshotFeatures(value: unknown): boolean {
  return (
    isPlainRecord(value) &&
    value.contentRevision === true &&
    value.backgroundPages === true &&
    value.truncationDiagnostics === true
  );
}

function normalizeCapabilityScopes(value: unknown): RuntimeSnapshotScopeKind[] {
  const source = Array.isArray(value) ? value : ["document"];
  const allowed = new Set<RuntimeSnapshotScopeKind>(
    SUPPORTED_RUNTIME_SNAPSHOT_SCOPES,
  );
  const seen = new Set<RuntimeSnapshotScopeKind>();
  for (const item of source) {
    if (
      typeof item !== "string" ||
      !allowed.has(item as RuntimeSnapshotScopeKind)
    ) {
      continue;
    }
    seen.add(item as RuntimeSnapshotScopeKind);
  }
  return SUPPORTED_RUNTIME_SNAPSHOT_SCOPES.filter((scope) => seen.has(scope));
}

function normalizeId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeIdArray(
  value: unknown,
  options: { readonly allowEmptyIds?: boolean } = {},
): RuntimeSnapshotScopeValidationResult extends infer _Unused
  ?
      | { readonly ok: true; readonly ids: readonly string[] }
      | {
          readonly ok: false;
          readonly code: "scope_invalid" | "scope_empty" | "scope_too_many_ids";
          readonly error: string;
        }
  : never {
  if (!Array.isArray(value)) {
    return {
      ok: false,
      code: "scope_invalid",
      error: "Runtime snapshot scope ids are malformed",
    };
  }
  if (value.length > MAX_RUNTIME_SCOPE_IDS) {
    return {
      ok: false,
      code: "scope_too_many_ids",
      error: "Runtime snapshot scope has too many ids",
    };
  }
  const ids = [
    ...new Set(
      value.map(normalizeId).filter((id): id is string => id !== undefined),
    ),
  ].sort(compareCodeUnits);
  if (ids.length === 0 && options.allowEmptyIds !== true) {
    return {
      ok: false,
      code: "scope_empty",
      error: "Runtime snapshot scope must include at least one id",
    };
  }
  return { ok: true, ids };
}

function validateSnapshotScopeMetadata(
  value: Record<string, unknown>,
):
  | ValidationFailure
  | { readonly ok: true; readonly scope: RuntimeSnapshotScopeMetadata } {
  const requested = normalizeRuntimeSnapshotScope(value.requestedScope);
  const resolved = normalizeRuntimeSnapshotScope(value.resolvedScope, {
    allowEmptyIds: true,
  });
  if (!requested.ok) {
    return {
      ok: false,
      error: `Runtime snapshot requested scope metadata is invalid: ${requested.error}`,
    };
  }
  if (!resolved.ok) {
    return {
      ok: false,
      error: `Runtime snapshot resolved scope metadata is invalid: ${resolved.error}`,
    };
  }
  if (!Array.isArray(value.includedPages)) {
    return {
      ok: false,
      error: "Runtime snapshot included pages metadata is invalid",
    };
  }
  if (!Array.isArray(value.includedLayers)) {
    return {
      ok: false,
      error: "Runtime snapshot included layers metadata is invalid",
    };
  }
  if (!Array.isArray(value.externalReferences)) {
    return {
      ok: false,
      error: "Runtime snapshot external references metadata is invalid",
    };
  }
  if (
    !Array.isArray(value.missingPageIds) ||
    !Array.isArray(value.missingLayerIds)
  ) {
    return {
      ok: false,
      error: "Runtime snapshot missing scope metadata is invalid",
    };
  }
  if (
    typeof value.includedElementCount !== "number" ||
    !Number.isInteger(value.includedElementCount) ||
    value.includedElementCount < 0 ||
    typeof value.contextElementCount !== "number" ||
    !Number.isInteger(value.contextElementCount) ||
    value.contextElementCount < 0
  ) {
    return { ok: false, error: "Runtime snapshot scope counts are invalid" };
  }
  if (
    typeof value.includedContext !== "boolean" ||
    typeof value.requiresScopeExpansion !== "boolean" ||
    typeof value.conclusive !== "boolean"
  ) {
    return { ok: false, error: "Runtime snapshot scope flags are invalid" };
  }
  return {
    ok: true,
    scope: {
      requestedScope: requested.scope,
      resolvedScope: resolved.scope,
      includedPages: value.includedPages.filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      ),
      includedLayers:
        value.includedLayers as RuntimeSnapshotScopeMetadata["includedLayers"],
      includedElementCount: value.includedElementCount,
      contextElementCount: value.contextElementCount,
      externalReferences:
        value.externalReferences as RuntimeSnapshotScopeMetadata["externalReferences"],
      missingPageIds: value.missingPageIds.filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      ),
      missingLayerIds:
        value.missingLayerIds as RuntimeSnapshotScopeMetadata["missingLayerIds"],
      includedContext: value.includedContext,
      requiresScopeExpansion: value.requiresScopeExpansion,
      conclusive: value.conclusive,
    },
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
