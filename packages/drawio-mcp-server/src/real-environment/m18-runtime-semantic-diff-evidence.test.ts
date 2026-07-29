import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

import {
  diffSemanticSnapshots,
  fromRuntimeSnapshot,
  type SemanticDiffEntityResult,
  type SemanticDiffInput,
  type SemanticDiffResult,
  type StructuralAnalysisCoverage,
  type StructuralCompleteness,
} from "cyberdraw-graph-model";
import type { RuntimeSnapshot } from "cyberdraw-runtime-contract";

import { requestCyberdrawRuntimeSnapshot } from "../cyberdraw-runtime-snapshot.js";
import {
  createRealEnvironmentContext,
  disposeRealEnvironmentContext,
  resetDiagram,
} from "./harness.js";
import { expectNoBrowserErrors, expectNoServerErrors } from "./assertions.js";
import { callToolJson } from "./tools.js";
import { expectToolSuccess, unwrapToolPayload } from "./test-helpers.js";
import type { RealEnvironmentContext } from "./types.js";

type IdResult = { readonly id: string };
type PageInfo = {
  readonly id: string;
  readonly index: number;
  readonly name: string;
};

describe("real environment/M18 runtime semantic diff evidence", () => {
  let context: RealEnvironmentContext;

  beforeAll(async () => {
    context = await createRealEnvironmentContext();
  }, 180000);

  afterAll(async () => {
    await disposeRealEnvironmentContext(context);
  });

  it("feeds real runtime snapshots into the pure semantic diff model", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: renamedPayload } = await callToolJson<{
      success: boolean;
      result: PageInfo;
    }>(context, "rename-page", {
      page: { index: 0 },
      name: "M18 Semantic Diff Runtime",
    });
    expectToolSuccess(renamedPayload);
    const page = unwrapToolPayload<PageInfo>(renamedPayload);

    const focusLayer = await createLayer("m18-focus");
    const contextLayer = await createLayer("m18-context");

    const source = await addRectangle({
      pageId: page.id,
      text: "m18-source",
      x: 90,
      y: 120,
      style: "fillColor=#dae8fc;strokeColor=#6c8ebf;whiteSpace=wrap;html=1;",
    });
    const target = await addRectangle({
      pageId: page.id,
      text: "m18-target",
      x: 340,
      y: 120,
      style: "fillColor=#fff2cc;strokeColor=#d6b656;whiteSpace=wrap;html=1;",
    });
    const alternate = await addRectangle({
      pageId: page.id,
      text: "m18-alt",
      x: 590,
      y: 120,
      style: "fillColor=#f8cecc;strokeColor=#b85450;whiteSpace=wrap;html=1;",
    });
    const disposable = await addRectangle({
      pageId: page.id,
      text: "m18-disposable",
      x: 90,
      y: 310,
    });
    const outside = await addRectangle({
      pageId: page.id,
      text: "m18-outside",
      x: 340,
      y: 310,
    });

    await moveToLayer(page.id, source.id, focusLayer.id);
    await moveToLayer(page.id, disposable.id, focusLayer.id);
    await moveToLayer(page.id, target.id, contextLayer.id);
    await moveToLayer(page.id, alternate.id, contextLayer.id);
    await moveToLayer(page.id, outside.id, contextLayer.id);

    const edge = await addEdge({
      pageId: page.id,
      sourceId: source.id,
      targetId: target.id,
      text: "m18-edge",
    });
    await moveToLayer(page.id, edge.id, focusLayer.id);

    const initial = await snapshot(context);
    const repeat = await snapshot(context);

    const identical = semanticDiff(initial, repeat);
    expect(expectEntity(identical, source.id)).toMatchObject({
      identityStatus: "EXACT",
      classifications: expect.arrayContaining(["UNCHANGED"]),
      dimensions: expect.objectContaining({ coverage: "unchanged" }),
    });
    expect(expectEntity(identical, edge.id)).toMatchObject({
      identityStatus: "EXACT",
      classifications: expect.arrayContaining(["UNCHANGED"]),
    });
    expect(identical.reasonCodes.join(" ")).not.toMatch(
      /privateSignature|mxGraphModel|mxCell/,
    );

    await callToolJson(context, "edit-cell", {
      target_page: { id: page.id },
      cell_id: source.id,
      x: 150,
      y: 180,
    });
    const geometryChanged = await snapshot(context);
    const geometryDiff = semanticDiff(initial, geometryChanged);
    expect(expectEntity(geometryDiff, source.id)).toMatchObject({
      identityStatus: "EXACT",
      classifications: expect.arrayContaining(["MOVED"]),
      dimensions: expect.objectContaining({ geometry: "changed" }),
    });

    await callToolJson(context, "edit-cell", {
      target_page: { id: page.id },
      cell_id: target.id,
      text: "m18-target-edited",
    });
    const labelChanged = await snapshot(context);
    const labelDiff = semanticDiff(initial, labelChanged);
    expect(expectEntity(labelDiff, target.id)).toMatchObject({
      identityStatus: "EXACT",
      classifications: expect.arrayContaining(["MODIFIED"]),
      dimensions: expect.objectContaining({ content: "changed" }),
    });

    await callToolJson(context, "edit-cell", {
      target_page: { id: page.id },
      cell_id: alternate.id,
      style: "fillColor=#d5e8d4;strokeColor=#82b366;whiteSpace=wrap;html=1;",
    });
    const styleChanged = await snapshot(context);
    const styleDiff = semanticDiff(initial, styleChanged);
    expect(expectEntity(styleDiff, alternate.id)).toMatchObject({
      identityStatus: "EXACT",
      classifications: expect.arrayContaining(["MODIFIED"]),
      dimensions: expect.objectContaining({ metadata: "changed" }),
    });

    await moveToLayer(page.id, source.id, contextLayer.id);
    const layerMoved = await snapshot(context);
    const layerMoveDiff = semanticDiff(styleChanged, layerMoved);
    const layerMoveResult = expectEntity(layerMoveDiff, source.id);
    expect(layerMoveResult).toMatchObject({
      identityStatus: "EXACT",
      classifications: expect.arrayContaining(["MOVED"]),
      dimensions: expect.objectContaining({
        container: "changed",
        geometry: "unchanged",
      }),
    });
    expect(layerMoveResult.classifications).not.toContain("MODIFIED");
    expect(layerMoveResult.classifications).not.toContain("REWIRED");

    await callToolJson(context, "edit-edge", {
      target_page: { id: page.id },
      cell_id: edge.id,
      target_id: alternate.id,
    });
    const endpointChanged = await snapshot(context);
    const endpointDiff = semanticDiff(initial, endpointChanged);
    expect(expectEntity(endpointDiff, edge.id)).toMatchObject({
      identityStatus: "EXACT",
      classifications: expect.arrayContaining(["REWIRED"]),
      dimensions: expect.objectContaining({ connectivity: "changed" }),
    });

    await callToolJson(context, "edit-edge", {
      target_page: { id: page.id },
      cell_id: edge.id,
      text: "m18-edge-edited",
      style: "endArrow=classic;strokeColor=#9673a6;html=1;rounded=0;",
    });
    const edgeLabelStyleChanged = await snapshot(context);
    const edgeLabelStyleDiff = semanticDiff(
      endpointChanged,
      edgeLabelStyleChanged,
    );
    const edgeLabelStyleResult = expectEntity(edgeLabelStyleDiff, edge.id);
    expect(edgeLabelStyleResult).toMatchObject({
      identityStatus: "EXACT",
      classifications: expect.arrayContaining(["MODIFIED"]),
      dimensions: expect.objectContaining({
        content: "changed",
        metadata: "changed",
        connectivity: "unchanged",
      }),
    });
    expect(edgeLabelStyleResult.classifications).not.toContain("REWIRED");

    await callToolJson(context, "delete-cell-by-id", {
      target_page: { id: page.id },
      cell_id: disposable.id,
    });
    const deleted = await snapshot(context);
    const deleteDiff = semanticDiff(initial, deleted);
    expect(expectEntity(deleteDiff, disposable.id)).toMatchObject({
      identityStatus: "NO_MATCH",
      classifications: expect.arrayContaining(["REMOVED"]),
      reasonCodes: expect.arrayContaining(["removed-absence-proven"]),
    });

    const scopedDeleteDiff = semanticDiff(initial, deleted, {
      baseCoverage: layerCoverage(initial, page.id, focusLayer.id),
      targetCoverage: layerCoverage(deleted, page.id, focusLayer.id),
      baseCompleteness: "complete-target-scopes",
      targetCompleteness: "complete-target-scopes",
    });
    expect(expectEntity(scopedDeleteDiff, disposable.id)).toMatchObject({
      classifications: expect.arrayContaining(["REMOVED"]),
      reasonCodes: expect.arrayContaining(["removed-absence-proven"]),
    });

    await callToolJson(context, "delete-cell-by-id", {
      target_page: { id: page.id },
      cell_id: outside.id,
    });
    const outsideDeleted = await snapshot(context);
    const outsideScopedDiff = semanticDiff(initial, outsideDeleted, {
      baseCoverage: layerCoverage(initial, page.id, focusLayer.id),
      targetCoverage: layerCoverage(outsideDeleted, page.id, focusLayer.id),
      baseCompleteness: "complete-target-scopes",
      targetCompleteness: "complete-target-scopes",
    });
    expect(expectEntity(outsideScopedDiff, outside.id)).toMatchObject({
      classifications: [],
      dimensions: expect.objectContaining({ existence: "unknown" }),
      reasonCodes: expect.arrayContaining(["absence-not-proven"]),
    });

    const recreated = await addRectangle({
      pageId: page.id,
      text: "m18-disposable",
      x: 90,
      y: 310,
    });
    await moveToLayer(page.id, recreated.id, focusLayer.id);
    const recreatedSnapshot = await snapshot(context);
    const recreatedDiff = semanticDiff(initial, recreatedSnapshot);
    expect(expectEntity(recreatedDiff, disposable.id)).not.toMatchObject({
      classifications: expect.arrayContaining(["UNCHANGED"]),
    });
    expect(expectEntity(recreatedDiff, recreated.id)).toMatchObject({
      classifications: expect.arrayContaining(["ADDED"]),
    });

    const added = await addRectangle({
      pageId: page.id,
      text: "m18-added",
      x: 590,
      y: 310,
    });
    const addedSnapshot = await snapshot(context);
    const addedDiff = semanticDiff(initial, addedSnapshot);
    expect(expectEntity(addedDiff, added.id)).toMatchObject({
      identityStatus: "NO_MATCH",
      classifications: expect.arrayContaining(["ADDED"]),
      reasonCodes: expect.arrayContaining(["added-absence-proven"]),
    });

    const { payload: copiedPagePayload } = await callToolJson<{
      success: boolean;
      result: PageInfo;
    }>(context, "copy-page", {
      page: { id: page.id },
      name: "M18 Semantic Diff Runtime Copy",
    });
    expectToolSuccess(copiedPagePayload);
    const copiedPage = unwrapToolPayload<PageInfo>(copiedPagePayload);
    const copiedSnapshot = await snapshot(context);
    const copiedSource = elementByLabel(copiedSnapshot, copiedPage.id, "m18-source");
    const copyDiff = semanticDiff(initial, copiedSnapshot);
    expect(expectEntity(copyDiff, copiedSource.id)).not.toMatchObject({
      identityStatus: "EXACT",
    });

    const partialCoverageDiff = semanticDiff(initial, styleChanged, {
      baseCoverage: layerCoverage(initial, page.id, focusLayer.id),
      baseCompleteness: "complete-target-scopes",
    });
    expect(expectEntity(partialCoverageDiff, alternate.id)).toMatchObject({
      classifications: [],
      dimensions: expect.objectContaining({ coverage: "not-compared" }),
    });

    const staleBase = semanticDiff(initial, repeat, {
      baseRevisionCompatible: false,
    });
    expect(staleBase).toMatchObject({
      outcome: "stale",
      revisionStatus: "stale-base",
      entityResults: [],
    });

    const staleTarget = semanticDiff(initial, repeat, {
      targetRevisionCompatible: false,
    });
    expect(staleTarget).toMatchObject({
      outcome: "stale",
      revisionStatus: "stale-target",
      entityResults: [],
    });

    const revisionMismatch = semanticDiff(initial, repeat, {
      baseDocumentRevisions: ["runtime-revision-a"],
      targetDocumentRevisions: ["runtime-revision-b"],
    });
    expect(revisionMismatch).toMatchObject({
      outcome: "incomparable",
      revisionStatus: "revision-mismatch",
      entityResults: [],
    });

    const deterministic = semanticDiff(initial, repeat);
    const reordered = semanticDiff(
      reorderRuntimeSnapshot(initial),
      reorderRuntimeSnapshot(repeat),
    );
    expect(semanticClassificationShape(reordered)).toEqual(
      semanticClassificationShape(deterministic),
    );

    expect(JSON.stringify(endpointDiff)).not.toMatch(
      /mxGraphModel|mxCell|privateSignature|cyberdraw-private-signature/,
    );

    await expectNoBrowserErrors(context, "m18-runtime-semantic-diff");
    await expectNoServerErrors(
      context,
      "m18-runtime-semantic-diff",
      logCountBefore,
    );
  }, 240000);

  async function createLayer(name: string): Promise<IdResult> {
    const { payload } = await callToolJson<{
      success: boolean;
      result: IdResult;
    }>(context, "create-layer", { name });
    expectToolSuccess(payload);
    return unwrapToolPayload<IdResult>(payload);
  }

  async function addRectangle(input: {
    readonly pageId: string;
    readonly text: string;
    readonly x: number;
    readonly y: number;
    readonly style?: string;
  }): Promise<IdResult> {
    const { payload } = await callToolJson<{
      success: boolean;
      result: IdResult;
    }>(context, "add-rectangle", {
      target_page: { id: input.pageId },
      x: input.x,
      y: input.y,
      width: 140,
      height: 70,
      text: input.text,
      ...(input.style ? { style: input.style } : {}),
    });
    expectToolSuccess(payload);
    return unwrapToolPayload<IdResult>(payload);
  }

  async function addEdge(input: {
    readonly pageId: string;
    readonly sourceId: string;
    readonly targetId: string;
    readonly text: string;
  }): Promise<IdResult> {
    const { payload } = await callToolJson<{
      success: boolean;
      result: IdResult;
    }>(context, "add-edge", {
      target_page: { id: input.pageId },
      source_id: input.sourceId,
      target_id: input.targetId,
      text: input.text,
    });
    expectToolSuccess(payload);
    return unwrapToolPayload<IdResult>(payload);
  }

  async function moveToLayer(pageId: string, cellId: string, layerId: string) {
    const { payload } = await callToolJson<{ success: boolean }>(
      context,
      "move-cell-to-layer",
      {
        target_page: { id: pageId },
        cell_id: cellId,
        target_layer_id: layerId,
      },
    );
    expectToolSuccess(payload);
  }
});

async function snapshot(
  context: RealEnvironmentContext,
): Promise<RuntimeSnapshot> {
  return (await requestCyberdrawRuntimeSnapshot(context.app.context, {
    includeRaw: false,
  })) as RuntimeSnapshot;
}

function semanticDiff(
  base: RuntimeSnapshot,
  target: RuntimeSnapshot,
  options: {
    readonly baseCoverage?: StructuralAnalysisCoverage;
    readonly targetCoverage?: StructuralAnalysisCoverage;
    readonly baseCompleteness?: StructuralCompleteness;
    readonly targetCompleteness?: StructuralCompleteness;
    readonly baseRevisionCompatible?: boolean;
    readonly targetRevisionCompatible?: boolean;
    readonly baseDocumentRevisions?: readonly string[];
    readonly targetDocumentRevisions?: readonly string[];
  } = {},
): SemanticDiffResult {
  const baseGraph = fromRuntimeSnapshot(base);
  const targetGraph = fromRuntimeSnapshot(target);
  const input: SemanticDiffInput = {
    base: {
      graph: baseGraph,
      coverage: options.baseCoverage,
      completeness: options.baseCompleteness,
      externalReferences: semanticExternalReferences(base),
      revisionEvidence: {
        documentId:
          base.document.id ?? base.document.revisionSignals.documentId,
        contentRevisions: [base.document.revisionSignals.contentRevision],
        documentRevisions: options.baseDocumentRevisions,
        revisionCompatible: options.baseRevisionCompatible,
      },
    },
    target: {
      graph: targetGraph,
      coverage: options.targetCoverage,
      completeness: options.targetCompleteness,
      externalReferences: semanticExternalReferences(target),
      revisionEvidence: {
        documentId:
          target.document.id ?? target.document.revisionSignals.documentId,
        contentRevisions: [target.document.revisionSignals.contentRevision],
        documentRevisions: options.targetDocumentRevisions,
        revisionCompatible: options.targetRevisionCompatible,
      },
    },
  };
  return diffSemanticSnapshots(input);
}

function semanticExternalReferences(snapshot: RuntimeSnapshot) {
  return snapshot.scope.externalReferences.map((reference) => ({
    pageId: reference.pageId,
    elementId: reference.elementId,
    referenceType: reference.referenceType,
    referencedId: reference.referencedId,
    referencedPageId: reference.referencedPageId,
    referencedLayerId: reference.referencedLayerId,
  }));
}

function expectEntity(
  result: SemanticDiffResult,
  rawAnchor: string,
): SemanticDiffEntityResult {
  const match = result.entityResults.find(
    (entry) =>
      entry.baseEntityRef?.snapshotScopedId.includes(rawAnchor) ||
      entry.targetEntityRef?.snapshotScopedId.includes(rawAnchor),
  );
  if (!match) {
    throw new Error(`semantic diff result did not include ${rawAnchor}`);
  }
  return match;
}

function layerCoverage(
  snapshot: RuntimeSnapshot,
  pageId: string,
  layerId: string,
): StructuralAnalysisCoverage {
  const graph = fromRuntimeSnapshot(snapshot);
  const page = graph.pages.find((candidate) => candidate.drawioId === pageId);
  const layer = graph.layers.find(
    (candidate) => candidate.drawioId === layerId && candidate.pageId === page?.internalId,
  );
  if (!page || !layer) {
    throw new Error(`could not resolve layer coverage for ${pageId}/${layerId}`);
  }
  return {
    document: false,
    pageIds: [],
    layerTargets: [{ pageId: page.internalId, layerIds: [layer.internalId] }],
    conclusive: true,
    completeness: "complete-target-scopes",
  };
}

function reorderRuntimeSnapshot(snapshot: RuntimeSnapshot): RuntimeSnapshot {
  return {
    ...snapshot,
    pages: [...snapshot.pages]
      .map((page) => ({
        ...page,
        layers: [...page.layers].reverse(),
        elements: [...page.elements].reverse(),
      }))
      .reverse(),
  };
}

function elementByLabel(
  snapshot: RuntimeSnapshot,
  pageId: string,
  label: string,
) {
  const page = snapshot.pages.find((candidate) => candidate.id === pageId);
  const matches =
    page?.elements.filter(
      (element) => (element.label?.text ?? element.label?.html ?? "") === label,
    ) ?? [];
  if (matches.length !== 1) {
    throw new Error(`expected one element with label ${label}`);
  }
  return matches[0]!;
}

function semanticClassificationShape(result: SemanticDiffResult) {
  return {
    outcome: result.outcome,
    baseCompleteness: result.baseCompleteness,
    targetCompleteness: result.targetCompleteness,
    diffCompleteness: result.diffCompleteness,
    reasonCodes: result.reasonCodes,
    entityResults: result.entityResults.map((entry) => ({
      entityType:
        entry.baseEntityRef?.entityType ?? entry.targetEntityRef?.entityType,
      identityStatus: entry.identityStatus,
      dimensions: entry.dimensions,
      classifications: entry.classifications,
      reasonCodes: entry.reasonCodes,
    })),
  };
}
