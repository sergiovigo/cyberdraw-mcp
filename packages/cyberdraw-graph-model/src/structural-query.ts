import type {
  BrokenReferenceStatus,
  CrossLayerRelationClassification,
  OrphanStatus,
  StructuralAnalysisCounts,
  StructuralAnalysisCoverage,
  StructuralAnalysisDiagnostic,
  StructuralAnalysisResult,
  StructuralCompleteness,
  StructuralCountBasis,
  StructuralFinding,
  StructuralFindingConfidence,
  StructuralFindingType,
} from "./structural-analysis.js";
import type { JsonValue } from "./types.js";

export const STRUCTURAL_QUERY_VERSION = "cyberdraw.structural-query.v1";

export type StructuralQueryKind =
  | "list-findings"
  | "get-finding"
  | "summarize"
  | "counts";

export type StructuralQueryOrder =
  | "canonical"
  | "finding-type"
  | "page-layer"
  | "finding-id";

export type StructuralCoverageRequirement =
  | "any"
  | "non-stale"
  | "complete-target-scopes"
  | "complete-document";

export type StructuralSummaryGroupBy =
  | "finding-type"
  | "classification"
  | "reason-code"
  | "page"
  | "layer"
  | "completeness"
  | "coverage";

export type StructuralFindingClassification =
  | BrokenReferenceStatus
  | CrossLayerRelationClassification
  | OrphanStatus;

export type StructuralFindingFilters = {
  readonly findingTypes?: readonly StructuralFindingType[];
  readonly classifications?: readonly StructuralFindingClassification[];
  readonly reasonCodes?: readonly string[];
  readonly pageIds?: readonly string[];
  readonly layerIds?: readonly string[];
  readonly elementIds?: readonly string[];
  readonly sourceIds?: readonly string[];
  readonly targetIds?: readonly string[];
  readonly referencedIds?: readonly string[];
  readonly confidences?: readonly StructuralFindingConfidence[];
  readonly completenesses?: readonly StructuralCompleteness[];
  readonly coverageClasses?: readonly StructuralCompleteness[];
  readonly includeContextOnly?: boolean;
};

export type StructuralQueryLimits = {
  readonly defaultLimit: number;
  readonly maxLimit: number;
  readonly maxFilterValues: number;
  readonly maxGroupBuckets: number;
  readonly maxIdentifierLength: number;
};

export type ListStructuralFindingsQuery = {
  readonly kind: "list-findings";
  readonly filters?: StructuralFindingFilters;
  readonly order?: StructuralQueryOrder;
  readonly offset?: number;
  readonly limit?: number;
  readonly coverageRequirement?: StructuralCoverageRequirement;
};

export type GetStructuralFindingQuery = {
  readonly kind: "get-finding";
  readonly findingId: string;
  readonly coverageRequirement?: StructuralCoverageRequirement;
};

export type SummarizeStructuralFindingsQuery = {
  readonly kind: "summarize";
  readonly groupBy: StructuralSummaryGroupBy;
  readonly filters?: StructuralFindingFilters;
  readonly coverageRequirement?: StructuralCoverageRequirement;
};

export type StructuralCountsQuery = {
  readonly kind: "counts";
  readonly coverageRequirement?: StructuralCoverageRequirement;
};

export type StructuralAnalysisQuery =
  | ListStructuralFindingsQuery
  | GetStructuralFindingQuery
  | SummarizeStructuralFindingsQuery
  | StructuralCountsQuery;

export type StructuralQueryDiagnosticCode =
  | "invalid-query"
  | "invalid-filter"
  | "excessive-filter-values"
  | "invalid-offset"
  | "invalid-limit"
  | "limit-clamped"
  | "insufficient-coverage"
  | "finding-not-found"
  | "unsupported-order"
  | "unsupported-group"
  | "stale-analysis"
  | "validation-failed";

export type StructuralQueryDiagnostic = {
  readonly code: StructuralQueryDiagnosticCode;
  readonly severity: "debug" | "info" | "warn" | "error";
  readonly detail?: JsonValue;
};

export type StructuralQueryOutcome =
  | "ok"
  | "invalid-query"
  | "insufficient-coverage"
  | "validation-failed";

export type StructuralSummaryBucket = {
  readonly key: string;
  readonly count: number;
  readonly countBasis: StructuralCountBasis;
  readonly coverage?: {
    readonly completeness: StructuralCompleteness;
    readonly conclusive: boolean;
  };
};

export type StructuralCountsSummary = {
  readonly counts: StructuralAnalysisCounts;
  readonly countBasis: StructuralCountBasis;
};

export type StructuralAnalysisQueryResult = {
  readonly queryVersion: typeof STRUCTURAL_QUERY_VERSION;
  readonly analysisVersion: StructuralAnalysisResult["analysisVersion"];
  readonly documentId?: string;
  readonly revisionEvidence: StructuralAnalysisResult["revisionEvidence"];
  readonly kind?: StructuralQueryKind;
  readonly outcome: StructuralQueryOutcome;
  readonly results: readonly StructuralFinding[];
  readonly finding?: StructuralFinding;
  readonly totalMatched: number;
  readonly returned: number;
  readonly offset: number;
  readonly limit: number;
  readonly hasMore: boolean;
  readonly ordering: StructuralQueryOrder;
  readonly groups?: readonly StructuralSummaryBucket[];
  readonly summary?: StructuralCountsSummary;
  readonly coverage: StructuralAnalysisCoverage;
  readonly completeness: StructuralCompleteness;
  readonly analysisDiagnostics: readonly StructuralAnalysisDiagnostic[];
  readonly limitations: readonly string[];
  readonly queryDiagnostics: readonly StructuralQueryDiagnostic[];
  readonly stopReason?: string;
};

export type StructuralAnalysisQueryInput = {
  readonly analysis: StructuralAnalysisResult;
  readonly query: StructuralAnalysisQuery;
  readonly limits?: Partial<StructuralQueryLimits>;
};

const DEFAULT_LIMITS: StructuralQueryLimits = {
  defaultLimit: 100,
  maxLimit: 500,
  maxFilterValues: 50,
  maxGroupBuckets: 100,
  maxIdentifierLength: 512,
};

const FINDING_TYPES = new Set<StructuralFindingType>([
  "broken-reference",
  "cross-layer-edge",
  "orphan-element",
]);
const CLASSIFICATIONS = new Set<StructuralFindingClassification>([
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
  "outside-coverage",
]);
const CONFIDENCES = new Set<StructuralFindingConfidence>([
  "confirmed",
  "contextual",
  "incomplete",
]);
const COMPLETENESSES = new Set<StructuralCompleteness>([
  "complete-document",
  "complete-target-scopes",
  "partial",
  "truncated",
  "stale",
  "unknown",
]);
const ORDERS = new Set<StructuralQueryOrder>([
  "canonical",
  "finding-type",
  "page-layer",
  "finding-id",
]);
const GROUPS = new Set<StructuralSummaryGroupBy>([
  "finding-type",
  "classification",
  "reason-code",
  "page",
  "layer",
  "completeness",
  "coverage",
]);
const COVERAGE_REQUIREMENTS = new Set<StructuralCoverageRequirement>([
  "any",
  "non-stale",
  "complete-target-scopes",
  "complete-document",
]);
const FILTER_KEYS = new Set([
  "findingTypes",
  "classifications",
  "reasonCodes",
  "pageIds",
  "layerIds",
  "elementIds",
  "sourceIds",
  "targetIds",
  "referencedIds",
  "confidences",
  "completenesses",
  "coverageClasses",
  "includeContextOnly",
]);

export function defaultStructuralQueryLimits(
  overrides: Partial<StructuralQueryLimits> = {},
): StructuralQueryLimits {
  return { ...DEFAULT_LIMITS, ...overrides };
}

export function queryStructuralAnalysis(
  input: StructuralAnalysisQueryInput,
): StructuralAnalysisQueryResult {
  const limits = defaultStructuralQueryLimits(input.limits);
  const diagnostics: StructuralQueryDiagnostic[] = [];
  if (!safeRecord(input.query)) {
    return invalidResult(
      input.analysis,
      undefined,
      "invalid-query",
      diagnostics,
    );
  }
  const query = input.query as Record<string, unknown>;
  const kind = query.kind;
  if (
    kind !== "list-findings" &&
    kind !== "get-finding" &&
    kind !== "summarize" &&
    kind !== "counts"
  ) {
    return invalidResult(
      input.analysis,
      undefined,
      "invalid-query",
      diagnostics,
    );
  }
  const validation = validateQuery(query, kind, limits, diagnostics);
  if (!validation.ok) {
    return invalidResult(input.analysis, kind, validation.outcome, diagnostics);
  }
  const requirement = validation.coverageRequirement;
  const coverage = satisfiesCoverageRequirement(input.analysis, requirement);
  if (!coverage.ok) {
    diagnostics.push({
      code:
        input.analysis.completeness === "stale"
          ? "stale-analysis"
          : "insufficient-coverage",
      severity: "warn",
      detail: {
        requirement,
        completeness: input.analysis.completeness,
      },
    });
    return {
      ...baseResult(input.analysis, kind, validation.ordering, diagnostics),
      outcome: "insufficient-coverage",
      limit: validation.limit,
    };
  }

  switch (kind) {
    case "list-findings":
      return listFindings(input.analysis, validation, diagnostics);
    case "get-finding":
      return getFinding(input.analysis, validation, diagnostics);
    case "summarize":
      return summarize(input.analysis, validation, limits, diagnostics);
    case "counts":
      return counts(input.analysis, diagnostics);
  }
}

type ValidatedQuery = {
  readonly ok: true;
  readonly kind: StructuralQueryKind;
  readonly filters: StructuralFindingFilters;
  readonly findingId?: string;
  readonly groupBy?: StructuralSummaryGroupBy;
  readonly offset: number;
  readonly limit: number;
  readonly ordering: StructuralQueryOrder;
  readonly coverageRequirement: StructuralCoverageRequirement;
};

type InvalidQuery = {
  readonly ok: false;
  readonly outcome: "invalid-query" | "validation-failed";
};

function validateQuery(
  query: Record<string, unknown>,
  kind: StructuralQueryKind,
  limits: StructuralQueryLimits,
  diagnostics: StructuralQueryDiagnostic[],
): ValidatedQuery | InvalidQuery {
  const allowed = allowedQueryKeys(kind);
  for (const key of Object.keys(query)) {
    if (!allowed.has(key)) {
      diagnostics.push({
        code: key === "order" ? "unsupported-order" : "invalid-query",
        severity: "error",
        detail: { field: key },
      });
      return { ok: false, outcome: "invalid-query" };
    }
  }
  if (
    query.coverageRequirement !== undefined &&
    typeof query.coverageRequirement !== "string"
  ) {
    diagnostics.push({
      code: "invalid-query",
      severity: "error",
      detail: { field: "coverageRequirement" },
    });
    return { ok: false, outcome: "invalid-query" };
  }
  const coverageRequirement = query.coverageRequirement ?? "any";
  if (
    !COVERAGE_REQUIREMENTS.has(
      coverageRequirement as StructuralCoverageRequirement,
    )
  ) {
    diagnostics.push({
      code: "invalid-query",
      severity: "error",
      detail: { field: "coverageRequirement" },
    });
    return { ok: false, outcome: "invalid-query" };
  }
  if (query.order !== undefined && typeof query.order !== "string") {
    diagnostics.push({
      code: "unsupported-order",
      severity: "error",
      detail: { order: "invalid" },
    });
    return { ok: false, outcome: "invalid-query" };
  }
  const order = query.order ?? "canonical";
  if (!ORDERS.has(order as StructuralQueryOrder)) {
    diagnostics.push({
      code: "unsupported-order",
      severity: "error",
      detail: { order },
    });
    return { ok: false, outcome: "invalid-query" };
  }
  const offset = normalizeOffset(query.offset, diagnostics);
  if (offset === undefined) {
    return { ok: false, outcome: "invalid-query" };
  }
  const limit = normalizeLimit(query.limit, limits, diagnostics);
  if (limit === undefined) {
    return { ok: false, outcome: "invalid-query" };
  }
  const filters = normalizeFilters(query.filters, limits, diagnostics);
  if (!filters.ok) {
    return { ok: false, outcome: filters.outcome };
  }
  if (kind === "get-finding") {
    if (
      typeof query.findingId !== "string" ||
      !validIdentifier(query.findingId, limits)
    ) {
      diagnostics.push({
        code: "invalid-query",
        severity: "error",
        detail: { field: "findingId" },
      });
      return { ok: false, outcome: "invalid-query" };
    }
  }
  if (kind === "summarize") {
    if (
      typeof query.groupBy !== "string" ||
      !GROUPS.has(query.groupBy as StructuralSummaryGroupBy)
    ) {
      diagnostics.push({
        code: "unsupported-group",
        severity: "error",
        detail: {
          groupBy:
            typeof query.groupBy === "string" ? query.groupBy : "invalid",
        },
      });
      return { ok: false, outcome: "invalid-query" };
    }
  }
  return {
    ok: true,
    kind,
    filters: filters.filters,
    findingId:
      typeof query.findingId === "string" ? query.findingId : undefined,
    groupBy:
      typeof query.groupBy === "string"
        ? (query.groupBy as StructuralSummaryGroupBy)
        : undefined,
    offset,
    limit,
    ordering: order as StructuralQueryOrder,
    coverageRequirement: coverageRequirement as StructuralCoverageRequirement,
  };
}

function allowedQueryKeys(kind: StructuralQueryKind): ReadonlySet<string> {
  switch (kind) {
    case "list-findings":
      return new Set([
        "kind",
        "filters",
        "order",
        "offset",
        "limit",
        "coverageRequirement",
      ]);
    case "get-finding":
      return new Set(["kind", "findingId", "coverageRequirement"]);
    case "summarize":
      return new Set(["kind", "groupBy", "filters", "coverageRequirement"]);
    case "counts":
      return new Set(["kind", "coverageRequirement"]);
  }
}

function normalizeOffset(
  value: unknown,
  diagnostics: StructuralQueryDiagnostic[],
): number | undefined {
  if (value === undefined) {
    return 0;
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    diagnostics.push({
      code: "invalid-offset",
      severity: "error",
      detail: { field: "offset" },
    });
    return undefined;
  }
  return value;
}

function normalizeLimit(
  value: unknown,
  limits: StructuralQueryLimits,
  diagnostics: StructuralQueryDiagnostic[],
): number | undefined {
  if (value === undefined) {
    return limits.defaultLimit;
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    diagnostics.push({
      code: "invalid-limit",
      severity: "error",
      detail: { field: "limit" },
    });
    return undefined;
  }
  if (value > limits.maxLimit) {
    diagnostics.push({
      code: "limit-clamped",
      severity: "warn",
      detail: { requested: value, maxLimit: limits.maxLimit },
    });
    return limits.maxLimit;
  }
  return value;
}

function normalizeFilters(
  value: unknown,
  limits: StructuralQueryLimits,
  diagnostics: StructuralQueryDiagnostic[],
):
  | { readonly ok: true; readonly filters: StructuralFindingFilters }
  | InvalidQuery {
  if (value === undefined) {
    return { ok: true, filters: {} };
  }
  if (!safeRecord(value)) {
    diagnostics.push({
      code: "invalid-filter",
      severity: "error",
      detail: { field: "filters" },
    });
    return { ok: false, outcome: "invalid-query" };
  }
  const raw = value as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!FILTER_KEYS.has(key)) {
      diagnostics.push({
        code: "invalid-filter",
        severity: "error",
        detail: { field: key },
      });
      return { ok: false, outcome: "invalid-query" };
    }
  }
  const filters: StructuralFindingFilters = {};
  const append = <T extends string>(
    key: keyof StructuralFindingFilters,
    allowed?: ReadonlySet<T>,
  ): false | undefined => {
    if (raw[key] === undefined) {
      return undefined;
    }
    const normalized = normalizeStringArray(
      raw[key],
      key,
      limits,
      diagnostics,
      allowed,
    );
    if (!normalized) {
      return false;
    }
    Object.assign(filters, { [key]: normalized });
    return undefined;
  };
  if (
    append("findingTypes", FINDING_TYPES) === false ||
    append("classifications", CLASSIFICATIONS) === false ||
    append("reasonCodes") === false ||
    append("pageIds") === false ||
    append("layerIds") === false ||
    append("elementIds") === false ||
    append("sourceIds") === false ||
    append("targetIds") === false ||
    append("referencedIds") === false ||
    append("confidences", CONFIDENCES) === false ||
    append("completenesses", COMPLETENESSES) === false ||
    append("coverageClasses", COMPLETENESSES) === false
  ) {
    return { ok: false, outcome: "invalid-query" };
  }
  if (raw.includeContextOnly !== undefined) {
    if (typeof raw.includeContextOnly !== "boolean") {
      diagnostics.push({
        code: "invalid-filter",
        severity: "error",
        detail: { field: "includeContextOnly" },
      });
      return { ok: false, outcome: "invalid-query" };
    }
    Object.assign(filters, { includeContextOnly: raw.includeContextOnly });
  }
  return { ok: true, filters };
}

function normalizeStringArray<T extends string>(
  value: unknown,
  field: string | number | symbol,
  limits: StructuralQueryLimits,
  diagnostics: StructuralQueryDiagnostic[],
  allowed?: ReadonlySet<T>,
): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    diagnostics.push({
      code: "invalid-filter",
      severity: "error",
      detail: { field: String(field) },
    });
    return undefined;
  }
  if (value.length > limits.maxFilterValues) {
    diagnostics.push({
      code: "excessive-filter-values",
      severity: "error",
      detail: { field: String(field), maxFilterValues: limits.maxFilterValues },
    });
    return undefined;
  }
  const normalized: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !validIdentifier(entry, limits)) {
      diagnostics.push({
        code: "invalid-filter",
        severity: "error",
        detail: { field: String(field) },
      });
      return undefined;
    }
    if (allowed && !allowed.has(entry as T)) {
      diagnostics.push({
        code: "invalid-filter",
        severity: "error",
        detail: { field: String(field) },
      });
      return undefined;
    }
    if (!normalized.includes(entry)) {
      normalized.push(entry);
    }
  }
  return normalized.sort();
}

function listFindings(
  analysis: StructuralAnalysisResult,
  query: ValidatedQuery,
  diagnostics: StructuralQueryDiagnostic[],
): StructuralAnalysisQueryResult {
  const matched = [...matchingFindings(analysis.findings, query.filters)].sort(
    comparatorFor(query.ordering),
  );
  const end = paginationEnd(query.offset, query.limit);
  const results = matched
    .slice(query.offset, end)
    .map((finding) => cloneJsonCompatible(finding));
  return {
    ...baseResult(analysis, "list-findings", query.ordering, diagnostics),
    results,
    totalMatched: matched.length,
    returned: results.length,
    offset: query.offset,
    limit: query.limit,
    hasMore: hasMore(query.offset, query.limit, matched.length),
  };
}

function getFinding(
  analysis: StructuralAnalysisResult,
  query: ValidatedQuery,
  diagnostics: StructuralQueryDiagnostic[],
): StructuralAnalysisQueryResult {
  const matches = analysis.findings.filter(
    (finding) => finding.findingId === query.findingId,
  );
  if (matches.length > 1) {
    diagnostics.push({
      code: "validation-failed",
      severity: "error",
      detail: { reason: "duplicate-finding-id" },
    });
    return {
      ...baseResult(analysis, "get-finding", "finding-id", diagnostics),
      outcome: "validation-failed",
      totalMatched: matches.length,
      returned: 0,
      limit: 1,
    };
  }
  if (matches.length === 0) {
    diagnostics.push({
      code: "finding-not-found",
      severity: "info",
    });
    return {
      ...baseResult(analysis, "get-finding", "finding-id", diagnostics),
      totalMatched: 0,
      returned: 0,
      limit: 1,
    };
  }
  return {
    ...baseResult(analysis, "get-finding", "finding-id", diagnostics),
    finding: cloneJsonCompatible(matches[0]!),
    results: [cloneJsonCompatible(matches[0]!)],
    totalMatched: 1,
    returned: 1,
    limit: 1,
  };
}

function summarize(
  analysis: StructuralAnalysisResult,
  query: ValidatedQuery,
  limits: StructuralQueryLimits,
  diagnostics: StructuralQueryDiagnostic[],
): StructuralAnalysisQueryResult {
  const groupBy = query.groupBy;
  if (!groupBy) {
    diagnostics.push({
      code: "unsupported-group",
      severity: "error",
    });
    return invalidResult(analysis, "summarize", "invalid-query", diagnostics);
  }
  const buckets = new Map<string, StructuralSummaryBucket>();
  const matched = matchingFindings(analysis.findings, query.filters);
  for (const finding of matched) {
    for (const key of groupKeys(finding, groupBy)) {
      const existing = buckets.get(key);
      buckets.set(key, {
        key,
        count: (existing?.count ?? 0) + 1,
        countBasis: countBasisForCompleteness(analysis.completeness),
        coverage:
          groupBy === "coverage" || groupBy === "completeness"
            ? {
                completeness: finding.coverage.completeness,
                conclusive: finding.coverage.conclusive,
              }
            : undefined,
      });
    }
  }
  if (buckets.size > limits.maxGroupBuckets) {
    diagnostics.push({
      code: "validation-failed",
      severity: "error",
      detail: {
        reason: "max-group-buckets",
        maxGroupBuckets: limits.maxGroupBuckets,
      },
    });
    return {
      ...baseResult(analysis, "summarize", "canonical", diagnostics),
      outcome: "validation-failed",
      totalMatched: matched.length,
      returned: 0,
    };
  }
  const groups = [...buckets.values()].sort((left, right) =>
    left.key.localeCompare(right.key),
  );
  return {
    ...baseResult(analysis, "summarize", "canonical", diagnostics),
    totalMatched: matched.length,
    returned: groups.length,
    groups: groups.map((bucket) => cloneJsonCompatible(bucket)),
  };
}

function counts(
  analysis: StructuralAnalysisResult,
  diagnostics: StructuralQueryDiagnostic[],
): StructuralAnalysisQueryResult {
  return {
    ...baseResult(analysis, "counts", "canonical", diagnostics),
    summary: {
      counts: cloneJsonCompatible(analysis.counts),
      countBasis: countBasisForCompleteness(analysis.completeness),
    },
  };
}

function matchingFindings(
  findings: readonly StructuralFinding[],
  filters: StructuralFindingFilters,
): readonly StructuralFinding[] {
  return findings.filter((finding) => matchesFilters(finding, filters));
}

function matchesFilters(
  finding: StructuralFinding,
  filters: StructuralFindingFilters,
): boolean {
  return (
    matchesAny(filters.findingTypes, [finding.findingType]) &&
    matchesAny(filters.classifications, [classificationOf(finding)]) &&
    matchesAny(filters.reasonCodes, [finding.reasonCode]) &&
    matchesAny(filters.pageIds, pageIdsOf(finding)) &&
    matchesAny(filters.layerIds, layerIdsOf(finding)) &&
    matchesAny(filters.elementIds, elementIdsOf(finding)) &&
    matchesAny(filters.sourceIds, sourceIdsOf(finding)) &&
    matchesAny(filters.targetIds, targetIdsOf(finding)) &&
    matchesAny(filters.referencedIds, referencedIdsOf(finding)) &&
    matchesAny(filters.confidences, [finding.confidence]) &&
    matchesAny(filters.completenesses, [finding.coverage.completeness]) &&
    matchesAny(filters.coverageClasses, [finding.coverage.completeness]) &&
    (filters.includeContextOnly !== false ||
      classificationOf(finding) !== "context-only-endpoint")
  );
}

function matchesAny(
  filter: readonly string[] | undefined,
  values: readonly (string | undefined)[],
): boolean {
  if (!filter || filter.length === 0) {
    return true;
  }
  const present = new Set(
    values.filter((value): value is string => Boolean(value)),
  );
  return filter.some((entry) => present.has(entry));
}

function classificationOf(
  finding: StructuralFinding,
): StructuralFindingClassification {
  switch (finding.findingType) {
    case "broken-reference":
      return finding.status;
    case "cross-layer-edge":
      return finding.relationClassification;
    case "orphan-element":
      return finding.status;
  }
}

function pageIdsOf(finding: StructuralFinding): readonly string[] {
  switch (finding.findingType) {
    case "broken-reference":
      return compact([finding.pageId, finding.referencedPageId]);
    case "cross-layer-edge":
      return compact([finding.sourcePageId, finding.targetPageId]);
    case "orphan-element":
      return compact([finding.pageId]);
  }
}

function layerIdsOf(finding: StructuralFinding): readonly string[] {
  switch (finding.findingType) {
    case "broken-reference":
      return compact([finding.layerId, finding.referencedLayerId]);
    case "cross-layer-edge":
      return compact([finding.sourceLayerId, finding.targetLayerId]);
    case "orphan-element":
      return compact([finding.layerId]);
  }
}

function elementIdsOf(finding: StructuralFinding): readonly string[] {
  switch (finding.findingType) {
    case "broken-reference":
      return compact([finding.sourceElementId, finding.referencedElementId]);
    case "cross-layer-edge":
      return compact([
        finding.edgeId,
        finding.sourceElementId,
        finding.targetElementId,
      ]);
    case "orphan-element":
      return [finding.elementId];
  }
}

function sourceIdsOf(finding: StructuralFinding): readonly string[] {
  return finding.findingType === "broken-reference" ||
    finding.findingType === "cross-layer-edge"
    ? compact([finding.sourceElementId])
    : [];
}

function targetIdsOf(finding: StructuralFinding): readonly string[] {
  return finding.findingType === "cross-layer-edge"
    ? compact([finding.targetElementId])
    : [];
}

function referencedIdsOf(finding: StructuralFinding): readonly string[] {
  return finding.findingType === "broken-reference"
    ? compact([finding.referencedElementId])
    : [];
}

function groupKeys(
  finding: StructuralFinding,
  groupBy: StructuralSummaryGroupBy,
): readonly string[] {
  switch (groupBy) {
    case "finding-type":
      return [finding.findingType];
    case "classification":
      return [classificationOf(finding)];
    case "reason-code":
      return [finding.reasonCode];
    case "page":
      return pageIdsOf(finding).length ? pageIdsOf(finding) : ["unknown"];
    case "layer":
      return layerIdsOf(finding).length ? layerIdsOf(finding) : ["unknown"];
    case "completeness":
    case "coverage":
      return [finding.coverage.completeness];
  }
}

function comparatorFor(order: StructuralQueryOrder) {
  switch (order) {
    case "canonical":
      return compareCanonical;
    case "finding-type":
      return chainComparators(
        (left, right) => left.findingType.localeCompare(right.findingType),
        compareCanonical,
      );
    case "page-layer":
      return chainComparators(
        (left, right) =>
          first(pageIdsOf(left)).localeCompare(first(pageIdsOf(right))),
        (left, right) =>
          first(layerIdsOf(left)).localeCompare(first(layerIdsOf(right))),
        compareCanonical,
      );
    case "finding-id":
      return chainComparators(
        (left, right) => left.findingId.localeCompare(right.findingId),
        compareCanonical,
      );
  }
}

function compareCanonical(
  left: StructuralFinding,
  right: StructuralFinding,
): number {
  return (
    left.findingType.localeCompare(right.findingType) ||
    first(pageIdsOf(left)).localeCompare(first(pageIdsOf(right))) ||
    first(layerIdsOf(left)).localeCompare(first(layerIdsOf(right))) ||
    first(elementIdsOf(left)).localeCompare(first(elementIdsOf(right))) ||
    first(referencedIdsOf(left)).localeCompare(first(referencedIdsOf(right))) ||
    left.reasonCode.localeCompare(right.reasonCode) ||
    left.findingId.localeCompare(right.findingId)
  );
}

function chainComparators(
  ...comparators: readonly ((
    left: StructuralFinding,
    right: StructuralFinding,
  ) => number)[]
) {
  return (left: StructuralFinding, right: StructuralFinding): number => {
    for (const comparator of comparators) {
      const result = comparator(left, right);
      if (result !== 0) {
        return result;
      }
    }
    return 0;
  };
}

function satisfiesCoverageRequirement(
  analysis: StructuralAnalysisResult,
  requirement: StructuralCoverageRequirement,
): { readonly ok: true } | { readonly ok: false } {
  if (analysis.completeness === "stale") {
    return { ok: false };
  }
  switch (requirement) {
    case "any":
      return { ok: true };
    case "non-stale":
      return { ok: true };
    case "complete-target-scopes":
      return analysis.completeness === "complete-document" ||
        analysis.completeness === "complete-target-scopes"
        ? { ok: true }
        : { ok: false };
    case "complete-document":
      return analysis.completeness === "complete-document"
        ? { ok: true }
        : { ok: false };
  }
}

function baseResult(
  analysis: StructuralAnalysisResult,
  kind: StructuralQueryKind | undefined,
  ordering: StructuralQueryOrder,
  queryDiagnostics: readonly StructuralQueryDiagnostic[],
): StructuralAnalysisQueryResult {
  return {
    queryVersion: STRUCTURAL_QUERY_VERSION,
    analysisVersion: analysis.analysisVersion,
    documentId: analysis.documentId,
    revisionEvidence: cloneJsonCompatible(analysis.revisionEvidence),
    ...(kind ? { kind } : {}),
    outcome: "ok",
    results: [],
    totalMatched: 0,
    returned: 0,
    offset: 0,
    limit: 0,
    hasMore: false,
    ordering,
    coverage: cloneJsonCompatible(analysis.coverage),
    completeness: analysis.completeness,
    analysisDiagnostics: analysis.diagnostics.map((diagnostic) =>
      cloneJsonCompatible(diagnostic),
    ),
    limitations: [...analysis.limitations],
    queryDiagnostics: queryDiagnostics.map((diagnostic) =>
      cloneJsonCompatible(diagnostic),
    ),
    ...(analysis.stopReason ? { stopReason: analysis.stopReason } : {}),
  };
}

function invalidResult(
  analysis: StructuralAnalysisResult,
  kind: StructuralQueryKind | undefined,
  outcome: "invalid-query" | "validation-failed",
  diagnostics: StructuralQueryDiagnostic[],
): StructuralAnalysisQueryResult {
  if (diagnostics.length === 0) {
    diagnostics.push({ code: "invalid-query", severity: "error" });
  }
  return {
    ...baseResult(analysis, kind, "canonical", diagnostics),
    outcome,
  };
}

function countBasisForCompleteness(
  completeness: StructuralCompleteness,
): StructuralCountBasis {
  switch (completeness) {
    case "complete-document":
      return "exact";
    case "complete-target-scopes":
      return "observed";
    case "partial":
    case "truncated":
      return "partial";
    case "stale":
    case "unknown":
      return "unknown";
  }
}

function safeRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  const keys = Object.keys(value);
  return !keys.some(
    (key) =>
      key === "__proto__" || key === "constructor" || key === "prototype",
  );
}

function validIdentifier(
  value: string,
  limits: StructuralQueryLimits,
): boolean {
  return value.length > 0 && value.length <= limits.maxIdentifierLength;
}

function compact(values: readonly (string | undefined)[]): readonly string[] {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ].sort();
}

function first(values: readonly string[]): string {
  return values[0] ?? "";
}

function paginationEnd(offset: number, limit: number): number {
  if (limit === 0) {
    return offset;
  }
  const remaining = Number.MAX_SAFE_INTEGER - offset;
  return remaining < limit ? Number.MAX_SAFE_INTEGER : offset + limit;
}

function hasMore(offset: number, limit: number, totalMatched: number): boolean {
  if (offset >= totalMatched) {
    return false;
  }
  if (limit === 0) {
    return true;
  }
  return limit < totalMatched - offset;
}

function cloneJsonCompatible<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
