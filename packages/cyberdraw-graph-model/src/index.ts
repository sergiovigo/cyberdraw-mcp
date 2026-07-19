export {
  fromLegacyPagedModel,
  toCanonicalDiagramInput,
} from "./legacy-adapter.js";
export {
  fromRuntimeSnapshot,
  toCanonicalRuntimeSnapshotInput,
} from "./runtime-snapshot-adapter.js";
export {
  defaultSnapshotPlanLimits,
  planHierarchicalSnapshot,
  scopeKey,
} from "./hierarchical-snapshot-planner.js";
export { mergeScopedSnapshotResults } from "./scoped-snapshot-merge.js";
export {
  analyzeGraphStructure,
  STRUCTURAL_ANALYSIS_VERSION,
} from "./structural-analysis.js";
export {
  defaultStructuralQueryLimits,
  queryStructuralAnalysis,
  STRUCTURAL_QUERY_VERSION,
} from "./structural-query.js";
export {
  defaultStructuralChangePlanLimits,
  defaultStructuralChangePlanPolicy,
  planStructuralChanges,
  STRUCTURAL_CHANGE_PLAN_VERSION,
} from "./structural-change-plan.js";
export {
  defaultStructuralChangePlanValidationLimits,
  validateStructuralChangePlan,
  STRUCTURAL_CHANGE_PLAN_VALIDATION_VERSION,
} from "./structural-change-plan-validation.js";
export {
  provisionalDiagramId,
  provisionalElementId,
  provisionalLayerId,
  provisionalPageId,
} from "./identity.js";
export { normalizeDiagram } from "./normalize.js";
export {
  getElement,
  getElementsByDrawioId,
  getElementsByLayer,
  getElementsByPage,
  incomingEdges,
  outgoingEdges,
} from "./queries.js";
export { serializeSnapshot, toSerializableSnapshot } from "./serialize.js";
export { validateBrokenReferences } from "./validation.js";
export type {
  BrokenReferenceFinding,
  CanonicalDiagramInput,
  CanonicalElementInput,
  CanonicalLayerInput,
  CanonicalPageInput,
  DiagramSnapshot,
  EdgeElement,
  Geometry,
  GraphElement,
  GroupElement,
  Label,
  LayerSnapshot,
  NodeElement,
  PageSnapshot,
  SourceRef,
  Style,
  UnknownElement,
} from "./types.js";
export type {
  DiagramInventory,
  HierarchicalSnapshotIntent,
  HierarchicalSnapshotIntentKind,
  InventoryLayer,
  InventoryPage,
  PlannerSnapshotScope,
  SnapshotPlan,
  SnapshotPlanCoverage,
  SnapshotPlanDecision,
  SnapshotPlanDiagnostic,
  SnapshotPlanExecutionResult,
  SnapshotPlanEstimate,
  SnapshotPlanLimits,
  SnapshotPlanStep,
  SnapshotPlanStopReason,
} from "./hierarchical-snapshot-planner.js";
export type {
  ScopedSnapshotMergeDiagnostic,
  ScopedSnapshotMergeResult,
} from "./scoped-snapshot-merge.js";
export type {
  BrokenReferenceStatus,
  CrossLayerRelationClassification,
  OrphanStatus,
  StructuralAnalysisCounts,
  StructuralAnalysisCoverage,
  StructuralAnalysisDiagnostic,
  StructuralAnalysisInput,
  StructuralAnalysisResult,
  StructuralBrokenReferenceFinding,
  StructuralCompleteness,
  StructuralCount,
  StructuralCountBasis,
  StructuralCrossLayerFinding,
  StructuralExternalReference,
  StructuralFinding,
  StructuralFindingConfidence,
  StructuralFindingType,
  StructuralOrphanFinding,
} from "./structural-analysis.js";
export type {
  GetStructuralFindingQuery,
  ListStructuralFindingsQuery,
  StructuralAnalysisQuery,
  StructuralAnalysisQueryInput,
  StructuralAnalysisQueryResult,
  StructuralCountsQuery,
  StructuralCoverageRequirement,
  StructuralFindingClassification,
  StructuralFindingFilters,
  StructuralQueryDiagnostic,
  StructuralQueryDiagnosticCode,
  StructuralQueryKind,
  StructuralQueryLimits,
  StructuralQueryOrder,
  StructuralSummaryBucket,
  StructuralSummaryGroupBy,
  SummarizeStructuralFindingsQuery,
} from "./structural-query.js";
export type {
  StructuralAbstractOperation,
  StructuralChangePlan,
  StructuralChangePlanInput,
  StructuralChangePlanLimits,
  StructuralChangePlanOutcome,
  StructuralChangePlanPolicy,
  StructuralChangePlanPolicyName,
  StructuralChangeProposal,
  StructuralPlanConflict,
  StructuralPlanConflictType,
  StructuralPlanDiagnostic,
  StructuralPlanDiagnosticCode,
  StructuralPlanPostconditionCode,
  StructuralPlanPreconditionCode,
  StructuralPlanRiskFlag,
  StructuralPlanTargetIdentity,
  StructuralProposalStatus,
  StructuralProposalType,
} from "./structural-change-plan.js";
export type {
  StructuralChangePlanValidationDiagnostic,
  StructuralChangePlanValidationDiagnosticCode,
  StructuralChangePlanValidationInput,
  StructuralChangePlanValidationLimits,
  StructuralChangePlanValidationMode,
  StructuralChangePlanValidationOutcome,
  StructuralChangePlanValidationResult,
  StructuralConflictValidationResult,
  StructuralPlanConditionValidationStatus,
  StructuralPreconditionValidationResult,
  StructuralProposalValidationResult,
  StructuralProposalValidationStatus,
  StructuralRevisionEvidence,
} from "./structural-change-plan-validation.js";
