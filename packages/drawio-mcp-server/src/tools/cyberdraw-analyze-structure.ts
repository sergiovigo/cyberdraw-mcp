import { z } from "zod";

import {
  executeHierarchicalSnapshotPlan,
  type HierarchicalSnapshotExecutionOptions,
} from "../cyberdraw-hierarchical-snapshot.js";
import type { Context } from "../types.js";
import type { ToolRegistrar } from "./types.js";
import type {
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
} from "cyberdraw-graph-model";

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
    {
      mode: PublicInputSchema.shape.mode,
      scope: PublicInputSchema.shape.scope,
      expansion: PublicInputSchema.shape.expansion,
      query: PublicInputSchema.shape.query,
      planning: PublicInputSchema.shape.planning,
      validation: PublicInputSchema.shape.validation,
      response: PublicInputSchema.shape.response,
    },
    async (rawArgs) => {
      const args = parseCyberdrawAnalyzeStructureInput(rawArgs);
      try {
        const response = await analyzeStructurePublic(context, args);
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

export async function analyzeStructurePublic(
  context: Context,
  input: CyberdrawAnalyzeStructureInput,
): Promise<PublicStructuralResponse> {
  const counters = createInstrumentationCounters();
  counters.plannerInvocations += 1;
  const execution = await executeHierarchicalSnapshotPlan(
    context,
    intentFor(input),
    executionOptionsFor(input, counters),
  );
  assertNoMutationInvocations(counters);
  const response = mapExecutionToPublicResponse(input, execution, counters);
  return enforceResponseLimit(response);
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

function intentFor(input: CyberdrawAnalyzeStructureInput) {
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

function executionOptionsFor(
  input: CyberdrawAnalyzeStructureInput,
  counters: InstrumentationCounters,
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
        document: coverage.document,
        pageIds: coverage.pageIds,
        layerTargets: coverage.layerTargets,
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
