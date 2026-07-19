import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

import {
  createRealEnvironmentContext,
  disposeRealEnvironmentContext,
  resetDiagram,
  selectCell,
} from "./harness.js";
import { expectNoBrowserErrors, expectNoServerErrors } from "./assertions.js";
import { callToolJson } from "./tools.js";
import { expectToolSuccess, unwrapToolPayload } from "./test-helpers.js";
import type { RealEnvironmentContext } from "./types.js";
import {
  executeHierarchicalSnapshotPlan,
  inventoryFromRuntimeSnapshot,
} from "../cyberdraw-hierarchical-snapshot.js";
import { requestCyberdrawRuntimeSnapshot } from "../cyberdraw-runtime-snapshot.js";
import {
  runtimeSnapshotScopeKey,
  type RuntimeSnapshot,
} from "cyberdraw-runtime-contract";

describe("real environment/hierarchical snapshot planner", () => {
  let context: RealEnvironmentContext;

  beforeAll(async () => {
    context = await createRealEnvironmentContext();
  }, 180000);

  afterAll(async () => {
    await disposeRealEnvironmentContext(context);
  });

  it("executes visible-page, explicit-layer and selection plans while preserving UI", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: rectPayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      x: 80,
      y: 90,
      width: 140,
      height: 80,
      text: "M8 visible node",
    });
    expectToolSuccess(rectPayload);
    const rect = unwrapToolPayload<{ id: string }>(rectPayload);

    const { payload: layerPayload } = await callToolJson<{
      success: boolean;
      result: { id: string; name: string };
    }>(context, "create-layer", { name: "M8 Layer" });
    expectToolSuccess(layerPayload);
    const layer = unwrapToolPayload<{ id: string; name: string }>(layerPayload);

    const { payload: pagePayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "get-current-page", {});
    expectToolSuccess(pagePayload);
    const page = unwrapToolPayload<{ id: string }>(pagePayload);

    await callToolJson(context, "move-cell-to-layer", {
      cell_id: rect.id,
      target_layer_id: layer.id,
    });
    await selectCell(context.page, rect.id);
    const beforeState = await readEditorState(context);

    const visible = await executeHierarchicalSnapshotPlan(
      context.app.context,
      { kind: "inspect-visible-page" },
      { limits: { maxPlanSteps: 4 } },
    );
    const layerPlan = await executeHierarchicalSnapshotPlan(
      context.app.context,
      {
        kind: "inspect-layers",
        layers: [{ pageId: page.id, layerIds: [layer.id] }],
      },
      { limits: { maxPlanSteps: 4 } },
    );
    const selection = await executeHierarchicalSnapshotPlan(
      context.app.context,
      { kind: "inspect-selection" },
      { limits: { maxPlanSteps: 4 } },
    );

    expect(visible.plan.steps[0]?.requestedScope.kind).toBe("pages");
    expect(layerPlan.plan.steps[0]?.requestedScope).toMatchObject({
      kind: "layers",
      pageId: page.id,
    });
    expect(selection.plan.steps[0]?.requestedScope.kind).toBe("selection");
    expect(
      visible.graph?.elements.some((element) => element.drawioId === rect.id),
    ).toBe(true);
    expect(layerPlan.metrics.measuredBytes).toBeGreaterThan(0);
    expect(selection.metrics.measuredBytes).toBeGreaterThan(0);

    const afterState = await readEditorState(context);
    expect(afterState).toEqual(beforeState);
    await expectNoBrowserErrors(context, "hierarchical-snapshot");
    await expectNoServerErrors(
      context,
      "hierarchical-snapshot",
      logCountBefore,
    );
  }, 180000);

  it("covers background page, explicit page target, empty selection, hard-limit avoidance and stale plan", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: visiblePagePayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "get-current-page", {});
    expectToolSuccess(visiblePagePayload);
    const visiblePage = unwrapToolPayload<{ id: string }>(visiblePagePayload);

    const { payload: visibleRectPayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      target_page: { id: visiblePage.id },
      x: 120,
      y: 120,
      width: 120,
      height: 70,
      text: "M8 stale node",
    });
    expectToolSuccess(visibleRectPayload);
    const visibleRect = unwrapToolPayload<{ id: string }>(visibleRectPayload);

    const { payload: backgroundPagePayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "create-page", { name: "M8 Background" });
    expectToolSuccess(backgroundPagePayload);
    const backgroundPage = unwrapToolPayload<{ id: string }>(
      backgroundPagePayload,
    );

    const { payload: backgroundRectPayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      target_page: { id: backgroundPage.id },
      x: 180,
      y: 160,
      width: 120,
      height: 70,
      text: "M8 background node",
    });
    expectToolSuccess(backgroundRectPayload);
    const backgroundRect = unwrapToolPayload<{ id: string }>(
      backgroundRectPayload,
    );

    await clearSelection(context);
    const beforeState = await readEditorState(context);

    const background = await executeHierarchicalSnapshotPlan(
      context.app.context,
      { kind: "inspect-pages", pageIds: [backgroundPage.id] },
      { limits: { maxPlanSteps: 4 } },
    );
    const emptySelection = await executeHierarchicalSnapshotPlan(
      context.app.context,
      { kind: "inspect-selection" },
      { limits: { maxPlanSteps: 4 } },
    );

    const documentSnapshot = (await requestCyberdrawRuntimeSnapshot(
      context.app.context,
      {},
    )) as RuntimeSnapshot;
    const hardLimit = await executeHierarchicalSnapshotPlan(
      context.app.context,
      { kind: "inspect-document", requireCompleteDocument: true },
      {
        inventorySnapshot: documentSnapshot,
        limits: { hardSnapshotBytes: 100 },
      },
    );

    const staleInventory = (await requestCyberdrawRuntimeSnapshot(
      context.app.context,
      { scope: { kind: "pages", pageIds: [visiblePage.id] } },
    )) as RuntimeSnapshot;
    await context.page.evaluate((cellId: string) => {
      const graph = (window as any).ui?.editor?.graph;
      const model = graph?.getModel?.();
      const cell = model?.getCell?.(cellId);
      model?.beginUpdate?.();
      try {
        model?.setValue?.(cell, "M8 stale mutation");
      } finally {
        model?.endUpdate?.();
      }
    }, visibleRect.id);
    const stale = await executeHierarchicalSnapshotPlan(
      context.app.context,
      { kind: "inspect-pages", pageIds: [visiblePage.id] },
      { inventorySnapshot: staleInventory },
    );

    expect(background.plan.steps[0]?.requestedScope).toEqual({
      kind: "pages",
      pageIds: [backgroundPage.id],
    });
    expect(
      background.graph?.elements.some(
        (element) => element.drawioId === backgroundRect.id,
      ),
    ).toBe(true);
    expect(emptySelection.plan.steps[0]?.requestedScope.kind).toBe("pages");
    expect(
      emptySelection.diagnostics.map((diagnostic) => diagnostic.code),
    ).toContain("selection-empty");
    expect(hardLimit.stopReason).toBe("hard-limit-reached");
    expect(hardLimit.plan.steps).toHaveLength(0);
    expect(stale.stopReason).toBe("stale-snapshot");
    expect(
      inventoryFromRuntimeSnapshot(documentSnapshot).pages.length,
    ).toBeGreaterThan(0);

    const afterState = await readEditorState(context);
    expect(afterState.currentPageId).toBe(beforeState.currentPageId);
    expect(afterState.editing).toBe(false);
    await expectNoBrowserErrors(context, "hierarchical-snapshot-extra");
    await expectNoServerErrors(
      context,
      "hierarchical-snapshot-extra",
      logCountBefore,
    );
  }, 180000);

  it("executes real external-reference expansion into a second layer snapshot", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: pagePayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "get-current-page", {});
    expectToolSuccess(pagePayload);
    const page = unwrapToolPayload<{ id: string }>(pagePayload);

    const { payload: focusLayerPayload } = await callToolJson<{
      success: boolean;
      result: { id: string; name: string };
    }>(context, "create-layer", { name: "m8-1-focus" });
    expectToolSuccess(focusLayerPayload);
    const focusLayer = unwrapToolPayload<{ id: string; name: string }>(
      focusLayerPayload,
    );

    const { payload: contextLayerPayload } = await callToolJson<{
      success: boolean;
      result: { id: string; name: string };
    }>(context, "create-layer", { name: "m8-1-context" });
    expectToolSuccess(contextLayerPayload);
    const contextLayer = unwrapToolPayload<{ id: string; name: string }>(
      contextLayerPayload,
    );

    const { payload: sourcePayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      target_page: { id: page.id },
      x: 90,
      y: 120,
      width: 130,
      height: 70,
      text: "m8-1-source",
    });
    expectToolSuccess(sourcePayload);
    const source = unwrapToolPayload<{ id: string }>(sourcePayload);

    const { payload: targetPayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      target_page: { id: page.id },
      x: 360,
      y: 120,
      width: 130,
      height: 70,
      text: "m8-1-target",
    });
    expectToolSuccess(targetPayload);
    const target = unwrapToolPayload<{ id: string }>(targetPayload);

    await callToolJson(context, "move-cell-to-layer", {
      target_page: { id: page.id },
      cell_id: source.id,
      target_layer_id: focusLayer.id,
    });
    await callToolJson(context, "move-cell-to-layer", {
      target_page: { id: page.id },
      cell_id: target.id,
      target_layer_id: contextLayer.id,
    });

    const { payload: edgePayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-edge", {
      target_page: { id: page.id },
      source_id: source.id,
      target_id: target.id,
      parent_id: focusLayer.id,
      text: "m8-1-edge",
    });
    expectToolSuccess(edgePayload);
    const edge = unwrapToolPayload<{ id: string }>(edgePayload);
    await callToolJson(context, "move-cell-to-layer", {
      target_page: { id: page.id },
      cell_id: edge.id,
      target_layer_id: focusLayer.id,
    });

    await selectCell(context.page, source.id);
    const beforeState = await readEditorState(context);
    const executionLogStart = context.logger.entries.length;

    const result = await executeHierarchicalSnapshotPlan(
      context.app.context,
      {
        kind: "inspect-layers",
        layers: [{ pageId: page.id, layerIds: [focusLayer.id] }],
      },
      {
        limits: { maxPlanSteps: 4, maxExpansionDepth: 2 },
        runtimeLimits: { hardSnapshotBytes: 2 * 1024 * 1024 },
      },
    );

    const firstStep = result.plan.steps[0];
    const secondStep = result.plan.steps[1];
    const externalContextDiagnostic = result.diagnostics.find(
      (diagnostic) => diagnostic.code === "external-context-required",
    );
    const edgeElement = result.graph?.elements.find(
      (element) => element.drawioId === edge.id && element.kind === "edge",
    );
    const sourceElement = result.graph?.elements.find(
      (element) => element.drawioId === source.id,
    );
    const targetElement = result.graph?.elements.find(
      (element) => element.drawioId === target.id,
    );
    const executedLogMessages = context.logger.entries
      .slice(executionLogStart)
      .map((entry) => entry.message);

    expect(firstStep?.requestedScope).toEqual({
      kind: "layers",
      pageId: page.id,
      layerIds: [focusLayer.id],
    });
    expect(secondStep).toMatchObject({
      ordinal: 2,
      reason: "external-context-required",
      requestedScope: {
        kind: "layers",
        pageId: page.id,
        layerIds: [contextLayer.id],
      },
    });
    expect(secondStep?.id).toBe(
      `step-02-expansion-${sanitizeStepScopeKey(
        `layers:${page.id}:${contextLayer.id}`,
      )}`,
    );
    expect(externalContextDiagnostic?.detail).toMatchObject({
      externalReferences: 3,
      references: expect.arrayContaining([
        {
          pageId: page.id,
          elementId: edge.id,
          referenceType: "target",
          referencedId: target.id,
          referencedPageId: page.id,
          referencedLayerId: contextLayer.id,
        },
      ]),
    });
    expect(result.metrics.stepsExecuted).toBeGreaterThanOrEqual(2);
    expect(result.metrics.scopesUsed).toEqual([
      runtimeSnapshotScopeKey({
        kind: "layers",
        pageId: page.id,
        layerIds: [focusLayer.id],
      }),
      runtimeSnapshotScopeKey({
        kind: "layers",
        pageId: page.id,
        layerIds: [contextLayer.id],
      }),
    ]);
    expect(result.metrics.revisionsObserved?.length).toBeGreaterThanOrEqual(2);
    expect(result.metrics.mergeDiagnostics).toBeGreaterThan(0);
    expect(result.stopReason).toBe("intent-satisfied");
    expect(result.coverage.document).toBe(false);
    expect(result.coverage.layerTargets).toEqual([
      { pageId: page.id, layerIds: [focusLayer.id] },
      { pageId: page.id, layerIds: [contextLayer.id] },
    ]);
    expect(result.graph?.elements.map((element) => element.drawioId)).toEqual(
      expect.arrayContaining([source.id, target.id, edge.id]),
    );
    expect(edgeElement?.kind).toBe("edge");
    if (edgeElement?.kind !== "edge") {
      throw new Error("expected expanded graph edge");
    }
    expect(edgeElement.sourceId).toBe(sourceElement?.internalId);
    expect(edgeElement.targetId).toBe(targetElement?.internalId);
    expect(result.graph?.findings).toEqual([]);
    expect(
      result.plan.steps.some((step) => step.requestedScope.kind === "document"),
    ).toBe(false);
    expect(
      executedLogMessages.some((message) => message.includes("scope=document")),
    ).toBe(false);

    const afterState = await readEditorState(context);
    expect(afterState).toEqual(beforeState);
    await expectNoBrowserErrors(context, "hierarchical-snapshot-expansion");
    await expectNoServerErrors(
      context,
      "hierarchical-snapshot-expansion",
      logCountBefore,
    );
  }, 180000);

  it("executes real internal structural analysis with expansion, broken reference and orphan finding", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: pagePayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "get-current-page", {});
    expectToolSuccess(pagePayload);
    const page = unwrapToolPayload<{ id: string }>(pagePayload);

    const { payload: layerAPayload } = await callToolJson<{
      success: boolean;
      result: { id: string; name: string };
    }>(context, "create-layer", { name: "m9-layer-a" });
    expectToolSuccess(layerAPayload);
    const layerA = unwrapToolPayload<{ id: string; name: string }>(
      layerAPayload,
    );

    const { payload: layerBPayload } = await callToolJson<{
      success: boolean;
      result: { id: string; name: string };
    }>(context, "create-layer", { name: "m9-layer-b" });
    expectToolSuccess(layerBPayload);
    const layerB = unwrapToolPayload<{ id: string; name: string }>(
      layerBPayload,
    );

    const { payload: sourcePayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      target_page: { id: page.id },
      x: 90,
      y: 120,
      width: 130,
      height: 70,
      text: "source-a",
    });
    expectToolSuccess(sourcePayload);
    const source = unwrapToolPayload<{ id: string }>(sourcePayload);

    const { payload: orphanPayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      target_page: { id: page.id },
      x: 90,
      y: 260,
      width: 130,
      height: 70,
      text: "orphan-a",
    });
    expectToolSuccess(orphanPayload);
    const orphan = unwrapToolPayload<{ id: string }>(orphanPayload);

    const { payload: targetPayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      target_page: { id: page.id },
      x: 360,
      y: 120,
      width: 130,
      height: 70,
      text: "target-b",
    });
    expectToolSuccess(targetPayload);
    const target = unwrapToolPayload<{ id: string }>(targetPayload);

    await callToolJson(context, "move-cell-to-layer", {
      target_page: { id: page.id },
      cell_id: source.id,
      target_layer_id: layerA.id,
    });
    await callToolJson(context, "move-cell-to-layer", {
      target_page: { id: page.id },
      cell_id: orphan.id,
      target_layer_id: layerA.id,
    });
    await callToolJson(context, "move-cell-to-layer", {
      target_page: { id: page.id },
      cell_id: target.id,
      target_layer_id: layerB.id,
    });

    const { payload: crossEdgePayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-edge", {
      target_page: { id: page.id },
      source_id: source.id,
      target_id: target.id,
      parent_id: layerA.id,
      text: "edge-cross",
    });
    expectToolSuccess(crossEdgePayload);
    const crossEdge = unwrapToolPayload<{ id: string }>(crossEdgePayload);

    const { payload: brokenEdgePayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-edge", {
      target_page: { id: page.id },
      source_id: source.id,
      target_id: target.id,
      parent_id: layerA.id,
      text: "edge-broken",
    });
    expectToolSuccess(brokenEdgePayload);
    const brokenEdge = unwrapToolPayload<{ id: string }>(brokenEdgePayload);
    await callToolJson(context, "move-cell-to-layer", {
      target_page: { id: page.id },
      cell_id: crossEdge.id,
      target_layer_id: layerA.id,
    });
    await callToolJson(context, "move-cell-to-layer", {
      target_page: { id: page.id },
      cell_id: brokenEdge.id,
      target_layer_id: layerA.id,
    });
    await context.page.evaluate((edgeId: string) => {
      const graph = (window as any).ui?.editor?.graph;
      const model = graph?.getModel?.();
      const edge = model?.getCell?.(edgeId);
      if (!edge) {
        throw new Error("M9 broken edge fixture missing edge");
      }
      model?.beginUpdate?.();
      try {
        edge.target = { id: "missing-terminal" };
      } finally {
        model?.endUpdate?.();
      }
    }, brokenEdge.id);

    await selectCell(context.page, source.id);
    const beforeState = await readEditorState(context);
    const executionLogStart = context.logger.entries.length;

    const result = await executeHierarchicalSnapshotPlan(
      context.app.context,
      {
        kind: "analyze-structure",
        layers: [{ pageId: page.id, layerIds: [layerA.id] }],
      },
      {
        limits: { maxPlanSteps: 4, maxExpansionDepth: 2 },
        runtimeLimits: { hardSnapshotBytes: 2 * 1024 * 1024 },
      },
    );

    const findings = result.structuralAnalysis?.findings ?? [];
    const crossLayer = findings.find(
      (finding) =>
        finding.findingType === "cross-layer-edge" &&
        finding.relationClassification === "same-page-cross-layer",
    );
    const broken = findings.find(
      (finding) =>
        finding.findingType === "broken-reference" &&
        finding.status === "broken" &&
        finding.referencedElementId === "missing-terminal",
    );
    const confirmedOrphan = findings.find(
      (finding) =>
        finding.findingType === "orphan-element" &&
        finding.status === "confirmed-orphan",
    );
    const edgeElement = result.graph?.elements.find(
      (element) => element.drawioId === crossEdge.id && element.kind === "edge",
    );
    const brokenEdgeElement = result.graph?.elements.find(
      (element) =>
        element.drawioId === brokenEdge.id && element.kind === "edge",
    );
    const sourceElement = result.graph?.elements.find(
      (element) => element.drawioId === source.id,
    );
    const targetElement = result.graph?.elements.find(
      (element) => element.drawioId === target.id,
    );
    const executedLogMessages = context.logger.entries
      .slice(executionLogStart)
      .map((entry) => entry.message);

    expect(result.plan.steps[0]?.requestedScope).toEqual({
      kind: "layers",
      pageId: page.id,
      layerIds: [layerA.id],
    });
    expect(result.plan.steps[1]).toMatchObject({
      ordinal: 2,
      reason: "external-context-required",
      requestedScope: {
        kind: "layers",
        pageId: page.id,
        layerIds: [layerB.id],
      },
    });
    expect(result.metrics.stepsExecuted).toBe(2);
    expect(result.metrics.externalReferences).toBeGreaterThanOrEqual(1);
    expect(result.metrics.scopesUsed).toEqual([
      runtimeSnapshotScopeKey({
        kind: "layers",
        pageId: page.id,
        layerIds: [layerA.id],
      }),
      runtimeSnapshotScopeKey({
        kind: "layers",
        pageId: page.id,
        layerIds: [layerB.id],
      }),
    ]);
    expect(result.stopReason).toBe("intent-satisfied");
    expect(result.coverage.document).toBe(false);
    expect(result.structuralAnalysis?.coverage.document).toBe(false);
    expect(result.structuralAnalysis?.completeness).toBe(
      "complete-target-scopes",
    );
    expect(result.structuralAnalysis?.revisionEvidence.revisionCompatible).toBe(
      true,
    );
    expect(edgeElement?.kind).toBe("edge");
    if (edgeElement?.kind !== "edge") {
      throw new Error("expected M9 cross-layer edge");
    }
    expect(edgeElement.sourceId).toBe(sourceElement?.internalId);
    expect(edgeElement.targetId).toBe(targetElement?.internalId);
    expect(brokenEdgeElement?.kind).toBe("edge");
    if (brokenEdgeElement?.kind !== "edge") {
      throw new Error("expected M9 broken edge");
    }
    expect(brokenEdgeElement.targetId).toBe("missing-terminal");
    expect(crossLayer).toBeDefined();
    expect(broken).toBeDefined();
    expect(confirmedOrphan).toBeDefined();
    expect(result.structuralAnalysis?.counts).toMatchObject({
      brokenReferenceCount: { value: 1, basis: "observed" },
      crossLayerEdgeCount: { value: 1, basis: "observed" },
      orphanElementCount: { value: 1, basis: "observed" },
    });
    expect(
      result.plan.steps.some((step) => step.requestedScope.kind === "document"),
    ).toBe(false);
    expect(
      executedLogMessages.some((message) => message.includes("scope=document")),
    ).toBe(false);
    expect(JSON.stringify(findings)).not.toContain("source-a");
    expect(JSON.stringify(findings)).not.toContain("<mxGraphModel");

    const afterState = await readEditorState(context);
    expect(afterState).toEqual(beforeState);
    await expectNoBrowserErrors(context, "hierarchical-structural-analysis");
    await expectNoServerErrors(
      context,
      "hierarchical-structural-analysis",
      logCountBefore,
    );
  }, 180000);
});

async function readEditorState(context: RealEnvironmentContext) {
  return context.page.evaluate(() => {
    const ui = (window as any).ui;
    const graph = ui?.editor?.graph;
    const currentId = ui?.currentPage?.getId?.() ?? ui?.currentPage?.id ?? null;
    const selection = graph?.getSelectionCells?.() ?? [];
    return {
      currentPageId: currentId,
      selectionIds: Array.isArray(selection)
        ? selection.map((cell: any) => String(cell.id)).sort()
        : [],
      editing:
        typeof graph?.isEditing === "function" ? graph.isEditing() : false,
    };
  });
}

async function clearSelection(context: RealEnvironmentContext) {
  await context.page.evaluate(() => {
    const graph = (window as any).ui?.editor?.graph;
    graph?.clearSelection?.();
  });
}

function sanitizeStepScopeKey(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
}
