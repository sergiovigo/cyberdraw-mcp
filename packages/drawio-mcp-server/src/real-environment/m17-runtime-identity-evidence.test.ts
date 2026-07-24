import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

import {
  createPrivateIdentitySignature,
  matchStableIdentity,
  type IdentityMatchOutcome,
  type IdentityMatchReasonCode,
  type StableIdentityEvidence,
} from "cyberdraw-graph-model";
import type {
  RuntimeSnapshot,
  RuntimeSnapshotElement,
  RuntimeSnapshotExternalReference,
  RuntimeSnapshotLayer,
  RuntimeSnapshotPage,
} from "cyberdraw-runtime-contract";

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

type PageInfo = {
  readonly id: string;
  readonly index: number;
  readonly name: string;
};

describe("real environment/M17 runtime identity evidence", () => {
  let context: RealEnvironmentContext;

  beforeAll(async () => {
    context = await createRealEnvironmentContext();
  }, 180000);

  afterAll(async () => {
    await disposeRealEnvironmentContext(context);
  });

  it("maps real runtime snapshots to identity evidence without public identity exposure", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: renamedPayload } = await callToolJson<{
      success: boolean;
      result: PageInfo;
    }>(context, "rename-page", {
      page: { index: 0 },
      name: "M17 Identity Runtime",
    });
    expectToolSuccess(renamedPayload);
    const page = unwrapToolPayload<PageInfo>(renamedPayload);

    const { payload: focusLayerPayload } = await callToolJson<{
      success: boolean;
      result: { id: string; name: string };
    }>(context, "create-layer", { name: "m17-focus" });
    expectToolSuccess(focusLayerPayload);
    const focusLayer = unwrapToolPayload<{ id: string; name: string }>(
      focusLayerPayload,
    );

    const { payload: contextLayerPayload } = await callToolJson<{
      success: boolean;
      result: { id: string; name: string };
    }>(context, "create-layer", { name: "m17-context" });
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
      width: 140,
      height: 70,
      text: "m17-source",
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
      width: 140,
      height: 70,
      text: "m17-target",
    });
    expectToolSuccess(targetPayload);
    const target = unwrapToolPayload<{ id: string }>(targetPayload);

    const { payload: disposablePayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      target_page: { id: page.id },
      x: 620,
      y: 120,
      width: 140,
      height: 70,
      text: "m17-disposable",
    });
    expectToolSuccess(disposablePayload);
    const disposable = unwrapToolPayload<{ id: string }>(disposablePayload);

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
      text: "m17-edge",
    });
    expectToolSuccess(edgePayload);
    const edge = unwrapToolPayload<{ id: string }>(edgePayload);
    await callToolJson(context, "move-cell-to-layer", {
      target_page: { id: page.id },
      cell_id: edge.id,
      target_layer_id: focusLayer.id,
    });

    const initial = await snapshot(context);
    const repeat = await snapshot(context);

    expectMatch(
      "same entity across consecutive snapshots",
      elementEvidence(initial, source.id),
      [elementEvidence(repeat, source.id)],
      "EXACT",
      ["exact-raw-anchor"],
    );
    expectMatch(
      "reordered candidate extraction remains deterministic",
      elementEvidence(initial, source.id),
      [elementEvidence(repeat, target.id), elementEvidence(repeat, source.id)],
      "EXACT",
      ["exact-raw-anchor"],
    );
    expectMatch(
      "edge unchanged across consecutive snapshots",
      edgeEvidence(initial, edge.id),
      [edgeEvidence(repeat, edge.id)],
      "EXACT",
      ["exact-raw-anchor"],
    );
    expectMatch(
      "page identity is anchored by runtime page id",
      pageEvidence(initial, page.id),
      [pageEvidence(repeat, page.id)],
      "EXACT",
      ["exact-raw-anchor"],
    );
    expectMatch(
      "layer identity survives equivalent snapshot",
      layerEvidence(initial, page.id, focusLayer.id),
      [layerEvidence(repeat, page.id, focusLayer.id)],
      "EXACT",
      ["exact-raw-anchor"],
    );

    const layerOnly = await snapshot(context, {
      scope: { kind: "layers", pageId: page.id, layerIds: [focusLayer.id] },
    });
    const layerOnlyRepeat = await snapshot(context, {
      scope: { kind: "layers", pageId: page.id, layerIds: [focusLayer.id] },
    });
    const targetReference = externalReferenceFor(layerOnly, {
      elementId: edge.id,
      referenceType: "target",
      referencedId: target.id,
    });
    expect(targetReference).toMatchObject({
      referencedLayerId: contextLayer.id,
    });
    expectMatch(
      "external-reference evidence repeats exactly inside layer scope",
      externalReferenceEvidence(layerOnly, targetReference),
      [
        externalReferenceEvidence(
          layerOnlyRepeat,
          externalReferenceFor(layerOnlyRepeat, {
            elementId: edge.id,
            referenceType: "target",
            referencedId: target.id,
          }),
        ),
      ],
      "EXACT",
      ["exact-raw-anchor"],
    );

    const { payload: copiedPagePayload } = await callToolJson<{
      success: boolean;
      result: PageInfo;
    }>(context, "copy-page", {
      page: { id: page.id },
      name: "M17 Identity Runtime Copy",
    });
    expectToolSuccess(copiedPagePayload);
    const copiedPage = unwrapToolPayload<PageInfo>(copiedPagePayload);
    const copiedSnapshot = await snapshot(context);
    const copiedSource = elementByLabel(
      copiedSnapshot,
      copiedPage.id,
      "m17-source",
    );
    const copiedPageOutcome = matchStableIdentity(
      elementEvidence(initial, source.id),
      [elementEvidence(copiedSnapshot, copiedSource.id, copiedPage.id)],
    );
    expect(copiedPageOutcome.outcome).not.toBe("EXACT");

    await callToolJson(context, "edit-cell", {
      target_page: { id: page.id },
      cell_id: source.id,
      x: 140,
      y: 170,
    });
    const movedGeometry = await snapshot(context);
    expectMatch(
      "node geometry move keeps exact raw-anchor identity",
      elementEvidence(initial, source.id),
      [elementEvidence(movedGeometry, source.id)],
      "EXACT",
      ["exact-raw-anchor"],
    );

    await callToolJson(context, "edit-cell", {
      target_page: { id: page.id },
      cell_id: source.id,
      text: "m17-source-edited",
    });
    const editedLabel = await snapshot(context);
    expectMatch(
      "node label edit keeps exact raw-anchor identity",
      elementEvidence(initial, source.id),
      [elementEvidence(editedLabel, source.id)],
      "EXACT",
      ["exact-raw-anchor"],
    );

    await callToolJson(context, "move-cell-to-layer", {
      target_page: { id: page.id },
      cell_id: source.id,
      target_layer_id: contextLayer.id,
    });
    const movedLayer = await snapshot(context);
    expectMatch(
      "node move across layers keeps exact identity with layer context evidence",
      elementEvidence(initial, source.id),
      [elementEvidence(movedLayer, source.id)],
      "EXACT",
      ["exact-raw-anchor", "layer-context-changed"],
    );

    const layerBeforeRename = layerEvidence(
      movedLayer,
      page.id,
      contextLayer.id,
    );
    await renameLayer(context, contextLayer.id, "m17-context-renamed");
    const renamedLayer = await snapshot(context);
    expectMatch(
      "renamed layer keeps exact raw-anchor identity",
      layerBeforeRename,
      [layerEvidence(renamedLayer, page.id, contextLayer.id)],
      "EXACT",
      ["exact-raw-anchor"],
    );

    const { payload: replacementTargetPayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      target_page: { id: page.id },
      x: 360,
      y: 280,
      width: 140,
      height: 70,
      text: "m17-replacement-target",
    });
    expectToolSuccess(replacementTargetPayload);
    const replacementTarget = unwrapToolPayload<{ id: string }>(
      replacementTargetPayload,
    );
    await callToolJson(context, "edit-edge", {
      target_page: { id: page.id },
      cell_id: edge.id,
      target_id: replacementTarget.id,
    });
    const changedEndpoint = await snapshot(context);
    expectMatch(
      "edge endpoint change keeps exact edge raw-anchor identity",
      edgeEvidence(initial, edge.id),
      [edgeEvidence(changedEndpoint, edge.id)],
      "EXACT",
      ["exact-raw-anchor"],
    );

    const disposableBefore = elementEvidence(initial, disposable.id);
    await callToolJson(context, "delete-cell-by-id", {
      target_page: { id: page.id },
      cell_id: disposable.id,
    });
    const { payload: recreatedPayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      target_page: { id: page.id },
      x: 620,
      y: 120,
      width: 140,
      height: 70,
      text: "m17-disposable",
    });
    expectToolSuccess(recreatedPayload);
    const recreated = unwrapToolPayload<{ id: string }>(recreatedPayload);
    const recreatedSnapshot = await snapshot(context);
    expectMatch(
      "deleted and recreated visual node is not silently correlated",
      disposableBefore,
      [elementEvidence(recreatedSnapshot, recreated.id)],
      "NO_MATCH",
      [
        "no-compatible-candidate",
        "private-signature-changed",
        "raw-anchor-changed",
      ],
    );

    const publicAnalyze = await callToolJson<any>(
      context,
      "cyberdraw_analyze_structure",
      { mode: "analyze" },
    );
    expect(publicAnalyze.payload.version).toBe("m13-v1");
    expect(JSON.stringify(publicAnalyze.payload)).not.toContain(
      "privateSignature",
    );
    expect(JSON.stringify(publicAnalyze.payload)).not.toContain(
      "StableIdentity",
    );

    await expectNoBrowserErrors(context, "m17-runtime-identity");
    await expectNoServerErrors(context, "m17-runtime-identity", logCountBefore);
  }, 180000);
});

async function snapshot(
  context: RealEnvironmentContext,
  request: Parameters<typeof requestCyberdrawRuntimeSnapshot>[1] = {},
) {
  return (await requestCyberdrawRuntimeSnapshot(
    context.app.context,
    request,
  )) as RuntimeSnapshot;
}

function expectMatch(
  name: string,
  reference: StableIdentityEvidence,
  candidates: readonly StableIdentityEvidence[],
  outcome: IdentityMatchOutcome,
  reasonCodes: readonly IdentityMatchReasonCode[],
) {
  const result = matchStableIdentity(reference, candidates);
  expect({ name, result }).toMatchObject({
    result: {
      outcome,
      reasonCodes,
    },
  });
}

function pageEvidence(
  snapshot: RuntimeSnapshot,
  pageId: string,
): StableIdentityEvidence {
  const page = pageById(snapshot, pageId);
  return {
    identityId: `runtime:page:${page.id}`,
    entityType: "page",
    documentId: documentId(snapshot),
    pageId: page.id,
    rawAnchor: page.id,
    privateSignature: createPrivateIdentitySignature({
      parts: ["page", String(page.index), page.name],
    }),
  };
}

function layerEvidence(
  snapshot: RuntimeSnapshot,
  pageId: string,
  layerId: string,
): StableIdentityEvidence {
  const layer = layerById(snapshot, pageId, layerId);
  return {
    identityId: `runtime:layer:${layer.pageId}:${layer.id}`,
    entityType: "layer",
    documentId: documentId(snapshot),
    pageId: layer.pageId,
    layerId: layer.id,
    rawAnchor: layer.id,
    privateSignature: createPrivateIdentitySignature({
      parts: ["layer", layer.name, String(layer.index)],
    }),
  };
}

function elementEvidence(
  snapshot: RuntimeSnapshot,
  elementId: string,
  pageId?: string,
): StableIdentityEvidence {
  const { page, element } = elementById(snapshot, elementId, pageId);
  return {
    identityId: `runtime:element:${page.id}:${element.layerId ?? ""}:${element.id}`,
    entityType: "element",
    documentId: documentId(snapshot),
    pageId: page.id,
    ...(element.layerId ? { layerId: element.layerId } : {}),
    rawAnchor: element.id,
    privateSignature: elementSignature(element),
  };
}

function edgeEvidence(
  snapshot: RuntimeSnapshot,
  edgeId: string,
): StableIdentityEvidence {
  const { page, element } = elementById(snapshot, edgeId);
  return {
    identityId: `runtime:edge:${page.id}:${element.layerId ?? ""}:${element.id}`,
    entityType: "edge",
    documentId: documentId(snapshot),
    pageId: page.id,
    ...(element.layerId ? { layerId: element.layerId } : {}),
    rawAnchor: element.id,
    privateSignature: elementSignature(element),
  };
}

function externalReferenceEvidence(
  snapshot: RuntimeSnapshot,
  reference: RuntimeSnapshotExternalReference,
): StableIdentityEvidence {
  return {
    identityId: `runtime:xref:${externalReferenceAnchor(reference)}`,
    entityType: "external-reference",
    documentId: documentId(snapshot),
    pageId: reference.pageId,
    ...(reference.referencedLayerId
      ? { layerId: reference.referencedLayerId }
      : {}),
    rawAnchor: externalReferenceAnchor(reference),
    privateSignature: createPrivateIdentitySignature({
      parts: [
        "external-reference",
        reference.referenceType,
        reference.elementId,
        reference.referencedId,
        reference.referencedPageId ?? "",
        reference.referencedLayerId ?? "",
      ],
    }),
  };
}

function externalReferenceAnchor(reference: RuntimeSnapshotExternalReference) {
  return [
    reference.pageId,
    reference.elementId,
    reference.referenceType,
    reference.referencedId,
    reference.referencedPageId ?? "",
    reference.referencedLayerId ?? "",
  ].join(":");
}

function elementSignature(element: RuntimeSnapshotElement) {
  const label = element.label?.text ?? element.label?.html ?? "";
  return createPrivateIdentitySignature({
    parts: [
      element.type,
      label,
      stablePart(element.geometry),
      stablePart(element.style?.properties),
      element.sourceId ?? "",
      element.targetId ?? "",
    ],
  });
}

function stablePart(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value !== "object") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stablePart).join(",")}]`;
  }
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${key}:${stablePart(nested)}`)
    .join(",")}}`;
}

function documentId(snapshot: RuntimeSnapshot): string {
  const id =
    snapshot.document.id ?? snapshot.document.revisionSignals.documentId;
  if (!id) {
    throw new Error(
      "runtime snapshot did not provide document identity context",
    );
  }
  return id;
}

function pageById(
  snapshot: RuntimeSnapshot,
  pageId: string,
): RuntimeSnapshotPage {
  const page = snapshot.pages.find((candidate) => candidate.id === pageId);
  if (!page) {
    throw new Error(`page ${pageId} not found in runtime snapshot`);
  }
  return page;
}

function layerById(
  snapshot: RuntimeSnapshot,
  pageId: string,
  layerId: string,
): RuntimeSnapshotLayer {
  const layer = pageById(snapshot, pageId).layers.find(
    (candidate) => candidate.id === layerId,
  );
  if (!layer) {
    throw new Error(`layer ${layerId} not found in runtime snapshot`);
  }
  return layer;
}

function elementById(
  snapshot: RuntimeSnapshot,
  elementId: string,
  pageId?: string,
): {
  readonly page: RuntimeSnapshotPage;
  readonly element: RuntimeSnapshotElement;
} {
  const pages = pageId ? [pageById(snapshot, pageId)] : snapshot.pages;
  const matches = pages.flatMap((page) =>
    page.elements
      .filter((element) => element.id === elementId)
      .map((element) => ({ page, element })),
  );
  if (matches.length !== 1) {
    throw new Error(
      `expected one runtime element ${elementId}, observed ${matches.length}`,
    );
  }
  return matches[0]!;
}

function elementByLabel(
  snapshot: RuntimeSnapshot,
  pageId: string,
  label: string,
): RuntimeSnapshotElement {
  const matches = pageById(snapshot, pageId).elements.filter(
    (element) => (element.label?.text ?? element.label?.html ?? "") === label,
  );
  if (matches.length !== 1) {
    throw new Error(`expected one runtime element with label ${label}`);
  }
  return matches[0]!;
}

function externalReferenceFor(
  snapshot: RuntimeSnapshot,
  expected: Pick<
    RuntimeSnapshotExternalReference,
    "elementId" | "referenceType" | "referencedId"
  >,
): RuntimeSnapshotExternalReference {
  const match = snapshot.scope.externalReferences.find(
    (reference) =>
      reference.elementId === expected.elementId &&
      reference.referenceType === expected.referenceType &&
      reference.referencedId === expected.referencedId,
  );
  if (!match) {
    throw new Error("expected runtime external reference was not observed");
  }
  return match;
}

async function renameLayer(
  context: RealEnvironmentContext,
  layerId: string,
  name: string,
) {
  await context.page.evaluate(
    ({ id, value }: { readonly id: string; readonly value: string }) => {
      const graph = (window as any).ui?.editor?.graph;
      const model = graph?.getModel?.();
      const layer = model?.getCell?.(id);
      if (!layer) {
        throw new Error(`Layer ${id} not found`);
      }
      model.beginUpdate();
      try {
        model.setValue(layer, value);
      } finally {
        model.endUpdate();
      }
    },
    { id: layerId, value: name },
  );
}
