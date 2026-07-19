import {
  defaultSnapshotPlanLimits,
  analyzeGraphStructure,
  fromRuntimeSnapshot,
  mergeScopedSnapshotResults,
  planHierarchicalSnapshot,
  scopeKey,
  type DiagramInventory,
  type HierarchicalSnapshotIntent,
  type PlannerSnapshotScope,
  type SnapshotPlan,
  type SnapshotPlanDiagnostic,
  type SnapshotPlanExecutionResult,
  type SnapshotPlanLimits,
  type SnapshotPlanStep,
  type StructuralExternalReference,
} from "cyberdraw-graph-model";
import type {
  RuntimeSnapshot,
  RuntimeSnapshotLimits,
  RuntimeSnapshotScope,
} from "cyberdraw-runtime-contract";
import { runtimeSnapshotScopeKey } from "cyberdraw-runtime-contract";
import { performance } from "node:perf_hooks";
import {
  requestCyberdrawRuntimeSnapshotMeasured,
  type MeasuredRuntimeSnapshot,
} from "./cyberdraw-runtime-snapshot.js";
import type { Context } from "./types.js";

export type HierarchicalSnapshotExecutionOptions = {
  readonly limits?: Partial<SnapshotPlanLimits>;
  readonly runtimeLimits?: Partial<RuntimeSnapshotLimits>;
  readonly replyTimeoutMs?: number;
  readonly supportedScopes?: readonly PlannerSnapshotScope["kind"][];
  readonly inventorySnapshot?: RuntimeSnapshot;
};

export async function executeHierarchicalSnapshotPlan(
  context: Context,
  intent: HierarchicalSnapshotIntent,
  options: HierarchicalSnapshotExecutionOptions = {},
): Promise<SnapshotPlanExecutionResult> {
  const started = performance.now();
  const inventoryStarted = performance.now();
  const inventorySnapshot: RuntimeSnapshot =
    options.inventorySnapshot ??
    (await requestCyberdrawRuntimeSnapshotMeasured(
      context,
      {
        scope: inventoryScopeForIntent(intent),
        limits: options.runtimeLimits,
      },
      { replyTimeoutMs: options.replyTimeoutMs },
    ).then((result) => result.snapshot));
  const inventory = inventoryFromRuntimeSnapshot(inventorySnapshot);
  const inventoryDurationMs = performance.now() - inventoryStarted;
  const planningStarted = performance.now();
  const limits = defaultSnapshotPlanLimits(options.limits);
  const plan = planHierarchicalSnapshot({
    inventory,
    intent,
    limits,
    supportedScopes: options.supportedScopes,
  });
  const planningDurationMs = performance.now() - planningStarted;
  const executionStarted = performance.now();
  const snapshots: RuntimeSnapshot[] = [];
  const diagnostics: SnapshotPlanDiagnostic[] = [...plan.diagnostics];
  const scopesUsed: string[] = [];
  const executionSteps = [...plan.steps];
  const executedScopeKeys = new Set<string>();
  let measuredBytes = 0;
  let elementsIncluded = 0;
  let contextElements = 0;
  let externalReferences = 0;
  const revisionsObserved: string[] = [];
  let stopReason = plan.stopReason;

  for (let index = 0; index < executionSteps.length; index += 1) {
    const step = executionSteps[index]!;
    if (performance.now() - started > limits.executionTimeoutMs) {
      stopReason = "timeout";
      break;
    }
    executedScopeKeys.add(scopeKey(step.requestedScope));
    let measured: MeasuredRuntimeSnapshot;
    try {
      measured = await requestCyberdrawRuntimeSnapshotMeasured(
        context,
        {
          scope: toRuntimeScope(step.requestedScope),
          limits: options.runtimeLimits,
        },
        { replyTimeoutMs: options.replyTimeoutMs },
      );
    } catch (error) {
      diagnostics.push({
        code: "incomplete-inventory",
        severity: "error",
        scope: step.requestedScope,
        detail: {
          executionError:
            error instanceof Error ? error.message.slice(0, 200) : "unknown",
        },
      });
      stopReason = "execution-error";
      break;
    }
    const freshness = compareSnapshotCompatibility(
      inventorySnapshot,
      measured.snapshot,
    );
    if (freshness.status === "stale" || freshness.status === "unknown") {
      diagnostics.push({
        code: "incomplete-inventory",
        severity: "warn",
        detail: {
          freshnessStatus: freshness.status,
          freshnessReason: freshness.reason,
        },
      });
      stopReason = "stale-snapshot";
      break;
    }
    collectMeasuredMetrics(measured, scopesUsed);
    snapshots.push(measured.snapshot);
    revisionsObserved.push(
      measured.snapshot.document.revisionSignals.contentRevision,
    );
    measuredBytes +=
      measured.snapshot.payload.measuredJsonBytes ??
      measured.snapshot.payload.approximateJsonBytes;
    elementsIncluded += measured.snapshot.scope.includedElementCount;
    contextElements += measured.snapshot.scope.contextElementCount;
    externalReferences += measured.snapshot.scope.externalReferences.length;
    if (measured.snapshot.completeness.status !== "complete") {
      stopReason =
        measured.snapshot.completeness.reason === "hard-limit"
          ? "hard-limit-reached"
          : "soft-limit-advisory";
      if (step.stopOnFailure) {
        break;
      }
    }
    if (measured.snapshot.scope.requiresScopeExpansion) {
      diagnostics.push({
        code: "external-context-required",
        severity: "warn",
        scope: step.requestedScope,
        detail: {
          externalReferences: measured.snapshot.scope.externalReferences.length,
          references: measured.snapshot.scope.externalReferences
            .slice(0, 10)
            .map((reference) => {
              const detail: Record<string, string> = {
                pageId: reference.pageId,
                elementId: reference.elementId,
                referenceType: reference.referenceType,
                referencedId: reference.referencedId,
              };
              if (reference.referencedPageId) {
                detail.referencedPageId = reference.referencedPageId;
              }
              if (reference.referencedLayerId) {
                detail.referencedLayerId = reference.referencedLayerId;
              }
              return detail;
            }),
        },
      });
      const expansion = deriveExpansionScopes({
        inventory,
        snapshot: measured.snapshot,
        depth: expansionDepth(step),
        limits,
        knownScopeKeys: new Set([
          ...executionSteps.map((candidate) =>
            scopeKey(candidate.requestedScope),
          ),
          ...executedScopeKeys,
        ]),
      });
      diagnostics.push(...expansion.diagnostics);
      if (
        expansion.diagnostics.some(
          (diagnostic) => diagnostic.code === "hard-limit-avoidance",
        )
      ) {
        stopReason = "hard-limit-reached";
      }
      for (const scope of expansion.scopes) {
        if (executionSteps.length >= limits.maxPlanSteps) {
          diagnostics.push({
            code: "max-steps-reached",
            severity: "error",
            scope,
          });
          stopReason = "max-steps-reached";
          break;
        }
        const expansionStep = createExpansionStep(
          executionSteps.length + 1,
          step.id,
          scope,
        );
        executionSteps.push(expansionStep);
      }
    }
  }

  const executedPlan: SnapshotPlan = { ...plan, steps: executionSteps };
  if (stopReason === "stale-snapshot") {
    return executionResult(executedPlan, {
      stopReason,
      diagnostics,
      inventoryDurationMs,
      planningDurationMs,
      executionDurationMs: performance.now() - executionStarted,
      scopesUsed,
      measuredBytes,
      elementsIncluded,
      contextElements,
      externalReferences,
      revisionsObserved,
      mergeDiagnostics: 0,
    });
  }

  const merge = mergeScopedSnapshotResults(snapshots);
  if (!merge.ok) {
    stopReason =
      merge.code === "stale-snapshot-rejected"
        ? "stale-snapshot"
        : "validation-failed";
    return executionResult(executedPlan, {
      stopReason,
      diagnostics,
      inventoryDurationMs,
      planningDurationMs,
      executionDurationMs: performance.now() - executionStarted,
      scopesUsed,
      measuredBytes,
      elementsIncluded,
      contextElements,
      externalReferences,
      revisionsObserved,
      mergeDiagnostics: merge.diagnostics.length,
    });
  }

  const graph =
    snapshots.length > 0 ? fromRuntimeSnapshot(merge.snapshot) : undefined;
  const finalStopReason =
    stopReason === "intent-satisfied"
      ? executedPlan.steps.some(
          (step) => step.requestedScope.kind === "document",
        )
        ? "complete"
        : "intent-satisfied"
      : stopReason === "soft-limit-advisory"
        ? stopReason
        : stopReason === "complete" && snapshots.length > 0
          ? "complete"
          : stopReason;
  const structuralAnalysis =
    intent.kind === "analyze-structure" && graph
      ? analyzeGraphStructure({
          graph,
          coverage: {
            ...coverageFromPlan(executedPlan, finalStopReason),
            truncated: merge.snapshot.truncated === true,
          },
          externalReferences: toStructuralExternalReferences(
            merge.snapshot.scope?.externalReferences,
          ),
          diagnostics: diagnostics.map((diagnostic) => ({
            code: diagnostic.code,
            severity: diagnostic.severity,
            detail: diagnostic.detail,
          })),
          stopReason: finalStopReason,
          revisionEvidence: {
            documentId:
              snapshots[0]?.document.revisionSignals.documentId ??
              snapshots[0]?.document.id,
            contentRevisions: revisionsObserved,
            documentRevisions: snapshots
              .map(
                (snapshot) =>
                  snapshot.document.revisionSignals.documentRevision,
              )
              .filter((revision): revision is string => revision !== undefined),
            revisionCompatible: true,
          },
          limits: {
            hardSnapshotBytes: snapshots[0]?.limits.hardSnapshotBytes,
            softSnapshotBytes: snapshots[0]?.limits.softSnapshotBytes,
            measuredBytes,
            estimatedBytes: executedPlan.steps.reduce(
              (sum, step) => sum + (step.estimate.bytes ?? 0),
              0,
            ),
          },
        })
      : undefined;
  return executionResult(executedPlan, {
    stopReason: finalStopReason,
    diagnostics,
    inventoryDurationMs,
    planningDurationMs,
    executionDurationMs: performance.now() - executionStarted,
    scopesUsed,
    measuredBytes,
    elementsIncluded,
    contextElements,
    externalReferences,
    revisionsObserved,
    mergeDiagnostics: merge.diagnostics.length,
    graph,
    structuralAnalysis,
  });
}

function toStructuralExternalReferences(
  value: unknown,
): readonly StructuralExternalReference[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry): StructuralExternalReference | undefined => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return undefined;
      }
      const raw = entry as Record<string, unknown>;
      const referenceType =
        raw.referenceType === "parent" ||
        raw.referenceType === "source" ||
        raw.referenceType === "target" ||
        raw.referenceType === "edge" ||
        raw.referenceType === "layer"
          ? raw.referenceType
          : undefined;
      return {
        ...(typeof raw.pageId === "string" ? { pageId: raw.pageId } : {}),
        ...(typeof raw.elementId === "string"
          ? { elementId: raw.elementId }
          : {}),
        ...(referenceType ? { referenceType } : {}),
        ...(typeof raw.referencedId === "string"
          ? { referencedId: raw.referencedId }
          : {}),
        ...(typeof raw.referencedPageId === "string"
          ? { referencedPageId: raw.referencedPageId }
          : {}),
        ...(typeof raw.referencedLayerId === "string"
          ? { referencedLayerId: raw.referencedLayerId }
          : {}),
      };
    })
    .filter(
      (entry): entry is StructuralExternalReference => entry !== undefined,
    );
}

function compareSnapshotCompatibility(
  expected: RuntimeSnapshot,
  current: RuntimeSnapshot,
) {
  if (
    expected.schemaVersion !== current.schemaVersion ||
    expected.contractVersion !== current.contractVersion
  ) {
    return { status: "stale" as const, reason: "contract-changed" as const };
  }
  const expectedDocumentId =
    expected.document.revisionSignals.documentId ?? expected.document.id;
  const currentDocumentId =
    current.document.revisionSignals.documentId ?? current.document.id;
  if (!expectedDocumentId || !currentDocumentId) {
    return { status: "unknown" as const, reason: "revision-missing" as const };
  }
  if (expectedDocumentId !== currentDocumentId) {
    return { status: "stale" as const, reason: "document-changed" as const };
  }
  const expectedDocumentRevision =
    expected.document.revisionSignals.documentRevision;
  const currentDocumentRevision =
    current.document.revisionSignals.documentRevision;
  if (
    expectedDocumentRevision !== undefined &&
    currentDocumentRevision !== undefined &&
    expectedDocumentRevision !== currentDocumentRevision
  ) {
    return { status: "stale" as const, reason: "content-changed" as const };
  }
  if (
    runtimeSnapshotScopeKey(expected.scope.resolvedScope) ===
      runtimeSnapshotScopeKey(current.scope.resolvedScope) &&
    runtimeSnapshotScopeKey(expected.scope.requestedScope) ===
      runtimeSnapshotScopeKey(current.scope.requestedScope)
  ) {
    if (
      expected.document.revisionSignals.contentRevision !==
      current.document.revisionSignals.contentRevision
    ) {
      return { status: "stale" as const, reason: "content-changed" as const };
    }
  }
  return { status: "fresh" as const };
}

export function inventoryFromRuntimeSnapshot(
  snapshot: RuntimeSnapshot,
): DiagramInventory {
  return {
    schemaVersion: "cyberdraw.diagram-inventory.v1",
    documentId:
      snapshot.document.revisionSignals.documentId ?? snapshot.document.id,
    contentRevision: snapshot.document.revisionSignals.contentRevision,
    activePageId: snapshot.document.currentPageId,
    completeness:
      snapshot.completeness.status === "complete" ? "complete" : "partial",
    selection: {
      pageId:
        snapshot.scope.resolvedScope.kind === "selection"
          ? snapshot.scope.resolvedScope.pageId
          : snapshot.document.currentPageId,
      count: {
        value:
          snapshot.scope.resolvedScope.kind === "selection"
            ? Math.max(
                0,
                snapshot.scope.includedElementCount -
                  snapshot.scope.contextElementCount,
              )
            : undefined,
        basis:
          snapshot.scope.resolvedScope.kind === "selection"
            ? "observed"
            : "unknown",
      },
    },
    pages: snapshot.pages.map((page) => ({
      id: page.id,
      name: page.name,
      order: page.index,
      active: page.id === snapshot.document.currentPageId,
      approximateElementCount: {
        value: page.elements.length,
        basis: "observed",
      },
      approximatePayloadBytes: {
        value:
          snapshot.pages.length === 0
            ? undefined
            : Math.ceil(
                (snapshot.payload.measuredJsonBytes ??
                  snapshot.payload.approximateJsonBytes) /
                  snapshot.pages.length,
              ),
        basis: "observed",
      },
      externalReferenceCount: {
        value: snapshot.scope.externalReferences.filter(
          (reference) => reference.pageId === page.id,
        ).length,
        basis: "observed",
      },
      layers: page.layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        order: layer.index,
        visible: layer.visible,
        locked: layer.locked,
        approximateElementCount: {
          value: page.elements.filter((element) => element.layerId === layer.id)
            .length,
          basis: "observed",
        },
        approximatePayloadBytes: {
          value:
            page.layers.length === 0
              ? undefined
              : Math.ceil(
                  (snapshot.payload.measuredJsonBytes ??
                    snapshot.payload.approximateJsonBytes) /
                    Math.max(1, snapshot.pages.length) /
                    page.layers.length,
                ),
          basis: "estimated",
        },
      })),
    })),
    externalReferenceCount: {
      value: snapshot.scope.externalReferences.length,
      basis: "observed",
    },
    softLimitProximity:
      (snapshot.payload.measuredJsonBytes ??
        snapshot.payload.approximateJsonBytes) /
      snapshot.limits.softSnapshotBytes,
    hardLimitProximity:
      (snapshot.payload.measuredJsonBytes ??
        snapshot.payload.approximateJsonBytes) /
      snapshot.limits.hardSnapshotBytes,
    diagnostics: snapshot.diagnostics
      .filter((diagnostic) => diagnostic.code.endsWith("_limit_reached"))
      .map((diagnostic) => ({
        code:
          diagnostic.code === "snapshot_soft_limit_reached"
            ? "soft-limit-advisory"
            : "hard-limit-avoidance",
        severity: "warn",
        detail: { runtimeDiagnosticCode: diagnostic.code },
      })),
  };
}

function inventoryScopeForIntent(
  intent: HierarchicalSnapshotIntent,
): RuntimeSnapshotScope {
  if (intent.kind === "inspect-selection") {
    return { kind: "selection" };
  }
  if (intent.kind === "inspect-pages" && intent.pageIds?.length) {
    return { kind: "pages", pageIds: intent.pageIds };
  }
  if (intent.kind === "analyze-structure" && intent.layers?.[0] !== undefined) {
    return {
      kind: "layers",
      pageId: intent.layers[0].pageId,
      layerIds: intent.layers[0].layerIds,
    };
  }
  if (intent.kind === "analyze-structure" && intent.pageIds?.length) {
    return { kind: "pages", pageIds: intent.pageIds };
  }
  if (intent.kind === "inspect-layers" && intent.layers?.[0]) {
    return {
      kind: "layers",
      pageId: intent.layers[0].pageId,
      layerIds: intent.layers[0].layerIds,
    };
  }
  return { kind: "document" };
}

function toRuntimeScope(scope: PlannerSnapshotScope): RuntimeSnapshotScope {
  switch (scope.kind) {
    case "document":
      return { kind: "document" };
    case "pages":
      return { kind: "pages", pageIds: scope.pageIds };
    case "layers":
      return {
        kind: "layers",
        pageId: scope.pageId,
        layerIds: scope.layerIds,
      };
    case "selection":
      return scope.pageId
        ? { kind: "selection", pageId: scope.pageId }
        : { kind: "selection" };
  }
}

function collectMeasuredMetrics(
  measured: MeasuredRuntimeSnapshot,
  scopesUsed: string[],
) {
  scopesUsed.push(
    runtimeSnapshotScopeKey(measured.snapshot.scope.resolvedScope),
  );
}

function deriveExpansionScopes(input: {
  readonly inventory: DiagramInventory;
  readonly snapshot: RuntimeSnapshot;
  readonly depth: number;
  readonly limits: SnapshotPlanLimits;
  readonly knownScopeKeys: ReadonlySet<string>;
}): {
  readonly scopes: readonly PlannerSnapshotScope[];
  readonly diagnostics: readonly SnapshotPlanDiagnostic[];
} {
  const diagnostics: SnapshotPlanDiagnostic[] = [];
  if (input.depth >= input.limits.maxExpansionDepth) {
    return {
      scopes: [],
      diagnostics: [
        {
          code: "maximum-expansion-depth",
          severity: "warn",
          detail: { depth: input.depth },
        },
      ],
    };
  }
  const scopes: PlannerSnapshotScope[] = [];
  const pagesById = new Map(
    input.inventory.pages.map((page) => [page.id, page]),
  );
  const layerById = new Map<
    string,
    { readonly pageId: string; readonly layerId: string }
  >();
  for (const page of input.inventory.pages) {
    for (const layer of page.layers) {
      layerById.set(layer.id, { pageId: page.id, layerId: layer.id });
    }
  }

  for (const reference of input.snapshot.scope.externalReferences) {
    if (!referenceTypeCanExpand(reference.referenceType)) {
      continue;
    }
    const candidate = resolveExpansionTarget(reference, {
      pagesById,
      layerById,
    });
    if (!candidate) {
      diagnostics.push({
        code: "missing-target",
        severity: "warn",
        targetId: reference.referencedId,
        detail: { referenceType: reference.referenceType },
      });
      continue;
    }
    const scope: PlannerSnapshotScope = candidate.layerId
      ? {
          kind: "layers",
          pageId: candidate.pageId,
          layerIds: [candidate.layerId],
        }
      : { kind: "pages", pageIds: [candidate.pageId] };
    const key = scopeKey(scope);
    if (
      input.knownScopeKeys.has(key) ||
      scopes.some((item) => scopeKey(item) === key)
    ) {
      diagnostics.push({
        code: "duplicate-scope-deduplicated",
        severity: "debug",
        scope,
      });
      continue;
    }
    if (expansionScopeHardLimitRisk(input.inventory, scope, input.limits)) {
      diagnostics.push({
        code: "hard-limit-avoidance",
        severity: "error",
        scope,
      });
      continue;
    }
    scopes.push(scope);
  }

  return { scopes, diagnostics };
}

function referenceTypeCanExpand(referenceType: string): boolean {
  return (
    referenceType === "source" ||
    referenceType === "target" ||
    referenceType === "layer"
  );
}

function resolveExpansionTarget(
  reference: RuntimeSnapshot["scope"]["externalReferences"][number],
  indexes: {
    readonly pagesById: ReadonlyMap<string, unknown>;
    readonly layerById: ReadonlyMap<
      string,
      { readonly pageId: string; readonly layerId: string }
    >;
  },
): { readonly pageId: string; readonly layerId?: string } | undefined {
  if (reference.referencedPageId) {
    return {
      pageId: reference.referencedPageId,
      layerId: reference.referencedLayerId,
    };
  }
  if (reference.referenceType === "layer") {
    return indexes.layerById.get(reference.referencedId);
  }
  if (indexes.pagesById.has(reference.referencedId)) {
    return { pageId: reference.referencedId };
  }
  return undefined;
}

function expansionScopeHardLimitRisk(
  inventory: DiagramInventory,
  scope: PlannerSnapshotScope,
  limits: SnapshotPlanLimits,
): boolean {
  if (scope.kind === "pages") {
    return scope.pageIds.some((pageId) => {
      const page = inventory.pages.find((candidate) => candidate.id === pageId);
      return (
        page?.approximatePayloadBytes?.value !== undefined &&
        page.approximatePayloadBytes.value * limits.safetyMarginRatio >
          limits.hardSnapshotBytes
      );
    });
  }
  if (scope.kind === "layers") {
    const page = inventory.pages.find(
      (candidate) => candidate.id === scope.pageId,
    );
    return scope.layerIds.some((layerId) => {
      const layer = page?.layers.find((candidate) => candidate.id === layerId);
      return (
        layer?.approximatePayloadBytes?.value !== undefined &&
        layer.approximatePayloadBytes.value * limits.safetyMarginRatio >
          limits.hardSnapshotBytes
      );
    });
  }
  return false;
}

function createExpansionStep(
  ordinal: number,
  prerequisite: string,
  scope: PlannerSnapshotScope,
): SnapshotPlanStep {
  return {
    id: `step-${String(ordinal).padStart(2, "0")}-expansion-${scopeKey(scope)
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}`,
    ordinal,
    phase: "snapshot",
    requestedScope: scope,
    targetIds: targetIds(scope),
    reason: "external-context-required",
    expectedCoverage: {
      document: false,
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
      conclusive: false,
    },
    estimate: { basis: "unknown", safetyMarginRatio: 1.35 },
    softLimitRisk: "unknown",
    hardLimitRisk: "unknown",
    prerequisites: [prerequisite],
    required: false,
    stopOnFailure: false,
    expectedDiagnostics: ["external-context-required"],
  };
}

function expansionDepth(step: SnapshotPlanStep): number {
  return step.prerequisites.length;
}

function targetIds(scope: PlannerSnapshotScope): readonly string[] {
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

function executionResult(
  plan: SnapshotPlan,
  state: {
    readonly stopReason: SnapshotPlanExecutionResult["stopReason"];
    readonly diagnostics: readonly SnapshotPlanDiagnostic[];
    readonly inventoryDurationMs: number;
    readonly planningDurationMs: number;
    readonly executionDurationMs: number;
    readonly scopesUsed: readonly string[];
    readonly measuredBytes: number;
    readonly elementsIncluded: number;
    readonly contextElements: number;
    readonly externalReferences: number;
    readonly revisionsObserved: readonly string[];
    readonly mergeDiagnostics: number;
    readonly graph?: SnapshotPlanExecutionResult["graph"];
    readonly structuralAnalysis?: SnapshotPlanExecutionResult["structuralAnalysis"];
  },
): SnapshotPlanExecutionResult {
  return {
    plan,
    coverage: coverageFromPlan(plan, state.stopReason),
    graph: state.graph,
    structuralAnalysis: state.structuralAnalysis,
    stopReason: state.stopReason,
    diagnostics: state.diagnostics,
    metrics: {
      inventoryDurationMs: state.inventoryDurationMs,
      planningDurationMs: state.planningDurationMs,
      executionDurationMs: state.executionDurationMs,
      stepsPlanned: plan.steps.length,
      stepsExecuted: state.scopesUsed.length,
      scopesUsed: state.scopesUsed,
      estimatedBytes: plan.steps.reduce(
        (sum, step) => sum + (step.estimate.bytes ?? 0),
        0,
      ),
      measuredBytes: state.measuredBytes,
      elementsIncluded: state.elementsIncluded,
      contextElements: state.contextElements,
      externalReferences: state.externalReferences,
      revisionsObserved: state.revisionsObserved,
      mergeDiagnostics: state.mergeDiagnostics,
      replans: 0,
      diagnosticsCount: state.diagnostics.length,
    },
  };
}

function coverageFromPlan(
  plan: SnapshotPlan,
  stopReason: SnapshotPlanExecutionResult["stopReason"],
): SnapshotPlanExecutionResult["coverage"] {
  return {
    document: plan.steps.some(
      (step) => step.requestedScope.kind === "document",
    ),
    pageIds: [
      ...new Set(
        plan.steps.flatMap((step) =>
          step.requestedScope.kind === "pages"
            ? step.requestedScope.pageIds
            : step.requestedScope.kind === "layers"
              ? [step.requestedScope.pageId]
              : [],
        ),
      ),
    ].sort(),
    layerTargets: plan.steps.flatMap((step) =>
      step.requestedScope.kind === "layers"
        ? [
            {
              pageId: step.requestedScope.pageId,
              layerIds: step.requestedScope.layerIds,
            },
          ]
        : [],
    ),
    selection: plan.steps.some(
      (step) => step.requestedScope.kind === "selection",
    ),
    conclusive: stopReason === "complete" || stopReason === "intent-satisfied",
  };
}
