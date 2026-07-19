import { describe, expect, it } from "@jest/globals";

import {
  executeHierarchicalSnapshotPlan,
  inventoryFromRuntimeSnapshot,
} from "./cyberdraw-hierarchical-snapshot.js";
import { create_request_queue } from "./request_queue.js";
import type { BusListener, Context } from "./types.js";
import {
  createRuntimeCapabilities,
  runtimeSnapshotScopeKey,
  type RuntimeSnapshot,
  type RuntimeSnapshotScope,
} from "cyberdraw-runtime-contract";
import type { SnapshotPlanLimits } from "cyberdraw-graph-model";

describe("cyberdraw hierarchical snapshot executor", () => {
  it("builds compact inventory from runtime snapshot without raw diagram content", () => {
    const snapshot = runtimeSnapshot({
      scope: { kind: "pages", pageIds: ["p1"] },
    });
    const inventory = inventoryFromRuntimeSnapshot(snapshot);

    expect(inventory.pages[0]?.layers[0]).toMatchObject({
      id: "l1",
      visible: true,
      locked: false,
    });
    expect(inventory.pages[0]?.approximateElementCount).toEqual({
      value: 2,
      basis: "observed",
    });
    expect(JSON.stringify(inventory)).not.toContain("Sensitive Label");
    expect(JSON.stringify(inventory)).not.toContain("<mxGraphModel");
  });

  it("executes analyze-structure through planning, scoped snapshot, merge and graph-model adaptation", async () => {
    const listeners = new Map<string, BusListener<Record<string, unknown>>>();
    const sent: unknown[] = [];
    const context = createTestContext({
      sent,
      onReply: (eventName, listener) => {
        listeners.set(eventName, listener);
        return () => listeners.delete(eventName);
      },
    });
    const inventory = runtimeSnapshot({ scope: { kind: "document" } });
    const execution = executeHierarchicalSnapshotPlan(
      context,
      { kind: "analyze-structure" },
      { inventorySnapshot: inventory },
    );
    await flushMicrotasks();

    expect(sent[0]).toMatchObject({
      __event: "cyberdraw.runtimeSnapshot.v1",
      scope: { kind: "document" },
    });
    listeners.get("cyberdraw.runtimeSnapshot.v1.request-1")?.({
      __event: "cyberdraw.runtimeSnapshot.v1.request-1",
      success: true,
      result: runtimeSnapshot({ scope: { kind: "document" } }),
    });

    const result = await execution;
    expect(result.stopReason).toBe("complete");
    expect(result.structuralAnalysis).toMatchObject({
      analysisVersion: "cyberdraw.structural-analysis.v1",
      completeness: "complete-document",
      counts: {
        edgeCount: { value: 1, basis: "exact" },
      },
    });
    expect(result.graph?.elements.map((element) => element.drawioId)).toEqual([
      "a",
      "edge",
    ]);
    expect(result.metrics.stepsExecuted).toBe(1);
    expect(result.metrics.scopesUsed).toEqual([
      runtimeSnapshotScopeKey({ kind: "document" }),
    ]);
  });

  it("executes internal analyze-structure with expansion and structural findings", async () => {
    const { context, listeners, sent } = createInteractiveContext();
    const execution = executeHierarchicalSnapshotPlan(
      context,
      {
        kind: "analyze-structure",
        layers: [{ pageId: "m9-page", layerIds: ["layer-a"] }],
      },
      {
        inventorySnapshot: m9RuntimeSnapshot("focus"),
        limits: { maxPlanSteps: 4, maxExpansionDepth: 2 },
      },
    );
    await flushMicrotasks();

    reply(listeners, "request-1", m9RuntimeSnapshot("focus"));
    await flushMicrotasks();
    expect(sent[0]).toMatchObject({
      scope: { kind: "layers", pageId: "m9-page", layerIds: ["layer-a"] },
    });
    expect(sent[1]).toMatchObject({
      scope: { kind: "layers", pageId: "m9-page", layerIds: ["layer-b"] },
    });
    reply(listeners, "request-2", m9RuntimeSnapshot("context"));

    const result = await execution;
    const findings = result.structuralAnalysis?.findings ?? [];
    expect(result.stopReason).toBe("intent-satisfied");
    expect(result.graph).toBeDefined();
    expect(result.structuralAnalysis).toBeDefined();
    expect(result.coverage.document).toBe(false);
    expect(
      result.plan.steps.some((step) => step.requestedScope.kind === "document"),
    ).toBe(false);
    expect(result.metrics.stepsExecuted).toBe(2);
    expect(result.structuralAnalysis?.counts).toMatchObject({
      edgeCount: { value: 2, basis: "observed" },
      brokenReferenceCount: { value: 1, basis: "observed" },
      crossLayerEdgeCount: { value: 1, basis: "observed" },
      orphanElementCount: { value: 1, basis: "observed" },
      unresolvedExternalReferenceCount: { value: 0, basis: "observed" },
    });
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          findingType: "broken-reference",
          status: "broken",
          referenceType: "target",
          referencedElementId: "missing-terminal",
        }),
        expect.objectContaining({
          findingType: "cross-layer-edge",
          relationClassification: "same-page-cross-layer",
        }),
        expect.objectContaining({
          findingType: "orphan-element",
          status: "confirmed-orphan",
        }),
      ]),
    );
    expect(JSON.stringify(findings)).not.toContain("m9 source label");
  });

  it("executes an internal structural query over the existing M9 result without extra snapshots", async () => {
    const { context, listeners, sent } = createInteractiveContext();
    let analysisInvocations = 0;
    let queryInvocations = 0;
    const execution = executeHierarchicalSnapshotPlan(
      context,
      {
        kind: "analyze-structure",
        layers: [{ pageId: "m9-page", layerIds: ["layer-a"] }],
      },
      {
        inventorySnapshot: m9RuntimeSnapshot("focus"),
        limits: { maxPlanSteps: 4, maxExpansionDepth: 2 },
        structuralQuery: {
          kind: "list-findings",
          filters: { findingTypes: ["broken-reference"] },
          coverageRequirement: "complete-target-scopes",
        },
        instrumentation: {
          onStructuralAnalysis: () => {
            analysisInvocations += 1;
          },
          onStructuralQuery: () => {
            queryInvocations += 1;
          },
        },
      },
    );
    await flushMicrotasks();

    reply(listeners, "request-1", m9RuntimeSnapshot("focus"));
    await flushMicrotasks();
    reply(listeners, "request-2", m9RuntimeSnapshot("context"));

    const result = await execution;
    expect(sent).toHaveLength(2);
    expect(analysisInvocations).toBe(1);
    expect(queryInvocations).toBe(1);
    expect(result.structuralAnalysis).toBeDefined();
    expect(result.structuralQueryResult).toMatchObject({
      kind: "list-findings",
      outcome: "ok",
      totalMatched: 1,
      returned: 1,
      completeness: "complete-target-scopes",
      stopReason: "intent-satisfied",
    });
    expect(result.structuralQueryResult?.results[0]).toMatchObject({
      findingType: "broken-reference",
      status: "broken",
      referencedElementId: "missing-terminal",
    });
    expect(result.structuralQueryResult?.analysisDiagnostics).toEqual(
      result.structuralAnalysis?.diagnostics,
    );
    expect(result.structuralQueryResult?.limitations).toEqual(
      result.structuralAnalysis?.limitations,
    );
    expect(result.metrics.measuredBytes).toBeGreaterThan(0);
  });

  it("returns internal query validation and coverage outcomes without replacing planner diagnostics", async () => {
    const invalid = await runM9StructuralQuery({
      kind: "list-findings",
      filters: { elementIds: ["x".repeat(600)] },
    } as never);
    const insufficient = await runM9StructuralQuery({
      kind: "list-findings",
      coverageRequirement: "complete-document",
    });
    const missing = await runM9StructuralQuery({
      kind: "get-finding",
      findingId: "not-present",
    });

    expect(invalid.structuralQueryResult).toMatchObject({
      outcome: "invalid-query",
      queryDiagnostics: [expect.objectContaining({ code: "invalid-filter" })],
    });
    expect(insufficient.structuralQueryResult).toMatchObject({
      outcome: "insufficient-coverage",
      results: [],
      queryDiagnostics: [
        expect.objectContaining({ code: "insufficient-coverage" }),
      ],
    });
    expect(missing.structuralQueryResult).toMatchObject({
      outcome: "ok",
      totalMatched: 0,
      queryDiagnostics: [
        expect.objectContaining({ code: "finding-not-found" }),
      ],
    });
    expect(
      insufficient.diagnostics.map((diagnostic) => diagnostic.code),
    ).toContain("external-context-required");
    expect(insufficient.stopReason).toBe("intent-satisfied");
  });

  it("does not execute a structural query when graph or structural analysis is unavailable", async () => {
    const noAnalysis = await executeHierarchicalSnapshotPlan(
      createInteractiveContext().context,
      { kind: "inspect-visible-page" },
      {
        inventorySnapshot: runtimeSnapshot({
          scope: { kind: "pages", pageIds: ["p1"] },
        }),
        limits: { executionTimeoutMs: -1 },
        structuralQuery: { kind: "counts" },
      },
    );
    const stale = await runStaleAnalyzeStructureWithQuery();

    expect(noAnalysis.graph).toBeUndefined();
    expect(noAnalysis.structuralAnalysis).toBeUndefined();
    expect(noAnalysis.structuralQueryResult).toBeUndefined();
    expect(noAnalysis.stopReason).toBe("timeout");
    expect(stale.stopReason).toBe("stale-snapshot");
    expect(stale.graph).toBeUndefined();
    expect(stale.structuralAnalysis).toBeUndefined();
    expect(stale.structuralQueryResult).toBeUndefined();
  });

  it("stops safely on stale snapshot revision", async () => {
    const listeners = new Map<string, BusListener<Record<string, unknown>>>();
    const sent: unknown[] = [];
    const context = createTestContext({
      sent,
      onReply: (eventName, listener) => {
        listeners.set(eventName, listener);
        return () => listeners.delete(eventName);
      },
    });
    const execution = executeHierarchicalSnapshotPlan(
      context,
      { kind: "inspect-visible-page" },
      {
        inventorySnapshot: runtimeSnapshot({
          scope: { kind: "pages", pageIds: ["p1"] },
        }),
      },
    );
    await flushMicrotasks();

    listeners.get("cyberdraw.runtimeSnapshot.v1.request-1")?.({
      __event: "cyberdraw.runtimeSnapshot.v1.request-1",
      success: true,
      result: runtimeSnapshot({
        scope: { kind: "pages", pageIds: ["p1"] },
        revision: "cyberdraw-content-v1:fnv1a64:0000000000000002",
      }),
    });

    const result = await execution;
    expect(result.stopReason).toBe("stale-snapshot");
    expect(result.graph).toBeUndefined();
    expect(result.structuralAnalysis).toBeUndefined();
  });

  it("stops cross-scope expansion when document revision changes between steps", async () => {
    const { context, listeners, sent } = createInteractiveContext();
    const stableDocumentRevision =
      "cyberdraw-content-v1:fnv1a64:1000000000000001";
    const changedDocumentRevision =
      "cyberdraw-content-v1:fnv1a64:1000000000000002";
    const execution = executeHierarchicalSnapshotPlan(
      context,
      {
        kind: "inspect-layers",
        layers: [{ pageId: "p1", layerIds: ["l1"] }],
      },
      {
        inventorySnapshot: runtimeSnapshot({
          scope: { kind: "layers", pageId: "p1", layerIds: ["l1"] },
          includeSecondPage: true,
          documentRevision: stableDocumentRevision,
        }),
      },
    );
    await flushMicrotasks();

    const focus = runtimeSnapshot({
      scope: { kind: "layers", pageId: "p1", layerIds: ["l1"] },
      includeSecondPage: true,
      documentRevision: stableDocumentRevision,
    });
    reply(listeners, "request-1", {
      ...focus,
      scope: {
        ...focus.scope,
        requiresScopeExpansion: true,
        externalReferences: [
          {
            pageId: "p1",
            elementId: "edge",
            referenceType: "target",
            referencedId: "b",
            referencedPageId: "p2",
            referencedLayerId: "l2",
          },
        ],
      },
    });
    await flushMicrotasks();
    expect(sent[1]).toMatchObject({
      scope: { kind: "layers", pageId: "p2", layerIds: ["l2"] },
    });

    reply(
      listeners,
      "request-2",
      runtimeSnapshot({
        scope: { kind: "layers", pageId: "p2", layerIds: ["l2"] },
        includeSecondPage: true,
        revision: "cyberdraw-content-v1:fnv1a64:0000000000000002",
        documentRevision: changedDocumentRevision,
      }),
    );

    const result = await execution;
    expect(result.stopReason).toBe("stale-snapshot");
    expect(result.graph).toBeUndefined();
    expect(result.metrics.stepsExecuted).toBe(1);
    expect(result.metrics.scopesUsed).toEqual([
      runtimeSnapshotScopeKey({
        kind: "layers",
        pageId: "p1",
        layerIds: ["l1"],
      }),
    ]);
    expect(result.plan.steps[1]).toMatchObject({
      ordinal: 2,
      reason: "external-context-required",
      requestedScope: { kind: "layers", pageId: "p2", layerIds: ["l2"] },
    });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "incomplete-inventory",
          detail: expect.objectContaining({
            freshnessStatus: "stale",
            freshnessReason: "content-changed",
          }),
        }),
      ]),
    );
  });

  it("derives a target layer from a resolvable external terminal reference", async () => {
    const { context, listeners, sent } = createInteractiveContext();
    const execution = executeHierarchicalSnapshotPlan(
      context,
      { kind: "inspect-selection" },
      {
        inventorySnapshot: runtimeSnapshot({
          scope: { kind: "selection", pageId: "p1" },
          includeSecondPage: true,
        }),
      },
    );
    await flushMicrotasks();

    reply(listeners, "request-1", {
      ...runtimeSnapshot({
        scope: { kind: "selection", pageId: "p1" },
        includeSecondPage: true,
      }),
      scope: {
        ...runtimeSnapshot({
          scope: { kind: "selection", pageId: "p1" },
          includeSecondPage: true,
        }).scope,
        requiresScopeExpansion: true,
        externalReferences: [
          {
            pageId: "p1",
            elementId: "edge",
            referenceType: "target",
            referencedId: "b",
            referencedPageId: "p2",
            referencedLayerId: "l2",
          },
        ],
      },
    });
    await flushMicrotasks();
    expect(sent[1]).toMatchObject({
      scope: { kind: "layers", pageId: "p2", layerIds: ["l2"] },
    });
    reply(
      listeners,
      "request-2",
      runtimeSnapshot({
        scope: { kind: "layers", pageId: "p2", layerIds: ["l2"] },
        includeSecondPage: true,
      }),
    );

    const result = await execution;
    expect(result.plan.steps.map((step) => step.requestedScope.kind)).toEqual([
      "selection",
      "layers",
    ]);
    expect(result.plan.steps[1]).toMatchObject({
      id: "step-02-expansion-layers-p2-l2",
      ordinal: 2,
      reason: "external-context-required",
      prerequisites: ["step-01-selection-p1"],
    });
    expect(result.stopReason).toBe("intent-satisfied");
    expect(result.metrics.stepsExecuted).toBe(2);
    expect(result.metrics.scopesUsed).toEqual([
      runtimeSnapshotScopeKey({ kind: "selection", pageId: "p1" }),
      runtimeSnapshotScopeKey({
        kind: "layers",
        pageId: "p2",
        layerIds: ["l2"],
      }),
    ]);
  });

  it("derives a target page from legacy page-id external references", async () => {
    const { context, listeners, sent } = createInteractiveContext();
    const execution = executeHierarchicalSnapshotPlan(
      context,
      { kind: "inspect-selection" },
      {
        inventorySnapshot: runtimeSnapshot({
          scope: { kind: "selection", pageId: "p1" },
          includeSecondPage: true,
        }),
      },
    );
    await flushMicrotasks();

    const selection = runtimeSnapshot({
      scope: { kind: "selection", pageId: "p1" },
      includeSecondPage: true,
    });
    reply(listeners, "request-1", {
      ...selection,
      scope: {
        ...selection.scope,
        requiresScopeExpansion: true,
        externalReferences: [
          {
            pageId: "p1",
            elementId: "edge",
            referenceType: "target",
            referencedId: "p2",
          },
        ],
      },
    });
    await flushMicrotasks();

    expect(sent[1]).toMatchObject({
      scope: { kind: "pages", pageIds: ["p2"] },
    });
    reply(
      listeners,
      "request-2",
      runtimeSnapshot({
        scope: { kind: "pages", pageIds: ["p2"] },
        includeSecondPage: true,
      }),
    );

    const result = await execution;
    expect(result.metrics.stepsExecuted).toBe(2);
    expect(result.plan.steps[1]?.requestedScope).toEqual({
      kind: "pages",
      pageIds: ["p2"],
    });
  });

  it("does not invent expansion for previous peers without location hints", async () => {
    const { context, listeners, sent } = createInteractiveContext();
    const execution = executeHierarchicalSnapshotPlan(
      context,
      { kind: "inspect-selection" },
      {
        inventorySnapshot: runtimeSnapshot({
          scope: { kind: "selection", pageId: "p1" },
          includeSecondPage: true,
        }),
      },
    );
    await flushMicrotasks();

    const selection = runtimeSnapshot({
      scope: { kind: "selection", pageId: "p1" },
      includeSecondPage: true,
    });
    reply(listeners, "request-1", {
      ...selection,
      scope: {
        ...selection.scope,
        requiresScopeExpansion: true,
        externalReferences: [
          {
            pageId: "p1",
            elementId: "edge",
            referenceType: "target",
            referencedId: "b",
          },
        ],
      },
    });

    const result = await execution;
    expect(sent).toHaveLength(1);
    expect(result.plan.steps).toHaveLength(1);
    expect(result.stopReason).toBe("intent-satisfied");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing-target",
          targetId: "b",
          detail: { referenceType: "target" },
        }),
      ]),
    );
  });

  it("expands from layers, deduplicates cycles, and records unresolved references", async () => {
    const { context, listeners } = createInteractiveContext();
    const execution = executeHierarchicalSnapshotPlan(
      context,
      {
        kind: "inspect-layers",
        layers: [{ pageId: "p2", layerIds: ["l2"] }],
      },
      {
        inventorySnapshot: runtimeSnapshot({
          scope: { kind: "layers", pageId: "p2", layerIds: ["l2"] },
          includeSecondPage: true,
        }),
      },
    );
    await flushMicrotasks();

    const layerSnapshot = runtimeSnapshot({
      scope: { kind: "layers", pageId: "p2", layerIds: ["l2"] },
      includeSecondPage: true,
    });
    reply(listeners, "request-1", {
      ...layerSnapshot,
      scope: {
        ...layerSnapshot.scope,
        requiresScopeExpansion: true,
        externalReferences: [
          {
            pageId: "p2",
            elementId: "edge",
            referenceType: "layer",
            referencedId: "l2",
          },
          {
            pageId: "p2",
            elementId: "edge",
            referenceType: "target",
            referencedId: "missing-node",
          },
        ],
      },
    });

    const result = await execution;
    expect(result.plan.steps).toHaveLength(1);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "duplicate-scope-deduplicated",
        "missing-target",
      ]),
    );
  });

  it("does not expand auxiliary parent references", async () => {
    const { context, listeners, sent } = createInteractiveContext();
    const execution = executeHierarchicalSnapshotPlan(
      context,
      { kind: "inspect-selection" },
      {
        inventorySnapshot: runtimeSnapshot({
          scope: { kind: "selection", pageId: "p1" },
          includeSecondPage: true,
        }),
      },
    );
    await flushMicrotasks();

    const selection = runtimeSnapshot({
      scope: { kind: "selection", pageId: "p1" },
      includeSecondPage: true,
    });
    reply(listeners, "request-1", {
      ...selection,
      scope: {
        ...selection.scope,
        requiresScopeExpansion: true,
        externalReferences: [
          {
            pageId: "p1",
            elementId: "edge",
            referenceType: "parent",
            referencedId: "b",
            referencedPageId: "p2",
            referencedLayerId: "l2",
          },
        ],
      },
    });

    const result = await execution;
    expect(sent).toHaveLength(1);
    expect(result.plan.steps).toHaveLength(1);
    expect(result.stopReason).toBe("intent-satisfied");
    expect(
      result.diagnostics.map((diagnostic) => diagnostic.code),
    ).not.toContain("missing-target");
  });

  it("bounds expansion by max depth, max steps, and hard-limit risk", async () => {
    const depth = await runSingleExpansion({
      limits: { maxExpansionDepth: 0 },
    });
    const steps = await runSingleExpansion({
      limits: { maxPlanSteps: 1 },
    });
    const hard = await runSingleExpansion({
      limits: { hardSnapshotBytes: 100, safetyMarginRatio: 2 },
      inventoryPayloadBytes: 10_000,
    });

    expect(depth.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "maximum-expansion-depth",
    );
    expect(steps.stopReason).toBe("max-steps-reached");
    expect(hard.stopReason).toBe("hard-limit-reached");
    expect(hard.structuralAnalysis).toBeUndefined();
  });

  it("returns execution-error when a planned snapshot request fails", async () => {
    const { context, listeners } = createInteractiveContext();
    const execution = executeHierarchicalSnapshotPlan(
      context,
      { kind: "inspect-visible-page" },
      {
        inventorySnapshot: runtimeSnapshot({
          scope: { kind: "pages", pageIds: ["p1"] },
        }),
      },
    );
    await flushMicrotasks();

    listeners.get("cyberdraw.runtimeSnapshot.v1.request-1")?.({
      __event: "cyberdraw.runtimeSnapshot.v1.request-1",
      success: false,
      error: { message: "bounded failure" },
    });

    const result = await execution;
    expect(result.stopReason).toBe("execution-error");
  });

  it("covers soft-limit and timeout stop reasons", async () => {
    const soft = await runSingleRequest(
      runtimeSnapshot({
        scope: { kind: "pages", pageIds: ["p1"] },
        partialReason: "soft-limit",
      }),
    );
    const timeout = await executeHierarchicalSnapshotPlan(
      createInteractiveContext().context,
      { kind: "inspect-visible-page" },
      {
        limits: { executionTimeoutMs: -1 },
        inventorySnapshot: runtimeSnapshot({
          scope: { kind: "pages", pageIds: ["p1"] },
        }),
      },
    );

    expect(soft.stopReason).toBe("soft-limit-advisory");
    expect(timeout.stopReason).toBe("timeout");
  });

  it("does not expose a public MCP hierarchical snapshot tool", async () => {
    const registry = await import("drawio-mcp-plugin/dist/tool-registry.js");
    const toolDefinitions = registry.toolDefinitions as Array<{ name: string }>;
    expect(toolDefinitions.map((tool) => tool.name)).not.toEqual(
      expect.arrayContaining([
        "cyberdraw.runtimeSnapshot.v1",
        "cyberdraw.hierarchicalSnapshotPlan.v1",
        "hierarchical-snapshot-planner",
        "analyze-structure",
        "structural-query",
        "cyberdraw.structuralQuery.v1",
        "cyberdraw.analyzeStructure.v1",
      ]),
    );
  });
});

async function runM9StructuralQuery(
  structuralQuery: NonNullable<
    Parameters<typeof executeHierarchicalSnapshotPlan>[2]
  >["structuralQuery"],
) {
  const { context, listeners } = createInteractiveContext();
  const execution = executeHierarchicalSnapshotPlan(
    context,
    {
      kind: "analyze-structure",
      layers: [{ pageId: "m9-page", layerIds: ["layer-a"] }],
    },
    {
      inventorySnapshot: m9RuntimeSnapshot("focus"),
      limits: { maxPlanSteps: 4, maxExpansionDepth: 2 },
      structuralQuery,
    },
  );
  await flushMicrotasks();
  reply(listeners, "request-1", m9RuntimeSnapshot("focus"));
  await flushMicrotasks();
  reply(listeners, "request-2", m9RuntimeSnapshot("context"));
  return execution;
}

async function runStaleAnalyzeStructureWithQuery() {
  const { context, listeners } = createInteractiveContext();
  const execution = executeHierarchicalSnapshotPlan(
    context,
    { kind: "analyze-structure", pageIds: ["p1"] },
    {
      inventorySnapshot: runtimeSnapshot({
        scope: { kind: "pages", pageIds: ["p1"] },
      }),
      structuralQuery: { kind: "counts" },
    },
  );
  await flushMicrotasks();
  reply(
    listeners,
    "request-1",
    runtimeSnapshot({
      scope: { kind: "pages", pageIds: ["p1"] },
      revision: "cyberdraw-content-v1:fnv1a64:0000000000000002",
    }),
  );
  return execution;
}

async function runSingleExpansion(options: {
  readonly limits?: Partial<SnapshotPlanLimits>;
  readonly inventoryPayloadBytes?: number;
}) {
  const { context, listeners } = createInteractiveContext();
  const execution = executeHierarchicalSnapshotPlan(
    context,
    { kind: "inspect-selection" },
    {
      limits: options.limits,
      inventorySnapshot: runtimeSnapshot({
        scope: { kind: "selection", pageId: "p1" },
        includeSecondPage: true,
        measuredJsonBytes: options.inventoryPayloadBytes,
      }),
    },
  );
  await flushMicrotasks();
  const selection = runtimeSnapshot({
    scope: { kind: "selection", pageId: "p1" },
    includeSecondPage: true,
  });
  reply(listeners, "request-1", {
    ...selection,
    scope: {
      ...selection.scope,
      requiresScopeExpansion: true,
      externalReferences: [
        {
          pageId: "p1",
          elementId: "edge",
          referenceType: "layer",
          referencedId: "l2",
        },
      ],
    },
  });
  await flushMicrotasks();
  if (listeners.has("cyberdraw.runtimeSnapshot.v1.request-2")) {
    reply(
      listeners,
      "request-2",
      runtimeSnapshot({
        scope: { kind: "layers", pageId: "p2", layerIds: ["l2"] },
        includeSecondPage: true,
      }),
    );
  }
  return execution;
}

async function runSingleRequest(snapshot: RuntimeSnapshot) {
  const { context, listeners } = createInteractiveContext();
  const execution = executeHierarchicalSnapshotPlan(
    context,
    { kind: "inspect-visible-page" },
    {
      inventorySnapshot: runtimeSnapshot({
        scope: { kind: "pages", pageIds: ["p1"] },
      }),
    },
  );
  await flushMicrotasks();
  reply(listeners, "request-1", snapshot);
  return execution;
}

function createInteractiveContext() {
  const listeners = new Map<string, BusListener<Record<string, unknown>>>();
  const sent: unknown[] = [];
  const context = createTestContext({
    sent,
    onReply: (eventName, listener) => {
      listeners.set(eventName, listener);
      return () => listeners.delete(eventName);
    },
  });
  return { context, listeners, sent };
}

function reply(
  listeners: ReadonlyMap<string, BusListener<Record<string, unknown>>>,
  requestId: string,
  result: RuntimeSnapshot,
) {
  listeners.get(`cyberdraw.runtimeSnapshot.v1.${requestId}`)?.({
    __event: `cyberdraw.runtimeSnapshot.v1.${requestId}`,
    success: true,
    result,
  });
}

function createTestContext(options: {
  readonly sent: unknown[];
  readonly onReply: (
    eventName: string,
    listener: BusListener<Record<string, unknown>>,
  ) => () => void;
}): Context {
  let nextId = 1;
  return {
    bus: {
      send_to_extension: (message) => {
        options.sent.push(message);
      },
      on_reply_from_extension: (eventName, listener) =>
        options.onReply(
          eventName,
          listener as BusListener<Record<string, unknown>>,
        ),
    },
    id_generator: { generate: () => `request-${nextId++}` },
    request_queue: create_request_queue({
      debug: () => {},
      log: () => {},
    }),
    document_routing: {
      list_documents: async () => [],
      resolve_target_document: async () => ({
        connection_id: "connection-1",
        target_document: { id: "doc-1" },
        document: {
          id: "doc-1",
          title: null,
          mode: null,
          hash: null,
          file_url: null,
          page_count: 1,
          current_page: null,
        },
        runtime_capabilities: createRuntimeCapabilities(),
      }),
    },
    log: {
      debug: () => {},
      log: () => {},
    },
  };
}

function runtimeSnapshot(options: {
  readonly scope: RuntimeSnapshotScope;
  readonly revision?: string;
  readonly documentRevision?: string;
  readonly includeSecondPage?: boolean;
  readonly measuredJsonBytes?: number;
  readonly partialReason?: "soft-limit" | "hard-limit";
}): RuntimeSnapshot {
  const pages: RuntimeSnapshot["pages"] = [
    {
      id: "p1",
      index: 0,
      name: "Page One",
      visible: true,
      background: false,
      layers: [
        {
          id: "l1",
          name: "Layer One",
          visible: true,
          locked: false,
          pageId: "p1",
          index: 0,
        },
      ],
      elements: [
        {
          id: "a",
          pageId: "p1",
          layerId: "l1",
          parentId: "l1",
          type: "vertex",
          label: { format: "plain", text: "Sensitive Label" },
        },
        {
          id: "edge",
          pageId: "p1",
          layerId: "l1",
          parentId: "l1",
          sourceId: "a",
          targetId: "a",
          type: "edge",
        },
      ],
    },
    ...(options.includeSecondPage
      ? [
          {
            id: "p2",
            index: 1,
            name: "Page Two",
            visible: false,
            background: true,
            layers: [
              {
                id: "l2",
                name: "Layer Two",
                visible: true,
                locked: false,
                pageId: "p2",
                index: 0,
              },
            ],
            elements: [
              {
                id: "b",
                pageId: "p2",
                layerId: "l2",
                parentId: "l2",
                type: "vertex" as const,
              },
            ],
          },
        ]
      : []),
  ];
  return {
    schemaVersion: "cyberdraw.runtime-snapshot.v1",
    contractVersion: 1,
    document: {
      id: "doc-1",
      pageCount: pages.length,
      currentPageId: "p1",
      capturedAt: "2026-07-17T00:00:00.000Z",
      revisionSignals: {
        documentId: "doc-1",
        pageIds: pages.map((page) => page.id),
        scope: options.scope,
        requestedScope: options.scope,
        resolvedScope: options.scope,
        complete: true,
        contentRevision:
          options.revision ?? "cyberdraw-content-v1:fnv1a64:0000000000000001",
        documentRevision: options.documentRevision,
      },
    },
    scope: {
      requestedScope: options.scope,
      resolvedScope: options.scope,
      includedPages: pages.map((page) => page.id),
      includedLayers: pages.map((page) => ({
        pageId: page.id,
        layerIds: page.layers.map((layer) => layer.id),
      })),
      includedElementCount: 2,
      contextElementCount: 0,
      externalReferences: [],
      missingPageIds: [],
      missingLayerIds: [],
      includedContext: false,
      requiresScopeExpansion: false,
      conclusive: true,
    },
    pages,
    diagnostics: options.partialReason
      ? [
          {
            code:
              options.partialReason === "soft-limit"
                ? "snapshot_soft_limit_reached"
                : "snapshot_hard_limit_reached",
            message: "partial test snapshot",
          },
        ]
      : [],
    completeness: options.partialReason
      ? { status: "partial", reason: options.partialReason }
      : { status: "complete" },
    truncated: options.partialReason !== undefined,
    limits: {
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
    },
    payload: {
      approximateJsonBytes: options.measuredJsonBytes ?? 1_000,
      measuredJsonBytes: options.measuredJsonBytes ?? 1_000,
      softLimitBytes: 12 * 1024 * 1024,
      hardLimitBytes: 16 * 1024 * 1024,
    },
    performance: {
      extractionMs: 1,
      serializationMs: 1,
      approximateJsonBytes: 1_000,
    },
  };
}

function m9RuntimeSnapshot(kind: "focus" | "context"): RuntimeSnapshot {
  const elements: RuntimeSnapshot["pages"][number]["elements"] =
    kind === "focus"
      ? [
          {
            id: "source-a",
            pageId: "m9-page",
            layerId: "layer-a",
            parentId: "layer-a",
            type: "vertex",
            label: { format: "plain", text: "m9 source label" },
          },
          {
            id: "orphan-a",
            pageId: "m9-page",
            layerId: "layer-a",
            parentId: "layer-a",
            type: "vertex",
          },
          {
            id: "edge-cross",
            pageId: "m9-page",
            layerId: "layer-a",
            parentId: "layer-a",
            sourceId: "source-a",
            targetId: "target-b",
            type: "edge",
          },
          {
            id: "edge-broken",
            pageId: "m9-page",
            layerId: "layer-a",
            parentId: "layer-a",
            sourceId: "source-a",
            targetId: "missing-terminal",
            type: "edge",
          },
        ]
      : [
          {
            id: "target-b",
            pageId: "m9-page",
            layerId: "layer-b",
            parentId: "layer-b",
            type: "vertex",
          },
        ];
  const scope: RuntimeSnapshotScope = {
    kind: "layers",
    pageId: "m9-page",
    layerIds: [kind === "focus" ? "layer-a" : "layer-b"],
  };
  return {
    schemaVersion: "cyberdraw.runtime-snapshot.v1",
    contractVersion: 1,
    document: {
      id: "m9-doc",
      pageCount: 1,
      currentPageId: "m9-page",
      capturedAt: "2026-07-17T00:00:00.000Z",
      revisionSignals: {
        documentId: "m9-doc",
        pageIds: ["m9-page"],
        scope,
        requestedScope: scope,
        resolvedScope: scope,
        complete: true,
        contentRevision:
          kind === "focus"
            ? "cyberdraw-content-v1:fnv1a64:00000000000000a1"
            : "cyberdraw-content-v1:fnv1a64:00000000000000b1",
        documentRevision: "cyberdraw-content-v1:fnv1a64:0000000000000009",
      },
    },
    scope: {
      requestedScope: scope,
      resolvedScope: scope,
      includedPages: ["m9-page"],
      includedLayers: [
        {
          pageId: "m9-page",
          layerIds: [kind === "focus" ? "layer-a" : "layer-b"],
        },
      ],
      includedElementCount: elements.length,
      contextElementCount: 0,
      externalReferences:
        kind === "focus"
          ? [
              {
                pageId: "m9-page",
                elementId: "edge-cross",
                referenceType: "target",
                referencedId: "target-b",
                referencedPageId: "m9-page",
                referencedLayerId: "layer-b",
              },
            ]
          : [],
      missingPageIds: [],
      missingLayerIds: [],
      includedContext: false,
      requiresScopeExpansion: kind === "focus",
      conclusive: true,
    },
    pages: [
      {
        id: "m9-page",
        index: 0,
        name: "M9 synthetic",
        visible: true,
        background: false,
        layers: [
          {
            id: "layer-a",
            name: "Layer A",
            visible: true,
            locked: false,
            pageId: "m9-page",
            index: 0,
          },
          {
            id: "layer-b",
            name: "Layer B",
            visible: true,
            locked: false,
            pageId: "m9-page",
            index: 1,
          },
        ],
        elements,
      },
    ],
    diagnostics: [],
    completeness: { status: "complete" },
    truncated: false,
    limits: {
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
    },
    payload: {
      approximateJsonBytes: 1_000,
      measuredJsonBytes: 1_000,
      softLimitBytes: 12 * 1024 * 1024,
      hardLimitBytes: 16 * 1024 * 1024,
    },
    performance: {
      extractionMs: 1,
      serializationMs: 1,
      approximateJsonBytes: 1_000,
    },
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}
