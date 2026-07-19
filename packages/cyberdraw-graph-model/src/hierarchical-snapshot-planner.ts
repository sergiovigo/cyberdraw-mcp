import type { StructuralAnalysisResult } from "./structural-analysis.js";
import type { DiagramSnapshot, JsonValue } from "./types.js";

export const HIERARCHICAL_SNAPSHOT_PLANNER_VERSION =
  "cyberdraw.hierarchical-snapshot-planner.v1";

export type HierarchicalSnapshotIntentKind =
  | "inspect-document"
  | "inspect-visible-page"
  | "inspect-pages"
  | "inspect-layers"
  | "inspect-selection"
  | "analyze-structure";

export type HierarchicalSnapshotIntent = {
  readonly kind: HierarchicalSnapshotIntentKind;
  readonly pageIds?: readonly string[];
  readonly layers?: readonly {
    readonly pageId: string;
    readonly layerIds: readonly string[];
  }[];
  readonly requireCompleteDocument?: boolean;
};

export type PlannerSnapshotScope =
  | { readonly kind: "document" }
  | { readonly kind: "pages"; readonly pageIds: readonly string[] }
  | {
      readonly kind: "layers";
      readonly pageId: string;
      readonly layerIds: readonly string[];
    }
  | { readonly kind: "selection"; readonly pageId?: string };

export type EstimateBasis = "exact" | "observed" | "estimated" | "unknown";

export type SnapshotPlanEstimate = {
  readonly basis: EstimateBasis;
  readonly elements?: number;
  readonly bytes?: number;
  readonly safetyMarginRatio: number;
};

export type LimitRisk = "none" | "soft" | "hard" | "unknown";

export type SnapshotPlanLimits = {
  readonly softSnapshotBytes: number;
  readonly hardSnapshotBytes: number;
  readonly maxPages: number;
  readonly maxLayersPerPage: number;
  readonly maxElementsPerPage: number;
  readonly maxMetadataStringLength: number;
  readonly executionTimeoutMs: number;
  readonly maxPlanSteps: number;
  readonly maxExpansionDepth: number;
  readonly safetyMarginRatio: number;
};

export type InventoryCompleteness =
  | "complete"
  | "partial"
  | "estimated"
  | "unknown";

export type InventoryCount = {
  readonly value?: number;
  readonly basis: EstimateBasis;
};

export type InventoryLayer = {
  readonly id: string;
  readonly name?: string;
  readonly order: number;
  readonly visible?: boolean;
  readonly locked?: boolean;
  readonly approximateElementCount?: InventoryCount;
  readonly approximatePayloadBytes?: InventoryCount;
};

export type InventoryPage = {
  readonly id: string;
  readonly name?: string;
  readonly order: number;
  readonly active?: boolean;
  readonly layers: readonly InventoryLayer[];
  readonly approximateElementCount?: InventoryCount;
  readonly approximatePayloadBytes?: InventoryCount;
  readonly externalReferenceCount?: InventoryCount;
};

export type SnapshotPlanDiagnosticCode =
  | "selection-preferred"
  | "selection-empty"
  | "explicit-layer-target"
  | "explicit-page-target"
  | "visible-page-default"
  | "document-bounded"
  | "document-too-large"
  | "layer-reduces-payload"
  | "background-page-required"
  | "external-context-required"
  | "hard-limit-avoidance"
  | "soft-limit-advisory"
  | "incomplete-inventory"
  | "missing-target"
  | "unsupported-scope"
  | "max-steps-reached"
  | "maximum-expansion-depth"
  | "duplicate-scope-deduplicated"
  | "unknown-estimate";

export type SnapshotPlanDiagnostic = {
  readonly code: SnapshotPlanDiagnosticCode;
  readonly severity: "debug" | "info" | "warn" | "error";
  readonly scope?: PlannerSnapshotScope;
  readonly targetId?: string;
  readonly detail?: JsonValue;
};

export type SnapshotPlanDecision = {
  readonly code: SnapshotPlanDiagnosticCode;
  readonly scope: PlannerSnapshotScope;
  readonly reason: string;
};

export type SnapshotPlanCoverage = {
  readonly document: boolean;
  readonly pageIds: readonly string[];
  readonly layerTargets: readonly {
    readonly pageId: string;
    readonly layerIds: readonly string[];
  }[];
  readonly selection: boolean;
  readonly conclusive: boolean;
};

export type SnapshotPlanStep = {
  readonly id: string;
  readonly ordinal: number;
  readonly phase: "inventory" | "snapshot" | "validation" | "stop";
  readonly requestedScope: PlannerSnapshotScope;
  readonly targetIds: readonly string[];
  readonly reason: SnapshotPlanDiagnosticCode;
  readonly expectedCoverage: SnapshotPlanCoverage;
  readonly estimate: SnapshotPlanEstimate;
  readonly softLimitRisk: LimitRisk;
  readonly hardLimitRisk: LimitRisk;
  readonly prerequisites: readonly string[];
  readonly required: boolean;
  readonly stopOnFailure: boolean;
  readonly expectedDiagnostics: readonly SnapshotPlanDiagnosticCode[];
};

export type SnapshotPlanStopReason =
  | "complete"
  | "intent-satisfied"
  | "soft-limit-advisory"
  | "hard-limit-reached"
  | "missing-target"
  | "stale-snapshot"
  | "incomplete-inventory"
  | "unsupported-scope"
  | "execution-error"
  | "max-steps-reached"
  | "timeout"
  | "validation-failed";

export type DiagramInventory = {
  readonly schemaVersion: "cyberdraw.diagram-inventory.v1";
  readonly documentId?: string;
  readonly contentRevision?: string;
  readonly activePageId?: string;
  readonly pages: readonly InventoryPage[];
  readonly selection?: {
    readonly pageId?: string;
    readonly count: InventoryCount;
  };
  readonly externalReferenceCount?: InventoryCount;
  readonly completeness: InventoryCompleteness;
  readonly softLimitProximity?: number;
  readonly hardLimitProximity?: number;
  readonly diagnostics: readonly SnapshotPlanDiagnostic[];
};

export type SnapshotPlan = {
  readonly schemaVersion: typeof HIERARCHICAL_SNAPSHOT_PLANNER_VERSION;
  readonly intent: HierarchicalSnapshotIntent;
  readonly limits: SnapshotPlanLimits;
  readonly steps: readonly SnapshotPlanStep[];
  readonly decisions: readonly SnapshotPlanDecision[];
  readonly diagnostics: readonly SnapshotPlanDiagnostic[];
  readonly stopReason: SnapshotPlanStopReason;
};

export type SnapshotPlanExecutionResult = {
  readonly plan: SnapshotPlan;
  readonly coverage: SnapshotPlanCoverage;
  readonly graph?: DiagramSnapshot;
  readonly structuralAnalysis?: StructuralAnalysisResult;
  readonly stopReason: SnapshotPlanStopReason;
  readonly diagnostics: readonly SnapshotPlanDiagnostic[];
  readonly metrics: {
    readonly inventoryDurationMs?: number;
    readonly planningDurationMs?: number;
    readonly executionDurationMs?: number;
    readonly stepsPlanned: number;
    readonly stepsExecuted: number;
    readonly scopesUsed: readonly string[];
    readonly estimatedBytes?: number;
    readonly measuredBytes?: number;
    readonly elementsIncluded?: number;
    readonly contextElements?: number;
    readonly externalReferences?: number;
    readonly revisionsObserved?: readonly string[];
    readonly mergeDiagnostics?: number;
    readonly replans: number;
    readonly diagnosticsCount: number;
  };
};

export type HierarchicalSnapshotPlanInput = {
  readonly inventory: DiagramInventory;
  readonly intent: HierarchicalSnapshotIntent;
  readonly limits: SnapshotPlanLimits;
  readonly supportedScopes?: readonly PlannerSnapshotScope["kind"][];
};

const DEFAULT_BYTES_PER_ELEMENT = 640;
const PAGE_OVERHEAD_BYTES = 2_048;
const LAYER_OVERHEAD_BYTES = 512;

export function defaultSnapshotPlanLimits(
  overrides: Partial<SnapshotPlanLimits> = {},
): SnapshotPlanLimits {
  return {
    softSnapshotBytes: 12 * 1024 * 1024,
    hardSnapshotBytes: 16 * 1024 * 1024,
    maxPages: 100,
    maxLayersPerPage: 100,
    maxElementsPerPage: 25_000,
    maxMetadataStringLength: 8_192,
    executionTimeoutMs: 90_000,
    maxPlanSteps: 16,
    maxExpansionDepth: 2,
    safetyMarginRatio: 1.35,
    ...overrides,
  };
}

export function planHierarchicalSnapshot(
  input: HierarchicalSnapshotPlanInput,
): SnapshotPlan {
  const diagnostics = [...input.inventory.diagnostics];
  const decisions: SnapshotPlanDecision[] = [];
  const steps: SnapshotPlanStep[] = [];
  const supported = new Set(
    input.supportedScopes ?? ["document", "pages", "layers", "selection"],
  );
  const addDiagnostic = (diagnostic: SnapshotPlanDiagnostic) => {
    diagnostics.push(diagnostic);
  };
  const addStep = (
    scope: PlannerSnapshotScope,
    reason: SnapshotPlanDiagnosticCode,
    required = true,
  ) => {
    if (!supported.has(scope.kind)) {
      addDiagnostic({ code: "unsupported-scope", severity: "error", scope });
      return;
    }
    const key = scopeKey(scope);
    if (steps.some((step) => scopeKey(step.requestedScope) === key)) {
      addDiagnostic({
        code: "duplicate-scope-deduplicated",
        severity: "debug",
        scope,
      });
      return;
    }
    if (steps.length >= input.limits.maxPlanSteps) {
      addDiagnostic({ code: "max-steps-reached", severity: "error", scope });
      return;
    }
    const estimate = estimateScope(input.inventory, scope, input.limits);
    const risks = classifyEstimate(estimate, input.limits);
    const step: SnapshotPlanStep = {
      id: stepId(steps.length + 1, scope),
      ordinal: steps.length + 1,
      phase: "snapshot",
      requestedScope: scope,
      targetIds: scopeTargetIds(scope),
      reason,
      expectedCoverage: coverageForScope(scope),
      estimate,
      softLimitRisk: risks.soft,
      hardLimitRisk: risks.hard,
      prerequisites: [],
      required,
      stopOnFailure: required,
      expectedDiagnostics: expectedDiagnostics(scope, reason),
    };
    if (risks.soft === "soft") {
      addDiagnostic({ code: "soft-limit-advisory", severity: "warn", scope });
    }
    if (risks.hard === "hard") {
      addDiagnostic({ code: "hard-limit-avoidance", severity: "warn", scope });
      if (scope.kind === "document") {
        decisions.push({
          code: "document-too-large",
          scope,
          reason: "Document estimate exceeds the hard snapshot limit.",
        });
        return;
      }
    }
    steps.push(step);
    decisions.push({ code: reason, scope, reason: reasonMessage(reason) });
  };

  if (input.inventory.completeness !== "complete") {
    addDiagnostic({ code: "incomplete-inventory", severity: "warn" });
  }

  switch (input.intent.kind) {
    case "inspect-selection": {
      const count = input.inventory.selection?.count.value ?? 0;
      if (count > 0) {
        addStep(
          input.inventory.selection?.pageId
            ? { kind: "selection", pageId: input.inventory.selection.pageId }
            : { kind: "selection" },
          "selection-preferred",
        );
      } else {
        addDiagnostic({ code: "selection-empty", severity: "warn" });
        addVisiblePageFallback(input, addStep, addDiagnostic);
      }
      break;
    }
    case "inspect-layers":
      for (const target of input.intent.layers ?? []) {
        if (!hasLayers(input.inventory, target.pageId, target.layerIds)) {
          addDiagnostic({
            code: "missing-target",
            severity: "error",
            targetId: target.pageId,
          });
          continue;
        }
        addStep(
          {
            kind: "layers",
            pageId: target.pageId,
            layerIds: uniqueSorted(target.layerIds),
          },
          "explicit-layer-target",
        );
      }
      break;
    case "inspect-pages":
      addPages(input, addStep, addDiagnostic);
      break;
    case "inspect-visible-page":
      addVisiblePageFallback(input, addStep, addDiagnostic);
      break;
    case "inspect-document":
      addDocumentOrFallback(input, addStep, addDiagnostic);
      break;
    case "analyze-structure":
      if (input.intent.pageIds?.length) {
        addPages(input, addStep, addDiagnostic);
      } else if (input.intent.layers?.length) {
        for (const target of input.intent.layers) {
          addStep(
            {
              kind: "layers",
              pageId: target.pageId,
              layerIds: uniqueSorted(target.layerIds),
            },
            "explicit-layer-target",
          );
        }
      } else {
        addDocumentOrFallback(input, addStep, addDiagnostic);
      }
      break;
  }

  const hasErrors = diagnostics.some(
    (diagnostic) => diagnostic.severity === "error",
  );
  const stopReason: SnapshotPlanStopReason = diagnostics.some(
    (diagnostic) => diagnostic.code === "max-steps-reached",
  )
    ? "max-steps-reached"
    : steps.length === 0 &&
        diagnostics.some(
          (diagnostic) => diagnostic.code === "hard-limit-avoidance",
        )
      ? "hard-limit-reached"
      : steps.length === 0 && hasErrors
        ? diagnostics.some(
            (diagnostic) => diagnostic.code === "unsupported-scope",
          )
          ? "unsupported-scope"
          : diagnostics.some(
                (diagnostic) => diagnostic.code === "missing-target",
              )
            ? "missing-target"
            : diagnostics.some(
                  (diagnostic) => diagnostic.code === "incomplete-inventory",
                )
              ? "incomplete-inventory"
              : "missing-target"
        : diagnostics.some(
              (diagnostic) => diagnostic.code === "soft-limit-advisory",
            )
          ? "soft-limit-advisory"
          : "intent-satisfied";

  return {
    schemaVersion: HIERARCHICAL_SNAPSHOT_PLANNER_VERSION,
    intent: input.intent,
    limits: input.limits,
    steps,
    decisions,
    diagnostics,
    stopReason,
  };
}

function addPages(
  input: HierarchicalSnapshotPlanInput,
  addStep: (
    scope: PlannerSnapshotScope,
    reason: SnapshotPlanDiagnosticCode,
    required?: boolean,
  ) => void,
  addDiagnostic: (diagnostic: SnapshotPlanDiagnostic) => void,
) {
  const pageIds = uniqueSorted(input.intent.pageIds ?? []);
  const existing = new Set(input.inventory.pages.map((page) => page.id));
  const missing = pageIds.filter((pageId) => !existing.has(pageId));
  if (missing.length > 0) {
    for (const pageId of missing) {
      addDiagnostic({
        code: "missing-target",
        severity: "error",
        targetId: pageId,
      });
    }
    return;
  }
  if (pageIds.length > 0) {
    addStep({ kind: "pages", pageIds }, "explicit-page-target");
  }
}

function addVisiblePageFallback(
  input: HierarchicalSnapshotPlanInput,
  addStep: (
    scope: PlannerSnapshotScope,
    reason: SnapshotPlanDiagnosticCode,
    required?: boolean,
  ) => void,
  addDiagnostic: (diagnostic: SnapshotPlanDiagnostic) => void,
) {
  const activePageId =
    input.inventory.activePageId ??
    input.inventory.pages.find((page) => page.active)?.id;
  if (!activePageId) {
    addDiagnostic({ code: "missing-target", severity: "error" });
    return;
  }
  addStep({ kind: "pages", pageIds: [activePageId] }, "visible-page-default");
}

function addDocumentOrFallback(
  input: HierarchicalSnapshotPlanInput,
  addStep: (
    scope: PlannerSnapshotScope,
    reason: SnapshotPlanDiagnosticCode,
    required?: boolean,
  ) => void,
  addDiagnostic: (diagnostic: SnapshotPlanDiagnostic) => void,
) {
  const estimate = estimateScope(
    input.inventory,
    { kind: "document" },
    input.limits,
  );
  const risks = classifyEstimate(estimate, input.limits);
  if (risks.hard === "hard") {
    const scope: PlannerSnapshotScope = { kind: "document" };
    addDiagnostic({
      code: "hard-limit-avoidance",
      severity: "error",
      scope,
    });
    addDiagnostic({ code: "document-too-large", severity: "error", scope });
    return;
  }
  if (input.intent.requireCompleteDocument && estimate.basis === "unknown") {
    addDiagnostic({ code: "incomplete-inventory", severity: "error" });
    return;
  }
  if (input.intent.requireCompleteDocument || estimate.basis !== "unknown") {
    addStep({ kind: "document" }, "document-bounded");
    return;
  }
  addDiagnostic({
    code:
      estimate.basis === "unknown" ? "unknown-estimate" : "document-too-large",
    severity: "warn",
  });
  addVisiblePageFallback(input, addStep, addDiagnostic);
}

function estimateScope(
  inventory: DiagramInventory,
  scope: PlannerSnapshotScope,
  limits: SnapshotPlanLimits,
): SnapshotPlanEstimate {
  if (scope.kind === "selection") {
    const elements = inventory.selection?.count.value;
    return estimateFromElements(
      elements,
      inventory.selection?.count.basis,
      limits,
    );
  }
  const pages =
    scope.kind === "document"
      ? inventory.pages
      : scope.kind === "pages"
        ? inventory.pages.filter((page) => scope.pageIds.includes(page.id))
        : inventory.pages.filter((page) => page.id === scope.pageId);
  if (scope.kind === "layers") {
    const page = pages[0];
    const layers =
      page?.layers.filter((layer) => scope.layerIds.includes(layer.id)) ?? [];
    const observedBytes = sumKnown(
      layers.map((layer) => layer.approximatePayloadBytes),
    );
    if (observedBytes !== undefined) {
      return {
        basis: "observed",
        elements: sumKnown(
          layers.map((layer) => layer.approximateElementCount),
        ),
        bytes: applyMargin(observedBytes + PAGE_OVERHEAD_BYTES, limits),
        safetyMarginRatio: limits.safetyMarginRatio,
      };
    }
    const elements = sumKnown(
      layers.map((layer) => layer.approximateElementCount),
    );
    return estimateFromElements(
      elements,
      elements === undefined ? "unknown" : "estimated",
      limits,
      layers.length * LAYER_OVERHEAD_BYTES + PAGE_OVERHEAD_BYTES,
    );
  }
  const observedBytes = sumKnown(
    pages.map((page) => page.approximatePayloadBytes),
  );
  if (observedBytes !== undefined) {
    return {
      basis: "observed",
      elements: sumKnown(pages.map((page) => page.approximateElementCount)),
      bytes: applyMargin(
        observedBytes + pages.length * PAGE_OVERHEAD_BYTES,
        limits,
      ),
      safetyMarginRatio: limits.safetyMarginRatio,
    };
  }
  const elements = sumKnown(pages.map((page) => page.approximateElementCount));
  return estimateFromElements(
    elements,
    elements === undefined ? "unknown" : "estimated",
    limits,
    pages.length * PAGE_OVERHEAD_BYTES,
  );
}

function estimateFromElements(
  elements: number | undefined,
  basis: EstimateBasis | undefined,
  limits: SnapshotPlanLimits,
  overhead = PAGE_OVERHEAD_BYTES,
): SnapshotPlanEstimate {
  if (elements === undefined) {
    return { basis: "unknown", safetyMarginRatio: limits.safetyMarginRatio };
  }
  return {
    basis: basis ?? "estimated",
    elements,
    bytes: applyMargin(elements * DEFAULT_BYTES_PER_ELEMENT + overhead, limits),
    safetyMarginRatio: limits.safetyMarginRatio,
  };
}

function classifyEstimate(
  estimate: SnapshotPlanEstimate,
  limits: SnapshotPlanLimits,
): { readonly soft: LimitRisk; readonly hard: LimitRisk } {
  if (estimate.bytes === undefined) {
    return { soft: "unknown", hard: "unknown" };
  }
  if (estimate.bytes > limits.hardSnapshotBytes) {
    return { soft: "soft", hard: "hard" };
  }
  if (estimate.bytes > limits.softSnapshotBytes) {
    return { soft: "soft", hard: "none" };
  }
  return { soft: "none", hard: "none" };
}

function applyMargin(value: number, limits: SnapshotPlanLimits): number {
  return Math.ceil(value * limits.safetyMarginRatio);
}

function sumKnown(
  counts: readonly (InventoryCount | undefined)[],
): number | undefined {
  let sum = 0;
  for (const count of counts) {
    if (count?.value === undefined) {
      return undefined;
    }
    sum += count.value;
  }
  return sum;
}

function hasLayers(
  inventory: DiagramInventory,
  pageId: string,
  layerIds: readonly string[],
): boolean {
  const page = inventory.pages.find((candidate) => candidate.id === pageId);
  if (!page) {
    return false;
  }
  const existing = new Set(page.layers.map((layer) => layer.id));
  return layerIds.every((layerId) => existing.has(layerId));
}

function coverageForScope(scope: PlannerSnapshotScope): SnapshotPlanCoverage {
  return {
    document: scope.kind === "document",
    pageIds:
      scope.kind === "pages"
        ? scope.pageIds
        : scope.kind === "layers"
          ? [scope.pageId]
          : [],
    layerTargets:
      scope.kind === "layers"
        ? [{ pageId: scope.pageId, layerIds: scope.layerIds }]
        : [],
    selection: scope.kind === "selection",
    conclusive: scope.kind === "document" || scope.kind === "pages",
  };
}

function expectedDiagnostics(
  scope: PlannerSnapshotScope,
  reason: SnapshotPlanDiagnosticCode,
): readonly SnapshotPlanDiagnosticCode[] {
  const diagnostics: SnapshotPlanDiagnosticCode[] = [];
  if (scope.kind === "layers" || scope.kind === "selection") {
    diagnostics.push("external-context-required");
  }
  if (reason === "visible-page-default") {
    diagnostics.push("background-page-required");
  }
  return diagnostics;
}

function scopeTargetIds(scope: PlannerSnapshotScope): readonly string[] {
  switch (scope.kind) {
    case "document":
      return [];
    case "pages":
      return scope.pageIds;
    case "layers":
      return [scope.pageId, ...scope.layerIds];
    case "selection":
      return scope.pageId ? [scope.pageId] : [];
  }
}

function stepId(ordinal: number, scope: PlannerSnapshotScope): string {
  return `step-${String(ordinal).padStart(2, "0")}-${scopeKey(scope)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

export function scopeKey(scope: PlannerSnapshotScope): string {
  switch (scope.kind) {
    case "document":
      return "document";
    case "pages":
      return `pages:${uniqueSorted(scope.pageIds).join(",")}`;
    case "layers":
      return `layers:${scope.pageId}:${uniqueSorted(scope.layerIds).join(",")}`;
    case "selection":
      return scope.pageId ? `selection:${scope.pageId}` : "selection";
  }
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function reasonMessage(code: SnapshotPlanDiagnosticCode): string {
  return code.replace(/-/g, " ");
}
