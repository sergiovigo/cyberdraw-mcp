import { z } from "zod";

import {
  executeHierarchicalSnapshotPlan,
  inventoryFromRuntimeSnapshot,
  type HierarchicalSnapshotExecutionOptions,
} from "../cyberdraw-hierarchical-snapshot.js";
import { requestCyberdrawRuntimeSnapshotMeasured } from "../cyberdraw-runtime-snapshot.js";
import type { Context } from "../types.js";
import type { ToolRegistrar } from "./types.js";
import {
  detectCyberdrawContractVersion,
  queryStructuralAnalysis,
  validateCyberdrawPublicRequest,
  type DiagramInventory,
  type InventoryPage,
  type StructuralFindingConfidence,
  type StructuralSummaryGroupBy,
} from "cyberdraw-graph-model";
import type {
  CyberdrawM14ReasonCode,
  CyberdrawNormalizedRequest,
  CyberdrawNormalizedScope,
  CyberdrawPublicRequestRejected,
  CyberdrawRequestedScope,
  CyberdrawValidationIssue,
  StructuralAnalysisDiagnostic,
  StructuralAnalysisQuery,
  StructuralAnalysisQueryResult,
  StructuralChangePlan,
  StructuralChangePlanPolicy,
  StructuralChangePlanValidationMode,
  StructuralChangePlanValidationResult,
  StructuralFinding,
  StructuralFindingClassification,
  StructuralFindingType,
  StructuralProposalType,
  StructuralQueryOrder,
  StructuralChangeProposal,
  StructuralAnalysisCoverage,
  SnapshotPlanExecutionResult,
  HierarchicalSnapshotIntent,
} from "cyberdraw-graph-model";
import type { RuntimeSnapshot } from "cyberdraw-runtime-contract";

export const TOOL_cyberdraw_analyze_structure = "cyberdraw_analyze_structure";

const PUBLIC_RESPONSE_VERSION = "m13-v1";
const DEFAULT_QUERY_LIMIT = 100;
const DEFAULT_MAX_SCOPES = 4;
const DEFAULT_MAX_DEPTH = 2;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const HARD_MAX_QUERY_LIMIT = 500;
const HARD_MAX_IDS = 50;
const HARD_MAX_FINDINGS = 200;
const HARD_MAX_PROPOSALS = 200;
const HARD_MAX_DIAGNOSTICS = 100;
const HARD_MAX_IDENTIFIER_LENGTH = 512;
const HARD_MAX_SCOPES = 8;
const HARD_MAX_DEPTH = 4;
const HARD_MAX_BYTES = 4 * 1024 * 1024;
const HARD_MAX_RESPONSE_BYTES = 512 * 1024;
const DEFAULT_TIMEOUT_MS = 90_000;
const HARD_MAX_INPUT_DEPTH = 8;
const M14_PUBLIC_RESPONSE_VERSION = "m14-v1";

const publicModes = ["analyze", "query", "plan", "validate"] as const;
const findingTypes = [
  "broken-reference",
  "cross-layer-edge",
  "orphan-element",
] as const satisfies readonly StructuralFindingType[];
const classifications = [
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
] as const satisfies readonly StructuralFindingClassification[];
const confidences = ["confirmed", "contextual", "incomplete"] as const;
const orders = [
  "canonical",
  "finding-type",
  "page-layer",
  "finding-id",
] as const satisfies readonly StructuralQueryOrder[];
const policies = [
  "conservative",
  "review-only",
  "allow-detach-broken-terminal",
  "allow-delete-confirmed-orphan",
] as const;
const validationModes = [
  "integrity-only",
  "analysis-correlated",
  "full-internal",
] as const satisfies readonly StructuralChangePlanValidationMode[];

const Identifier = z
  .string()
  .min(1)
  .max(HARD_MAX_IDENTIFIER_LENGTH)
  .refine((value) => !looksLikeXml(value), {
    message: "XML-like identifiers are not accepted",
  })
  .refine((value) => !looksLikeUrl(value), {
    message: "URL-like identifiers are not accepted",
  })
  .refine((value) => !looksLikeFilesystemPath(value), {
    message: "Filesystem-path-like identifiers are not accepted",
  });

const IdArray = z
  .array(Identifier)
  .max(HARD_MAX_IDS)
  .transform((values) => [...new Set(values)].sort());

const PublicInputSchema = z
  .strictObject({
    mode: z.enum(publicModes).optional().default("analyze"),
    scope: z
      .strictObject({
        pageId: Identifier.optional(),
        layerId: Identifier.optional(),
      })
      .optional(),
    expansion: z
      .strictObject({
        enabled: z.boolean().optional().default(true),
        maxScopes: z
          .number()
          .int()
          .nonnegative()
          .max(HARD_MAX_SCOPES)
          .optional()
          .default(DEFAULT_MAX_SCOPES),
        maxDepth: z
          .number()
          .int()
          .nonnegative()
          .max(HARD_MAX_DEPTH)
          .optional()
          .default(DEFAULT_MAX_DEPTH),
        maxBytes: z
          .number()
          .int()
          .positive()
          .safe()
          .max(HARD_MAX_BYTES)
          .optional()
          .default(DEFAULT_MAX_BYTES),
      })
      .optional()
      .default({
        enabled: true,
        maxScopes: DEFAULT_MAX_SCOPES,
        maxDepth: DEFAULT_MAX_DEPTH,
        maxBytes: DEFAULT_MAX_BYTES,
      }),
    query: z
      .strictObject({
        findingTypes: z
          .array(z.enum(findingTypes))
          .max(HARD_MAX_IDS)
          .optional(),
        classifications: z
          .array(z.enum(classifications))
          .max(HARD_MAX_IDS)
          .optional(),
        confidences: z.array(z.enum(confidences)).max(HARD_MAX_IDS).optional(),
        pageIds: IdArray.optional(),
        layerIds: IdArray.optional(),
        findingIds: IdArray.optional(),
        order: z.enum(orders).optional().default("canonical"),
        offset: z.number().int().nonnegative().safe().optional().default(0),
        limit: z
          .number()
          .int()
          .nonnegative()
          .safe()
          .max(HARD_MAX_QUERY_LIMIT)
          .optional()
          .default(DEFAULT_QUERY_LIMIT),
      })
      .optional(),
    planning: z
      .strictObject({
        policy: z.enum(policies).optional().default("conservative"),
        selectedFindingIds: IdArray.optional(),
      })
      .optional(),
    validation: z
      .strictObject({
        mode: z.enum(validationModes).optional().default("full-internal"),
      })
      .optional(),
    response: z
      .strictObject({
        includeFindings: z.boolean().optional().default(true),
        includeSummary: z.boolean().optional().default(true),
        includePlan: z.boolean().optional().default(true),
        includeValidation: z.boolean().optional().default(true),
        includeDiagnostics: z.boolean().optional().default(false),
      })
      .optional()
      .default({
        includeFindings: true,
        includeSummary: true,
        includePlan: true,
        includeValidation: true,
        includeDiagnostics: false,
      }),
  })
  .superRefine((value, ctx) => {
    if (value.scope?.layerId && !value.scope.pageId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scope", "pageId"],
        message: "`scope.pageId` is required when `scope.layerId` is provided",
      });
    }
    if (value.mode === "analyze" && value.query) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["query"],
        message: "`query` is only valid in query, plan or validate mode",
      });
    }
    if (
      (value.mode === "analyze" || value.mode === "query") &&
      value.planning
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["planning"],
        message: "`planning` is only valid in plan or validate mode",
      });
    }
    if (value.mode !== "validate" && value.validation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["validation"],
        message: "`validation` is only valid in validate mode",
      });
    }
    if (
      value.planning?.selectedFindingIds &&
      value.query?.findingIds &&
      value.planning.selectedFindingIds.length > 0 &&
      value.query.findingIds.length > 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["planning", "selectedFindingIds"],
        message:
          "`planning.selectedFindingIds` and `query.findingIds` cannot both select findings",
      });
    }
  });

export type CyberdrawAnalyzeStructureInput = z.output<typeof PublicInputSchema>;

const PublicToolInputSchema = {
  mode: z.unknown().optional(),
  scope: z.unknown().optional(),
  expansion: z.unknown().optional(),
  query: z.unknown().optional(),
  coverageRequirements: z.unknown().optional(),
  limits: z.unknown().optional(),
  planning: z.unknown().optional(),
  validation: z.unknown().optional(),
  response: z.unknown().optional(),
};

export type PublicOutcome =
  | "ok"
  | "ok-with-limitations"
  | "manual-review-required"
  | "insufficient-coverage"
  | "stale"
  | "conflict"
  | "invalid-request"
  | "analysis-failed"
  | "planning-blocked"
  | "validation-failed"
  | "resource-limit-exceeded"
  | "runtime-unavailable";

export type PublicStructuralResponse = {
  readonly version: typeof PUBLIC_RESPONSE_VERSION;
  readonly mode: CyberdrawAnalyzeStructureInput["mode"];
  readonly outcome: PublicOutcome;
  readonly scope: {
    readonly requested: {
      readonly pageId?: string;
      readonly layerId?: string;
      readonly defaulted: boolean;
    };
    readonly inspected: {
      readonly document: boolean;
      readonly pageIds: readonly string[];
      readonly layerTargets: readonly {
        readonly pageId: string;
        readonly layerIds: readonly string[];
      }[];
    };
    readonly expanded: boolean;
    readonly documentScopeUsed: boolean;
  };
  readonly coverage: PublicCoverage;
  readonly revision: {
    readonly documentId?: string;
    readonly compatible: boolean;
    readonly contentRevisionCount: number;
    readonly documentRevisionCount: number;
  };
  readonly summary?: PublicSummary;
  readonly findings?: readonly PublicStructuralFinding[];
  readonly query?: PublicQueryMetadata;
  readonly plan?: PublicStructuralPlan;
  readonly validation?: PublicPlanValidation;
  readonly diagnostics?: readonly PublicDiagnostic[];
  readonly limitations: readonly PublicLimitation[];
  readonly safety: {
    readonly readOnly: true;
    readonly mutationAttempted: false;
    readonly mutationInvocations: 0;
  };
};

type PublicCoverage = {
  readonly document: boolean;
  readonly pageIds: readonly string[];
  readonly layerTargets: readonly {
    readonly pageId: string;
    readonly layerIds: readonly string[];
  }[];
  readonly conclusive: boolean;
  readonly truncated: boolean;
  readonly stale: boolean;
  readonly completeness: string;
};

type PublicSummary = {
  readonly findings: number;
  readonly brokenReferences: number;
  readonly crossLayerEdges: number;
  readonly confirmedOrphans: number;
  readonly proposals: number;
  readonly conflicts: number;
  readonly manualReview: number;
};

export type PublicStructuralFinding = {
  readonly findingId: string;
  readonly type: StructuralFindingType;
  readonly classification: string;
  readonly pageId?: string;
  readonly layerId?: string;
  readonly elementId?: string;
  readonly edgeId?: string;
  readonly terminal?: "source" | "target";
  readonly referencedElementId?: string;
  readonly reasonCode: string;
  readonly confidence: string;
  readonly reviewRequired: boolean;
};

type PublicQueryMetadata = {
  readonly outcome: string;
  readonly totalMatched: number;
  readonly returned: number;
  readonly offset: number;
  readonly limit: number;
  readonly hasMore: boolean;
  readonly ordering: string;
  readonly truncated: boolean;
};

type PublicStructuralPlan = {
  readonly planId: string;
  readonly outcome: string;
  readonly executable: false;
  readonly selectedFindingCount: number;
  readonly proposalCount: number;
  readonly conflictCount: number;
  readonly manualReviewCount: number;
  readonly proposals: readonly PublicStructuralProposal[];
  readonly conflicts: readonly {
    readonly conflictId: string;
    readonly proposalIds: readonly string[];
    readonly conflictType: string;
    readonly rationaleCode: string;
  }[];
};

type PublicStructuralProposal = {
  readonly proposalId: string;
  readonly proposalType: StructuralProposalType;
  readonly operationType: string;
  readonly findingIds: readonly string[];
  readonly target: {
    readonly pageId?: string;
    readonly layerId?: string;
    readonly elementId?: string;
    readonly edgeId?: string;
    readonly terminal?: "source" | "target";
    readonly referencedElementId?: string;
  };
  readonly rationaleCode: string;
  readonly reviewRequired: boolean;
  readonly destructive: boolean;
  readonly reversibleEstimate: "likely" | "uncertain" | "not-reversible";
  readonly preconditions: readonly string[];
  readonly limitations: readonly string[];
  readonly executable: false;
};

type PublicPlanValidation = {
  readonly validationId: string;
  readonly outcome: string;
  readonly planIntegrity: string;
  readonly revisionStatus: string;
  readonly coverageStatus: string;
  readonly failedPreconditionCount: number;
  readonly conflictCount: number;
  readonly proposalStatusSummary: {
    readonly valid: number;
    readonly validWithReview: number;
    readonly invalid: number;
    readonly stale: number;
    readonly tampered: number;
  };
  readonly limitationCodes: readonly string[];
  readonly manualReviewRequired: boolean;
};

type PublicDiagnostic = {
  readonly code: string;
  readonly severity: "debug" | "info" | "warn" | "error";
  readonly pageId?: string;
  readonly layerId?: string;
  readonly elementId?: string;
};

type PublicLimitation = {
  readonly code: string;
};

export type PublicM14StructuralResponse = {
  readonly version: typeof M14_PUBLIC_RESPONSE_VERSION;
  readonly mode: CyberdrawNormalizedRequest["mode"];
  readonly operation: CyberdrawNormalizedRequest["operation"];
  readonly outcome: "accepted" | "partial" | "rejected";
  readonly requestedScope: PublicM14RequestedScope;
  readonly executedScope: PublicM14ExecutedScope;
  readonly coverage: PublicM14Coverage;
  readonly limitations: readonly PublicLimitation[];
  readonly summary?: PublicSummary;
  readonly results?: PublicM14Results;
  readonly plan?: PublicStructuralPlan;
  readonly validation?: PublicPlanValidation;
  readonly revision?: PublicStructuralResponse["revision"];
  readonly safety: PublicStructuralResponse["safety"];
};

type PublicM14RequestedScope = {
  readonly defaulted: boolean;
  readonly scopeType: "default" | "page" | "layer" | "mixed" | "document";
  readonly pageIds: readonly string[];
  readonly layerTargets: readonly {
    readonly pageId: string;
    readonly layerIds: readonly string[];
  }[];
  readonly rejectedReason?: CyberdrawM14ReasonCode;
};

type PublicM14ExecutedScope = {
  readonly executed: boolean;
  readonly document: false;
  readonly pageIds: readonly string[];
  readonly layerTargets: readonly {
    readonly pageId: string;
    readonly layerIds: readonly string[];
  }[];
};

type PublicM14Coverage = {
  readonly conclusive: boolean;
  readonly truncated: boolean;
  readonly stale: boolean;
  readonly completeTargetScopes: boolean;
  readonly completeness:
    | "complete-target-scopes"
    | "partial"
    | "truncated"
    | "stale"
    | "unknown";
  readonly completeDocument: "unsupported";
};

type PublicM14Results =
  | {
      readonly kind: "findings";
      readonly findings: readonly PublicStructuralFinding[];
      readonly totalMatched: number;
      readonly returned: number;
      readonly hasMore: boolean;
    }
  | {
      readonly kind: "count";
      readonly totalFindings: number;
      readonly findingsByType: Record<string, number>;
      readonly findingsByClassification: Record<string, number>;
      readonly findingsByConfidence: Record<
        StructuralFindingConfidence,
        number
      >;
      readonly scopesInspected: {
        readonly pages: number;
        readonly layerTargets: number;
      };
      readonly proposals: number;
      readonly validationIssues: number;
    }
  | {
      readonly kind: "summary";
      readonly groupBy: StructuralSummaryGroupBy;
      readonly buckets: readonly {
        readonly key: string;
        readonly count: number;
      }[];
      readonly totalMatched: number;
      readonly returned: number;
    };

type InstrumentationCounters = {
  plannerInvocations: number;
  snapshotRequests: number;
  mergeInvocations: number;
  graphBuildInvocations: number;
  structuralAnalysisInvocations: number;
  structuralQueryInvocations: number;
  structuralPlanInvocations: number;
  structuralValidationInvocations: number;
  mutationInvocations: number;
};

export const registerCyberdrawAnalyzeStructureTool: ToolRegistrar = (
  server,
  context,
) => {
  server.tool(
    TOOL_cyberdraw_analyze_structure,
    "Read-only CyberDraw structural analysis of the currently open diagram. Runs bounded internal snapshot, analysis, query, planning and validation flows without modifying draw.io.",
    PublicToolInputSchema,
    async (rawArgs) => {
      try {
        const response = await analyzeStructurePublic(context, rawArgs);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(response),
            },
          ],
        };
      } catch (error) {
        throw new Error(publicErrorMessage(error));
      }
    },
  );
};

export function analyzeStructurePublic(
  context: Context,
  input: CyberdrawAnalyzeStructureInput,
): Promise<PublicStructuralResponse>;
export function analyzeStructurePublic(
  context: Context,
  input: unknown,
): Promise<PublicStructuralResponse | PublicM14StructuralResponse>;
export async function analyzeStructurePublic(
  context: Context,
  input: unknown,
): Promise<PublicStructuralResponse | PublicM14StructuralResponse> {
  assertSafePublicInputShape(input);
  const detectedVersion = detectCyberdrawContractVersion(input);
  const validation = validateCyberdrawPublicRequest(input, {
    maxPages: HARD_MAX_SCOPES,
    maxLayers: HARD_MAX_SCOPES,
    maxFindings: HARD_MAX_FINDINGS,
    maxProposals: HARD_MAX_PROPOSALS,
    maxExpansionSteps: HARD_MAX_SCOPES,
    maxExecutionTime: DEFAULT_TIMEOUT_MS,
  });
  if (!validation.ok) {
    if (
      validation.version === "m14-v1" ||
      validation.issues.some(
        (issue) => issue.reasonCode === "unsupported-query-operation",
      )
    ) {
      return m14RejectedResponse(input, validation);
    }
    throw new Error(publicValidationErrorMessage(detectedVersion, validation));
  }
  if (validation.version === "m14-v1") {
    return analyzeStructurePublicM14(context, input, validation.request);
  }
  return analyzeStructurePublicM13(
    context,
    parseCyberdrawAnalyzeStructureInput(input),
  );
}

async function analyzeStructurePublicM13(
  context: Context,
  input: CyberdrawAnalyzeStructureInput,
): Promise<PublicStructuralResponse> {
  const counters = createInstrumentationCounters();
  counters.plannerInvocations += 1;
  const resolved = await resolvePublicAnalysisIntent(context, input);
  const execution = await executeHierarchicalSnapshotPlan(
    context,
    resolved.intent,
    executionOptionsFor(input, counters, resolved.inventorySnapshot),
  );
  assertNoMutationInvocations(counters);
  const response = mapExecutionToPublicResponse(input, execution, counters);
  context.log.debug(
    `[cyberdraw_analyze_structure] completed mode=${input.mode} plannerInvocations=${counters.plannerInvocations} snapshotRequests=${counters.snapshotRequests} structuralAnalysisInvocations=${counters.structuralAnalysisInvocations} mutationInvocations=${counters.mutationInvocations} documentScopeUsed=${response.scope.documentScopeUsed} inspectedDocument=${response.scope.inspected.document}`,
  );
  return enforceResponseLimit(response);
}

async function analyzeStructurePublicM14(
  context: Context,
  rawInput: unknown,
  normalized: CyberdrawNormalizedRequest,
): Promise<PublicM14StructuralResponse> {
  const counters = createInstrumentationCounters();
  const resolution = await resolveM14AnalysisIntent(context, normalized);
  if (!resolution.ok) {
    return m14RejectedResponse(
      rawInput,
      {
        ok: false,
        version: "m14-v1",
        issues: [
          {
            path: resolution.path,
            message: resolution.reason,
            reasonCode: resolution.reason,
          },
        ],
      },
      resolution.snapshot
        ? revisionFromSnapshot(resolution.snapshot)
        : undefined,
    );
  }
  counters.plannerInvocations += 1;
  const execution = await executeHierarchicalSnapshotPlan(
    context,
    resolution.intent,
    executionOptionsForM14(rawInput, normalized, counters, resolution.snapshot),
  );
  assertNoMutationInvocations(counters);
  const response = mapExecutionToM14PublicResponse(
    rawInput,
    normalized,
    execution,
  );
  context.log.debug(
    `[cyberdraw_analyze_structure] completed version=m14-v1 mode=${normalized.mode} operation=${normalized.operation} plannerInvocations=${counters.plannerInvocations} snapshotRequests=${counters.snapshotRequests} structuralAnalysisInvocations=${counters.structuralAnalysisInvocations} mutationInvocations=${counters.mutationInvocations}`,
  );
  return enforceM14ResponseLimit(response);
}

export function parseCyberdrawAnalyzeStructureInput(
  value: unknown,
): CyberdrawAnalyzeStructureInput {
  assertSafePublicInputShape(value);
  return PublicInputSchema.parse(value);
}

export function assertNoMutationInvocations(value: {
  readonly mutationInvocations: number;
}): void {
  if (value.mutationInvocations !== 0) {
    throw new Error("read-only invariant violated: mutation was attempted");
  }
}

async function resolvePublicAnalysisIntent(
  context: Context,
  input: CyberdrawAnalyzeStructureInput,
): Promise<{
  readonly intent: HierarchicalSnapshotIntent;
  readonly inventorySnapshot?: RuntimeSnapshot;
}> {
  if (!isDefaultScope(input)) {
    return { intent: intentFor(input) };
  }
  const inventorySnapshot = await requestCyberdrawRuntimeSnapshotMeasured(
    context,
    {
      scope: { kind: "selection" },
      limits: {
        hardSnapshotBytes: input.expansion.maxBytes,
      },
    },
    { replyTimeoutMs: DEFAULT_TIMEOUT_MS },
  ).then((result) => result.snapshot);
  const inventory = inventoryFromRuntimeSnapshot(inventorySnapshot);
  const page = resolveDefaultPage(inventory);
  if (!page) {
    throw new Error("default scope could not resolve the active Draw.io page");
  }
  const layer = resolveDefaultLayer(page);
  if (layer) {
    return {
      intent: {
        kind: "analyze-structure",
        layers: [{ pageId: page.id, layerIds: [layer.id] }],
      },
      inventorySnapshot,
    };
  }
  return {
    intent: { kind: "analyze-structure", pageIds: [page.id] },
    inventorySnapshot,
  };
}

function isDefaultScope(input: CyberdrawAnalyzeStructureInput): boolean {
  return !input.scope?.pageId && !input.scope?.layerId;
}

function resolveDefaultPage(
  inventory: ReturnType<typeof inventoryFromRuntimeSnapshot>,
) {
  const activePageId =
    inventory.activePageId ?? inventory.pages.find((page) => page.active)?.id;
  if (!activePageId) {
    return undefined;
  }
  const matches = inventory.pages.filter((page) => page.id === activePageId);
  return matches.length === 1 ? matches[0] : undefined;
}

function resolveDefaultLayer(
  page: ReturnType<typeof inventoryFromRuntimeSnapshot>["pages"][number],
) {
  const visibleLayers = page.layers
    .filter((layer) => layer.visible === true)
    .sort(
      (left, right) =>
        left.order - right.order || left.id.localeCompare(right.id),
    );
  return visibleLayers[0];
}

function intentFor(
  input: CyberdrawAnalyzeStructureInput,
): HierarchicalSnapshotIntent {
  if (input.scope?.layerId) {
    return {
      kind: "analyze-structure" as const,
      layers: [
        { pageId: input.scope.pageId!, layerIds: [input.scope.layerId] },
      ],
    };
  }
  if (input.scope?.pageId) {
    return {
      kind: "analyze-structure" as const,
      pageIds: [input.scope.pageId],
    };
  }
  return { kind: "analyze-structure" as const };
}

async function resolveM14AnalysisIntent(
  context: Context,
  request: CyberdrawNormalizedRequest,
): Promise<
  | {
      readonly ok: true;
      readonly intent: HierarchicalSnapshotIntent;
      readonly snapshot: RuntimeSnapshot;
    }
  | {
      readonly ok: false;
      readonly reason: CyberdrawM14ReasonCode;
      readonly path: readonly (string | number)[];
      readonly snapshot?: RuntimeSnapshot;
    }
> {
  let snapshot: RuntimeSnapshot;
  try {
    snapshot = await requestCyberdrawRuntimeSnapshotMeasured(
      context,
      {
        scope: { kind: "selection" },
        limits: { hardSnapshotBytes: expansionControls({}).maxBytes },
      },
      { replyTimeoutMs: DEFAULT_TIMEOUT_MS },
    ).then((result) => result.snapshot);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Multiple Draw.io documents")
    ) {
      return {
        ok: false,
        reason: "ambiguous-document",
        path: ["target_document"],
      };
    }
    throw error;
  }
  const inventory = inventoryFromRuntimeSnapshot(snapshot);
  const resolved = resolveM14ExecutableScope(
    request.normalizedScope,
    inventory,
    snapshot,
  );
  if (!resolved.ok) {
    return resolved;
  }
  return {
    ok: true,
    intent: intentForM14Scope(resolved.scope),
    snapshot,
  };
}

function resolveM14ExecutableScope(
  scope: CyberdrawNormalizedScope,
  inventory: DiagramInventory,
  snapshot: RuntimeSnapshot,
):
  | { readonly ok: true; readonly scope: CyberdrawNormalizedScope }
  | {
      readonly ok: false;
      readonly reason: CyberdrawM14ReasonCode;
      readonly path: readonly (string | number)[];
      readonly snapshot?: RuntimeSnapshot;
    } {
  if (scope.kind === "default") {
    const page = resolveDefaultPage(inventory);
    if (!page) {
      return {
        ok: false,
        reason: "active-page-unavailable",
        path: ["scope"],
        snapshot,
      };
    }
    const layer = resolveDefaultLayer(page);
    return {
      ok: true,
      scope: layer
        ? {
            kind: "layer",
            layerTargets: [{ pageId: page.id, layerIds: [layer.id] }],
          }
        : { kind: "page", pageTargets: [{ pageId: page.id }] },
    };
  }

  const pagesById = new Map(inventory.pages.map((page) => [page.id, page]));
  const pageTargets =
    scope.kind === "page" || scope.kind === "mixed" ? scope.pageTargets : [];
  for (const target of pageTargets) {
    if (!pagesById.has(target.pageId)) {
      return {
        ok: false,
        reason: "page-not-found",
        path: ["scope", "pageIds"],
        snapshot,
      };
    }
  }
  const layerTargets =
    scope.kind === "layer" || scope.kind === "mixed" ? scope.layerTargets : [];
  for (const target of layerTargets) {
    const page = pagesById.get(target.pageId);
    if (!page) {
      return {
        ok: false,
        reason: "page-not-found",
        path: ["scope", "layerTargets"],
        snapshot,
      };
    }
    const layerIds = new Set(page.layers.map((layer) => layer.id));
    if (target.layerIds.some((layerId) => !layerIds.has(layerId))) {
      return {
        ok: false,
        reason: "layer-not-found",
        path: ["scope", "layerTargets"],
        snapshot,
      };
    }
  }
  return { ok: true, scope };
}

function intentForM14Scope(
  scope: CyberdrawNormalizedScope,
): HierarchicalSnapshotIntent {
  if (scope.kind === "page") {
    return {
      kind: "analyze-structure",
      pageIds: scope.pageTargets.map((target) => target.pageId),
    };
  }
  if (scope.kind === "layer") {
    return { kind: "analyze-structure", layers: scope.layerTargets };
  }
  if (scope.kind === "mixed") {
    return {
      kind: "analyze-structure",
      pageIds: scope.pageTargets.map((target) => target.pageId),
      layers: scope.layerTargets,
    };
  }
  return { kind: "analyze-structure" };
}

function executionOptionsFor(
  input: CyberdrawAnalyzeStructureInput,
  counters: InstrumentationCounters,
  inventorySnapshot?: RuntimeSnapshot,
): HierarchicalSnapshotExecutionOptions {
  const query = queryFor(input);
  const policy = policyFor(input.planning?.policy ?? "conservative");
  return {
    limits: {
      maxPlanSteps: input.expansion.enabled ? input.expansion.maxScopes : 1,
      maxExpansionDepth: input.expansion.enabled ? input.expansion.maxDepth : 0,
      hardSnapshotBytes: input.expansion.maxBytes,
      executionTimeoutMs: DEFAULT_TIMEOUT_MS,
    },
    runtimeLimits: {
      hardSnapshotBytes: input.expansion.maxBytes,
    },
    ...(inventorySnapshot ? { inventorySnapshot } : {}),
    replyTimeoutMs: DEFAULT_TIMEOUT_MS,
    ...(query ? { structuralQuery: query } : {}),
    ...(input.mode === "plan" || input.mode === "validate"
      ? {
          structuralChangePlan: {
            ...(input.planning?.selectedFindingIds
              ? { selectedFindingIds: input.planning.selectedFindingIds }
              : query
                ? { useStructuralQueryResult: true }
                : {}),
            policy,
            limits: {
              maxSelectedFindings: HARD_MAX_FINDINGS,
              maxProposals: HARD_MAX_PROPOSALS,
              maxConflicts: HARD_MAX_PROPOSALS,
              maxIdentifierLength: HARD_MAX_IDENTIFIER_LENGTH,
              maxDiagnostics: HARD_MAX_DIAGNOSTICS,
            },
          },
        }
      : {}),
    ...(input.mode === "validate"
      ? {
          structuralChangePlanValidation: {
            mode: input.validation?.mode ?? "full-internal",
            policy,
            limits: {
              maxProposals: HARD_MAX_PROPOSALS,
              maxConflicts: HARD_MAX_PROPOSALS,
              maxDiagnostics: HARD_MAX_DIAGNOSTICS,
              maxIdentifierLength: HARD_MAX_IDENTIFIER_LENGTH,
            },
          },
        }
      : {}),
    instrumentation: {
      onSnapshotRequest: () => {
        counters.snapshotRequests += 1;
      },
      onMerge: () => {
        counters.mergeInvocations += 1;
      },
      onGraphBuild: () => {
        counters.graphBuildInvocations += 1;
      },
      onStructuralAnalysis: () => {
        counters.structuralAnalysisInvocations += 1;
      },
      onStructuralQuery: () => {
        counters.structuralQueryInvocations += 1;
      },
      onStructuralPlan: () => {
        counters.structuralPlanInvocations += 1;
      },
      onStructuralValidation: () => {
        counters.structuralValidationInvocations += 1;
      },
      onMutation: () => {
        counters.mutationInvocations += 1;
      },
    },
  };
}

function executionOptionsForM14(
  rawInput: unknown,
  request: CyberdrawNormalizedRequest,
  counters: InstrumentationCounters,
  inventorySnapshot: RuntimeSnapshot,
): HierarchicalSnapshotExecutionOptions {
  const expansion = expansionControls(rawInput);
  const requestedLimits = request.limits;
  const query = queryForM14(rawInput, request);
  const policy = policyFor(planningPolicy(rawInput));
  const selectedFindingIds = planningSelectedFindingIds(rawInput);
  const maxFindings = clampRequestedLimit(
    requestedLimits?.maxFindings,
    HARD_MAX_FINDINGS,
  );
  const maxProposals = clampRequestedLimit(
    requestedLimits?.maxProposals,
    HARD_MAX_PROPOSALS,
  );
  const maxExpansionSteps = clampRequestedLimit(
    requestedLimits?.maxExpansionSteps,
    expansion.enabled ? expansion.maxScopes : 1,
  );
  const maxExecutionTime = clampRequestedLimit(
    requestedLimits?.maxExecutionTime,
    DEFAULT_TIMEOUT_MS,
  );
  return {
    limits: {
      maxPlanSteps: expansion.enabled ? maxExpansionSteps : 1,
      maxExpansionDepth: expansion.enabled ? expansion.maxDepth : 0,
      hardSnapshotBytes: expansion.maxBytes,
      executionTimeoutMs: maxExecutionTime,
    },
    runtimeLimits: {
      hardSnapshotBytes: expansion.maxBytes,
    },
    inventorySnapshot,
    replyTimeoutMs: maxExecutionTime,
    ...(query ? { structuralQuery: query } : {}),
    ...(query
      ? {
          structuralQueryLimits: {
            defaultLimit: Math.min(DEFAULT_QUERY_LIMIT, maxFindings),
            maxLimit: maxFindings,
            maxFilterValues: HARD_MAX_IDS,
            maxGroupBuckets: Math.min(HARD_MAX_IDS, maxFindings),
            maxIdentifierLength: HARD_MAX_IDENTIFIER_LENGTH,
          },
        }
      : {}),
    ...(request.mode === "plan" || request.mode === "validate"
      ? {
          structuralChangePlan: {
            ...(selectedFindingIds.length > 0
              ? { selectedFindingIds }
              : query
                ? { useStructuralQueryResult: true }
                : {}),
            policy,
            limits: {
              maxSelectedFindings: maxFindings,
              maxProposals,
              maxConflicts: maxProposals,
              maxIdentifierLength: HARD_MAX_IDENTIFIER_LENGTH,
              maxDiagnostics: HARD_MAX_DIAGNOSTICS,
            },
          },
        }
      : {}),
    ...(request.mode === "validate"
      ? {
          structuralChangePlanValidation: {
            mode: validationMode(rawInput),
            policy,
            limits: {
              maxProposals,
              maxConflicts: maxProposals,
              maxDiagnostics: HARD_MAX_DIAGNOSTICS,
              maxIdentifierLength: HARD_MAX_IDENTIFIER_LENGTH,
            },
          },
        }
      : {}),
    instrumentation: {
      onSnapshotRequest: () => {
        counters.snapshotRequests += 1;
      },
      onMerge: () => {
        counters.mergeInvocations += 1;
      },
      onGraphBuild: () => {
        counters.graphBuildInvocations += 1;
      },
      onStructuralAnalysis: () => {
        counters.structuralAnalysisInvocations += 1;
      },
      onStructuralQuery: () => {
        counters.structuralQueryInvocations += 1;
      },
      onStructuralPlan: () => {
        counters.structuralPlanInvocations += 1;
      },
      onStructuralValidation: () => {
        counters.structuralValidationInvocations += 1;
      },
      onMutation: () => {
        counters.mutationInvocations += 1;
      },
    },
  };
}

function clampRequestedLimit(
  requested: number | undefined,
  maximum: number,
): number {
  return Math.min(requested ?? maximum, maximum);
}

function queryFor(
  input: CyberdrawAnalyzeStructureInput,
): StructuralAnalysisQuery | undefined {
  if (input.mode === "analyze") {
    return undefined;
  }
  const query = input.query;
  if (query?.findingIds?.length === 1 && input.mode === "query") {
    return {
      kind: "get-finding",
      findingId: query.findingIds[0]!,
      coverageRequirement: "any",
    };
  }
  return {
    kind: "list-findings",
    filters: {
      ...(query?.findingTypes ? { findingTypes: query.findingTypes } : {}),
      ...(query?.classifications
        ? { classifications: query.classifications }
        : {}),
      ...(query?.confidences ? { confidences: query.confidences } : {}),
      ...(query?.pageIds ? { pageIds: query.pageIds } : {}),
      ...(query?.layerIds ? { layerIds: query.layerIds } : {}),
    },
    order: query?.order ?? "canonical",
    offset: query?.offset ?? 0,
    limit: query?.limit ?? DEFAULT_QUERY_LIMIT,
    coverageRequirement: "any",
  };
}

function queryForM14(
  rawInput: unknown,
  request: CyberdrawNormalizedRequest,
): StructuralAnalysisQuery | undefined {
  if (request.mode === "analyze") {
    return undefined;
  }
  const query = rawRecord(rawRecord(rawInput)?.query);
  const coverageRequirement = structuralCoverageRequirement(request);
  if (request.mode === "query" && request.operation === "count") {
    return { kind: "counts", coverageRequirement };
  }
  if (request.mode === "query" && request.operation === "summarize") {
    return {
      kind: "summarize",
      groupBy: groupByForM14(query),
      filters: filtersForM14(query),
      coverageRequirement,
    };
  }
  const findingIds = stringArray(query?.findingIds);
  if (request.mode === "query" && findingIds.length === 1) {
    return {
      kind: "get-finding",
      findingId: findingIds[0]!,
      coverageRequirement,
    };
  }
  return {
    kind: "list-findings",
    filters: filtersForM14(query),
    order: orderForM14(query),
    offset: numberField(query, "offset", 0),
    limit: numberField(
      query,
      "limit",
      clampRequestedLimit(request.limits?.maxFindings, DEFAULT_QUERY_LIMIT),
    ),
    coverageRequirement,
  };
}

function filtersForM14(
  query: Record<string, unknown> | undefined,
): NonNullable<
  Extract<StructuralAnalysisQuery, { kind: "list-findings" }>["filters"]
> {
  return {
    ...arrayField(query, "findingTypes"),
    ...arrayField(query, "classifications"),
    ...arrayField(query, "reasonCodes"),
    ...arrayField(query, "pageIds"),
    ...arrayField(query, "layerIds"),
    ...arrayField(query, "elementIds"),
    ...arrayField(query, "sourceIds"),
    ...arrayField(query, "targetIds"),
    ...arrayField(query, "referencedIds"),
    ...arrayField(query, "confidences"),
  };
}

function arrayField(
  query: Record<string, unknown> | undefined,
  key: string,
): Record<string, readonly string[]> {
  const values = stringArray(query?.[key]);
  return values.length > 0 ? { [key]: values } : {};
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function groupByForM14(
  query: Record<string, unknown> | undefined,
): StructuralSummaryGroupBy {
  return typeof query?.groupBy === "string"
    ? (query.groupBy as StructuralSummaryGroupBy)
    : "finding-type";
}

function orderForM14(
  query: Record<string, unknown> | undefined,
): StructuralQueryOrder {
  return typeof query?.order === "string"
    ? (query.order as StructuralQueryOrder)
    : "canonical";
}

function structuralCoverageRequirement(
  request: CyberdrawNormalizedRequest,
): "any" | "non-stale" | "complete-target-scopes" {
  if (request.coverageRequirements?.minimum.includes("nonStale")) {
    return "non-stale";
  }
  if (request.coverageRequirements?.minimum.includes("completeTargetScopes")) {
    return "complete-target-scopes";
  }
  return "any";
}

function rawRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function numberField(
  value: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
): number {
  const candidate = value?.[key];
  return typeof candidate === "number" && Number.isSafeInteger(candidate)
    ? candidate
    : fallback;
}

function policyFor(
  policy: (typeof policies)[number],
): StructuralChangePlanPolicy {
  switch (policy) {
    case "review-only":
      return { name: "review-only" };
    case "allow-detach-broken-terminal":
      return { allowDetachBrokenTerminals: true };
    case "allow-delete-confirmed-orphan":
      return { allowDeleteConfirmedOrphans: true };
    case "conservative":
      return { name: "conservative" };
  }
}

function expansionControls(rawInput: unknown): {
  readonly enabled: boolean;
  readonly maxScopes: number;
  readonly maxDepth: number;
  readonly maxBytes: number;
} {
  const expansion = rawRecord(rawRecord(rawInput)?.expansion);
  return {
    enabled: typeof expansion?.enabled === "boolean" ? expansion.enabled : true,
    maxScopes: boundedInteger(
      expansion?.maxScopes,
      DEFAULT_MAX_SCOPES,
      HARD_MAX_SCOPES,
    ),
    maxDepth: boundedInteger(
      expansion?.maxDepth,
      DEFAULT_MAX_DEPTH,
      HARD_MAX_DEPTH,
    ),
    maxBytes: boundedInteger(
      expansion?.maxBytes,
      DEFAULT_MAX_BYTES,
      HARD_MAX_BYTES,
      1,
    ),
  };
}

function responseControls(
  rawInput: unknown,
): CyberdrawAnalyzeStructureInput["response"] {
  const response = rawRecord(rawRecord(rawInput)?.response);
  return {
    includeFindings:
      typeof response?.includeFindings === "boolean"
        ? response.includeFindings
        : true,
    includeSummary:
      typeof response?.includeSummary === "boolean"
        ? response.includeSummary
        : true,
    includePlan:
      typeof response?.includePlan === "boolean" ? response.includePlan : true,
    includeValidation:
      typeof response?.includeValidation === "boolean"
        ? response.includeValidation
        : true,
    includeDiagnostics: false,
  };
}

function planningPolicy(rawInput: unknown): (typeof policies)[number] {
  const policy = rawRecord(rawRecord(rawInput)?.planning)?.policy;
  return typeof policy === "string"
    ? (policy as (typeof policies)[number])
    : "conservative";
}

function planningSelectedFindingIds(rawInput: unknown): readonly string[] {
  return stringArray(
    rawRecord(rawRecord(rawInput)?.planning)?.selectedFindingIds,
  );
}

function validationMode(rawInput: unknown): StructuralChangePlanValidationMode {
  const mode = rawRecord(rawRecord(rawInput)?.validation)?.mode;
  return typeof mode === "string"
    ? (mode as StructuralChangePlanValidationMode)
    : "full-internal";
}

function boundedInteger(
  value: unknown,
  fallback: number,
  maximum: number,
  minimum = 0,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum
  ) {
    return fallback;
  }
  return Math.min(value, maximum);
}

function mapExecutionToPublicResponse(
  input: CyberdrawAnalyzeStructureInput,
  execution: SnapshotPlanExecutionResult,
  counters: InstrumentationCounters,
): PublicStructuralResponse {
  const analysis = execution.structuralAnalysis;
  const query = filterPublicQuery(input, execution.structuralQueryResult);
  const plan = execution.structuralChangePlan
    ? publicPlan(execution.structuralChangePlan)
    : undefined;
  const validation = execution.structuralChangePlanValidation
    ? publicValidation(execution.structuralChangePlanValidation)
    : undefined;
  const findings = findingsForPublicResponse(input, analysis?.findings ?? []);
  const limitations = publicLimitations([
    ...(analysis?.limitations ?? []),
    ...execution.diagnostics.map((diagnostic) => diagnostic.code),
    ...limitLimitations(input, findings, plan),
  ]);
  const coverage = publicCoverage(analysis?.coverage ?? execution.coverage);
  const inspectedCoverage = publicCoverage(execution.coverage);
  const response: PublicStructuralResponse = {
    version: PUBLIC_RESPONSE_VERSION,
    mode: input.mode,
    outcome: outcomeFor(execution, query, plan, validation, limitations),
    scope: {
      requested: {
        ...(input.scope?.pageId ? { pageId: input.scope.pageId } : {}),
        ...(input.scope?.layerId ? { layerId: input.scope.layerId } : {}),
        defaulted: !input.scope?.pageId && !input.scope?.layerId,
      },
      inspected: {
        document: inspectedCoverage.document,
        pageIds: inspectedCoverage.pageIds,
        layerTargets: inspectedCoverage.layerTargets,
      },
      expanded: execution.metrics.stepsExecuted > 1,
      documentScopeUsed: execution.plan.steps.some(
        (step) => step.requestedScope.kind === "document",
      ),
    },
    coverage,
    revision: {
      ...(analysis?.revisionEvidence.documentId
        ? { documentId: analysis.revisionEvidence.documentId }
        : {}),
      compatible: analysis?.revisionEvidence.revisionCompatible ?? false,
      contentRevisionCount:
        analysis?.revisionEvidence.contentRevisions.length ?? 0,
      documentRevisionCount:
        analysis?.revisionEvidence.documentRevisions.length ?? 0,
    },
    ...(input.response.includeSummary
      ? { summary: publicSummary(analysis, plan, validation) }
      : {}),
    ...(input.response.includeFindings ? { findings } : {}),
    ...(query ? { query } : {}),
    ...(input.response.includePlan && plan ? { plan } : {}),
    ...(input.response.includeValidation && validation ? { validation } : {}),
    ...(input.response.includeDiagnostics
      ? {
          diagnostics: publicDiagnostics([
            ...(analysis?.diagnostics ?? []),
            ...execution.diagnostics,
          ]),
        }
      : {}),
    limitations,
    safety: {
      readOnly: true,
      mutationAttempted: false,
      mutationInvocations: 0,
    } as const,
  };
  return response;
}

function mapExecutionToM14PublicResponse(
  rawInput: unknown,
  request: CyberdrawNormalizedRequest,
  execution: SnapshotPlanExecutionResult,
): PublicM14StructuralResponse {
  const controls = responseControls(rawInput);
  const analysis = execution.structuralAnalysis;
  const plan = execution.structuralChangePlan
    ? publicPlan(execution.structuralChangePlan)
    : undefined;
  const validation = execution.structuralChangePlanValidation
    ? publicValidation(execution.structuralChangePlanValidation)
    : undefined;
  const coverage = publicM14Coverage(
    {
      ...execution.coverage,
      truncated: analysis?.coverage.truncated,
      stale: analysis?.coverage.stale,
      completeness: analysis?.coverage.completeness,
    },
    request.normalizedScope,
    execution.stopReason,
  );
  const limitations = publicM14Limitations(
    request,
    execution,
    coverage,
    controls,
  );
  const results = controls.includeFindings
    ? publicM14Results(rawInput, request, execution, plan, validation)
    : undefined;
  return {
    version: M14_PUBLIC_RESPONSE_VERSION,
    mode: request.mode,
    operation: request.operation,
    outcome: m14Outcome(request, execution, coverage, limitations),
    requestedScope: publicM14RequestedScope(request.requestedScope),
    executedScope: publicM14ExecutedScope(execution.coverage),
    coverage,
    limitations,
    ...(controls.includeSummary
      ? { summary: publicSummary(analysis, plan, validation) }
      : {}),
    ...(results ? { results } : {}),
    ...(controls.includePlan && plan ? { plan } : {}),
    ...(controls.includeValidation && validation ? { validation } : {}),
    revision: {
      ...(analysis?.revisionEvidence.documentId
        ? { documentId: analysis.revisionEvidence.documentId }
        : {}),
      compatible: analysis?.revisionEvidence.revisionCompatible ?? false,
      contentRevisionCount:
        analysis?.revisionEvidence.contentRevisions.length ?? 0,
      documentRevisionCount:
        analysis?.revisionEvidence.documentRevisions.length ?? 0,
    },
    safety: publicSafety(),
  };
}

function m14RejectedResponse(
  rawInput: unknown,
  validation: CyberdrawPublicRequestRejected,
  revision?: PublicStructuralResponse["revision"],
): PublicM14StructuralResponse {
  const reason = firstM14Reason(validation.issues);
  const mode = publicModeFromRaw(rawInput);
  const operation = publicOperationFromRaw(rawInput, mode);
  return {
    version: M14_PUBLIC_RESPONSE_VERSION,
    mode,
    operation,
    outcome: "rejected",
    requestedScope: publicM14RequestedScopeFromRaw(rawInput, reason),
    executedScope: {
      executed: false,
      document: false,
      pageIds: [],
      layerTargets: [],
    },
    coverage: {
      conclusive: false,
      truncated: false,
      stale: false,
      completeTargetScopes: false,
      completeness: "unknown",
      completeDocument: "unsupported",
    },
    limitations: reason ? publicLimitations([reason]) : [],
    ...(revision ? { revision } : {}),
    safety: publicSafety(),
  };
}

function revisionFromSnapshot(
  snapshot: RuntimeSnapshot,
): PublicStructuralResponse["revision"] {
  return {
    ...(snapshot.document.revisionSignals.documentId
      ? { documentId: snapshot.document.revisionSignals.documentId }
      : {}),
    compatible: true,
    contentRevisionCount: snapshot.document.revisionSignals.contentRevision
      ? 1
      : 0,
    documentRevisionCount: snapshot.document.revisionSignals.documentRevision
      ? 1
      : 0,
  };
}

function publicM14Results(
  rawInput: unknown,
  request: CyberdrawNormalizedRequest,
  execution: SnapshotPlanExecutionResult,
  plan: PublicStructuralPlan | undefined,
  validation: PublicPlanValidation | undefined,
): PublicM14Results | undefined {
  const analysis = execution.structuralAnalysis;
  if (!analysis) {
    return undefined;
  }
  if (request.mode === "query" && request.operation === "count") {
    const countQuery = queryStructuralAnalysis({
      analysis,
      query: {
        kind: "list-findings",
        filters: filtersForM14(rawRecord(rawRecord(rawInput)?.query)),
        order: "canonical",
        offset: 0,
        limit: HARD_MAX_FINDINGS,
        coverageRequirement: "any",
      },
      limits: { maxLimit: HARD_MAX_FINDINGS },
    });
    const findings = countQuery.results;
    return {
      kind: "count",
      totalFindings: countQuery.totalMatched,
      findingsByType: countBy(findings, (finding) => finding.findingType),
      findingsByClassification: countBy(findings, classificationForPublic),
      findingsByConfidence: {
        confirmed: findings.filter(
          (finding) => finding.confidence === "confirmed",
        ).length,
        contextual: findings.filter(
          (finding) => finding.confidence === "contextual",
        ).length,
        incomplete: findings.filter(
          (finding) => finding.confidence === "incomplete",
        ).length,
      },
      scopesInspected: {
        pages: new Set(execution.coverage.pageIds).size,
        layerTargets: execution.coverage.layerTargets.length,
      },
      proposals: plan?.proposalCount ?? 0,
      validationIssues: validation
        ? validation.failedPreconditionCount + validation.conflictCount
        : 0,
    };
  }
  if (request.mode === "query" && request.operation === "summarize") {
    const query = execution.structuralQueryResult;
    return {
      kind: "summary",
      groupBy: groupByForM14(rawRecord(rawRecord(rawInput)?.query)),
      buckets:
        query?.groups
          ?.slice(0, HARD_MAX_IDS)
          .map((bucket) => ({ key: bucket.key, count: bucket.count })) ?? [],
      totalMatched: query?.totalMatched ?? 0,
      returned: query?.returned ?? 0,
    };
  }
  if (request.mode !== "query") {
    return undefined;
  }
  const query = execution.structuralQueryResult;
  const findings = (query?.results ?? analysis.findings)
    .slice(0, HARD_MAX_FINDINGS)
    .map(publicFinding);
  return {
    kind: "findings",
    findings,
    totalMatched: query?.totalMatched ?? findings.length,
    returned: findings.length,
    hasMore: query?.hasMore ?? false,
  };
}

function publicM14RequestedScope(
  scope: CyberdrawRequestedScope,
): PublicM14RequestedScope {
  if (scope.kind === "default") {
    return {
      defaulted: true,
      scopeType: "default",
      pageIds: [],
      layerTargets: [],
    };
  }
  if (scope.kind === "document") {
    return {
      defaulted: false,
      scopeType: "document",
      pageIds: [],
      layerTargets: [],
      rejectedReason: "document-scope-not-supported",
    };
  }
  if (scope.kind === "m13") {
    return {
      defaulted: !scope.pageId,
      scopeType: scope.layerId ? "layer" : scope.pageId ? "page" : "default",
      pageIds: scope.pageId && !scope.layerId ? [scope.pageId] : [],
      layerTargets:
        scope.pageId && scope.layerId
          ? [{ pageId: scope.pageId, layerIds: [scope.layerId] }]
          : [],
    };
  }
  return {
    defaulted: false,
    scopeType:
      scope.pageIds.length > 0 && scope.layerTargets.length > 0
        ? "mixed"
        : scope.layerTargets.length > 0
          ? "layer"
          : "page",
    pageIds: [...scope.pageIds].sort(),
    layerTargets: scope.layerTargets.map(sortedLayerTarget),
  };
}

function publicM14RequestedScopeFromRaw(
  rawInput: unknown,
  reason: CyberdrawM14ReasonCode | undefined,
): PublicM14RequestedScope {
  const rawScope = rawRecord(rawRecord(rawInput)?.scope);
  const pageIds = [...stringArray(rawScope?.pageIds)].sort();
  const layerTargets = Array.isArray(rawScope?.layerTargets)
    ? rawScope.layerTargets
        .map((entry) => {
          const raw = rawRecord(entry);
          return raw && typeof raw.pageId === "string"
            ? {
                pageId: raw.pageId,
                layerIds: [...stringArray(raw.layerIds)].sort(),
              }
            : undefined;
        })
        .filter((entry): entry is { pageId: string; layerIds: string[] } =>
          Boolean(entry),
        )
    : [];
  return {
    defaulted: !rawScope,
    scopeType:
      rawScope?.document !== undefined
        ? "document"
        : pageIds.length > 0 && layerTargets.length > 0
          ? "mixed"
          : layerTargets.length > 0
            ? "layer"
            : pageIds.length > 0
              ? "page"
              : "default",
    pageIds,
    layerTargets,
    ...(reason ? { rejectedReason: reason } : {}),
  };
}

function publicM14ExecutedScope(
  coverage: StructuralAnalysisCoverage,
): PublicM14ExecutedScope {
  return {
    executed: coverage.pageIds.length > 0 || coverage.layerTargets.length > 0,
    document: false,
    pageIds: [...coverage.pageIds].sort(),
    layerTargets: coverage.layerTargets.map(sortedLayerTarget),
  };
}

function sortedLayerTarget(target: {
  readonly pageId: string;
  readonly layerIds: readonly string[];
}) {
  return { pageId: target.pageId, layerIds: [...target.layerIds].sort() };
}

function publicM14Coverage(
  coverage: StructuralAnalysisCoverage,
  requested: CyberdrawNormalizedScope,
  stopReason: SnapshotPlanExecutionResult["stopReason"],
): PublicM14Coverage {
  const completeTargetScopes = requestedScopeCovered(requested, coverage);
  const truncated = coverage.truncated === true;
  const stale = coverage.stale === true || stopReason === "stale-snapshot";
  return {
    conclusive: coverage.conclusive === true,
    truncated,
    stale,
    completeTargetScopes,
    completeness: stale
      ? "stale"
      : truncated
        ? "truncated"
        : completeTargetScopes
          ? "complete-target-scopes"
          : coverage.completeness === "partial"
            ? "partial"
            : "unknown",
    completeDocument: "unsupported",
  };
}

function requestedScopeCovered(
  requested: CyberdrawNormalizedScope,
  coverage: StructuralAnalysisCoverage,
): boolean {
  if (requested.kind === "default") {
    return coverage.conclusive === true;
  }
  const pageSet = new Set(coverage.pageIds);
  const layerMap = new Map<string, Set<string>>();
  for (const target of coverage.layerTargets) {
    const layers = layerMap.get(target.pageId) ?? new Set<string>();
    for (const layerId of target.layerIds) {
      layers.add(layerId);
    }
    layerMap.set(target.pageId, layers);
  }
  const pages =
    requested.kind === "page" || requested.kind === "mixed"
      ? requested.pageTargets
      : [];
  const layers =
    requested.kind === "layer" || requested.kind === "mixed"
      ? requested.layerTargets
      : [];
  return (
    pages.every((target) => pageSet.has(target.pageId)) &&
    layers.every((target) => {
      const covered = layerMap.get(target.pageId);
      return target.layerIds.every((layerId) => covered?.has(layerId));
    })
  );
}

function publicM14Limitations(
  request: CyberdrawNormalizedRequest,
  execution: SnapshotPlanExecutionResult,
  coverage: PublicM14Coverage,
  controls: CyberdrawAnalyzeStructureInput["response"],
): readonly PublicLimitation[] {
  const values: CyberdrawM14ReasonCode[] = [];
  if (coverage.stale) {
    values.push("stale-coverage");
  }
  if (!coverage.completeTargetScopes) {
    values.push("incomplete-target-scope");
  }
  if (coverage.truncated || execution.stopReason === "hard-limit-reached") {
    values.push("result-limit-reached");
  }
  if (
    execution.stopReason === "max-steps-reached" ||
    execution.diagnostics.some((entry) =>
      ["maximum-expansion-depth", "max-steps-reached"].includes(entry.code),
    )
  ) {
    values.push("expansion-limit-reached");
  }
  if (
    request.operation === "list" &&
    controls.includeFindings &&
    (execution.structuralQueryResult?.hasMore ||
      (execution.structuralQueryResult?.returned ?? 0) >= HARD_MAX_FINDINGS)
  ) {
    values.push("result-limit-reached");
  }
  if (execution.structuralQueryResult?.outcome === "invalid-query") {
    values.push("unsupported-query-operation");
  }
  if (
    execution.structuralAnalysis?.revisionEvidence.revisionCompatible === false
  ) {
    values.push("revision-incompatible");
  }
  return publicLimitations(values);
}

function m14Outcome(
  request: CyberdrawNormalizedRequest,
  execution: SnapshotPlanExecutionResult,
  coverage: PublicM14Coverage,
  limitations: readonly PublicLimitation[],
): PublicM14StructuralResponse["outcome"] {
  const codes = new Set(limitations.map((limitation) => limitation.code));
  if (
    (request.coverageRequirements?.minimum.includes("nonStale") &&
      codes.has("stale-coverage")) ||
    (request.coverageRequirements?.minimum.includes("completeTargetScopes") &&
      codes.has("incomplete-target-scope")) ||
    execution.structuralQueryResult?.outcome === "invalid-query" ||
    execution.stopReason === "missing-target" ||
    execution.stopReason === "unsupported-scope"
  ) {
    return "rejected";
  }
  if (
    limitations.length > 0 ||
    !coverage.conclusive ||
    execution.stopReason !== "intent-satisfied"
  ) {
    return "partial";
  }
  return "accepted";
}

function countBy<T>(
  values: readonly T[],
  keyFor: (value: T) => string,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    const key = keyFor(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function classificationForPublic(finding: StructuralFinding): string {
  if (finding.findingType === "broken-reference") {
    return finding.status;
  }
  if (finding.findingType === "cross-layer-edge") {
    return finding.relationClassification;
  }
  return finding.status;
}

function firstM14Reason(
  issues: readonly CyberdrawValidationIssue[],
): CyberdrawM14ReasonCode | undefined {
  return issues
    .map((entry) => entry.reasonCode)
    .find((entry): entry is CyberdrawM14ReasonCode => entry !== undefined);
}

function publicModeFromRaw(
  rawInput: unknown,
): CyberdrawNormalizedRequest["mode"] {
  const mode = rawRecord(rawInput)?.mode;
  return mode === "query" || mode === "plan" || mode === "validate"
    ? mode
    : "analyze";
}

function publicOperationFromRaw(
  rawInput: unknown,
  mode: CyberdrawNormalizedRequest["mode"],
): CyberdrawNormalizedRequest["operation"] {
  const operation = rawRecord(rawRecord(rawInput)?.query)?.operation;
  if (
    mode === "query" &&
    (operation === "count" || operation === "summarize")
  ) {
    return operation;
  }
  return mode === "query" ? "list" : mode;
}

function publicSafety(): PublicStructuralResponse["safety"] {
  return {
    readOnly: true,
    mutationAttempted: false,
    mutationInvocations: 0,
  };
}

function findingsForPublicResponse(
  input: CyberdrawAnalyzeStructureInput,
  findings: readonly StructuralFinding[],
): readonly PublicStructuralFinding[] {
  const selectedIds = new Set(input.query?.findingIds ?? []);
  const visibleFindings =
    selectedIds.size > 0
      ? findings.filter((finding) => selectedIds.has(finding.findingId))
      : findings;
  return visibleFindings.slice(0, HARD_MAX_FINDINGS).map(publicFinding);
}

function publicFinding(finding: StructuralFinding): PublicStructuralFinding {
  if (finding.findingType === "broken-reference") {
    return stripUndefined({
      findingId: finding.findingId,
      type: finding.findingType,
      classification: finding.status,
      pageId: finding.pageId,
      layerId: finding.layerId,
      elementId: finding.sourceElementId,
      edgeId:
        finding.referenceType === "source" || finding.referenceType === "target"
          ? finding.sourceElementId
          : undefined,
      terminal:
        finding.referenceType === "source" || finding.referenceType === "target"
          ? finding.referenceType
          : undefined,
      referencedElementId: finding.referencedElementId,
      reasonCode: finding.reasonCode,
      confidence: finding.confidence,
      reviewRequired: finding.status !== "broken",
    });
  }
  if (finding.findingType === "cross-layer-edge") {
    return stripUndefined({
      findingId: finding.findingId,
      type: finding.findingType,
      classification: finding.relationClassification,
      pageId: finding.sourcePageId ?? finding.targetPageId,
      layerId: finding.sourceLayerId ?? finding.targetLayerId,
      elementId: finding.sourceElementId,
      edgeId: finding.edgeId,
      referencedElementId: finding.targetElementId,
      reasonCode: finding.reasonCode,
      confidence: finding.confidence,
      reviewRequired: true,
    });
  }
  return stripUndefined({
    findingId: finding.findingId,
    type: finding.findingType,
    classification: finding.status,
    pageId: finding.pageId,
    layerId: finding.layerId,
    elementId: finding.elementId,
    reasonCode: finding.reasonCode,
    confidence: finding.confidence,
    reviewRequired: finding.status !== "confirmed-orphan",
  });
}

function filterPublicQuery(
  input: CyberdrawAnalyzeStructureInput,
  query: StructuralAnalysisQueryResult | undefined,
): PublicQueryMetadata | undefined {
  if (!query || input.mode === "analyze") {
    return undefined;
  }
  return {
    outcome: query.outcome,
    totalMatched: query.totalMatched,
    returned: query.returned,
    offset: query.offset,
    limit: query.limit,
    hasMore: query.hasMore,
    ordering: query.ordering,
    truncated: query.returned > HARD_MAX_FINDINGS,
  };
}

function publicPlan(plan: StructuralChangePlan): PublicStructuralPlan {
  return {
    planId: plan.planId,
    outcome: plan.outcome,
    executable: false,
    selectedFindingCount: plan.selectedFindingCount,
    proposalCount: plan.proposalCount,
    conflictCount: plan.conflictCount,
    manualReviewCount: plan.manualReviewCount,
    proposals: plan.proposals.slice(0, HARD_MAX_PROPOSALS).map(publicProposal),
    conflicts: plan.conflicts.slice(0, HARD_MAX_PROPOSALS).map((conflict) => ({
      conflictId: conflict.conflictId,
      proposalIds: [...conflict.proposalIds],
      conflictType: conflict.conflictType,
      rationaleCode: conflict.rationaleCode,
    })),
  };
}

function publicProposal(
  proposal: StructuralChangeProposal,
): PublicStructuralProposal {
  return {
    proposalId: proposal.proposalId,
    proposalType: proposal.proposalType,
    operationType: proposal.operation.operationType,
    findingIds: [...proposal.sourceFindingIds],
    target: stripUndefined({ ...proposal.target }),
    rationaleCode: proposal.rationaleCode,
    reviewRequired:
      proposal.status === "review-required" ||
      proposal.riskFlags.includes("requires-review"),
    destructive: proposal.riskFlags.includes("destructive"),
    reversibleEstimate: reversibleEstimate(proposal),
    preconditions: proposal.preconditions
      .slice(0, 12)
      .map((precondition) => precondition.code),
    limitations: proposal.riskFlags
      .filter((flag) => flag !== "destructive")
      .map((flag) => `risk-${flag}`),
    executable: false,
  };
}

function publicValidation(
  validation: StructuralChangePlanValidationResult,
): PublicPlanValidation {
  return {
    validationId: validation.validationId,
    outcome: validation.outcome,
    planIntegrity: validation.planIntegrity.status,
    revisionStatus: validation.revisionStatus,
    coverageStatus: validation.coverageStatus,
    failedPreconditionCount: validation.summary.failedPreconditions,
    conflictCount: validation.summary.conflicts,
    proposalStatusSummary: {
      valid: validation.summary.valid,
      validWithReview: validation.summary.validWithReview,
      invalid: validation.summary.invalid,
      stale: validation.summary.stale,
      tampered: validation.summary.tampered,
    },
    limitationCodes: validation.limitations.slice(0, HARD_MAX_DIAGNOSTICS),
    manualReviewRequired:
      validation.outcome === "manual-review-required" ||
      validation.summary.validWithReview > 0,
  };
}

function publicSummary(
  analysis: SnapshotPlanExecutionResult["structuralAnalysis"],
  plan: PublicStructuralPlan | undefined,
  validation: PublicPlanValidation | undefined,
): PublicSummary {
  const findings = analysis?.findings ?? [];
  return {
    findings: findings.length,
    brokenReferences:
      analysis?.counts.brokenReferenceCount.value ??
      findings.filter((finding) => finding.findingType === "broken-reference")
        .length,
    crossLayerEdges:
      analysis?.counts.crossLayerEdgeCount.value ??
      findings.filter((finding) => finding.findingType === "cross-layer-edge")
        .length,
    confirmedOrphans: findings.filter(
      (finding) =>
        finding.findingType === "orphan-element" &&
        finding.status === "confirmed-orphan",
    ).length,
    proposals: plan?.proposalCount ?? 0,
    conflicts: plan?.conflictCount ?? validation?.conflictCount ?? 0,
    manualReview:
      plan?.manualReviewCount ??
      (validation?.manualReviewRequired
        ? validation.failedPreconditionCount
        : 0),
  };
}

function publicCoverage(coverage: StructuralAnalysisCoverage): PublicCoverage {
  return {
    document: coverage.document,
    pageIds: [...coverage.pageIds].sort(),
    layerTargets: coverage.layerTargets.map((target) => ({
      pageId: target.pageId,
      layerIds: [...target.layerIds].sort(),
    })),
    conclusive: coverage.conclusive,
    truncated: coverage.truncated === true,
    stale: coverage.stale === true,
    completeness: coverage.completeness ?? "unknown",
  };
}

function publicDiagnostics(
  diagnostics: readonly (
    | StructuralAnalysisDiagnostic
    | {
        code: string;
        severity: "debug" | "info" | "warn" | "error";
        pageId?: string;
        layerId?: string;
        elementId?: string;
      }
  )[],
): readonly PublicDiagnostic[] {
  return diagnostics.slice(0, HARD_MAX_DIAGNOSTICS).map((diagnostic) =>
    stripUndefined({
      code: diagnostic.code,
      severity: diagnostic.severity,
      pageId: diagnostic.pageId,
      layerId: diagnostic.layerId,
      elementId: diagnostic.elementId,
    }),
  );
}

function publicLimitations(
  values: readonly string[],
): readonly PublicLimitation[] {
  return [...new Set(values)]
    .sort()
    .slice(0, HARD_MAX_DIAGNOSTICS)
    .map((code) => ({ code: sanitizeCode(code) }));
}

function limitLimitations(
  input: CyberdrawAnalyzeStructureInput,
  findings: readonly PublicStructuralFinding[],
  plan: PublicStructuralPlan | undefined,
): readonly string[] {
  const limitations: string[] = [];
  if (findings.length >= HARD_MAX_FINDINGS) {
    limitations.push("public-findings-limit");
  }
  if ((plan?.proposals.length ?? 0) >= HARD_MAX_PROPOSALS) {
    limitations.push("public-proposals-limit");
  }
  if (!input.expansion.enabled) {
    limitations.push("expansion-disabled");
  }
  return limitations;
}

function outcomeFor(
  execution: SnapshotPlanExecutionResult,
  query: PublicQueryMetadata | undefined,
  plan: PublicStructuralPlan | undefined,
  validation: PublicPlanValidation | undefined,
  limitations: readonly PublicLimitation[],
): PublicOutcome {
  if (limitations.some((limitation) => limitation.code.includes("limit"))) {
    return "ok-with-limitations";
  }
  if (execution.stopReason === "hard-limit-reached") {
    return "resource-limit-exceeded";
  }
  if (
    execution.stopReason === "timeout" ||
    execution.stopReason === "execution-error"
  ) {
    return "analysis-failed";
  }
  if (execution.stopReason === "stale-snapshot") {
    return "stale";
  }
  if (execution.stopReason === "missing-target") {
    return "invalid-request";
  }
  if (query?.outcome === "insufficient-coverage") {
    return "insufficient-coverage";
  }
  if (plan?.outcome === "conflict") {
    return "conflict";
  }
  if (
    plan?.outcome === "manual-review" ||
    plan?.outcome === "planned-with-review" ||
    validation?.manualReviewRequired
  ) {
    return "manual-review-required";
  }
  if (
    validation &&
    !["valid", "valid-with-limitations"].includes(validation.outcome)
  ) {
    return "validation-failed";
  }
  if (limitations.length > 0) {
    return "ok-with-limitations";
  }
  return "ok";
}

function reversibleEstimate(
  proposal: StructuralChangeProposal,
): PublicStructuralProposal["reversibleEstimate"] {
  if (proposal.operation.operationType === "delete-element") {
    return "not-reversible";
  }
  if (proposal.riskFlags.includes("destructive")) {
    return "uncertain";
  }
  return "likely";
}

function createInstrumentationCounters(): InstrumentationCounters {
  return {
    plannerInvocations: 0,
    snapshotRequests: 0,
    mergeInvocations: 0,
    graphBuildInvocations: 0,
    structuralAnalysisInvocations: 0,
    structuralQueryInvocations: 0,
    structuralPlanInvocations: 0,
    structuralValidationInvocations: 0,
    mutationInvocations: 0,
  };
}

function enforceResponseLimit(
  response: PublicStructuralResponse,
): PublicStructuralResponse {
  if (
    Buffer.byteLength(JSON.stringify(response), "utf8") <=
    HARD_MAX_RESPONSE_BYTES
  ) {
    return response;
  }
  return {
    ...response,
    outcome: "resource-limit-exceeded",
    findings: undefined,
    plan: response.plan
      ? { ...response.plan, proposals: [], conflicts: [] }
      : undefined,
    diagnostics: undefined,
    limitations: publicLimitations([
      ...response.limitations.map((limitation) => limitation.code),
      "public-response-byte-limit",
    ]),
  };
}

function enforceM14ResponseLimit(
  response: PublicM14StructuralResponse,
): PublicM14StructuralResponse {
  if (
    Buffer.byteLength(JSON.stringify(response), "utf8") <=
    HARD_MAX_RESPONSE_BYTES
  ) {
    return response;
  }
  return {
    ...response,
    outcome: response.outcome === "rejected" ? "rejected" : "partial",
    results: undefined,
    plan: response.plan
      ? { ...response.plan, proposals: [], conflicts: [] }
      : undefined,
    limitations: publicLimitations([
      ...response.limitations.map((limitation) => limitation.code),
      "result-limit-reached",
    ]),
  };
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function sanitizeCode(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 128);
}

function publicErrorMessage(error: unknown): string {
  const message =
    error instanceof Error && error.message ? error.message : "analysis failed";
  if (message.includes("No connected Draw.io documents")) {
    return "runtime unavailable: no active Draw.io diagram is connected";
  }
  if (message.includes("does not support cyberdraw.runtimeSnapshot.v1")) {
    return "runtime unavailable: connected plugin does not support read-only runtime snapshots";
  }
  if (message.includes("Timed out waiting")) {
    return "runtime unavailable: read-only snapshot request timed out";
  }
  if (message.includes("Multiple Draw.io documents")) {
    return "runtime unavailable: multiple active diagrams are connected";
  }
  return `cyberdraw_analyze_structure failed: ${message.slice(0, 300)}`;
}

function publicValidationErrorMessage(
  detectedVersion: ReturnType<typeof detectCyberdrawContractVersion>,
  validation: ReturnType<typeof validateCyberdrawPublicRequest>,
): string {
  const issueText = validation.issues
    .slice(0, 3)
    .map((entry) => entry.path.join(".") || "$")
    .join(", ");
  return `invalid cyberdraw_analyze_structure request (${detectedVersion}): ${issueText}`;
}

function looksLikeXml(value: string): boolean {
  return /<\s*(mxGraphModel|mxCell|root|diagram)\b/i.test(value);
}

function looksLikeUrl(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

function looksLikeFilesystemPath(value: string): boolean {
  return (
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    /^[a-zA-Z]:[\\/]/.test(value)
  );
}

function assertSafePublicInputShape(
  value: unknown,
  path = "$",
  depth = 0,
): void {
  if (depth > HARD_MAX_INPUT_DEPTH) {
    throw new Error(`Input object is too deeply nested at ${path}`);
  }
  if (value === null || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertSafePublicInputShape(entry, `${path}[${index}]`, depth + 1),
    );
    return;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`Input object must use a plain prototype at ${path}`);
  }
  for (const key of Object.keys(value)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new Error(`Unsafe input key is not accepted at ${path}.${key}`);
    }
    assertSafePublicInputShape(
      (value as Record<string, unknown>)[key],
      `${path}.${key}`,
      depth + 1,
    );
  }
}
