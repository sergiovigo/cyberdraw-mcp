import type {
  StructuralAnalysisCoverage,
  StructuralAnalysisDiagnostic,
  StructuralAnalysisResult,
  StructuralCompleteness,
  StructuralFinding,
} from "./structural-analysis.js";
import type {
  StructuralAnalysisQueryResult,
  StructuralQueryDiagnostic,
} from "./structural-query.js";
import type { JsonValue } from "./types.js";

export const STRUCTURAL_CHANGE_PLAN_VERSION =
  "cyberdraw.structural-change-plan.v1";

export type StructuralChangePlanOutcome =
  | "planned"
  | "planned-with-review"
  | "no-op"
  | "manual-review"
  | "conflict"
  | "insufficient-coverage"
  | "stale-analysis"
  | "unsupported-finding"
  | "invalid-input"
  | "validation-failed"
  | "blocked-by-policy";

export type StructuralPlanDiagnosticCode =
  | "invalid-plan-input"
  | "duplicate-finding-id"
  | "finding-not-found"
  | "unsupported-finding-type"
  | "insufficient-coverage"
  | "stale-analysis"
  | "blocked-by-policy"
  | "destructive-action-not-allowed"
  | "ambiguous-target"
  | "unresolved-external-context"
  | "conflicting-proposals"
  | "proposal-deduplicated"
  | "no-safe-action"
  | "revision-evidence-missing"
  | "limit-exceeded"
  | "validation-failed";

export type StructuralChangePlanPolicyName = "conservative" | "review-only";

export type StructuralChangePlanPolicy = {
  readonly name?: StructuralChangePlanPolicyName;
  readonly allowDeleteConfirmedOrphans?: boolean;
  readonly allowDetachBrokenTerminals?: boolean;
  readonly allowRemoveDanglingEdges?: boolean;
  readonly allowCrossLayerReview?: boolean;
  readonly allowCrossLayerReconnect?: boolean;
  readonly requireCompleteDocument?: boolean;
  readonly requireCompleteTargetScopes?: boolean;
  readonly orphanDefaultAction?: "manual-review" | "retain";
  readonly crossLayerDefaultAction?: "review" | "no-op";
};

export type StructuralChangePlanLimits = {
  readonly maxSelectedFindings: number;
  readonly maxProposals: number;
  readonly maxConflicts: number;
  readonly maxIdentifierLength: number;
  readonly maxPreconditionsPerProposal: number;
  readonly maxPostconditionsPerProposal: number;
  readonly maxDiagnostics: number;
};

export type StructuralChangePlanInput = {
  readonly analysis: StructuralAnalysisResult;
  readonly selectedFindingIds?: readonly string[];
  readonly queryResult?: StructuralAnalysisQueryResult;
  readonly policy?: StructuralChangePlanPolicy;
  readonly limits?: Partial<StructuralChangePlanLimits>;
  readonly reviewContext?: {
    readonly expectedDocumentRevision?: string;
    readonly knownDocumentRevisionMismatch?: boolean;
  };
};

export type StructuralProposalType =
  | "detach-broken-terminal"
  | "replace-terminal-reference"
  | "remove-dangling-edge"
  | "move-element-to-layer"
  | "reconnect-cross-layer-edge"
  | "review-cross-layer-edge"
  | "delete-orphan-element"
  | "retain-orphan-element"
  | "attach-orphan-to-container"
  | "resolve-ambiguous-reference"
  | "load-external-context"
  | "no-op"
  | "manual-review";

export type StructuralAbstractOperation =
  | {
      readonly operationType: "detach-terminal";
      readonly target: {
        readonly edgeId: string;
        readonly terminal: "source" | "target";
      };
    }
  | {
      readonly operationType: "remove-edge";
      readonly target: { readonly edgeId: string };
    }
  | {
      readonly operationType: "delete-element";
      readonly target: { readonly elementId: string };
    }
  | {
      readonly operationType: "retain-element";
      readonly target: { readonly elementId: string };
    }
  | {
      readonly operationType: "move-element-to-layer";
      readonly target: { readonly elementId: string; readonly layerId: string };
    }
  | {
      readonly operationType: "reconnect-edge";
      readonly target: {
        readonly edgeId: string;
        readonly terminal: "source" | "target";
        readonly elementId: string;
      };
    }
  | {
      readonly operationType: "load-external-context";
      readonly target: {
        readonly pageId?: string;
        readonly layerId?: string;
        readonly referencedElementId?: string;
      };
    }
  | {
      readonly operationType: "review";
      readonly target: StructuralPlanTargetIdentity;
    }
  | {
      readonly operationType: "no-op";
      readonly target: StructuralPlanTargetIdentity;
    };

export type StructuralPlanTargetIdentity = {
  readonly elementId?: string;
  readonly edgeId?: string;
  readonly terminal?: "source" | "target";
  readonly pageId?: string;
  readonly layerId?: string;
  readonly referencedElementId?: string;
};

export type StructuralPlanPreconditionCode =
  | "document-id-matches"
  | "document-revision-matches"
  | "finding-still-exists"
  | "finding-classification-unchanged"
  | "target-element-identity-unchanged"
  | "page-layer-context-unchanged"
  | "referenced-element-remains-absent"
  | "referenced-element-remains-ambiguous"
  | "coverage-requirement-satisfied"
  | "no-conflicting-proposal-accepted";

export type StructuralPlanPostconditionCode =
  | "expected-terminal-detached"
  | "expected-edge-absent"
  | "orphan-status-requires-reevaluation"
  | "cross-layer-relation-requires-reevaluation"
  | "finding-expected-to-disappear-after-reanalysis"
  | "manual-review-required"
  | "external-context-required"
  | "element-retention-proposed";

export type StructuralPlanCondition = {
  readonly code:
    | StructuralPlanPreconditionCode
    | StructuralPlanPostconditionCode;
  readonly target?: StructuralPlanTargetIdentity;
};

export type StructuralPlanRiskFlag =
  | "destructive"
  | "coverage-limited"
  | "requires-review"
  | "stale-sensitive"
  | "ambiguous-target"
  | "external-context";

export type StructuralProposalStatus =
  | "proposed"
  | "review-required"
  | "blocked"
  | "no-op";

export type StructuralChangeProposal = {
  readonly proposalId: string;
  readonly sourceFindingIds: readonly string[];
  readonly proposalType: StructuralProposalType;
  readonly target: StructuralPlanTargetIdentity;
  readonly operation: StructuralAbstractOperation;
  readonly preconditions: readonly StructuralPlanCondition[];
  readonly expectedPostconditions: readonly StructuralPlanCondition[];
  readonly riskFlags: readonly StructuralPlanRiskFlag[];
  readonly evidenceClass: "confirmed" | "contextual" | "incomplete";
  readonly rationaleCode: string;
  readonly coverage: {
    readonly completeness: StructuralCompleteness;
    readonly conclusive: boolean;
    readonly pageCovered: boolean;
    readonly layerCovered: boolean;
  };
  readonly provenance: {
    readonly analysisVersion: string;
    readonly findingType: string;
    readonly classification: string;
  };
  readonly status: StructuralProposalStatus;
};

export type StructuralPlanConflictType =
  | "same-terminal"
  | "delete-retain-element"
  | "delete-reconnect-target"
  | "move-to-multiple-layers"
  | "remove-reconnect-edge"
  | "duplicate-finding-incompatible"
  | "ambiguous-proposal-target";

export type StructuralPlanConflict = {
  readonly conflictId: string;
  readonly proposalIds: readonly string[];
  readonly conflictType: StructuralPlanConflictType;
  readonly target: StructuralPlanTargetIdentity;
  readonly rationaleCode: string;
  readonly resolution: "manual-review";
};

export type StructuralPlanDiagnostic = {
  readonly code: StructuralPlanDiagnosticCode;
  readonly severity: "debug" | "info" | "warn" | "error";
  readonly findingId?: string;
  readonly proposalId?: string;
  readonly detail?: JsonValue;
};

export type StructuralChangePlan = {
  readonly planVersion: typeof STRUCTURAL_CHANGE_PLAN_VERSION;
  readonly planId: string;
  readonly outcome: StructuralChangePlanOutcome;
  readonly documentId?: string;
  readonly documentRevision?: string;
  readonly analysisVersion: string;
  readonly queryVersion?: string;
  readonly revisionEvidence: StructuralAnalysisResult["revisionEvidence"];
  readonly coverage: StructuralAnalysisCoverage;
  readonly completeness: StructuralCompleteness;
  readonly revisionCompatible: boolean;
  readonly selectedFindingIds: readonly string[];
  readonly selectedFindingCount: number;
  readonly proposalCount: number;
  readonly conflictCount: number;
  readonly skippedCount: number;
  readonly manualReviewCount: number;
  readonly proposals: readonly StructuralChangeProposal[];
  readonly conflicts: readonly StructuralPlanConflict[];
  readonly preconditions: readonly StructuralPlanCondition[];
  readonly diagnostics: {
    readonly analysisDiagnostics: readonly StructuralAnalysisDiagnostic[];
    readonly queryDiagnostics: readonly StructuralQueryDiagnostic[];
    readonly planningDiagnostics: readonly StructuralPlanDiagnostic[];
  };
  readonly limitations: readonly string[];
  readonly summary: {
    readonly planned: number;
    readonly noOp: number;
    readonly manualReview: number;
    readonly blocked: number;
    readonly conflicts: number;
  };
};

const DEFAULT_LIMITS: StructuralChangePlanLimits = {
  maxSelectedFindings: 100,
  maxProposals: 200,
  maxConflicts: 100,
  maxIdentifierLength: 512,
  maxPreconditionsPerProposal: 12,
  maxPostconditionsPerProposal: 8,
  maxDiagnostics: 200,
};

const POLICY_KEYS = new Set([
  "name",
  "allowDeleteConfirmedOrphans",
  "allowDetachBrokenTerminals",
  "allowRemoveDanglingEdges",
  "allowCrossLayerReview",
  "allowCrossLayerReconnect",
  "requireCompleteDocument",
  "requireCompleteTargetScopes",
  "orphanDefaultAction",
  "crossLayerDefaultAction",
]);

const INPUT_KEYS = new Set([
  "analysis",
  "selectedFindingIds",
  "queryResult",
  "policy",
  "limits",
  "reviewContext",
]);

export function defaultStructuralChangePlanLimits(
  overrides: Partial<StructuralChangePlanLimits> = {},
): StructuralChangePlanLimits {
  return { ...DEFAULT_LIMITS, ...overrides };
}

export function defaultStructuralChangePlanPolicy(
  overrides: StructuralChangePlanPolicy = {},
): Required<StructuralChangePlanPolicy> {
  const name = overrides.name ?? "conservative";
  const base: Required<StructuralChangePlanPolicy> =
    name === "review-only"
      ? {
          name,
          allowDeleteConfirmedOrphans: false,
          allowDetachBrokenTerminals: false,
          allowRemoveDanglingEdges: false,
          allowCrossLayerReview: true,
          allowCrossLayerReconnect: false,
          requireCompleteDocument: false,
          requireCompleteTargetScopes: false,
          orphanDefaultAction: "manual-review",
          crossLayerDefaultAction: "review",
        }
      : {
          name,
          allowDeleteConfirmedOrphans: false,
          allowDetachBrokenTerminals: false,
          allowRemoveDanglingEdges: false,
          allowCrossLayerReview: true,
          allowCrossLayerReconnect: false,
          requireCompleteDocument: false,
          requireCompleteTargetScopes: false,
          orphanDefaultAction: "manual-review",
          crossLayerDefaultAction: "review",
        };
  return { ...base, ...overrides, name };
}

export function planStructuralChanges(
  input: StructuralChangePlanInput,
): StructuralChangePlan {
  const planningDiagnostics: StructuralPlanDiagnostic[] = [];
  if (!safeRecord(input)) {
    return emptyPlan(basePlanParts(), "invalid-input", planningDiagnostics, [
      "invalid-plan-input",
    ]);
  }
  const limits = defaultStructuralChangePlanLimits(input.limits);
  const policyValidation = validatePolicy(input.policy, planningDiagnostics);
  const policy = defaultStructuralChangePlanPolicy(input.policy);
  const analysis = input.analysis;
  const queryResult = input.queryResult;
  const base = basePlanParts(analysis, queryResult);

  if (!safeRecord(analysis)) {
    return emptyPlan(base, "invalid-input", planningDiagnostics, [
      "invalid-plan-input",
    ]);
  }
  for (const key of Object.keys(input)) {
    if (!INPUT_KEYS.has(key)) {
      planningDiagnostics.push({
        code: "invalid-plan-input",
        severity: "error",
        detail: { field: key },
      });
      return emptyPlan(base, "invalid-input", planningDiagnostics, []);
    }
  }
  if (!validLimits(limits, planningDiagnostics)) {
    return emptyPlan(base, "validation-failed", planningDiagnostics, []);
  }
  if (!policyValidation.ok) {
    return emptyPlan(base, policyValidation.outcome, planningDiagnostics, []);
  }
  const revisionProblem = validateRevision(input, planningDiagnostics);
  if (revisionProblem) {
    return emptyPlan(base, revisionProblem, planningDiagnostics, []);
  }
  const coverageProblem = validateCoverage(
    analysis,
    policy,
    planningDiagnostics,
  );
  if (coverageProblem) {
    return emptyPlan(base, coverageProblem, planningDiagnostics, []);
  }
  const selected = selectFindings(input, limits, planningDiagnostics);
  if (!selected.ok) {
    return emptyPlan(base, selected.outcome, planningDiagnostics, []);
  }
  const proposals: StructuralChangeProposal[] = [];
  let skippedCount = 0;
  for (const finding of selected.findings) {
    const planned = proposalsForFinding(finding, analysis, policy);
    if (planned.length === 0) {
      skippedCount += 1;
      planningDiagnostics.push({
        code: "no-safe-action",
        severity: "info",
        findingId: finding.findingId,
      });
      continue;
    }
    proposals.push(...planned);
  }
  const deduped = dedupeProposals(proposals, planningDiagnostics);
  const conditionLimitProblem = validateProposalConditionLimits(
    deduped,
    limits,
    planningDiagnostics,
  );
  if (conditionLimitProblem) {
    return emptyPlan(base, conditionLimitProblem, planningDiagnostics, []);
  }
  if (deduped.length > limits.maxProposals) {
    planningDiagnostics.push({
      code: "limit-exceeded",
      severity: "error",
      detail: { limit: "maxProposals", maxProposals: limits.maxProposals },
    });
    return emptyPlan(base, "validation-failed", planningDiagnostics, []);
  }
  const conflicts = detectConflicts(deduped).slice(0, limits.maxConflicts + 1);
  if (conflicts.length > limits.maxConflicts) {
    planningDiagnostics.push({
      code: "limit-exceeded",
      severity: "error",
      detail: { limit: "maxConflicts", maxConflicts: limits.maxConflicts },
    });
    return emptyPlan(base, "validation-failed", planningDiagnostics, []);
  }
  if (conflicts.length > 0) {
    planningDiagnostics.push({
      code: "conflicting-proposals",
      severity: "warn",
      detail: { conflictCount: conflicts.length },
    });
  }
  if (planningDiagnostics.length > limits.maxDiagnostics) {
    return emptyPlan(
      base,
      "validation-failed",
      [
        {
          code: "limit-exceeded",
          severity: "error",
          detail: {
            limit: "maxDiagnostics",
            maxDiagnostics: limits.maxDiagnostics,
          },
        },
      ],
      [],
    );
  }

  const orderedProposals = [...deduped].sort(compareProposals);
  const orderedConflicts = conflicts.sort(compareConflicts);
  const planBase = {
    ...base,
    selectedFindingIds: selected.ids,
    selectedFindingCount: selected.ids.length,
    proposalCount: orderedProposals.length,
    conflictCount: orderedConflicts.length,
    skippedCount,
    manualReviewCount: orderedProposals.filter(
      (proposal) => proposal.status === "review-required",
    ).length,
    proposals: orderedProposals,
    conflicts: orderedConflicts,
    preconditions: planPreconditions(analysis),
    diagnostics: {
      analysisDiagnostics: [...clone(analysis.diagnostics)].sort(
        compareAnalysisDiagnostics,
      ),
      queryDiagnostics: [...clone(queryResult?.queryDiagnostics ?? [])].sort(
        compareQueryDiagnostics,
      ),
      planningDiagnostics: planningDiagnostics.sort(comparePlanDiagnostics),
    },
    limitations: uniqueSorted([
      ...analysis.limitations,
      ...limitationsForPlan(analysis),
    ]),
  };
  return {
    ...planBase,
    planId: planId(planBase, policy),
    outcome: outcomeFor(planBase, planningDiagnostics, conflicts),
    summary: {
      planned: orderedProposals.filter(
        (proposal) => proposal.status === "proposed",
      ).length,
      noOp: orderedProposals.filter((proposal) => proposal.status === "no-op")
        .length,
      manualReview: orderedProposals.filter(
        (proposal) => proposal.status === "review-required",
      ).length,
      blocked: orderedProposals.filter(
        (proposal) => proposal.status === "blocked",
      ).length,
      conflicts: orderedConflicts.length,
    },
  };
}

function proposalsForFinding(
  finding: StructuralFinding,
  analysis: StructuralAnalysisResult,
  policy: Required<StructuralChangePlanPolicy>,
): readonly StructuralChangeProposal[] {
  switch (finding.findingType) {
    case "broken-reference":
      return brokenReferenceProposals(finding, analysis, policy);
    case "orphan-element":
      return orphanProposals(finding, analysis, policy);
    case "cross-layer-edge":
      return crossLayerProposals(finding, analysis, policy);
  }
}

function brokenReferenceProposals(
  finding: Extract<StructuralFinding, { findingType: "broken-reference" }>,
  analysis: StructuralAnalysisResult,
  policy: Required<StructuralChangePlanPolicy>,
): readonly StructuralChangeProposal[] {
  const target = targetForFinding(finding);
  if (finding.status === "ambiguous") {
    return [
      proposal(
        finding,
        analysis,
        "manual-review",
        target,
        {
          operationType: "review",
          target,
        },
        "ambiguous-reference-requires-review",
        ["requires-review", "ambiguous-target"],
        "review-required",
      ),
    ];
  }
  if (finding.status === "external-context-not-loaded") {
    return [
      proposal(
        finding,
        analysis,
        "load-external-context",
        target,
        {
          operationType: "load-external-context",
          target: {
            pageId: finding.referencedPageId ?? finding.pageId,
            layerId: finding.referencedLayerId ?? finding.layerId,
            referencedElementId: finding.referencedElementId,
          },
        },
        "external-context-required",
        ["external-context", "requires-review"],
        "review-required",
      ),
    ];
  }
  if (finding.status !== "broken") {
    return [
      proposal(
        finding,
        analysis,
        "no-op",
        target,
        {
          operationType: "no-op",
          target,
        },
        "reference-not-proven-broken",
        ["coverage-limited"],
        "no-op",
      ),
    ];
  }
  if (!destructiveCoverageAllowed(analysis, finding)) {
    return [
      proposal(
        finding,
        analysis,
        "manual-review",
        target,
        {
          operationType: "review",
          target,
        },
        "destructive-action-needs-coverage",
        ["coverage-limited", "requires-review"],
        "review-required",
      ),
    ];
  }
  if (
    (finding.referenceType === "source" ||
      finding.referenceType === "target") &&
    finding.sourceElementId &&
    policy.allowDetachBrokenTerminals
  ) {
    return [
      proposal(
        finding,
        analysis,
        "detach-broken-terminal",
        {
          ...target,
          edgeId: finding.sourceElementId,
          terminal: finding.referenceType,
        },
        {
          operationType: "detach-terminal",
          target: {
            edgeId: finding.sourceElementId,
            terminal: finding.referenceType,
          },
        },
        "broken-terminal-detach-allowed",
        ["destructive", "stale-sensitive"],
        "proposed",
      ),
    ];
  }
  if (
    (finding.referenceType === "source" ||
      finding.referenceType === "target") &&
    finding.sourceElementId &&
    policy.allowRemoveDanglingEdges
  ) {
    return [
      proposal(
        finding,
        analysis,
        "remove-dangling-edge",
        { ...target, edgeId: finding.sourceElementId },
        {
          operationType: "remove-edge",
          target: { edgeId: finding.sourceElementId },
        },
        "dangling-edge-remove-allowed",
        ["destructive", "stale-sensitive"],
        "proposed",
      ),
    ];
  }
  return [
    proposal(
      finding,
      analysis,
      "manual-review",
      target,
      {
        operationType: "review",
        target,
      },
      "broken-reference-policy-review",
      ["requires-review"],
      "review-required",
    ),
  ];
}

function orphanProposals(
  finding: Extract<StructuralFinding, { findingType: "orphan-element" }>,
  analysis: StructuralAnalysisResult,
  policy: Required<StructuralChangePlanPolicy>,
): readonly StructuralChangeProposal[] {
  const target = targetForFinding(finding);
  if (
    finding.status === "confirmed-orphan" &&
    policy.allowDeleteConfirmedOrphans &&
    destructiveCoverageAllowed(analysis, finding)
  ) {
    return [
      proposal(
        finding,
        analysis,
        "delete-orphan-element",
        target,
        {
          operationType: "delete-element",
          target: { elementId: finding.elementId },
        },
        "confirmed-orphan-delete-allowed",
        ["destructive", "stale-sensitive"],
        "proposed",
      ),
    ];
  }
  if (policy.orphanDefaultAction === "retain") {
    return [
      proposal(
        finding,
        analysis,
        "retain-orphan-element",
        target,
        {
          operationType: "retain-element",
          target: { elementId: finding.elementId },
        },
        "orphan-retain-policy",
        [],
        "proposed",
      ),
    ];
  }
  return [
    proposal(
      finding,
      analysis,
      "manual-review",
      target,
      {
        operationType: "review",
        target,
      },
      finding.status === "confirmed-orphan"
        ? "orphan-review-default"
        : "possible-orphan-review",
      ["requires-review"],
      "review-required",
    ),
  ];
}

function crossLayerProposals(
  finding: Extract<StructuralFinding, { findingType: "cross-layer-edge" }>,
  analysis: StructuralAnalysisResult,
  policy: Required<StructuralChangePlanPolicy>,
): readonly StructuralChangeProposal[] {
  const target = targetForFinding(finding);
  if (policy.allowCrossLayerReconnect) {
    return [
      proposal(
        finding,
        analysis,
        "manual-review",
        target,
        {
          operationType: "review",
          target,
        },
        "cross-layer-reconnect-strategy-missing",
        ["requires-review"],
        "review-required",
      ),
    ];
  }
  if (policy.crossLayerDefaultAction === "no-op") {
    return [
      proposal(
        finding,
        analysis,
        "no-op",
        target,
        {
          operationType: "no-op",
          target,
        },
        "cross-layer-allowed-by-policy",
        [],
        "no-op",
      ),
    ];
  }
  return [
    proposal(
      finding,
      analysis,
      "review-cross-layer-edge",
      target,
      {
        operationType: "review",
        target,
      },
      "cross-layer-review-default",
      ["requires-review"],
      "review-required",
    ),
  ];
}

function proposal(
  finding: StructuralFinding,
  analysis: StructuralAnalysisResult,
  proposalType: StructuralProposalType,
  target: StructuralPlanTargetIdentity,
  operation: StructuralAbstractOperation,
  rationaleCode: string,
  riskFlags: readonly StructuralPlanRiskFlag[],
  status: StructuralProposalStatus,
): StructuralChangeProposal {
  const preconditions = conditionsFor(
    finding,
    analysis,
    target,
    proposalType,
    "pre",
  );
  const expectedPostconditions = conditionsFor(
    finding,
    analysis,
    target,
    proposalType,
    "post",
  );
  const withoutId = {
    sourceFindingIds: [finding.findingId],
    proposalType,
    target,
    operation,
    rationaleCode,
  };
  return {
    proposalId: proposalId(withoutId),
    sourceFindingIds: [finding.findingId],
    proposalType,
    target,
    operation,
    preconditions,
    expectedPostconditions,
    riskFlags: uniqueSortedFlags(riskFlags),
    evidenceClass: finding.confidence,
    rationaleCode,
    coverage: {
      completeness: finding.coverage.completeness,
      conclusive: finding.coverage.conclusive,
      pageCovered: finding.coverage.pageCovered,
      layerCovered: finding.coverage.layerCovered,
    },
    provenance: {
      analysisVersion: analysis.analysisVersion,
      findingType: finding.findingType,
      classification: classificationFor(finding),
    },
    status,
  };
}

function conditionsFor(
  finding: StructuralFinding,
  analysis: StructuralAnalysisResult,
  target: StructuralPlanTargetIdentity,
  proposalType: StructuralProposalType,
  kind: "pre" | "post",
): readonly StructuralPlanCondition[] {
  if (kind === "post") {
    if (proposalType === "detach-broken-terminal") {
      return [{ code: "expected-terminal-detached", target }];
    }
    if (proposalType === "remove-dangling-edge") {
      return [{ code: "expected-edge-absent", target }];
    }
    if (proposalType === "delete-orphan-element") {
      return [
        { code: "orphan-status-requires-reevaluation", target },
        { code: "finding-expected-to-disappear-after-reanalysis", target },
      ];
    }
    if (proposalType === "retain-orphan-element") {
      return [{ code: "element-retention-proposed", target }];
    }
    if (proposalType === "load-external-context") {
      return [{ code: "external-context-required", target }];
    }
    if (proposalType === "review-cross-layer-edge") {
      return [{ code: "cross-layer-relation-requires-reevaluation", target }];
    }
    return [{ code: "manual-review-required", target }];
  }
  const conditions: StructuralPlanCondition[] = [
    { code: "document-id-matches" },
    { code: "finding-still-exists", target },
    { code: "finding-classification-unchanged", target },
    { code: "target-element-identity-unchanged", target },
    { code: "page-layer-context-unchanged", target },
    { code: "coverage-requirement-satisfied", target },
    { code: "no-conflicting-proposal-accepted", target },
  ];
  if (analysis.revisionEvidence.documentRevisions.length > 0) {
    conditions.push({ code: "document-revision-matches" });
  }
  if (finding.findingType === "broken-reference") {
    conditions.push({
      code:
        finding.status === "ambiguous"
          ? "referenced-element-remains-ambiguous"
          : "referenced-element-remains-absent",
      target,
    });
  }
  return conditions.sort(compareConditions);
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

function selectFindings(
  input: StructuralChangePlanInput,
  limits: StructuralChangePlanLimits,
  diagnostics: StructuralPlanDiagnostic[],
):
  | {
      readonly ok: true;
      readonly findings: readonly StructuralFinding[];
      readonly ids: readonly string[];
    }
  | { readonly ok: false; readonly outcome: StructuralChangePlanOutcome } {
  const analysis = input.analysis;
  const byId = new Map<string, StructuralFinding>();
  for (const finding of analysis.findings) {
    if (!validIdentifier(finding.findingId, limits)) {
      diagnostics.push({
        code: "validation-failed",
        severity: "error",
        detail: { reason: "invalid-finding-id" },
      });
      return { ok: false, outcome: "validation-failed" };
    }
    const existing = byId.get(finding.findingId);
    if (existing && canonicalJson(existing) !== canonicalJson(finding)) {
      diagnostics.push({
        code: "duplicate-finding-id",
        severity: "error",
        findingId: finding.findingId,
      });
      return { ok: false, outcome: "validation-failed" };
    }
    byId.set(finding.findingId, finding);
  }
  const ids = input.queryResult
    ? input.queryResult.results.map((finding) => finding.findingId)
    : input.selectedFindingIds;
  if (input.queryResult && input.queryResult.outcome !== "ok") {
    const outcome =
      input.queryResult.completeness === "stale"
        ? "stale-analysis"
        : "insufficient-coverage";
    diagnostics.push({
      code: outcome,
      severity: "error",
    });
    return { ok: false, outcome };
  }
  if (
    input.queryResult &&
    !queryMatchesAnalysis(input.queryResult, input.analysis, byId)
  ) {
    diagnostics.push({ code: "validation-failed", severity: "error" });
    return { ok: false, outcome: "validation-failed" };
  }
  if (!ids) {
    diagnostics.push({ code: "invalid-plan-input", severity: "error" });
    return { ok: false, outcome: "invalid-input" };
  }
  if (!Array.isArray(ids)) {
    diagnostics.push({ code: "invalid-plan-input", severity: "error" });
    return { ok: false, outcome: "invalid-input" };
  }
  if (ids.length > limits.maxSelectedFindings) {
    diagnostics.push({
      code: "limit-exceeded",
      severity: "error",
      detail: {
        limit: "maxSelectedFindings",
        maxSelectedFindings: limits.maxSelectedFindings,
      },
    });
    return { ok: false, outcome: "validation-failed" };
  }
  const uniqueIds = uniqueSorted(ids);
  const findings: StructuralFinding[] = [];
  for (const id of uniqueIds) {
    if (!validIdentifier(id, limits)) {
      diagnostics.push({
        code: "invalid-plan-input",
        severity: "error",
        detail: { field: "selectedFindingIds" },
      });
      return { ok: false, outcome: "invalid-input" };
    }
    const finding = byId.get(id);
    if (!finding) {
      diagnostics.push({
        code: "finding-not-found",
        severity: "error",
        findingId: id,
      });
      return { ok: false, outcome: "validation-failed" };
    }
    findings.push(clone(finding));
  }
  return { ok: true, findings: findings.sort(compareFindings), ids: uniqueIds };
}

function validatePolicy(
  policy: StructuralChangePlanPolicy | undefined,
  diagnostics: StructuralPlanDiagnostic[],
): {
  readonly ok: boolean;
  readonly outcome: StructuralChangePlanOutcome;
} {
  if (policy === undefined) {
    return { ok: true, outcome: "planned" };
  }
  if (!safeRecord(policy)) {
    diagnostics.push({ code: "invalid-plan-input", severity: "error" });
    return { ok: false, outcome: "invalid-input" };
  }
  for (const key of Object.keys(policy)) {
    if (!POLICY_KEYS.has(key)) {
      diagnostics.push({
        code: "invalid-plan-input",
        severity: "error",
        detail: { field: key },
      });
      return { ok: false, outcome: "invalid-input" };
    }
  }
  const booleanFields = [
    "allowDeleteConfirmedOrphans",
    "allowDetachBrokenTerminals",
    "allowRemoveDanglingEdges",
    "allowCrossLayerReview",
    "allowCrossLayerReconnect",
    "requireCompleteDocument",
    "requireCompleteTargetScopes",
  ] as const;
  for (const field of booleanFields) {
    if (policy[field] !== undefined && typeof policy[field] !== "boolean") {
      diagnostics.push({
        code: "invalid-plan-input",
        severity: "error",
        detail: { field },
      });
      return { ok: false, outcome: "invalid-input" };
    }
  }
  if (
    policy.name !== undefined &&
    policy.name !== "conservative" &&
    policy.name !== "review-only"
  ) {
    diagnostics.push({
      code: "invalid-plan-input",
      severity: "error",
      detail: { field: "name" },
    });
    return { ok: false, outcome: "invalid-input" };
  }
  if (
    policy.orphanDefaultAction !== undefined &&
    policy.orphanDefaultAction !== "manual-review" &&
    policy.orphanDefaultAction !== "retain"
  ) {
    diagnostics.push({
      code: "invalid-plan-input",
      severity: "error",
      detail: { field: "orphanDefaultAction" },
    });
    return { ok: false, outcome: "invalid-input" };
  }
  if (
    policy.crossLayerDefaultAction !== undefined &&
    policy.crossLayerDefaultAction !== "review" &&
    policy.crossLayerDefaultAction !== "no-op"
  ) {
    diagnostics.push({
      code: "invalid-plan-input",
      severity: "error",
      detail: { field: "crossLayerDefaultAction" },
    });
    return { ok: false, outcome: "invalid-input" };
  }
  if (policy.name === "review-only") {
    const destructiveOverride =
      policy.allowDeleteConfirmedOrphans === true ||
      policy.allowDetachBrokenTerminals === true ||
      policy.allowRemoveDanglingEdges === true ||
      policy.allowCrossLayerReconnect === true;
    if (destructiveOverride) {
      diagnostics.push({
        code: "blocked-by-policy",
        severity: "error",
        detail: { reason: "review-only-with-mutating-allowance" },
      });
      return { ok: false, outcome: "blocked-by-policy" };
    }
  }
  if (
    policy.allowDetachBrokenTerminals === true &&
    policy.allowRemoveDanglingEdges === true
  ) {
    diagnostics.push({
      code: "blocked-by-policy",
      severity: "error",
      detail: { reason: "multiple-broken-terminal-strategies" },
    });
    return { ok: false, outcome: "blocked-by-policy" };
  }
  if (
    policy.orphanDefaultAction === "retain" &&
    policy.allowDeleteConfirmedOrphans === true
  ) {
    diagnostics.push({
      code: "blocked-by-policy",
      severity: "error",
      detail: { reason: "retain-and-delete-orphan-policy" },
    });
    return { ok: false, outcome: "blocked-by-policy" };
  }
  return { ok: true, outcome: "planned" };
}

function validateRevision(
  input: StructuralChangePlanInput,
  diagnostics: StructuralPlanDiagnostic[],
): StructuralChangePlanOutcome | undefined {
  if (!input.analysis.revisionEvidence.revisionCompatible) {
    diagnostics.push({ code: "stale-analysis", severity: "error" });
    return "stale-analysis";
  }
  if (input.reviewContext?.knownDocumentRevisionMismatch) {
    diagnostics.push({ code: "stale-analysis", severity: "error" });
    return "stale-analysis";
  }
  const expected = input.reviewContext?.expectedDocumentRevision;
  const observed = input.analysis.revisionEvidence.documentRevisions;
  if (expected && observed.length > 0 && !observed.includes(expected)) {
    diagnostics.push({
      code: "validation-failed",
      severity: "error",
      detail: { reason: "revision-mismatch" },
    });
    return "validation-failed";
  }
  if (observed.length === 0) {
    diagnostics.push({ code: "revision-evidence-missing", severity: "warn" });
  }
  return undefined;
}

function validateCoverage(
  analysis: StructuralAnalysisResult,
  policy: Required<StructuralChangePlanPolicy>,
  diagnostics: StructuralPlanDiagnostic[],
): StructuralChangePlanOutcome | undefined {
  if (analysis.completeness === "stale" || analysis.coverage.stale) {
    diagnostics.push({ code: "stale-analysis", severity: "error" });
    return "stale-analysis";
  }
  if (
    policy.requireCompleteDocument &&
    analysis.completeness !== "complete-document"
  ) {
    diagnostics.push({
      code: "insufficient-coverage",
      severity: "error",
      detail: { requirement: "complete-document" },
    });
    return "insufficient-coverage";
  }
  if (
    policy.requireCompleteTargetScopes &&
    analysis.completeness !== "complete-document" &&
    analysis.completeness !== "complete-target-scopes"
  ) {
    diagnostics.push({
      code: "insufficient-coverage",
      severity: "error",
      detail: { requirement: "complete-target-scopes" },
    });
    return "insufficient-coverage";
  }
  return undefined;
}

function queryMatchesAnalysis(
  queryResult: StructuralAnalysisQueryResult,
  analysis: StructuralAnalysisResult,
  findingsById: ReadonlyMap<string, StructuralFinding>,
): boolean {
  if (
    queryResult.analysisVersion !== analysis.analysisVersion ||
    queryResult.documentId !== analysis.documentId ||
    queryResult.completeness !== analysis.completeness ||
    canonicalJson(queryResult.coverage) !== canonicalJson(analysis.coverage) ||
    canonicalJson(queryResult.revisionEvidence) !==
      canonicalJson(analysis.revisionEvidence) ||
    canonicalJson(queryResult.analysisDiagnostics) !==
      canonicalJson(analysis.diagnostics) ||
    canonicalJson(queryResult.limitations) !== canonicalJson(analysis.limitations)
  ) {
    return false;
  }
  if (
    queryResult.returned !== queryResult.results.length ||
    queryResult.totalMatched < queryResult.results.length ||
    queryResult.offset < 0 ||
    queryResult.limit < 0
  ) {
    return false;
  }
  if (
    queryResult.finding &&
    (queryResult.results.length !== 1 ||
      canonicalJson(queryResult.finding) !== canonicalJson(queryResult.results[0]))
  ) {
    return false;
  }
  const seen = new Map<string, StructuralFinding>();
  for (const finding of queryResult.results) {
    const prior = seen.get(finding.findingId);
    if (prior && canonicalJson(prior) !== canonicalJson(finding)) {
      return false;
    }
    seen.set(finding.findingId, finding);
    const analysisFinding = findingsById.get(finding.findingId);
    if (!analysisFinding || canonicalJson(analysisFinding) !== canonicalJson(finding)) {
      return false;
    }
  }
  return true;
}

function destructiveCoverageAllowed(
  analysis: StructuralAnalysisResult,
  finding: StructuralFinding,
): boolean {
  return (
    (analysis.completeness === "complete-document" ||
      analysis.completeness === "complete-target-scopes") &&
    finding.coverage.conclusive &&
    finding.coverage.pageCovered &&
    finding.coverage.layerCovered &&
    finding.coverage.completeness !== "partial" &&
    finding.coverage.completeness !== "truncated" &&
    finding.coverage.completeness !== "stale" &&
    finding.coverage.completeness !== "unknown"
  );
}

function validateProposalConditionLimits(
  proposals: readonly StructuralChangeProposal[],
  limits: StructuralChangePlanLimits,
  diagnostics: StructuralPlanDiagnostic[],
): StructuralChangePlanOutcome | undefined {
  for (const proposal of proposals) {
    if (
      proposal.preconditions.length > limits.maxPreconditionsPerProposal ||
      proposal.expectedPostconditions.length >
        limits.maxPostconditionsPerProposal
    ) {
      diagnostics.push({
        code: "limit-exceeded",
        severity: "error",
        proposalId: proposal.proposalId,
        detail: { limit: "proposal-conditions" },
      });
      return "validation-failed";
    }
  }
  return undefined;
}

function dedupeProposals(
  proposals: readonly StructuralChangeProposal[],
  diagnostics: StructuralPlanDiagnostic[],
): readonly StructuralChangeProposal[] {
  const byKey = new Map<string, StructuralChangeProposal>();
  for (const proposal of proposals) {
    const key = canonicalJson({
      proposalType: proposal.proposalType,
      target: proposal.target,
      operation: proposal.operation,
      rationaleCode: proposal.rationaleCode,
    });
    const existing = byKey.get(key);
    if (existing) {
      diagnostics.push({
        code: "proposal-deduplicated",
        severity: "info",
        proposalId: proposal.proposalId,
      });
      byKey.set(key, {
        ...existing,
        sourceFindingIds: uniqueSorted([
          ...existing.sourceFindingIds,
          ...proposal.sourceFindingIds,
        ]),
      });
      continue;
    }
    byKey.set(key, proposal);
  }
  return [...byKey.values()];
}

function detectConflicts(
  proposals: readonly StructuralChangeProposal[],
): readonly StructuralPlanConflict[] {
  const conflicts: StructuralPlanConflict[] = [];
  const byTerminal = new Map<string, StructuralChangeProposal[]>();
  const byElementAction = new Map<string, StructuralChangeProposal[]>();
  const byEdgeAction = new Map<string, StructuralChangeProposal[]>();
  const byMove = new Map<string, Set<string>>();
  const moves = new Map<string, StructuralChangeProposal[]>();
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
    if (proposal.operation.operationType === "move-element-to-layer") {
      const elementKey = elementIdentityKey({
        ...proposal.target,
        elementId: proposal.operation.target.elementId,
      });
      const layers = byMove.get(elementKey) ?? new Set<string>();
      layers.add(
        canonicalJson({
          pageId: proposal.target.pageId,
          layerId: proposal.operation.target.layerId,
        }),
      );
      byMove.set(elementKey, layers);
      push(moves, elementKey, proposal);
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
    const reconnects = proposals.filter(
      (proposal) =>
        proposal.operation.operationType === "reconnect-edge" &&
        elementIdentityKey({
          ...proposal.target,
          elementId: proposal.operation.target.elementId,
        }) === elementIdentityKey(proposalsForElement[0]!.target),
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
    if (deletes.length > 0 && reconnects.length > 0) {
      conflicts.push(
        conflict(
          "delete-reconnect-target",
          [...deletes, ...reconnects],
          deletes[0]!.target,
          "delete-reconnect-same-element",
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
  for (const [elementKey, layers] of byMove) {
    if (layers.size > 1) {
      conflicts.push(
        conflict(
          "move-to-multiple-layers",
          moves.get(elementKey) ?? [],
          moves.get(elementKey)?.[0]?.target ?? {},
          "move-element-multiple-layers",
        ),
      );
    }
  }
  return dedupeConflicts(conflicts);
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

function dedupeConflicts(
  conflicts: readonly StructuralPlanConflict[],
): readonly StructuralPlanConflict[] {
  const byId = new Map<string, StructuralPlanConflict>();
  for (const conflict of conflicts) {
    byId.set(conflict.conflictId, conflict);
  }
  return [...byId.values()];
}

function basePlanParts(
  analysis?: StructuralAnalysisResult,
  queryResult?: StructuralAnalysisQueryResult,
): Omit<
  StructuralChangePlan,
  | "planId"
  | "outcome"
  | "selectedFindingIds"
  | "selectedFindingCount"
  | "proposalCount"
  | "conflictCount"
  | "skippedCount"
  | "manualReviewCount"
  | "proposals"
  | "conflicts"
  | "preconditions"
  | "diagnostics"
  | "limitations"
  | "summary"
> {
  return {
    planVersion: STRUCTURAL_CHANGE_PLAN_VERSION,
    documentId: analysis?.documentId,
    documentRevision: analysis?.revisionEvidence?.documentRevisions?.[0],
    analysisVersion: analysis?.analysisVersion ?? "",
    queryVersion: queryResult?.queryVersion,
    revisionEvidence: clone(
      analysis?.revisionEvidence ?? {
        contentRevisions: [],
        documentRevisions: [],
        revisionCompatible: false,
      },
    ),
    coverage: clone(
      analysis?.coverage ?? {
        document: false,
        pageIds: [],
        layerTargets: [],
        conclusive: false,
        completeness: "unknown",
      },
    ),
    completeness: analysis?.completeness ?? "unknown",
    revisionCompatible: analysis?.revisionEvidence?.revisionCompatible ?? false,
  };
}

function emptyPlan(
  base: ReturnType<typeof basePlanParts>,
  outcome: StructuralChangePlanOutcome,
  diagnostics: StructuralPlanDiagnostic[],
  extraCodes: readonly StructuralPlanDiagnosticCode[],
): StructuralChangePlan {
  for (const code of extraCodes) {
    diagnostics.push({ code, severity: "error" });
  }
  const planBase = {
    ...base,
    selectedFindingIds: [],
    selectedFindingCount: 0,
    proposalCount: 0,
    conflictCount: 0,
    skippedCount: 0,
    manualReviewCount: 0,
    proposals: [],
    conflicts: [],
    preconditions: [],
    diagnostics: {
      analysisDiagnostics: [],
      queryDiagnostics: [],
      planningDiagnostics: diagnostics.sort(comparePlanDiagnostics),
    },
    limitations: [],
  };
  return {
    ...planBase,
    planId: planId(planBase, {}),
    outcome,
    summary: { planned: 0, noOp: 0, manualReview: 0, blocked: 0, conflicts: 0 },
  };
}

function outcomeFor(
  plan: Pick<StructuralChangePlan, "proposals" | "manualReviewCount">,
  diagnostics: readonly StructuralPlanDiagnostic[],
  conflicts: readonly StructuralPlanConflict[],
): StructuralChangePlanOutcome {
  if (
    diagnostics.some((diagnostic) => diagnostic.code === "invalid-plan-input")
  ) {
    return "invalid-input";
  }
  if (
    diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "validation-failed" ||
        diagnostic.code === "limit-exceeded",
    )
  ) {
    return "validation-failed";
  }
  if (diagnostics.some((diagnostic) => diagnostic.code === "stale-analysis")) {
    return "stale-analysis";
  }
  if (
    diagnostics.some(
      (diagnostic) => diagnostic.code === "insufficient-coverage",
    )
  ) {
    return "insufficient-coverage";
  }
  if (conflicts.length > 0) {
    return "conflict";
  }
  if (
    plan.proposals.some((proposal) => proposal.status === "proposed") &&
    plan.manualReviewCount > 0
  ) {
    return "planned-with-review";
  }
  if (plan.proposals.some((proposal) => proposal.status === "proposed")) {
    return "planned";
  }
  if (plan.manualReviewCount > 0) {
    return "manual-review";
  }
  return "no-op";
}

function planPreconditions(
  analysis: StructuralAnalysisResult,
): readonly StructuralPlanCondition[] {
  const conditions: StructuralPlanCondition[] = [
    { code: "document-id-matches" },
    { code: "coverage-requirement-satisfied" },
  ];
  if (analysis.revisionEvidence.documentRevisions.length > 0) {
    conditions.push({ code: "document-revision-matches" });
  }
  return conditions.sort(compareConditions);
}

function limitationsForPlan(
  analysis: StructuralAnalysisResult,
): readonly string[] {
  return analysis.revisionEvidence.documentRevisions.length === 0
    ? ["document-revision-evidence-missing"]
    : [];
}

function validLimits(
  limits: StructuralChangePlanLimits,
  diagnostics: StructuralPlanDiagnostic[],
): boolean {
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      diagnostics.push({
        code: "validation-failed",
        severity: "error",
        detail: { field: key },
      });
      return false;
    }
  }
  return true;
}

function validIdentifier(
  value: string,
  limits: Pick<StructuralChangePlanLimits, "maxIdentifierLength">,
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

function classificationFor(finding: StructuralFinding): string {
  if (finding.findingType === "broken-reference") {
    return finding.status;
  }
  if (finding.findingType === "cross-layer-edge") {
    return finding.relationClassification;
  }
  return finding.status;
}

function compareFindings(
  left: StructuralFinding,
  right: StructuralFinding,
): number {
  return (
    left.findingType.localeCompare(right.findingType) ||
    findingPage(left).localeCompare(findingPage(right)) ||
    findingLayer(left).localeCompare(findingLayer(right)) ||
    findingSource(left).localeCompare(findingSource(right)) ||
    findingTarget(left).localeCompare(findingTarget(right)) ||
    findingReason(left).localeCompare(findingReason(right)) ||
    left.findingId.localeCompare(right.findingId)
  );
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

function comparePlanDiagnostics(
  left: StructuralPlanDiagnostic,
  right: StructuralPlanDiagnostic,
): number {
  return (
    left.code.localeCompare(right.code) ||
    (left.findingId ?? "").localeCompare(right.findingId ?? "") ||
    (left.proposalId ?? "").localeCompare(right.proposalId ?? "")
  );
}

function compareAnalysisDiagnostics(
  left: StructuralAnalysisDiagnostic,
  right: StructuralAnalysisDiagnostic,
): number {
  return (
    left.code.localeCompare(right.code) ||
    (left.pageId ?? "").localeCompare(right.pageId ?? "") ||
    (left.layerId ?? "").localeCompare(right.layerId ?? "") ||
    (left.elementId ?? "").localeCompare(right.elementId ?? "")
  );
}

function compareQueryDiagnostics(
  left: StructuralQueryDiagnostic,
  right: StructuralQueryDiagnostic,
): number {
  return left.code.localeCompare(right.code);
}

function findingPage(finding: StructuralFinding): string {
  return finding.findingType === "cross-layer-edge"
    ? (finding.sourcePageId ?? "")
    : (finding.pageId ?? "");
}

function findingLayer(finding: StructuralFinding): string {
  return finding.findingType === "cross-layer-edge"
    ? (finding.sourceLayerId ?? "")
    : (finding.layerId ?? "");
}

function findingSource(finding: StructuralFinding): string {
  if (finding.findingType === "orphan-element") {
    return finding.elementId;
  }
  if (finding.findingType === "cross-layer-edge") {
    return finding.sourceElementId ?? finding.edgeId;
  }
  return finding.sourceElementId ?? "";
}

function findingTarget(finding: StructuralFinding): string {
  if (finding.findingType === "cross-layer-edge") {
    return finding.targetElementId ?? "";
  }
  if (finding.findingType === "broken-reference") {
    return finding.referencedElementId ?? "";
  }
  return "";
}

function findingReason(finding: StructuralFinding): string {
  return finding.reasonCode;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function uniqueSortedFlags(
  values: readonly StructuralPlanRiskFlag[],
): readonly StructuralPlanRiskFlag[] {
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
