export type CyberdrawPublicContractVersion = "m13-v1" | "m14-v1";
export type CyberdrawContractVersionDetection =
  | CyberdrawPublicContractVersion
  | "invalid";

export type CyberdrawM14ReasonCode =
  | "active-page-unavailable"
  | "ambiguous-document"
  | "document-scope-not-supported"
  | "duplicate-scope-target"
  | "empty-scope"
  | "expansion-limit-reached"
  | "incomplete-target-scope"
  | "layer-not-found"
  | "page-not-found"
  | "result-limit-reached"
  | "revision-incompatible"
  | "scope-too-broad"
  | "stale-coverage"
  | "unsupported-query-operation";

export type CyberdrawPublicMode = "analyze" | "query" | "plan" | "validate";
export type CyberdrawPublicQueryOperation = "list" | "count" | "summarize";
export type CyberdrawCoverageRequirement = "nonStale" | "completeTargetScopes";

export type CyberdrawValidationIssue = {
  readonly path: readonly (string | number)[];
  readonly message: string;
  readonly reasonCode?: CyberdrawM14ReasonCode;
};

export type CyberdrawPageTarget = {
  readonly pageId: string;
};

export type CyberdrawLayerTarget = {
  readonly pageId: string;
  readonly layerIds: readonly string[];
};

export type CyberdrawRequestedScope =
  | { readonly kind: "default" }
  | {
      readonly kind: "m13";
      readonly pageId?: string;
      readonly layerId?: string;
    }
  | {
      readonly kind: "m14";
      readonly pageIds: readonly string[];
      readonly layerTargets: readonly CyberdrawLayerTarget[];
    }
  | { readonly kind: "document" };

export type CyberdrawNormalizedScope =
  | { readonly kind: "default" }
  | {
      readonly kind: "page";
      readonly pageTargets: readonly CyberdrawPageTarget[];
    }
  | {
      readonly kind: "layer";
      readonly layerTargets: readonly CyberdrawLayerTarget[];
    }
  | {
      readonly kind: "mixed";
      readonly pageTargets: readonly CyberdrawPageTarget[];
      readonly layerTargets: readonly CyberdrawLayerTarget[];
    };

export type CyberdrawCoverageRequirements = {
  readonly minimum: readonly CyberdrawCoverageRequirement[];
};

export type CyberdrawRequestedLimits = {
  readonly maxPages?: number;
  readonly maxLayers?: number;
  readonly maxFindings?: number;
  readonly maxProposals?: number;
  readonly maxExpansionSteps?: number;
  readonly maxExecutionTime?: number;
};

export type CyberdrawPublicScopeModelLimits = {
  readonly maxPages?: number;
  readonly maxLayers?: number;
  readonly maxFindings?: number;
  readonly maxProposals?: number;
  readonly maxExpansionSteps?: number;
  readonly maxExecutionTime?: number;
};

export type CyberdrawNormalizedRequest = {
  readonly version: CyberdrawPublicContractVersion;
  readonly mode: CyberdrawPublicMode;
  readonly operation: CyberdrawPublicQueryOperation | CyberdrawPublicMode;
  readonly requestedScope: CyberdrawRequestedScope;
  readonly normalizedScope: CyberdrawNormalizedScope;
  readonly coverageRequirements?: CyberdrawCoverageRequirements;
  readonly limits?: CyberdrawRequestedLimits;
};

export type CyberdrawPublicRequestAccepted = {
  readonly ok: true;
  readonly version: CyberdrawPublicContractVersion;
  readonly request: CyberdrawNormalizedRequest;
  readonly issues: readonly CyberdrawValidationIssue[];
};

export type CyberdrawPublicRequestRejected = {
  readonly ok: false;
  readonly version: CyberdrawContractVersionDetection;
  readonly issues: readonly CyberdrawValidationIssue[];
};

export type CyberdrawPublicRequestValidationResult =
  | CyberdrawPublicRequestAccepted
  | CyberdrawPublicRequestRejected;

const ROOT_KEYS = new Set([
  "mode",
  "scope",
  "expansion",
  "query",
  "coverageRequirements",
  "limits",
  "planning",
  "validation",
  "response",
]);
const M13_SCOPE_KEYS = new Set(["pageId", "layerId"]);
const M14_SCOPE_KEYS = new Set(["pageIds", "layerTargets", "document"]);
const QUERY_KEYS = new Set([
  "operation",
  "findingTypes",
  "classifications",
  "confidences",
  "pageIds",
  "layerIds",
  "findingIds",
  "reasonCodes",
  "elementIds",
  "sourceIds",
  "targetIds",
  "referencedIds",
  "groupBy",
  "order",
  "offset",
  "limit",
]);
const EXPANSION_KEYS = new Set([
  "enabled",
  "maxScopes",
  "maxDepth",
  "maxBytes",
]);
const PLANNING_KEYS = new Set(["policy", "selectedFindingIds"]);
const VALIDATION_KEYS = new Set(["mode"]);
const RESPONSE_KEYS = new Set([
  "includeFindings",
  "includeSummary",
  "includePlan",
  "includeValidation",
  "includeDiagnostics",
]);
const COVERAGE_KEYS = new Set(["minimum", "nonStale", "completeTargetScopes"]);
const LIMIT_KEYS = new Set([
  "maxPages",
  "maxLayers",
  "maxFindings",
  "maxProposals",
  "maxExpansionSteps",
  "maxExecutionTime",
]);
const PUBLIC_MODES = new Set(["analyze", "query", "plan", "validate"]);
const QUERY_OPERATIONS = new Set(["list", "count", "summarize"]);
const M14_QUERY_OPERATIONS = new Set(["count", "summarize"]);
const PLANNING_POLICIES = new Set([
  "conservative",
  "review-only",
  "allow-detach-broken-terminal",
  "allow-delete-confirmed-orphan",
]);
const VALIDATION_MODES = new Set([
  "integrity-only",
  "analysis-correlated",
  "full-internal",
]);
const FINDING_TYPES = new Set([
  "broken-reference",
  "cross-layer-edge",
  "orphan-element",
]);
const CLASSIFICATIONS = new Set([
  "broken",
  "unresolved",
  "ambiguous",
  "outside-coverage",
  "external-context-not-loaded",
  "same-page-cross-layer",
  "cross-page-edge",
  "unresolved-cross-layer-candidate",
  "context-only-endpoint",
  "confirmed-orphan",
  "possible-orphan",
  "excluded-from-orphan-analysis",
]);
const CONFIDENCES = new Set(["confirmed", "contextual", "incomplete"]);
const QUERY_ORDERS = new Set(["canonical", "finding-type", "page-layer", "finding-id"]);
const STRING_ARRAY_QUERY_KEYS = [
  "pageIds",
  "layerIds",
  "findingIds",
  "reasonCodes",
  "elementIds",
  "sourceIds",
  "targetIds",
  "referencedIds",
] as const;
const SUMMARY_GROUPS = new Set([
  "finding-type",
  "classification",
  "reason-code",
  "page",
  "layer",
  "completeness",
  "coverage",
]);

export function detectCyberdrawContractVersion(
  input: unknown,
): CyberdrawContractVersionDetection {
  if (!safeRecord(input)) {
    return "invalid";
  }
  const issues: CyberdrawValidationIssue[] = [];
  const root = input as Record<string, unknown>;
  validateKnownShapeForDetection(root, issues);
  validateVersionDetectionSemantics(root, issues);
  if (issues.length > 0) {
    return "invalid";
  }
  return classifyVersion(root);
}

export function validateCyberdrawPublicRequest(
  input: unknown,
  config: CyberdrawPublicScopeModelLimits = {},
): CyberdrawPublicRequestValidationResult {
  const issues: CyberdrawValidationIssue[] = [];
  if (!safeRecord(input)) {
    return rejected("invalid", [issue([], "input must be an object")]);
  }
  const root = input as Record<string, unknown>;
  validateInternalConfig(config, issues);
  validatePlainRecord(root, [], issues);
  rejectUnknownKeys(root, ROOT_KEYS, [], issues);
  if (issues.length > 0) {
    return rejected("invalid", issues);
  }
  const version = issues.length === 0 ? classifyVersion(root) : "invalid";

  const mode = normalizeMode(root.mode, issues);
  const query = normalizeQuery(root.query, mode, issues);
  validateExpansion(root.expansion, issues);
  validatePlanning(root.planning, issues);
  validateValidation(root.validation, issues);
  validateResponse(root.response, issues);
  validateModeCombinations(root, mode, issues);

  const scope = normalizeScope(root.scope, config, issues);
  const coverageRequirements = normalizeCoverageRequirements(
    root.coverageRequirements,
    issues,
  );
  const limits = normalizeRequestedLimits(root.limits, config, issues);

  if (
    issues.length > 0 ||
    version === "invalid" ||
    !mode ||
    !query ||
    !scope.ok
  ) {
    return rejected(version, issues);
  }
  const acceptedVersion: CyberdrawPublicContractVersion = version;

  return {
    ok: true,
    version: acceptedVersion,
    request: {
      version: acceptedVersion,
      mode,
      operation: mode === "query" ? query.operation : mode,
      requestedScope: scope.requested,
      normalizedScope: scope.normalized,
      ...(coverageRequirements ? { coverageRequirements } : {}),
      ...(limits ? { limits } : {}),
    },
    issues: [],
  };
}

function classifyVersion(
  root: Record<string, unknown>,
): CyberdrawPublicContractVersion {
  if (safeRecord(root.scope)) {
    const scope = root.scope as Record<string, unknown>;
    if (
      scope.pageIds !== undefined ||
      scope.layerTargets !== undefined ||
      scope.document !== undefined
    ) {
      return "m14-v1";
    }
  }
  if (safeRecord(root.query)) {
    const operation = (root.query as Record<string, unknown>).operation;
    if (operation === "count" || operation === "summarize") {
      return "m14-v1";
    }
  }
  if (root.coverageRequirements !== undefined || root.limits !== undefined) {
    return "m14-v1";
  }
  return "m13-v1";
}

function normalizeMode(
  value: unknown,
  issues: CyberdrawValidationIssue[],
): CyberdrawPublicMode | undefined {
  if (value === undefined) {
    return "analyze";
  }
  if (typeof value !== "string" || !PUBLIC_MODES.has(value)) {
    issues.push(
      issue(
        ["mode"],
        "mode must be analyze, query, plan or validate",
        value === "count" || value === "summarize"
          ? "unsupported-query-operation"
          : undefined,
      ),
    );
    return undefined;
  }
  return value as CyberdrawPublicMode;
}

function validateModeCombinations(
  root: Record<string, unknown>,
  mode: CyberdrawPublicMode | undefined,
  issues: CyberdrawValidationIssue[],
): void {
  if (!mode) {
    return;
  }
  if (mode === "analyze" && root.query !== undefined) {
    issues.push(
      issue(["query"], "query is only valid for query, plan or validate mode"),
    );
  }
  if ((mode === "analyze" || mode === "query") && root.planning !== undefined) {
    issues.push(
      issue(["planning"], "planning is only valid for plan or validate mode"),
    );
  }
  if (mode !== "validate" && root.validation !== undefined) {
    issues.push(
      issue(["validation"], "validation is only valid for validate mode"),
    );
  }
}

function normalizeQuery(
  value: unknown,
  mode: CyberdrawPublicMode | undefined,
  issues: CyberdrawValidationIssue[],
): { readonly operation: CyberdrawPublicQueryOperation } | undefined {
  if (value === undefined) {
    return { operation: "list" };
  }
  if (!safeRecord(value)) {
    issues.push(issue(["query"], "query must be an object"));
    return undefined;
  }
  const query = value as Record<string, unknown>;
  const initialIssueCount = issues.length;
  validatePlainRecord(query, ["query"], issues);
  if (issues.length > initialIssueCount) {
    return undefined;
  }
  rejectUnknownKeys(query, QUERY_KEYS, ["query"], issues);
  validateQueryFilters(query, issues);
  const operation = query.operation ?? "list";
  if (typeof operation !== "string" || !QUERY_OPERATIONS.has(operation)) {
    issues.push(
      issue(
        ["query", "operation"],
        "query.operation must be list, count or summarize",
        "unsupported-query-operation",
      ),
    );
    return undefined;
  }
  if (mode !== "query" && M14_QUERY_OPERATIONS.has(operation)) {
    issues.push(
      issue(
        ["query", "operation"],
        "count and summarize require mode query",
        "unsupported-query-operation",
      ),
    );
    return undefined;
  }
  if (query.groupBy !== undefined) {
    if (
      typeof query.groupBy !== "string" ||
      !SUMMARY_GROUPS.has(query.groupBy)
    ) {
      issues.push(
        issue(
          ["query", "groupBy"],
          "query.groupBy is not supported",
          "unsupported-query-operation",
        ),
      );
      return undefined;
    }
    if (operation !== "summarize") {
      issues.push(
        issue(
          ["query", "groupBy"],
          "query.groupBy requires summarize operation",
          "unsupported-query-operation",
        ),
      );
      return undefined;
    }
  }
  return { operation: operation as CyberdrawPublicQueryOperation };
}

function validateQueryFilters(
  query: Record<string, unknown>,
  issues: CyberdrawValidationIssue[],
): void {
  validateStringArray(query.findingTypes, ["query", "findingTypes"], issues, FINDING_TYPES);
  validateStringArray(
    query.classifications,
    ["query", "classifications"],
    issues,
    CLASSIFICATIONS,
  );
  validateStringArray(query.confidences, ["query", "confidences"], issues, CONFIDENCES);
  for (const key of STRING_ARRAY_QUERY_KEYS) {
    validateStringArray(query[key], ["query", key], issues);
  }
  if (
    query.order !== undefined &&
    (typeof query.order !== "string" || !QUERY_ORDERS.has(query.order))
  ) {
    issues.push(issue(["query", "order"], "query.order is not supported"));
  }
  validateNonNegativeInteger(query.offset, ["query", "offset"], issues);
  validateNonNegativeInteger(query.limit, ["query", "limit"], issues);
}

function normalizeScope(
  value: unknown,
  config: CyberdrawPublicScopeModelLimits,
  issues: CyberdrawValidationIssue[],
):
  | {
      readonly ok: true;
      readonly requested: CyberdrawRequestedScope;
      readonly normalized: CyberdrawNormalizedScope;
    }
  | { readonly ok: false } {
  if (value === undefined) {
    return {
      ok: true,
      requested: { kind: "default" },
      normalized: { kind: "default" },
    };
  }
  if (!safeRecord(value)) {
    issues.push(issue(["scope"], "scope must be an object"));
    return { ok: false };
  }
  const scope = value as Record<string, unknown>;
  const initialIssueCount = issues.length;
  validatePlainRecord(scope, ["scope"], issues);
  if (issues.length > initialIssueCount) {
    return { ok: false };
  }
  const hasM14Scope = [...M14_SCOPE_KEYS].some(
    (key) => scope[key] !== undefined,
  );
  const allowed = hasM14Scope
    ? new Set([...M13_SCOPE_KEYS, ...M14_SCOPE_KEYS])
    : M13_SCOPE_KEYS;
  rejectUnknownKeys(scope, allowed, ["scope"], issues);

  if (scope.document !== undefined) {
    if (scope.document !== true) {
      issues.push(issue(["scope", "document"], "scope.document must be true"));
    }
    issues.push(
      issue(
        ["scope", "document"],
        "document scope is not supported",
        "document-scope-not-supported",
      ),
    );
    return { ok: false };
  }
  if (!hasM14Scope) {
    return normalizeM13Scope(scope, issues);
  }
  if (scope.pageId !== undefined || scope.layerId !== undefined) {
    issues.push(
      issue(
        ["scope"],
        "inherited pageId/layerId cannot be combined with M14 scope fields",
        "duplicate-scope-target",
      ),
    );
    return { ok: false };
  }

  const pages = normalizeIdArray(scope.pageIds, ["scope", "pageIds"], issues);
  const layers = normalizeLayerTargets(scope.layerTargets, issues);
  if (pages === undefined || layers === undefined) {
    return { ok: false };
  }
  if (scope.pageIds !== undefined && pages.length === 0) {
    issues.push(
      issue(["scope", "pageIds"], "pageIds cannot be empty", "empty-scope"),
    );
  }
  if (scope.layerTargets !== undefined && layers.length === 0) {
    issues.push(
      issue(
        ["scope", "layerTargets"],
        "layerTargets cannot be empty",
        "empty-scope",
      ),
    );
  }
  if (pages.length === 0 && layers.length === 0) {
    issues.push(
      issue(
        ["scope"],
        "explicit scope must select at least one target",
        "empty-scope",
      ),
    );
  }
  const pageSet = new Set(pages);
  for (const target of layers) {
    if (pageSet.has(target.pageId)) {
      issues.push(
        issue(
          ["scope", "layerTargets"],
          "same page cannot be targeted as both page and layer scope",
          "duplicate-scope-target",
        ),
      );
    }
  }
  const selectedPages = pages.length;
  const selectedLayers = layers.reduce(
    (sum, target) => sum + target.layerIds.length,
    0,
  );
  if (config.maxPages !== undefined && selectedPages > config.maxPages) {
    issues.push(
      issue(
        ["scope", "pageIds"],
        "page scope exceeds maxPages",
        "scope-too-broad",
      ),
    );
  }
  if (config.maxLayers !== undefined && selectedLayers > config.maxLayers) {
    issues.push(
      issue(
        ["scope", "layerTargets"],
        "layer scope exceeds maxLayers",
        "scope-too-broad",
      ),
    );
  }
  if (issues.length > initialIssueCount) {
    return { ok: false };
  }
  const pageTargets = pages.map((pageId) => ({ pageId }));
  const requested = {
    kind: "m14" as const,
    pageIds: pages,
    layerTargets: layers,
  };
  if (pageTargets.length > 0 && layers.length > 0) {
    return {
      ok: true,
      requested,
      normalized: { kind: "mixed", pageTargets, layerTargets: layers },
    };
  }
  if (pageTargets.length > 0) {
    return {
      ok: true,
      requested,
      normalized: { kind: "page", pageTargets },
    };
  }
  return {
    ok: true,
    requested,
    normalized: { kind: "layer", layerTargets: layers },
  };
}

function normalizeM13Scope(
  scope: Record<string, unknown>,
  issues: CyberdrawValidationIssue[],
):
  | {
      readonly ok: true;
      readonly requested: CyberdrawRequestedScope;
      readonly normalized: CyberdrawNormalizedScope;
    }
  | { readonly ok: false } {
  const initialIssueCount = issues.length;
  const pageId = normalizeOptionalId(scope.pageId, ["scope", "pageId"], issues);
  const layerId = normalizeOptionalId(
    scope.layerId,
    ["scope", "layerId"],
    issues,
  );
  if (scope.layerId !== undefined && scope.pageId === undefined) {
    issues.push(
      issue(["scope", "pageId"], "scope.pageId is required with scope.layerId"),
    );
  }
  if (issues.length > initialIssueCount) {
    return { ok: false };
  }
  if (pageId && layerId) {
    return {
      ok: true,
      requested: { kind: "m13", pageId, layerId },
      normalized: {
        kind: "layer",
        layerTargets: [{ pageId, layerIds: [layerId] }],
      },
    };
  }
  if (pageId) {
    return {
      ok: true,
      requested: { kind: "m13", pageId },
      normalized: { kind: "page", pageTargets: [{ pageId }] },
    };
  }
  return {
    ok: true,
    requested: { kind: "m13" },
    normalized: { kind: "default" },
  };
}

function normalizeLayerTargets(
  value: unknown,
  issues: CyberdrawValidationIssue[],
): readonly CyberdrawLayerTarget[] | undefined {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    issues.push(
      issue(["scope", "layerTargets"], "layerTargets must be an array"),
    );
    return undefined;
  }
  const targets: CyberdrawLayerTarget[] = [];
  const pages = new Set<string>();
  value.forEach((entry, index) => {
    if (!safeRecord(entry)) {
      issues.push(
        issue(
          ["scope", "layerTargets", index],
          "layer target must be an object",
        ),
      );
      return;
    }
    const target = entry as Record<string, unknown>;
    const initialIssueCount = issues.length;
    validatePlainRecord(target, ["scope", "layerTargets", index], issues);
    if (issues.length > initialIssueCount) {
      return;
    }
    rejectUnknownKeys(
      target,
      new Set(["pageId", "layerIds"]),
      ["scope", "layerTargets", index],
      issues,
    );
    const pageId = normalizeOptionalId(
      target.pageId,
      ["scope", "layerTargets", index, "pageId"],
      issues,
    );
    const layerIds = normalizeIdArray(
      target.layerIds,
      ["scope", "layerTargets", index, "layerIds"],
      issues,
    );
    if (!pageId || layerIds === undefined) {
      return;
    }
    if (layerIds.length === 0) {
      issues.push(
        issue(
          ["scope", "layerTargets", index, "layerIds"],
          "layerIds cannot be empty",
          "empty-scope",
        ),
      );
      return;
    }
    if (pages.has(pageId)) {
      issues.push(
        issue(
          ["scope", "layerTargets", index, "pageId"],
          "duplicate layer target page",
          "duplicate-scope-target",
        ),
      );
      return;
    }
    pages.add(pageId);
    targets.push({ pageId, layerIds });
  });
  return targets.sort((left, right) => left.pageId.localeCompare(right.pageId));
}

function normalizeCoverageRequirements(
  value: unknown,
  issues: CyberdrawValidationIssue[],
): CyberdrawCoverageRequirements | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!safeRecord(value)) {
    issues.push(
      issue(["coverageRequirements"], "coverageRequirements must be an object"),
    );
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const initialIssueCount = issues.length;
  validatePlainRecord(raw, ["coverageRequirements"], issues);
  if (issues.length > initialIssueCount) {
    return undefined;
  }
  rejectUnknownKeys(raw, COVERAGE_KEYS, ["coverageRequirements"], issues);
  const requirements = new Set<CyberdrawCoverageRequirement>();
  if (raw.minimum !== undefined) {
    if (
      raw.minimum !== "any" &&
      raw.minimum !== "nonStale" &&
      raw.minimum !== "completeTargetScopes"
    ) {
      issues.push(
        issue(
          ["coverageRequirements", "minimum"],
          "minimum must be any, nonStale or completeTargetScopes",
        ),
      );
    } else if (raw.minimum !== "any") {
      requirements.add(raw.minimum);
    }
  }
  appendCoverageBoolean(raw, "nonStale", requirements, issues);
  appendCoverageBoolean(raw, "completeTargetScopes", requirements, issues);
  return { minimum: [...requirements].sort() };
}

function appendCoverageBoolean(
  raw: Record<string, unknown>,
  key: CyberdrawCoverageRequirement,
  requirements: Set<CyberdrawCoverageRequirement>,
  issues: CyberdrawValidationIssue[],
): void {
  if (raw[key] === undefined) {
    return;
  }
  if (typeof raw[key] !== "boolean") {
    issues.push(issue(["coverageRequirements", key], `${key} must be boolean`));
    return;
  }
  if (raw[key] === true) {
    requirements.add(key);
  }
}

function normalizeRequestedLimits(
  value: unknown,
  config: CyberdrawPublicScopeModelLimits,
  issues: CyberdrawValidationIssue[],
): CyberdrawRequestedLimits | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!safeRecord(value)) {
    issues.push(issue(["limits"], "limits must be an object"));
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const initialIssueCount = issues.length;
  validatePlainRecord(raw, ["limits"], issues);
  if (issues.length > initialIssueCount) {
    return undefined;
  }
  rejectUnknownKeys(raw, LIMIT_KEYS, ["limits"], issues);
  const normalized: Partial<Record<keyof CyberdrawRequestedLimits, number>> =
    {};
  for (const key of LIMIT_KEYS) {
    const valueForKey = raw[key];
    if (valueForKey === undefined) {
      continue;
    }
    if (
      typeof valueForKey !== "number" ||
      !Number.isSafeInteger(valueForKey) ||
      valueForKey <= 0
    ) {
      issues.push(issue(["limits", key], `${key} must be a positive integer`));
      continue;
    }
    const absoluteMax = config[key as keyof CyberdrawPublicScopeModelLimits];
    if (absoluteMax !== undefined && valueForKey > absoluteMax) {
      issues.push(
        issue(
          ["limits", key],
          `${key} exceeds configured maximum`,
          "scope-too-broad",
        ),
      );
      continue;
    }
    normalized[key as keyof CyberdrawRequestedLimits] = valueForKey;
  }
  return normalized;
}

function validateExpansion(
  value: unknown,
  issues: CyberdrawValidationIssue[],
): void {
  const raw = validateClosedRecord(value, "expansion", EXPANSION_KEYS, issues);
  if (!raw) {
    return;
  }
  if (raw.enabled !== undefined && typeof raw.enabled !== "boolean") {
    issues.push(issue(["expansion", "enabled"], "enabled must be boolean"));
  }
  validateNonNegativeInteger(raw.maxScopes, ["expansion", "maxScopes"], issues);
  validateNonNegativeInteger(raw.maxDepth, ["expansion", "maxDepth"], issues);
  validatePositiveInteger(raw.maxBytes, ["expansion", "maxBytes"], issues);
}

function validatePlanning(
  value: unknown,
  issues: CyberdrawValidationIssue[],
): void {
  const raw = validateClosedRecord(value, "planning", PLANNING_KEYS, issues);
  if (!raw) {
    return;
  }
  if (
    raw.policy !== undefined &&
    (typeof raw.policy !== "string" || !PLANNING_POLICIES.has(raw.policy))
  ) {
    issues.push(issue(["planning", "policy"], "policy is not supported"));
  }
  if (raw.selectedFindingIds !== undefined) {
    validateStringArray(
      raw.selectedFindingIds,
      ["planning", "selectedFindingIds"],
      issues,
    );
  }
}

function validateValidation(
  value: unknown,
  issues: CyberdrawValidationIssue[],
): void {
  const raw = validateClosedRecord(value, "validation", VALIDATION_KEYS, issues);
  if (!raw) {
    return;
  }
  if (
    raw.mode !== undefined &&
    (typeof raw.mode !== "string" || !VALIDATION_MODES.has(raw.mode))
  ) {
    issues.push(issue(["validation", "mode"], "validation mode is not supported"));
  }
}

function validateResponse(
  value: unknown,
  issues: CyberdrawValidationIssue[],
): void {
  const raw = validateClosedRecord(value, "response", RESPONSE_KEYS, issues);
  if (!raw) {
    return;
  }
  for (const key of RESPONSE_KEYS) {
    if (raw[key] !== undefined && typeof raw[key] !== "boolean") {
      issues.push(issue(["response", key], `${key} must be boolean`));
    }
  }
}

function validateClosedRecord(
  value: unknown,
  field: string,
  allowed: ReadonlySet<string>,
  issues: CyberdrawValidationIssue[],
): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!safeRecord(value)) {
    issues.push(issue([field], `${field} must be an object`));
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const initialIssueCount = issues.length;
  validatePlainRecord(raw, [field], issues);
  if (issues.length > initialIssueCount) {
    return undefined;
  }
  rejectUnknownKeys(raw, allowed, [field], issues);
  return raw;
}

function validateNonNegativeInteger(
  value: unknown,
  path: readonly (string | number)[],
  issues: CyberdrawValidationIssue[],
): void {
  if (value === undefined) {
    return;
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    issues.push(issue(path, "value must be a non-negative integer"));
  }
}

function validatePositiveInteger(
  value: unknown,
  path: readonly (string | number)[],
  issues: CyberdrawValidationIssue[],
): void {
  if (value === undefined) {
    return;
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    issues.push(issue(path, "value must be a positive integer"));
  }
}

function validateStringArray(
  value: unknown,
  path: readonly (string | number)[],
  issues: CyberdrawValidationIssue[],
  allowed?: ReadonlySet<string>,
): void {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    issues.push(issue(path, "value must be an array"));
    return;
  }
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    const entryPath = [...path, index];
    if (typeof entry !== "string") {
      issues.push(issue(entryPath, "identifier must be a string"));
      return;
    }
    const trimmed = entry.trim();
    if (trimmed.length === 0) {
      issues.push(issue(entryPath, "identifier cannot be blank"));
      return;
    }
    if (allowed && !allowed.has(trimmed)) {
      issues.push(issue(entryPath, "value is not supported"));
      return;
    }
    if (seen.has(trimmed)) {
      issues.push(issue(entryPath, "duplicate identifier"));
      return;
    }
    seen.add(trimmed);
  });
}

function normalizeIdArray(
  value: unknown,
  path: readonly (string | number)[],
  issues: CyberdrawValidationIssue[],
): readonly string[] | undefined {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    issues.push(issue(path, "value must be an array"));
    return undefined;
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    const normalized = normalizeOptionalId(entry, [...path, index], issues);
    if (normalized) {
      if (seen.has(normalized)) {
        issues.push(
          issue(
            [...path, index],
            "duplicate identifier",
            "duplicate-scope-target",
          ),
        );
        return;
      }
      seen.add(normalized);
      ids.push(normalized);
    }
  });
  return ids.sort();
}

function normalizeOptionalId(
  value: unknown,
  path: readonly (string | number)[],
  issues: CyberdrawValidationIssue[],
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    issues.push(issue(path, "identifier must be a string"));
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    issues.push(issue(path, "identifier cannot be blank", "empty-scope"));
    return undefined;
  }
  return trimmed;
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: readonly (string | number)[],
  issues: CyberdrawValidationIssue[],
): void {
  for (const key of Object.keys(value).sort()) {
    if (!allowed.has(key)) {
      issues.push(issue([...path, key], "unknown field"));
    }
  }
}

function rejected(
  version: CyberdrawContractVersionDetection,
  issues: readonly CyberdrawValidationIssue[],
): CyberdrawPublicRequestRejected {
  return { ok: false, version, issues };
}

function issue(
  path: readonly (string | number)[],
  message: string,
  reasonCode?: CyberdrawM14ReasonCode,
): CyberdrawValidationIssue {
  return { path, message, ...(reasonCode ? { reasonCode } : {}) };
}

function validatePlainRecord(
  value: Record<string, unknown>,
  path: readonly (string | number)[],
  issues: CyberdrawValidationIssue[],
): void {
  const symbols = Object.getOwnPropertySymbols(value);
  if (symbols.length > 0) {
    issues.push(issue(path, "symbol keys are not accepted"));
  }
  const descriptors = Object.entries(
    Object.getOwnPropertyDescriptors(value),
  ).sort(([left], [right]) => left.localeCompare(right));
  for (const [key, descriptor] of descriptors) {
    if (descriptor.get || descriptor.set) {
      issues.push(
        issue([...path, key], "accessor properties are not accepted"),
      );
    }
  }
}

function validateKnownShapeForDetection(
  root: Record<string, unknown>,
  issues: CyberdrawValidationIssue[],
): void {
  validatePlainRecord(root, [], issues);
  rejectUnknownKeys(root, ROOT_KEYS, [], issues);
  validateNestedPlainObject(root.scope, ["scope"], issues);
  if (safeRecord(root.scope)) {
    const scope = root.scope as Record<string, unknown>;
    rejectUnknownKeys(
      scope,
      new Set([...M13_SCOPE_KEYS, ...M14_SCOPE_KEYS]),
      ["scope"],
      issues,
    );
    validateLayerTargetsShape(scope.layerTargets, issues);
  }
  validateNestedPlainObject(root.query, ["query"], issues);
  if (safeRecord(root.query)) {
    rejectUnknownKeys(
      root.query as Record<string, unknown>,
      QUERY_KEYS,
      ["query"],
      issues,
    );
  }
  validateNestedPlainObject(
    root.coverageRequirements,
    ["coverageRequirements"],
    issues,
  );
  if (safeRecord(root.coverageRequirements)) {
    rejectUnknownKeys(
      root.coverageRequirements as Record<string, unknown>,
      COVERAGE_KEYS,
      ["coverageRequirements"],
      issues,
    );
  }
  validateNestedPlainObject(root.limits, ["limits"], issues);
  if (safeRecord(root.limits)) {
    rejectUnknownKeys(
      root.limits as Record<string, unknown>,
      LIMIT_KEYS,
      ["limits"],
      issues,
    );
  }
}

function validateVersionDetectionSemantics(
  root: Record<string, unknown>,
  issues: CyberdrawValidationIssue[],
): void {
  if (
    root.mode !== undefined &&
    (typeof root.mode !== "string" || !PUBLIC_MODES.has(root.mode))
  ) {
    issues.push(
      issue(
        ["mode"],
        "mode must be analyze, query, plan or validate",
        root.mode === "count" || root.mode === "summarize"
          ? "unsupported-query-operation"
          : undefined,
      ),
    );
  }
  if (safeRecord(root.query)) {
    const operation = (root.query as Record<string, unknown>).operation;
    if (operation === undefined) {
      return;
    }
    if (typeof operation !== "string" || !QUERY_OPERATIONS.has(operation)) {
      issues.push(
        issue(
          ["query", "operation"],
          "query.operation must be list, count or summarize",
          "unsupported-query-operation",
        ),
      );
      return;
    }
    const mode = root.mode ?? "analyze";
    if (M14_QUERY_OPERATIONS.has(operation) && mode !== "query") {
      issues.push(
        issue(
          ["query", "operation"],
          "count and summarize require mode query",
          "unsupported-query-operation",
        ),
      );
    }
  }
}

function validateNestedPlainObject(
  value: unknown,
  path: readonly (string | number)[],
  issues: CyberdrawValidationIssue[],
): void {
  if (value === undefined) {
    return;
  }
  if (safeRecord(value)) {
    validatePlainRecord(value, path, issues);
  }
}

function validateLayerTargetsShape(
  value: unknown,
  issues: CyberdrawValidationIssue[],
): void {
  if (value === undefined || !Array.isArray(value)) {
    return;
  }
  value.forEach((entry, index) => {
    if (!safeRecord(entry)) {
      return;
    }
    const target = entry as Record<string, unknown>;
    validatePlainRecord(target, ["scope", "layerTargets", index], issues);
    rejectUnknownKeys(
      target,
      new Set(["pageId", "layerIds"]),
      ["scope", "layerTargets", index],
      issues,
    );
  });
}

function validateInternalConfig(
  config: CyberdrawPublicScopeModelLimits,
  issues: CyberdrawValidationIssue[],
): void {
  for (const key of LIMIT_KEYS) {
    const value = config[key as keyof CyberdrawPublicScopeModelLimits];
    if (value === undefined) {
      continue;
    }
    if (
      typeof value !== "number" ||
      !Number.isSafeInteger(value) ||
      value <= 0
    ) {
      issues.push(
        issue(["config", key], `${key} cap must be a positive integer`),
      );
    }
  }
}

function safeRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
