import type {
  BrokenReferenceStatus,
  CrossLayerRelationClassification,
  OrphanStatus,
  StructuralAnalysisCoverage,
  StructuralAnalysisResult,
  StructuralCompleteness,
  StructuralFinding,
} from "./structural-analysis.js";
import type {
  StructuralAbstractOperation,
  StructuralChangePlan,
  StructuralChangePlanLimits,
  StructuralChangePlanPolicy,
  StructuralChangeProposal,
  StructuralPlanCondition,
  StructuralPlanConflict,
  StructuralPlanConflictType,
  StructuralPlanPostconditionCode,
  StructuralPlanPreconditionCode,
  StructuralPlanTargetIdentity,
} from "./structural-change-plan.js";
import {
  STRUCTURAL_CHANGE_PLAN_VERSION,
  defaultStructuralChangePlanPolicy,
} from "./structural-change-plan.js";
import type { StructuralAnalysisQueryResult } from "./structural-query.js";
import type { JsonValue } from "./types.js";

export const STRUCTURAL_CHANGE_PLAN_VALIDATION_VERSION =
  "cyberdraw.structural-change-plan-validation.v1";

export type StructuralChangePlanValidationMode =
  | "integrity-only"
  | "analysis-correlated"
  | "full-internal";

export type StructuralChangePlanValidationOutcome =
  | "valid"
  | "valid-with-limitations"
  | "invalid-input"
  | "validation-failed"
  | "tampered-plan"
  | "stale-plan"
  | "insufficient-coverage"
  | "precondition-failed"
  | "conflict"
  | "blocked-by-policy"
  | "unsupported-operation"
  | "limit-exceeded"
  | "incompatible-analysis"
  | "incompatible-query-result"
  | "manual-review-required";

export type StructuralProposalValidationStatus =
  | "valid"
  | "valid-with-review"
  | "invalid"
  | "stale"
  | "target-missing"
  | "finding-missing"
  | "finding-changed"
  | "coverage-insufficient"
  | "blocked-by-policy"
  | "conflict"
  | "unsupported-operation"
  | "tampered";

export type StructuralPlanConditionValidationStatus =
  | "passed"
  | "failed"
  | "not-verifiable"
  | "stale"
  | "unsupported";

export type StructuralChangePlanValidationDiagnosticCode =
  | "invalid-input"
  | "unknown-field"
  | "unsafe-json"
  | "limit-exceeded"
  | "invalid-mode"
  | "invalid-plan-shape"
  | "invalid-analysis-shape"
  | "invalid-query-result"
  | "plan-id-mismatch"
  | "proposal-id-mismatch"
  | "conflict-id-mismatch"
  | "canonical-ordering-mismatch"
  | "duplicate-id"
  | "count-mismatch"
  | "summary-mismatch"
  | "document-mismatch"
  | "revision-mismatch"
  | "revision-evidence-missing"
  | "analysis-version-mismatch"
  | "query-version-mismatch"
  | "coverage-mismatch"
  | "completeness-mismatch"
  | "finding-missing"
  | "finding-changed"
  | "target-missing"
  | "target-changed"
  | "precondition-failed"
  | "precondition-not-verifiable"
  | "unsupported-precondition"
  | "unsupported-postcondition"
  | "unsupported-operation"
  | "operation-not-permitted"
  | "conflict-missing"
  | "conflict-invented"
  | "manual-review-required"
  | "validation-failed";

export type StructuralChangePlanValidationDiagnostic = {
  readonly code: StructuralChangePlanValidationDiagnosticCode;
  readonly severity: "debug" | "info" | "warn" | "error";
  readonly proposalId?: string;
  readonly conflictId?: string;
  readonly findingId?: string;
  readonly detail?: JsonValue;
};

export type StructuralChangePlanValidationLimits = {
  readonly maxProposals: number;
  readonly maxConflicts: number;
  readonly maxPreconditions: number;
  readonly maxDiagnostics: number;
  readonly maxIdentifierLength: number;
  readonly maxPlanBytes: number;
  readonly maxCanonicalizationDepth: number;
};

export type StructuralRevisionEvidence = {
  readonly documentId?: string;
  readonly contentRevisions?: readonly string[];
  readonly documentRevisions?: readonly string[];
  readonly revisionCompatible?: boolean;
};

export type StructuralChangePlanValidationInput = {
  readonly plan: StructuralChangePlan;
  readonly analysis: StructuralAnalysisResult;
  readonly queryResult?: StructuralAnalysisQueryResult;
  readonly expectedPolicy?: StructuralChangePlanPolicy;
  readonly currentRevisionEvidence?: StructuralRevisionEvidence;
  readonly limits?: Partial<StructuralChangePlanValidationLimits>;
  readonly mode: StructuralChangePlanValidationMode;
};

export type StructuralPreconditionValidationResult = {
  readonly code: StructuralPlanPreconditionCode;
  readonly status: StructuralPlanConditionValidationStatus;
  readonly target?: StructuralPlanTargetIdentity;
  readonly diagnosticCode?: StructuralChangePlanValidationDiagnosticCode;
};

export type StructuralProposalValidationResult = {
  readonly proposalId: string;
  readonly status: StructuralProposalValidationStatus;
  readonly operationIntegrity: StructuralPlanConditionValidationStatus;
  readonly targetIdentityStatus: StructuralPlanConditionValidationStatus;
  readonly findingStatus: StructuralPlanConditionValidationStatus;
  readonly revisionStatus: StructuralPlanConditionValidationStatus;
  readonly coverageStatus: StructuralPlanConditionValidationStatus;
  readonly policyStatus: StructuralPlanConditionValidationStatus;
  readonly preconditionResults: readonly StructuralPreconditionValidationResult[];
  readonly conflictStatus: StructuralPlanConditionValidationStatus;
  readonly diagnostics: readonly StructuralChangePlanValidationDiagnostic[];
  readonly limitations: readonly string[];
};

export type StructuralConflictValidationResult = {
  readonly conflictId: string;
  readonly status: "valid" | "missing" | "invented" | "tampered";
  readonly proposalIds: readonly string[];
  readonly diagnostics: readonly StructuralChangePlanValidationDiagnostic[];
};

type ProposalIntegrityMode = {
  readonly correlationEnabled: boolean;
};

type ExpectedPlanSummary = {
  readonly planned: number;
  readonly noOp: number;
  readonly manualReview: number;
  readonly blocked: number;
  readonly conflicts: number;
};

type StructuralChangePlanIntegritySnapshot = {
  readonly summary: ExpectedPlanSummary;
  readonly outcome: StructuralChangePlan["outcome"];
};

type StructuralChangePlanDiagnosticEnvelope = {
  readonly planningDiagnostics?: readonly { readonly code?: string }[];
};

export type StructuralChangePlanValidationResult = {
  readonly validationVersion: typeof STRUCTURAL_CHANGE_PLAN_VALIDATION_VERSION;
  readonly validationId: string;
  readonly planId: string;
  readonly recomputedPlanId?: string;
  readonly outcome: StructuralChangePlanValidationOutcome;
  readonly mode: StructuralChangePlanValidationMode;
  readonly documentIdentity: {
    readonly planDocumentId?: string;
    readonly analysisDocumentId?: string;
    readonly currentDocumentId?: string;
    readonly status: "matched" | "mismatched" | "not-verifiable";
  };
  readonly revisionStatus:
    | "matched"
    | "mismatched"
    | "missing-original"
    | "missing-current"
    | "not-verifiable";
  readonly coverageStatus:
    | "matched"
    | "mismatched"
    | "insufficient"
    | "not-verifiable";
  readonly planIntegrity: {
    readonly status: "valid" | "tampered" | "invalid";
    readonly planIdMatches: boolean;
    readonly proposalIdsMatch: boolean;
    readonly conflictIdsMatch: boolean;
    readonly canonicalOrdering: boolean;
    readonly countsMatch: boolean;
    readonly summaryMatches: boolean;
    readonly outcomeMatches: boolean;
  };
  readonly proposalResults: readonly StructuralProposalValidationResult[];
  readonly conflictResults: readonly StructuralConflictValidationResult[];
  readonly failedPreconditions: readonly StructuralPreconditionValidationResult[];
  readonly diagnostics: readonly StructuralChangePlanValidationDiagnostic[];
  readonly limitations: readonly string[];
  readonly summary: {
    readonly proposals: number;
    readonly valid: number;
    readonly validWithReview: number;
    readonly invalid: number;
    readonly stale: number;
    readonly tampered: number;
    readonly conflicts: number;
    readonly failedPreconditions: number;
  };
};

const DEFAULT_LIMITS: StructuralChangePlanValidationLimits = {
  maxProposals: 200,
  maxConflicts: 100,
  maxPreconditions: 2400,
  maxDiagnostics: 300,
  maxIdentifierLength: 512,
  maxPlanBytes: 1024 * 1024,
  maxCanonicalizationDepth: 24,
};

const INPUT_KEYS = new Set([
  "plan",
  "analysis",
  "queryResult",
  "expectedPolicy",
  "currentRevisionEvidence",
  "limits",
  "mode",
]);

const PLAN_KEYS = new Set([
  "planVersion",
  "planId",
  "outcome",
  "documentId",
  "documentRevision",
  "analysisVersion",
  "queryVersion",
  "revisionEvidence",
  "coverage",
  "completeness",
  "revisionCompatible",
  "selectedFindingIds",
  "selectedFindingCount",
  "proposalCount",
  "conflictCount",
  "skippedCount",
  "manualReviewCount",
  "proposals",
  "conflicts",
  "preconditions",
  "diagnostics",
  "limitations",
  "summary",
]);

const PROPOSAL_KEYS = new Set([
  "proposalId",
  "sourceFindingIds",
  "proposalType",
  "target",
  "operation",
  "preconditions",
  "expectedPostconditions",
  "riskFlags",
  "evidenceClass",
  "rationaleCode",
  "coverage",
  "provenance",
  "status",
]);

const CONFLICT_KEYS = new Set([
  "conflictId",
  "proposalIds",
  "conflictType",
  "target",
  "rationaleCode",
  "resolution",
]);

const TARGET_KEYS = new Set([
  "documentId",
  "pageId",
  "layerId",
  "elementId",
  "edgeId",
  "terminal",
  "referencedElementId",
]);

const CONDITION_KEYS = new Set(["code", "target"]);

const OPERATION_TYPES = new Set([
  "detach-terminal",
  "remove-edge",
  "delete-element",
  "retain-element",
  "move-element-to-layer",
  "reconnect-edge",
  "load-external-context",
  "review",
  "no-op",
]);

const PRECONDITION_CODES = new Set<StructuralPlanPreconditionCode>([
  "document-id-matches",
  "document-revision-matches",
  "finding-still-exists",
  "finding-classification-unchanged",
  "target-element-identity-unchanged",
  "page-layer-context-unchanged",
  "referenced-element-remains-absent",
  "referenced-element-remains-ambiguous",
  "coverage-requirement-satisfied",
  "no-conflicting-proposal-accepted",
]);

const POSTCONDITION_CODES = new Set<StructuralPlanPostconditionCode>([
  "expected-terminal-detached",
  "expected-edge-absent",
  "orphan-status-requires-reevaluation",
  "cross-layer-relation-requires-reevaluation",
  "finding-expected-to-disappear-after-reanalysis",
  "manual-review-required",
  "external-context-required",
  "element-retention-proposed",
]);

const OUTCOME_PRECEDENCE: readonly StructuralChangePlanValidationOutcome[] = [
  "invalid-input",
  "validation-failed",
  "tampered-plan",
  "stale-plan",
  "incompatible-analysis",
  "incompatible-query-result",
  "insufficient-coverage",
  "conflict",
  "precondition-failed",
  "blocked-by-policy",
  "unsupported-operation",
  "manual-review-required",
  "valid-with-limitations",
  "valid",
];

export function defaultStructuralChangePlanValidationLimits(
  overrides: Partial<StructuralChangePlanValidationLimits> = {},
): StructuralChangePlanValidationLimits {
  return { ...DEFAULT_LIMITS, ...overrides };
}

export function validateStructuralChangePlan(
  input: StructuralChangePlanValidationInput,
): StructuralChangePlanValidationResult {
  const diagnostics: StructuralChangePlanValidationDiagnostic[] = [];
  if (!safeRecord(input)) {
    return invalidValidation("invalid-input", "invalid-input", diagnostics);
  }
  for (const key of Object.keys(input)) {
    if (!INPUT_KEYS.has(key)) {
      diagnostics.push({
        code: "unknown-field",
        severity: "error",
        detail: { field: key },
      });
      return invalidValidation("invalid-input", "invalid-input", diagnostics);
    }
  }
  const mode = input.mode;
  if (
    mode !== "integrity-only" &&
    mode !== "analysis-correlated" &&
    mode !== "full-internal"
  ) {
    diagnostics.push({ code: "invalid-mode", severity: "error" });
    return invalidValidation("invalid-input", "invalid-input", diagnostics);
  }
  const limits = defaultStructuralChangePlanValidationLimits(input.limits);
  if (!validLimits(limits)) {
    diagnostics.push({ code: "limit-exceeded", severity: "error" });
    return invalidValidation(mode, "limit-exceeded", diagnostics);
  }
  const jsonSafety = validateJsonValue(input, limits);
  if (!jsonSafety.ok) {
    diagnostics.push({
      code: jsonSafety.limitExceeded ? "limit-exceeded" : "unsafe-json",
      severity: "error",
      detail: { reason: jsonSafety.reason, path: jsonSafety.path },
    });
    return invalidValidation(
      mode,
      jsonSafety.limitExceeded ? "limit-exceeded" : "invalid-input",
      diagnostics,
    );
  }

  const plan = clone(input.plan);
  const analysis = clone(input.analysis);
  const queryResult = clone(input.queryResult);
  const policy = defaultStructuralChangePlanPolicy(input.expectedPolicy);
  const shape = validatePlanShape(plan, limits, diagnostics);
  if (!shape) {
    return invalidValidation(mode, "invalid-input", diagnostics);
  }
  if (!safeRecord(analysis)) {
    diagnostics.push({ code: "invalid-analysis-shape", severity: "error" });
    return invalidValidation(mode, "invalid-input", diagnostics);
  }

  const integrity = validateIntegrity(plan, policy, limits, diagnostics);
  const analysisCorrelation =
    mode === "integrity-only"
      ? correlatedDefaults()
      : correlateAnalysis(
          plan,
          analysis,
          input.currentRevisionEvidence,
          diagnostics,
        );
  const queryCorrelation =
    mode === "full-internal"
      ? queryResult
        ? correlateQuery(plan, analysis, queryResult, diagnostics)
        : plan.queryVersion
          ? missingQueryCorrelation(diagnostics)
          : { ok: true }
      : { ok: true };
  const proposalResults = plan.proposals.map((proposal) =>
    validateProposal(proposal, plan, analysis, policy, mode, diagnostics),
  );
  const recomputedConflicts = [...detectConflicts(plan.proposals)].sort(
    compareConflicts,
  );
  const conflictResults = validateConflicts(
    plan.conflicts,
    recomputedConflicts,
    diagnostics,
  );
  const failedPreconditions = proposalResults.flatMap((proposal) =>
    proposal.preconditionResults.filter(
      (condition) =>
        condition.status === "failed" ||
        condition.status === "stale" ||
        condition.status === "unsupported",
    ),
  );
  const limitations = uniqueSorted([
    ...plan.limitations,
    ...(mode === "integrity-only" ? ["freshness-not-asserted"] : []),
    ...(analysisCorrelation.revisionStatus === "missing-current"
      ? ["current-revision-evidence-missing"]
      : []),
    ...(analysisCorrelation.revisionStatus === "missing-original"
      ? ["plan-revision-evidence-missing"]
      : []),
  ]);

  const outcomes: StructuralChangePlanValidationOutcome[] = [];
  if (!integrity.valid) {
    outcomes.push(integrity.invalidInput ? "invalid-input" : "tampered-plan");
  }
  if (!analysisCorrelation.ok) {
    outcomes.push(analysisCorrelation.outcome);
  }
  if (!queryCorrelation.ok) {
    outcomes.push("incompatible-query-result");
  }
  if (conflictResults.some((conflict) => conflict.status !== "valid")) {
    outcomes.push("conflict");
  }
  for (const proposal of proposalResults) {
    if (proposal.status === "unsupported-operation") {
      outcomes.push("unsupported-operation");
    } else if (proposal.status === "blocked-by-policy") {
      outcomes.push("blocked-by-policy");
    } else if (proposal.status === "coverage-insufficient") {
      outcomes.push("insufficient-coverage");
    } else if (proposal.status === "stale") {
      outcomes.push("stale-plan");
    } else if (
      proposal.status === "finding-missing" ||
      proposal.status === "finding-changed" ||
      proposal.status === "target-missing"
    ) {
      outcomes.push("precondition-failed");
    } else if (proposal.status === "conflict") {
      outcomes.push("conflict");
    } else if (proposal.status === "tampered") {
      outcomes.push("tampered-plan");
    } else if (proposal.status === "valid-with-review") {
      outcomes.push("manual-review-required");
    }
  }
  if (outcomes.length === 0 && limitations.length > 0) {
    outcomes.push("valid-with-limitations");
  }
  const outcome = chooseOutcome(outcomes);
  const resultBase = {
    validationVersion: STRUCTURAL_CHANGE_PLAN_VALIDATION_VERSION,
    planId: plan.planId,
    recomputedPlanId: integrity.recomputedPlanId,
    outcome,
    mode,
    documentIdentity: analysisCorrelation.documentIdentity,
    revisionStatus: analysisCorrelation.revisionStatus,
    coverageStatus: analysisCorrelation.coverageStatus,
    planIntegrity: {
      status: integrity.valid
        ? "valid"
        : integrity.invalidInput
          ? "invalid"
          : "tampered",
      planIdMatches: integrity.planIdMatches,
      proposalIdsMatch: integrity.proposalIdsMatch,
      conflictIdsMatch: integrity.conflictIdsMatch,
      canonicalOrdering: integrity.canonicalOrdering,
      countsMatch: integrity.countsMatch,
      summaryMatches: integrity.summaryMatches,
      outcomeMatches: integrity.outcomeMatches,
    },
    proposalResults: proposalResults.sort(compareProposalResults),
    conflictResults: [...conflictResults].sort(compareConflictResults),
    failedPreconditions: failedPreconditions.sort(comparePreconditionResults),
    diagnostics: diagnostics
      .slice(0, limits.maxDiagnostics + 1)
      .sort(compareDiagnostics),
    limitations,
    summary: {
      proposals: proposalResults.length,
      valid: proposalResults.filter((proposal) => proposal.status === "valid")
        .length,
      validWithReview: proposalResults.filter(
        (proposal) => proposal.status === "valid-with-review",
      ).length,
      invalid: proposalResults.filter(
        (proposal) => proposal.status === "invalid",
      ).length,
      stale: proposalResults.filter((proposal) => proposal.status === "stale")
        .length,
      tampered: proposalResults.filter(
        (proposal) => proposal.status === "tampered",
      ).length,
      conflicts: conflictResults.filter(
        (conflict) => conflict.status !== "valid",
      ).length,
      failedPreconditions: failedPreconditions.length,
    },
  } satisfies Omit<StructuralChangePlanValidationResult, "validationId">;
  return {
    ...resultBase,
    validationId: validationId(resultBase),
  };
}

function validateIntegrity(
  plan: StructuralChangePlan,
  policy: Required<StructuralChangePlanPolicy>,
  limits: StructuralChangePlanValidationLimits,
  diagnostics: StructuralChangePlanValidationDiagnostic[],
) {
  let invalidInput = false;
  let proposalIdsMatch = true;
  let conflictIdsMatch = true;
  let canonicalOrdering = true;
  let countsMatch = true;
  let summaryMatches = true;
  let outcomeMatches = true;
  let sourceFindingsMatch = true;

  const proposalIds = new Set<string>();
  const selectedFindingIds = new Set(plan.selectedFindingIds);
  const proposalSourceFindingIds = new Set<string>();
  for (const proposal of plan.proposals) {
    const expectedProposalId = proposalId({
      sourceFindingIds: proposal.sourceFindingIds,
      proposalType: proposal.proposalType,
      target: proposal.target,
      operation: proposal.operation,
      rationaleCode: proposal.rationaleCode,
    });
    if (proposal.proposalId !== expectedProposalId) {
      proposalIdsMatch = false;
      diagnostics.push({
        code: "proposal-id-mismatch",
        severity: "error",
        proposalId: proposal.proposalId,
      });
    }
    if (proposalIds.has(proposal.proposalId)) {
      invalidInput = true;
      diagnostics.push({
        code: "duplicate-id",
        severity: "error",
        proposalId: proposal.proposalId,
      });
    }
    proposalIds.add(proposal.proposalId);
    for (const findingId of proposal.sourceFindingIds) {
      proposalSourceFindingIds.add(findingId);
      if (!selectedFindingIds.has(findingId)) {
        sourceFindingsMatch = false;
        diagnostics.push({
          code: "invalid-plan-shape",
          severity: "error",
          proposalId: proposal.proposalId,
          findingId,
          detail: { reason: "proposal-source-finding-not-selected" },
        });
      }
    }
  }
  const conflictIds = new Set<string>();
  for (const conflict of plan.conflicts) {
    const expectedConflictId = conflictId({
      conflictType: conflict.conflictType,
      proposalIds: uniqueSorted(conflict.proposalIds),
      target: conflict.target,
      rationaleCode: conflict.rationaleCode,
    });
    if (conflict.conflictId !== expectedConflictId) {
      conflictIdsMatch = false;
      diagnostics.push({
        code: "conflict-id-mismatch",
        severity: "error",
        conflictId: conflict.conflictId,
      });
    }
    if (conflictIds.has(conflict.conflictId)) {
      invalidInput = true;
      diagnostics.push({
        code: "duplicate-id",
        severity: "error",
        conflictId: conflict.conflictId,
      });
    }
    conflictIds.add(conflict.conflictId);
    for (const id of conflict.proposalIds) {
      if (!proposalIds.has(id)) {
        invalidInput = true;
        diagnostics.push({
          code: "invalid-plan-shape",
          severity: "error",
          conflictId: conflict.conflictId,
          detail: { reason: "unknown-conflict-proposal-id" },
        });
      }
    }
  }
  if (
    canonicalJson(plan.selectedFindingIds) !==
    canonicalJson(uniqueSorted(plan.selectedFindingIds))
  ) {
    canonicalOrdering = false;
  }
  if (
    canonicalJson(plan.proposals) !==
    canonicalJson([...plan.proposals].sort(compareProposals))
  ) {
    canonicalOrdering = false;
  }
  if (
    canonicalJson(plan.conflicts) !==
    canonicalJson([...plan.conflicts].sort(compareConflicts))
  ) {
    canonicalOrdering = false;
  }
  if (
    canonicalJson(plan.preconditions) !==
    canonicalJson([...plan.preconditions].sort(compareConditions))
  ) {
    canonicalOrdering = false;
  }
  if (!canonicalOrdering) {
    diagnostics.push({
      code: "canonical-ordering-mismatch",
      severity: "error",
    });
  }
  const expectedCounts = {
    selectedFindingCount: plan.selectedFindingIds.length,
    proposalCount: plan.proposals.length,
    conflictCount: plan.conflicts.length,
    skippedCount: Math.max(
      0,
      uniqueSorted(plan.selectedFindingIds).length -
        proposalSourceFindingIds.size,
    ),
    manualReviewCount: plan.proposals.filter(
      (proposal) => proposal.status === "review-required",
    ).length,
  };
  if (
    plan.selectedFindingCount !== expectedCounts.selectedFindingCount ||
    plan.proposalCount !== expectedCounts.proposalCount ||
    plan.conflictCount !== expectedCounts.conflictCount ||
    plan.skippedCount !== expectedCounts.skippedCount ||
    plan.manualReviewCount !== expectedCounts.manualReviewCount
  ) {
    countsMatch = false;
    diagnostics.push({ code: "count-mismatch", severity: "error" });
  }
  const summary = {
    planned: plan.proposals.filter((proposal) => proposal.status === "proposed")
      .length,
    noOp: plan.proposals.filter((proposal) => proposal.status === "no-op")
      .length,
    manualReview: plan.proposals.filter(
      (proposal) => proposal.status === "review-required",
    ).length,
    blocked: plan.proposals.filter((proposal) => proposal.status === "blocked")
      .length,
    conflicts: plan.conflicts.length,
  };
  if (canonicalJson(plan.summary) !== canonicalJson(summary)) {
    summaryMatches = false;
    diagnostics.push({ code: "summary-mismatch", severity: "error" });
  }
  const expectedOutcome = outcomeForPlanIntegrity(plan, summary);
  if (plan.outcome !== expectedOutcome) {
    outcomeMatches = false;
    diagnostics.push({
      code: "summary-mismatch",
      severity: "error",
      detail: { reason: "outcome-mismatch" },
    });
  }
  const planBase = {
    planVersion: plan.planVersion,
    documentId: plan.documentId,
    documentRevision: plan.documentRevision,
    analysisVersion: plan.analysisVersion,
    queryVersion: plan.queryVersion,
    revisionEvidence: plan.revisionEvidence,
    coverage: plan.coverage,
    completeness: plan.completeness,
    revisionCompatible: plan.revisionCompatible,
    selectedFindingIds: plan.selectedFindingIds,
    selectedFindingCount: plan.selectedFindingCount,
    proposalCount: plan.proposalCount,
    conflictCount: plan.conflictCount,
    skippedCount: plan.skippedCount,
    manualReviewCount: plan.manualReviewCount,
    proposals: plan.proposals,
    conflicts: plan.conflicts,
    preconditions: plan.preconditions,
    diagnostics: plan.diagnostics,
    limitations: plan.limitations,
  };
  const recomputedPlanId = planId(planBase, policy);
  const planIdMatches = plan.planId === recomputedPlanId;
  if (!planIdMatches) {
    diagnostics.push({ code: "plan-id-mismatch", severity: "error" });
  }
  if (
    plan.proposals.length > limits.maxProposals ||
    plan.conflicts.length > limits.maxConflicts
  ) {
    invalidInput = true;
    diagnostics.push({ code: "limit-exceeded", severity: "error" });
  }
  return {
    valid:
      !invalidInput &&
      planIdMatches &&
      proposalIdsMatch &&
      conflictIdsMatch &&
      canonicalOrdering &&
      countsMatch &&
      summaryMatches &&
      outcomeMatches &&
      sourceFindingsMatch,
    invalidInput,
    recomputedPlanId,
    planIdMatches,
    proposalIdsMatch,
    conflictIdsMatch,
    canonicalOrdering,
    countsMatch,
    summaryMatches,
    outcomeMatches,
  };
}

function outcomeForPlanIntegrity(
  plan: StructuralChangePlan,
  summary: ExpectedPlanSummary,
): StructuralChangePlan["outcome"] {
  const planningDiagnostics = safeRecord(plan.diagnostics)
    ? ((plan.diagnostics as StructuralChangePlanDiagnosticEnvelope)
        .planningDiagnostics ?? [])
    : [];
  if (
    planningDiagnostics.some(
      (diagnostic) => diagnostic.code === "invalid-plan-input",
    )
  ) {
    return "invalid-input";
  }
  if (
    planningDiagnostics.some(
      (diagnostic) =>
        diagnostic.code === "validation-failed" ||
        diagnostic.code === "limit-exceeded",
    )
  ) {
    return "validation-failed";
  }
  if (
    planningDiagnostics.some(
      (diagnostic) => diagnostic.code === "stale-analysis",
    )
  ) {
    return "stale-analysis";
  }
  if (
    planningDiagnostics.some(
      (diagnostic) => diagnostic.code === "insufficient-coverage",
    )
  ) {
    return "insufficient-coverage";
  }
  if (summary.conflicts > 0) {
    return "conflict";
  }
  if (summary.planned > 0 && summary.manualReview > 0) {
    return "planned-with-review";
  }
  if (summary.planned > 0) {
    return "planned";
  }
  if (summary.manualReview > 0) {
    return "manual-review";
  }
  return "no-op";
}

function correlateAnalysis(
  plan: StructuralChangePlan,
  analysis: StructuralAnalysisResult,
  currentRevisionEvidence: StructuralRevisionEvidence | undefined,
  diagnostics: StructuralChangePlanValidationDiagnostic[],
): {
  readonly ok: boolean;
  readonly outcome: StructuralChangePlanValidationOutcome;
  readonly documentIdentity: StructuralChangePlanValidationResult["documentIdentity"];
  readonly revisionStatus: StructuralChangePlanValidationResult["revisionStatus"];
  readonly coverageStatus: StructuralChangePlanValidationResult["coverageStatus"];
} {
  const currentDocumentId =
    currentRevisionEvidence?.documentId ?? analysis.revisionEvidence.documentId;
  const documentIdentity = {
    planDocumentId: plan.documentId,
    analysisDocumentId: analysis.documentId,
    currentDocumentId,
    status:
      plan.documentId &&
      analysis.documentId &&
      plan.documentId === analysis.documentId
        ? "matched"
        : plan.documentId || analysis.documentId
          ? "mismatched"
          : "not-verifiable",
  } as const;
  if (documentIdentity.status === "mismatched") {
    diagnostics.push({ code: "document-mismatch", severity: "error" });
    return {
      ok: false,
      outcome: "incompatible-analysis",
      documentIdentity,
      revisionStatus: "not-verifiable",
      coverageStatus: "not-verifiable",
    };
  }
  if (plan.analysisVersion !== analysis.analysisVersion) {
    diagnostics.push({ code: "analysis-version-mismatch", severity: "error" });
    return {
      ok: false,
      outcome: "incompatible-analysis",
      documentIdentity,
      revisionStatus: "not-verifiable",
      coverageStatus: "not-verifiable",
    };
  }
  const planRevision = plan.documentRevision;
  const currentRevision =
    currentRevisionEvidence?.documentRevisions?.[0] ??
    analysis.revisionEvidence.documentRevisions[0];
  let revisionStatus: StructuralChangePlanValidationResult["revisionStatus"] =
    "matched";
  if (planRevision && currentRevision && planRevision !== currentRevision) {
    revisionStatus = "mismatched";
    diagnostics.push({ code: "revision-mismatch", severity: "error" });
    return {
      ok: false,
      outcome: "stale-plan",
      documentIdentity,
      revisionStatus,
      coverageStatus: "matched",
    };
  }
  if (planRevision && !currentRevision) {
    revisionStatus = "missing-current";
    diagnostics.push({ code: "revision-evidence-missing", severity: "warn" });
  }
  if (!planRevision) {
    revisionStatus = "missing-original";
    diagnostics.push({ code: "revision-evidence-missing", severity: "warn" });
  }
  if (analysis.completeness === "stale" || analysis.coverage.stale === true) {
    diagnostics.push({ code: "revision-mismatch", severity: "error" });
    return {
      ok: false,
      outcome: "stale-plan",
      documentIdentity,
      revisionStatus: "mismatched",
      coverageStatus: "matched",
    };
  }
  if (canonicalJson(plan.coverage) !== canonicalJson(analysis.coverage)) {
    diagnostics.push({ code: "coverage-mismatch", severity: "error" });
    return {
      ok: false,
      outcome: "incompatible-analysis",
      documentIdentity,
      revisionStatus,
      coverageStatus: "mismatched",
    };
  }
  if (plan.completeness !== analysis.completeness) {
    diagnostics.push({ code: "completeness-mismatch", severity: "error" });
    return {
      ok: false,
      outcome: "incompatible-analysis",
      documentIdentity,
      revisionStatus,
      coverageStatus: "mismatched",
    };
  }
  if (!analysis.coverage.conclusive) {
    diagnostics.push({ code: "coverage-mismatch", severity: "warn" });
    return {
      ok: false,
      outcome: "insufficient-coverage",
      documentIdentity,
      revisionStatus,
      coverageStatus: "insufficient",
    };
  }
  return {
    ok: true,
    outcome: "valid",
    documentIdentity,
    revisionStatus,
    coverageStatus: "matched",
  };
}

function correlateQuery(
  plan: StructuralChangePlan,
  analysis: StructuralAnalysisResult,
  queryResult: StructuralAnalysisQueryResult,
  diagnostics: StructuralChangePlanValidationDiagnostic[],
): { readonly ok: boolean } {
  if (!safeRecord(queryResult) || queryResult.outcome !== "ok") {
    diagnostics.push({ code: "invalid-query-result", severity: "error" });
    return { ok: false };
  }
  if (
    queryResult.queryVersion !== plan.queryVersion ||
    queryResult.analysisVersion !== analysis.analysisVersion ||
    queryResult.documentId !== analysis.documentId ||
    queryResult.completeness !== analysis.completeness ||
    canonicalJson(queryResult.coverage) !== canonicalJson(analysis.coverage) ||
    canonicalJson(queryResult.revisionEvidence) !==
      canonicalJson(analysis.revisionEvidence) ||
    canonicalJson(queryResult.analysisDiagnostics) !==
      canonicalJson(analysis.diagnostics) ||
    canonicalJson(queryResult.limitations) !==
      canonicalJson(analysis.limitations) ||
    canonicalJson(queryResult.queryDiagnostics) !==
      canonicalJson(plan.diagnostics.queryDiagnostics ?? [])
  ) {
    diagnostics.push({ code: "query-version-mismatch", severity: "error" });
    return { ok: false };
  }
  if (
    queryResult.returned !== queryResult.results.length ||
    queryResult.totalMatched < queryResult.results.length ||
    queryResult.offset < 0 ||
    queryResult.limit < 0 ||
    queryResult.ordering !== "canonical"
  ) {
    diagnostics.push({ code: "invalid-query-result", severity: "error" });
    return { ok: false };
  }
  if (
    queryResult.finding &&
    (queryResult.results.length !== 1 ||
      canonicalJson(queryResult.finding) !==
        canonicalJson(queryResult.results[0]))
  ) {
    diagnostics.push({ code: "invalid-query-result", severity: "error" });
    return { ok: false };
  }
  const resultIds = uniqueSorted(
    queryResult.results.map((finding) => finding.findingId),
  );
  if (canonicalJson(resultIds) !== canonicalJson(plan.selectedFindingIds)) {
    diagnostics.push({ code: "invalid-query-result", severity: "error" });
    return { ok: false };
  }
  const findingsById = new Map(
    analysis.findings.map((finding) => [finding.findingId, finding]),
  );
  for (const finding of queryResult.results) {
    const current = findingsById.get(finding.findingId);
    if (!current || canonicalJson(current) !== canonicalJson(finding)) {
      diagnostics.push({
        code: "finding-changed",
        severity: "error",
        findingId: finding.findingId,
      });
      return { ok: false };
    }
  }
  return { ok: true };
}

function validateProposal(
  proposal: StructuralChangeProposal,
  plan: StructuralChangePlan,
  analysis: StructuralAnalysisResult,
  policy: Required<StructuralChangePlanPolicy>,
  mode: StructuralChangePlanValidationMode,
  parentDiagnostics: StructuralChangePlanValidationDiagnostic[],
): StructuralProposalValidationResult {
  const diagnostics: StructuralChangePlanValidationDiagnostic[] = [];
  const correlationEnabled = mode !== "integrity-only";
  const findingsById = correlationEnabled
    ? new Map(analysis.findings.map((finding) => [finding.findingId, finding]))
    : new Map<string, StructuralFinding>();
  const sourceFindings = correlationEnabled
    ? proposal.sourceFindingIds
        .map((id) => findingsById.get(id))
        .filter(
          (finding): finding is StructuralFinding => finding !== undefined,
        )
    : [];
  const finding = sourceFindings[0];
  const preconditionResults = proposal.preconditions.map((condition) =>
    correlationEnabled
      ? validatePrecondition(condition, proposal, plan, analysis, finding)
      : {
          code: condition.code as StructuralPlanPreconditionCode,
          status: "not-verifiable" as const,
          target: condition.target,
        },
  );
  const operationIntegrity = validateOperation(
    proposal.operation,
    proposal.target,
  )
    ? "passed"
    : "unsupported";
  if (operationIntegrity === "unsupported") {
    diagnostics.push({
      code: "unsupported-operation",
      severity: "error",
      proposalId: proposal.proposalId,
    });
  }
  const policyStatus = operationPermitted(proposal, policy)
    ? "passed"
    : "failed";
  if (policyStatus === "failed") {
    diagnostics.push({
      code: "operation-not-permitted",
      severity: "error",
      proposalId: proposal.proposalId,
    });
  }
  const targetStatus = correlationEnabled
    ? validateTarget(proposal, finding)
      ? "passed"
      : "failed"
    : "not-verifiable";
  const findingStatus = correlationEnabled
    ? proposal.sourceFindingIds.length > 0 &&
      sourceFindings.length === proposal.sourceFindingIds.length
      ? "passed"
      : "failed"
    : "not-verifiable";
  const revisionStatus =
    correlationEnabled &&
    plan.documentRevision &&
    analysis.revisionEvidence.documentRevisions[0]
      ? plan.documentRevision === analysis.revisionEvidence.documentRevisions[0]
        ? "passed"
        : "stale"
      : "not-verifiable";
  const coverageStatus = correlationEnabled
    ? coverageSatisfiesProposal(proposal, analysis)
      ? "passed"
      : "failed"
    : "not-verifiable";
  const conflictStatus = plan.conflicts.some((conflict) =>
    conflict.proposalIds.includes(proposal.proposalId),
  )
    ? "failed"
    : "passed";
  diagnostics.push(
    ...preconditionResults
      .filter((condition) => condition.diagnosticCode)
      .map((condition) => ({
        code: condition.diagnosticCode!,
        severity:
          condition.status === "not-verifiable"
            ? ("warn" as const)
            : ("error" as const),
        proposalId: proposal.proposalId,
        findingId: proposal.sourceFindingIds[0],
        detail: { precondition: condition.code },
      })),
  );
  parentDiagnostics.push(...diagnostics);
  const status = proposalStatus({
    proposal,
    mode: { correlationEnabled },
    operationIntegrity,
    targetStatus,
    findingStatus,
    revisionStatus,
    coverageStatus,
    policyStatus,
    conflictStatus,
    preconditionResults,
  });
  return {
    proposalId: proposal.proposalId,
    status,
    operationIntegrity,
    targetIdentityStatus: targetStatus,
    findingStatus,
    revisionStatus,
    coverageStatus,
    policyStatus,
    preconditionResults,
    conflictStatus,
    diagnostics: diagnostics.sort(compareDiagnostics),
    limitations:
      revisionStatus === "not-verifiable" ? ["revision-not-verifiable"] : [],
  };
}

function validatePrecondition(
  condition: StructuralPlanCondition,
  proposal: StructuralChangeProposal,
  plan: StructuralChangePlan,
  analysis: StructuralAnalysisResult,
  finding: StructuralFinding | undefined,
): StructuralPreconditionValidationResult {
  const code = condition.code as StructuralPlanPreconditionCode;
  if (!PRECONDITION_CODES.has(code)) {
    return {
      code,
      status: "unsupported",
      target: condition.target,
      diagnosticCode: "unsupported-precondition",
    };
  }
  switch (code) {
    case "document-id-matches":
      return conditionResult(
        code,
        plan.documentId === undefined ||
          analysis.documentId === undefined ||
          plan.documentId === analysis.documentId,
        condition.target,
        "document-mismatch",
      );
    case "document-revision-matches":
      if (!plan.documentRevision) {
        return {
          code,
          status: "not-verifiable",
          target: condition.target,
          diagnosticCode: "revision-evidence-missing",
        };
      }
      if (!analysis.revisionEvidence.documentRevisions[0]) {
        return {
          code,
          status: "not-verifiable",
          target: condition.target,
          diagnosticCode: "revision-evidence-missing",
        };
      }
      return {
        code,
        status:
          plan.documentRevision ===
          analysis.revisionEvidence.documentRevisions[0]
            ? "passed"
            : "stale",
        target: condition.target,
        ...(plan.documentRevision ===
        analysis.revisionEvidence.documentRevisions[0]
          ? {}
          : { diagnosticCode: "revision-mismatch" as const }),
      };
    case "finding-still-exists":
      return conditionResult(
        code,
        finding !== undefined,
        condition.target,
        "finding-missing",
      );
    case "finding-classification-unchanged":
      return conditionResult(
        code,
        finding !== undefined &&
          proposal.provenance.classification === classificationFor(finding),
        condition.target,
        "finding-changed",
      );
    case "target-element-identity-unchanged":
    case "page-layer-context-unchanged":
      return conditionResult(
        code,
        validateTarget(proposal, finding),
        condition.target,
        "target-changed",
      );
    case "referenced-element-remains-absent":
      return conditionResult(
        code,
        finding?.findingType === "broken-reference" &&
          finding.status === "broken",
        condition.target,
        "precondition-failed",
      );
    case "referenced-element-remains-ambiguous":
      return conditionResult(
        code,
        finding?.findingType === "broken-reference" &&
          finding.status === "ambiguous",
        condition.target,
        "precondition-failed",
      );
    case "coverage-requirement-satisfied":
      return conditionResult(
        code,
        coverageSatisfiesProposal(proposal, analysis),
        condition.target,
        "coverage-mismatch",
      );
    case "no-conflicting-proposal-accepted":
      return conditionResult(
        code,
        !detectConflicts(plan.proposals).some((conflict) =>
          conflict.proposalIds.includes(proposal.proposalId),
        ),
        condition.target,
        "conflict-missing",
      );
  }
}

function conditionResult(
  code: StructuralPlanPreconditionCode,
  passed: boolean,
  target: StructuralPlanTargetIdentity | undefined,
  diagnosticCode: StructuralChangePlanValidationDiagnosticCode,
): StructuralPreconditionValidationResult {
  return {
    code,
    status: passed ? "passed" : "failed",
    target,
    ...(passed ? {} : { diagnosticCode }),
  };
}

function validateOperation(
  operation: StructuralAbstractOperation,
  planTarget: StructuralPlanTargetIdentity,
): boolean {
  if (!safeRecord(operation) || !OPERATION_TYPES.has(operation.operationType)) {
    return false;
  }
  for (const key of Object.keys(operation)) {
    if (key !== "operationType" && key !== "target") {
      return false;
    }
  }
  if (!safeTarget(operation.target)) {
    return false;
  }
  switch (operation.operationType) {
    case "detach-terminal":
      return (
        hasOnlyKeys(operation.target, ["edgeId", "terminal"]) &&
        terminalValid(operation.target.terminal)
      );
    case "remove-edge":
      return hasOnlyKeys(operation.target, ["edgeId"]);
    case "delete-element":
    case "retain-element":
      return hasOnlyKeys(operation.target, ["elementId"]);
    case "move-element-to-layer":
      return hasOnlyKeys(operation.target, ["elementId", "layerId"]);
    case "reconnect-edge":
      return (
        hasOnlyKeys(operation.target, ["edgeId", "terminal", "elementId"]) &&
        terminalValid(operation.target.terminal)
      );
    case "load-external-context":
      return hasOnlyKeys(operation.target, [
        "pageId",
        "layerId",
        "referencedElementId",
      ]);
    case "review":
    case "no-op":
      return canonicalJson(operation.target) === canonicalJson(planTarget);
  }
}

function operationPermitted(
  proposal: StructuralChangeProposal,
  policy: Required<StructuralChangePlanPolicy>,
): boolean {
  if (policy.name === "review-only") {
    return !proposal.riskFlags.includes("destructive");
  }
  switch (proposal.operation.operationType) {
    case "detach-terminal":
      return policy.allowDetachBrokenTerminals;
    case "remove-edge":
      return policy.allowRemoveDanglingEdges;
    case "delete-element":
      return policy.allowDeleteConfirmedOrphans;
    case "reconnect-edge":
      return policy.allowCrossLayerReconnect;
    default:
      return true;
  }
}

function validateTarget(
  proposal: StructuralChangeProposal,
  finding: StructuralFinding | undefined,
): boolean {
  if (!finding) {
    return false;
  }
  const expected = targetForProposalFinding(proposal, finding);
  return (
    canonicalJson(proposal.target) === canonicalJson(expected) &&
    proposal.provenance.findingType === finding.findingType &&
    proposal.provenance.classification === classificationFor(finding)
  );
}

function targetForProposalFinding(
  proposal: StructuralChangeProposal,
  finding: StructuralFinding,
): StructuralPlanTargetIdentity {
  const target = targetForFinding(finding);
  if (
    finding.findingType === "broken-reference" &&
    (proposal.proposalType === "detach-broken-terminal" ||
      proposal.proposalType === "remove-dangling-edge") &&
    finding.sourceElementId
  ) {
    return { ...target, edgeId: finding.sourceElementId };
  }
  return target;
}

function coverageSatisfiesProposal(
  proposal: StructuralChangeProposal,
  analysis: StructuralAnalysisResult,
): boolean {
  if (analysis.completeness === "stale" || analysis.coverage.stale) {
    return false;
  }
  if (proposal.riskFlags.includes("destructive")) {
    return (
      (analysis.completeness === "complete-document" ||
        analysis.completeness === "complete-target-scopes") &&
      proposal.coverage.conclusive &&
      proposal.coverage.pageCovered &&
      proposal.coverage.layerCovered
    );
  }
  return analysis.coverage.conclusive;
}

function proposalStatus(input: {
  readonly proposal: StructuralChangeProposal;
  readonly mode: ProposalIntegrityMode;
  readonly operationIntegrity: StructuralPlanConditionValidationStatus;
  readonly targetStatus: StructuralPlanConditionValidationStatus;
  readonly findingStatus: StructuralPlanConditionValidationStatus;
  readonly revisionStatus: StructuralPlanConditionValidationStatus;
  readonly coverageStatus: StructuralPlanConditionValidationStatus;
  readonly policyStatus: StructuralPlanConditionValidationStatus;
  readonly conflictStatus: StructuralPlanConditionValidationStatus;
  readonly preconditionResults: readonly StructuralPreconditionValidationResult[];
}): StructuralProposalValidationStatus {
  if (input.operationIntegrity === "unsupported") {
    return "unsupported-operation";
  }
  if (input.mode.correlationEnabled) {
    if (input.findingStatus === "failed") {
      return "finding-missing";
    }
    if (input.targetStatus === "failed") {
      return "target-missing";
    }
    if (input.revisionStatus === "stale") {
      return "stale";
    }
    if (input.coverageStatus === "failed") {
      return "coverage-insufficient";
    }
  }
  if (input.conflictStatus === "failed") {
    return "conflict";
  }
  if (input.policyStatus === "failed") {
    return "blocked-by-policy";
  }
  if (
    input.mode.correlationEnabled &&
    input.preconditionResults.some(
      (condition) =>
        condition.status === "failed" ||
        condition.status === "stale" ||
        condition.status === "unsupported",
    )
  ) {
    return "finding-changed";
  }
  return input.proposal.status === "review-required"
    ? "valid-with-review"
    : "valid";
}

function validateConflicts(
  declared: readonly StructuralPlanConflict[],
  recomputed: readonly StructuralPlanConflict[],
  diagnostics: StructuralChangePlanValidationDiagnostic[],
): readonly StructuralConflictValidationResult[] {
  const declaredById = new Map(
    declared.map((conflict) => [conflict.conflictId, conflict]),
  );
  const recomputedById = new Map(
    recomputed.map((conflict) => [conflict.conflictId, conflict]),
  );
  const ids = uniqueSorted([...declaredById.keys(), ...recomputedById.keys()]);
  return ids.map((id) => {
    const declaredConflict = declaredById.get(id);
    const recomputedConflict = recomputedById.get(id);
    if (!declaredConflict && recomputedConflict) {
      const diagnostic = {
        code: "conflict-missing" as const,
        severity: "error" as const,
        conflictId: id,
      };
      diagnostics.push(diagnostic);
      return {
        conflictId: id,
        status: "missing" as const,
        proposalIds: recomputedConflict.proposalIds,
        diagnostics: [diagnostic],
      };
    }
    if (declaredConflict && !recomputedConflict) {
      const diagnostic = {
        code: "conflict-invented" as const,
        severity: "error" as const,
        conflictId: id,
      };
      diagnostics.push(diagnostic);
      return {
        conflictId: id,
        status: "invented" as const,
        proposalIds: declaredConflict.proposalIds,
        diagnostics: [diagnostic],
      };
    }
    if (
      declaredConflict &&
      recomputedConflict &&
      canonicalJson(declaredConflict) !== canonicalJson(recomputedConflict)
    ) {
      const diagnostic = {
        code: "conflict-id-mismatch" as const,
        severity: "error" as const,
        conflictId: id,
      };
      diagnostics.push(diagnostic);
      return {
        conflictId: id,
        status: "tampered" as const,
        proposalIds: declaredConflict.proposalIds,
        diagnostics: [diagnostic],
      };
    }
    return {
      conflictId: id,
      status: "valid" as const,
      proposalIds: declaredConflict?.proposalIds ?? [],
      diagnostics: [],
    };
  });
}

function validatePlanShape(
  plan: unknown,
  limits: StructuralChangePlanValidationLimits,
  diagnostics: StructuralChangePlanValidationDiagnostic[],
): plan is StructuralChangePlan {
  if (!safeRecord(plan)) {
    diagnostics.push({ code: "invalid-plan-shape", severity: "error" });
    return false;
  }
  for (const key of Object.keys(plan)) {
    if (!PLAN_KEYS.has(key)) {
      diagnostics.push({
        code: "unknown-field",
        severity: "error",
        detail: { field: key },
      });
      return false;
    }
  }
  const raw = plan as StructuralChangePlan;
  if (
    raw.planVersion !== STRUCTURAL_CHANGE_PLAN_VERSION ||
    typeof raw.planId !== "string" ||
    !validIdentifier(raw.planId, limits) ||
    !Array.isArray(raw.selectedFindingIds) ||
    !Array.isArray(raw.proposals) ||
    !Array.isArray(raw.conflicts) ||
    !Array.isArray(raw.preconditions) ||
    !Array.isArray(raw.limitations) ||
    !safeRecord(raw.diagnostics) ||
    !safeRecord(raw.summary)
  ) {
    diagnostics.push({ code: "invalid-plan-shape", severity: "error" });
    return false;
  }
  if (
    raw.proposals.length > limits.maxProposals ||
    raw.conflicts.length > limits.maxConflicts
  ) {
    diagnostics.push({ code: "limit-exceeded", severity: "error" });
    return false;
  }
  let preconditionCount = raw.preconditions.length;
  for (const proposal of raw.proposals) {
    if (!validateProposalShape(proposal, limits, diagnostics)) {
      return false;
    }
    preconditionCount += proposal.preconditions.length;
    for (const postcondition of proposal.expectedPostconditions) {
      if (!validateCondition(postcondition, POSTCONDITION_CODES, diagnostics)) {
        return false;
      }
    }
  }
  for (const condition of raw.preconditions) {
    if (!validateCondition(condition, PRECONDITION_CODES, diagnostics)) {
      return false;
    }
  }
  if (preconditionCount > limits.maxPreconditions) {
    diagnostics.push({ code: "limit-exceeded", severity: "error" });
    return false;
  }
  for (const conflict of raw.conflicts) {
    if (!validateConflictShape(conflict, limits, diagnostics)) {
      return false;
    }
  }
  return true;
}

function validateProposalShape(
  proposal: unknown,
  limits: StructuralChangePlanValidationLimits,
  diagnostics: StructuralChangePlanValidationDiagnostic[],
): proposal is StructuralChangeProposal {
  if (!safeRecord(proposal)) {
    diagnostics.push({ code: "invalid-plan-shape", severity: "error" });
    return false;
  }
  for (const key of Object.keys(proposal)) {
    if (!PROPOSAL_KEYS.has(key)) {
      diagnostics.push({
        code: "unknown-field",
        severity: "error",
        detail: { field: key },
      });
      return false;
    }
  }
  const raw = proposal as StructuralChangeProposal;
  if (
    typeof raw.proposalId !== "string" ||
    !validIdentifier(raw.proposalId, limits) ||
    !Array.isArray(raw.sourceFindingIds) ||
    !safeTarget(raw.target) ||
    !safeRecord(raw.operation) ||
    !Array.isArray(raw.preconditions) ||
    !Array.isArray(raw.expectedPostconditions) ||
    !Array.isArray(raw.riskFlags)
  ) {
    diagnostics.push({ code: "invalid-plan-shape", severity: "error" });
    return false;
  }
  for (const condition of raw.preconditions) {
    if (!validateCondition(condition, PRECONDITION_CODES, diagnostics)) {
      return false;
    }
  }
  return raw.sourceFindingIds.every((id) => validIdentifier(id, limits));
}

function validateConflictShape(
  conflict: unknown,
  limits: StructuralChangePlanValidationLimits,
  diagnostics: StructuralChangePlanValidationDiagnostic[],
): conflict is StructuralPlanConflict {
  if (!safeRecord(conflict)) {
    diagnostics.push({ code: "invalid-plan-shape", severity: "error" });
    return false;
  }
  for (const key of Object.keys(conflict)) {
    if (!CONFLICT_KEYS.has(key)) {
      diagnostics.push({
        code: "unknown-field",
        severity: "error",
        detail: { field: key },
      });
      return false;
    }
  }
  const raw = conflict as StructuralPlanConflict;
  return (
    typeof raw.conflictId === "string" &&
    validIdentifier(raw.conflictId, limits) &&
    Array.isArray(raw.proposalIds) &&
    raw.proposalIds.every((id) => validIdentifier(id, limits)) &&
    safeTarget(raw.target) &&
    raw.resolution === "manual-review"
  );
}

function validateCondition(
  condition: unknown,
  allowed: ReadonlySet<string>,
  diagnostics: StructuralChangePlanValidationDiagnostic[],
): condition is StructuralPlanCondition {
  if (!safeRecord(condition)) {
    diagnostics.push({ code: "invalid-plan-shape", severity: "error" });
    return false;
  }
  for (const key of Object.keys(condition)) {
    if (!CONDITION_KEYS.has(key)) {
      diagnostics.push({
        code: "unknown-field",
        severity: "error",
        detail: { field: key },
      });
      return false;
    }
  }
  if (!allowed.has(String(condition.code))) {
    diagnostics.push({
      code:
        allowed === PRECONDITION_CODES
          ? "unsupported-precondition"
          : "unsupported-postcondition",
      severity: "error",
    });
    return false;
  }
  return condition.target === undefined || safeTarget(condition.target);
}

function validateJsonValue(
  value: unknown,
  limits: StructuralChangePlanValidationLimits,
):
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly path: string;
      readonly limitExceeded?: boolean;
    } {
  let serialized = "";
  try {
    serialized = JSON.stringify(value);
  } catch {
    return { ok: false, reason: "not-json-serializable", path: "$" };
  }
  if (serialized.length > limits.maxPlanBytes) {
    return {
      ok: false,
      reason: "max-plan-bytes",
      path: "$",
      limitExceeded: true,
    };
  }
  const stack: {
    readonly value: unknown;
    readonly depth: number;
    readonly path: string;
  }[] = [{ value, depth: 0, path: "$" }];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.depth > limits.maxCanonicalizationDepth) {
      return {
        ok: false,
        reason: "max-depth",
        path: current.path,
        limitExceeded: true,
      };
    }
    if (
      typeof current.value === "number" &&
      !Number.isSafeInteger(current.value)
    ) {
      return { ok: false, reason: "unsafe-number", path: current.path };
    }
    if (
      typeof current.value === "function" ||
      typeof current.value === "symbol"
    ) {
      return { ok: false, reason: "unsafe-type", path: current.path };
    }
    if (current.value && typeof current.value === "object") {
      if (Array.isArray(current.value)) {
        for (const entry of current.value) {
          stack.push({
            value: entry,
            depth: current.depth + 1,
            path: `${current.path}[]`,
          });
        }
      } else {
        if (!safeRecord(current.value)) {
          return { ok: false, reason: "unsafe-object", path: current.path };
        }
        for (const [key, entry] of Object.entries(current.value)) {
          stack.push({
            value: entry,
            depth: current.depth + 1,
            path: `${current.path}.${key}`,
          });
        }
      }
    }
  }
  return { ok: true };
}

function correlatedDefaults() {
  return {
    ok: true,
    outcome: "valid" as const,
    documentIdentity: {
      status: "not-verifiable" as const,
    },
    revisionStatus: "not-verifiable" as const,
    coverageStatus: "not-verifiable" as const,
  };
}

function missingQueryCorrelation(
  diagnostics: StructuralChangePlanValidationDiagnostic[],
): { readonly ok: false } {
  diagnostics.push({ code: "invalid-query-result", severity: "error" });
  return { ok: false };
}

function invalidValidation(
  mode: StructuralChangePlanValidationMode | "invalid-input",
  outcome: StructuralChangePlanValidationOutcome,
  diagnostics: readonly StructuralChangePlanValidationDiagnostic[],
): StructuralChangePlanValidationResult {
  const base = {
    validationVersion: STRUCTURAL_CHANGE_PLAN_VALIDATION_VERSION,
    planId: "",
    outcome,
    mode: mode === "invalid-input" ? "integrity-only" : mode,
    documentIdentity: { status: "not-verifiable" as const },
    revisionStatus: "not-verifiable" as const,
    coverageStatus: "not-verifiable" as const,
    planIntegrity: {
      status: "invalid" as const,
      planIdMatches: false,
      proposalIdsMatch: false,
      conflictIdsMatch: false,
      canonicalOrdering: false,
      countsMatch: false,
      summaryMatches: false,
      outcomeMatches: false,
    },
    proposalResults: [],
    conflictResults: [],
    failedPreconditions: [],
    diagnostics: [...diagnostics].sort(compareDiagnostics),
    limitations: [],
    summary: {
      proposals: 0,
      valid: 0,
      validWithReview: 0,
      invalid: 0,
      stale: 0,
      tampered: 0,
      conflicts: 0,
      failedPreconditions: 0,
    },
  } satisfies Omit<StructuralChangePlanValidationResult, "validationId">;
  return { ...base, validationId: validationId(base) };
}

function chooseOutcome(
  outcomes: readonly StructuralChangePlanValidationOutcome[],
): StructuralChangePlanValidationOutcome {
  if (outcomes.length === 0) {
    return "valid";
  }
  for (const outcome of OUTCOME_PRECEDENCE) {
    if (outcomes.includes(outcome)) {
      return outcome;
    }
  }
  return "validation-failed";
}

function safeTarget(value: unknown): value is StructuralPlanTargetIdentity {
  if (!safeRecord(value)) {
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!TARGET_KEYS.has(key)) {
      return false;
    }
    const entry = value[key];
    if (entry !== undefined && typeof entry !== "string") {
      return false;
    }
  }
  return terminalValid(value.terminal);
}

function terminalValid(value: unknown): boolean {
  return value === undefined || value === "source" || value === "target";
}

function hasOnlyKeys(
  value: StructuralPlanTargetIdentity,
  keys: readonly string[],
): boolean {
  const expected = new Set(keys);
  return (
    keys.every(
      (key) => typeof (value as Record<string, unknown>)[key] === "string",
    ) && Object.keys(value).every((key) => expected.has(key))
  );
}

function validLimits(limits: StructuralChangePlanValidationLimits): boolean {
  return Object.values(limits).every(
    (value) => Number.isSafeInteger(value) && value >= 0,
  );
}

function validIdentifier(
  value: string,
  limits: Pick<StructuralChangePlanValidationLimits, "maxIdentifierLength">,
): boolean {
  return value.length > 0 && value.length <= limits.maxIdentifierLength;
}

function safeRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  for (const key in record) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      return false;
    }
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return false;
    }
  }
  return true;
}

function targetForFinding(
  finding: StructuralFinding,
): StructuralPlanTargetIdentity {
  if (finding.findingType === "orphan-element") {
    return {
      elementId: finding.elementId,
      pageId: finding.pageId,
      layerId: finding.layerId,
    };
  }
  if (finding.findingType === "cross-layer-edge") {
    return {
      edgeId: finding.edgeId,
      pageId: finding.sourcePageId,
      layerId: finding.sourceLayerId,
      elementId: finding.sourceElementId,
      referencedElementId: finding.targetElementId,
    };
  }
  return {
    elementId: finding.sourceElementId,
    pageId: finding.pageId,
    layerId: finding.layerId,
    referencedElementId: finding.referencedElementId,
    terminal:
      finding.referenceType === "source" || finding.referenceType === "target"
        ? finding.referenceType
        : undefined,
  };
}

function classificationFor(finding: StructuralFinding): string {
  if (finding.findingType === "broken-reference") {
    return finding.status satisfies BrokenReferenceStatus;
  }
  if (finding.findingType === "cross-layer-edge") {
    return finding.relationClassification satisfies CrossLayerRelationClassification;
  }
  return finding.status satisfies OrphanStatus;
}

function detectConflicts(
  proposals: readonly StructuralChangeProposal[],
): readonly StructuralPlanConflict[] {
  const conflicts: StructuralPlanConflict[] = [];
  const byTerminal = new Map<string, StructuralChangeProposal[]>();
  const byElementAction = new Map<string, StructuralChangeProposal[]>();
  const byEdgeAction = new Map<string, StructuralChangeProposal[]>();
  for (const proposal of proposals) {
    if (proposal.target.edgeId && proposal.target.terminal) {
      push(byTerminal, terminalIdentityKey(proposal.target), proposal);
    }
    if (proposal.target.elementId) {
      push(byElementAction, elementIdentityKey(proposal.target), proposal);
    }
    if (proposal.target.edgeId) {
      push(byEdgeAction, edgeIdentityKey(proposal.target), proposal);
    }
    if (
      !proposal.target.elementId &&
      !proposal.target.edgeId &&
      !proposal.target.referencedElementId
    ) {
      conflicts.push(
        conflict(
          "ambiguous-proposal-target",
          [proposal],
          proposal.target,
          "proposal-target-ambiguous",
        ),
      );
    }
  }
  for (const proposalsForTerminal of byTerminal.values()) {
    const mutating = proposalsForTerminal.filter(
      (proposal) =>
        proposal.operation.operationType === "detach-terminal" ||
        proposal.operation.operationType === "reconnect-edge",
    );
    if (mutating.length > 1) {
      conflicts.push(
        conflict(
          "same-terminal",
          mutating,
          mutating[0]!.target,
          "same-terminal-multiple-proposals",
        ),
      );
    }
  }
  for (const proposalsForElement of byElementAction.values()) {
    const deletes = proposalsForElement.filter(
      (proposal) => proposal.proposalType === "delete-orphan-element",
    );
    const retains = proposalsForElement.filter(
      (proposal) => proposal.proposalType === "retain-orphan-element",
    );
    if (deletes.length > 0 && retains.length > 0) {
      conflicts.push(
        conflict(
          "delete-retain-element",
          [...deletes, ...retains],
          deletes[0]!.target,
          "delete-retain-same-element",
        ),
      );
    }
  }
  for (const proposalsForEdge of byEdgeAction.values()) {
    const removes = proposalsForEdge.filter(
      (proposal) => proposal.proposalType === "remove-dangling-edge",
    );
    const reconnects = proposalsForEdge.filter(
      (proposal) => proposal.proposalType === "reconnect-cross-layer-edge",
    );
    if (removes.length > 0 && reconnects.length > 0) {
      conflicts.push(
        conflict(
          "remove-reconnect-edge",
          [...removes, ...reconnects],
          removes[0]!.target,
          "remove-reconnect-same-edge",
        ),
      );
    }
  }
  return [
    ...new Map(conflicts.map((item) => [item.conflictId, item])).values(),
  ];
}

function conflict(
  conflictType: StructuralPlanConflictType,
  proposals: readonly StructuralChangeProposal[],
  target: StructuralPlanTargetIdentity,
  rationaleCode: string,
): StructuralPlanConflict {
  const proposalIds = uniqueSorted(
    proposals.map((proposal) => proposal.proposalId),
  );
  return {
    conflictId: conflictId({
      conflictType,
      proposalIds,
      target,
      rationaleCode,
    }),
    proposalIds,
    conflictType,
    target,
    rationaleCode,
    resolution: "manual-review",
  };
}

function terminalIdentityKey(target: StructuralPlanTargetIdentity): string {
  return canonicalJson({
    pageId: target.pageId ?? null,
    layerId: target.layerId ?? null,
    edgeId: target.edgeId ?? null,
    terminal: target.terminal ?? null,
  });
}

function elementIdentityKey(target: StructuralPlanTargetIdentity): string {
  return canonicalJson({
    pageId: target.pageId ?? null,
    layerId: target.layerId ?? null,
    elementId: target.elementId ?? target.referencedElementId ?? null,
  });
}

function edgeIdentityKey(target: StructuralPlanTargetIdentity): string {
  return canonicalJson({
    pageId: target.pageId ?? null,
    layerId: target.layerId ?? null,
    edgeId: target.edgeId ?? null,
  });
}

function compareProposals(
  left: StructuralChangeProposal,
  right: StructuralChangeProposal,
): number {
  return (
    left.proposalType.localeCompare(right.proposalType) ||
    (left.target.pageId ?? "").localeCompare(right.target.pageId ?? "") ||
    (left.target.layerId ?? "").localeCompare(right.target.layerId ?? "") ||
    (left.target.edgeId ?? left.target.elementId ?? "").localeCompare(
      right.target.edgeId ?? right.target.elementId ?? "",
    ) ||
    left.sourceFindingIds[0]!.localeCompare(right.sourceFindingIds[0]!) ||
    left.rationaleCode.localeCompare(right.rationaleCode) ||
    left.proposalId.localeCompare(right.proposalId)
  );
}

function compareConflicts(
  left: StructuralPlanConflict,
  right: StructuralPlanConflict,
): number {
  return (
    left.conflictType.localeCompare(right.conflictType) ||
    (left.target.edgeId ?? left.target.elementId ?? "").localeCompare(
      right.target.edgeId ?? right.target.elementId ?? "",
    ) ||
    left.conflictId.localeCompare(right.conflictId)
  );
}

function compareConditions(
  left: StructuralPlanCondition,
  right: StructuralPlanCondition,
): number {
  return (
    left.code.localeCompare(right.code) ||
    canonicalJson(left.target ?? {}).localeCompare(
      canonicalJson(right.target ?? {}),
    )
  );
}

function compareDiagnostics(
  left: StructuralChangePlanValidationDiagnostic,
  right: StructuralChangePlanValidationDiagnostic,
): number {
  return (
    left.code.localeCompare(right.code) ||
    (left.findingId ?? "").localeCompare(right.findingId ?? "") ||
    (left.proposalId ?? "").localeCompare(right.proposalId ?? "") ||
    (left.conflictId ?? "").localeCompare(right.conflictId ?? "")
  );
}

function compareProposalResults(
  left: StructuralProposalValidationResult,
  right: StructuralProposalValidationResult,
): number {
  return left.proposalId.localeCompare(right.proposalId);
}

function compareConflictResults(
  left: StructuralConflictValidationResult,
  right: StructuralConflictValidationResult,
): number {
  return left.conflictId.localeCompare(right.conflictId);
}

function comparePreconditionResults(
  left: StructuralPreconditionValidationResult,
  right: StructuralPreconditionValidationResult,
): number {
  return (
    left.code.localeCompare(right.code) ||
    canonicalJson(left.target ?? {}).localeCompare(
      canonicalJson(right.target ?? {}),
    )
  );
}

function clone<T>(value: T): T {
  if (value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const values = map.get(key);
  if (values) {
    values.push(value);
  } else {
    map.set(key, [value]);
  }
}

function planId(plan: object, policy: object): string {
  return `m11-plan-${fnv1a64(canonicalJson({ plan, policy }))}`;
}

function proposalId(value: object): string {
  return `m11-proposal-${fnv1a64(canonicalJson(value))}`;
}

function conflictId(value: object): string {
  return `m11-conflict-${fnv1a64(canonicalJson(value))}`;
}

function validationId(value: object): string {
  return `m12-validation-${fnv1a64(
    canonicalJson({
      validationVersion: STRUCTURAL_CHANGE_PLAN_VALIDATION_VERSION,
      mode: (value as { mode?: unknown }).mode,
      planId: (value as { planId?: unknown }).planId,
      recomputedPlanId: (value as { recomputedPlanId?: unknown })
        .recomputedPlanId,
      documentIdentity: (value as { documentIdentity?: unknown })
        .documentIdentity,
      revisionStatus: (value as { revisionStatus?: unknown }).revisionStatus,
      outcome: (value as { outcome?: unknown }).outcome,
      failedPreconditions: (value as { failedPreconditions?: unknown })
        .failedPreconditions,
      proposalResults: (value as { proposalResults?: unknown }).proposalResults,
      conflictResults: (value as { conflictResults?: unknown }).conflictResults,
    }),
  )}`;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(",")}}`;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const framed = framedHashPart(value);
  for (let index = 0; index < framed.length; index += 1) {
    hash ^= BigInt(framed.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, "0");
}

function framedHashPart(value: string): string {
  return `${value.length}:${value};`;
}
