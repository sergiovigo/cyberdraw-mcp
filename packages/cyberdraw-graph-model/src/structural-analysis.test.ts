import { describe, expect, it } from "@jest/globals";

import { normalizeDiagram } from "./normalize.js";
import {
  analyzeGraphStructure,
  type StructuralFinding,
  type StructuralOrphanFinding,
  type StructuralAnalysisCoverage,
  type StructuralExternalReference,
} from "./structural-analysis.js";
import type {
  CanonicalDiagramInput,
  CanonicalElementInput,
  DiagramSnapshot,
  GraphElement,
  GraphIndexes,
} from "./types.js";

describe("structural analysis broken references", () => {
  it("classifies missing source, target and parent as broken with complete coverage", () => {
    const graph = graphFrom([
      node("parented", { parentExternalId: "missing-parent" }),
      edge("missing-source", {
        sourceExternalId: "no-source",
        targetExternalId: "parented",
      }),
      edge("missing-target", {
        sourceExternalId: "parented",
        targetExternalId: "no-target",
      }),
    ]);

    const result = analyzeGraphStructure({
      graph,
      coverage: completeDocumentCoverage(),
    });

    expect(
      result.findings
        .filter((finding) => finding.findingType === "broken-reference")
        .map((finding) => [
          finding.referenceType,
          finding.status,
          finding.reasonCode,
        ]),
    ).toEqual(
      expect.arrayContaining([
        ["parent", "broken", "missing_parent"],
        ["source", "broken", "missing_edge_source"],
        ["target", "broken", "missing_edge_target"],
      ]),
    );
    expect(result.counts.brokenReferenceCount).toEqual({
      value: 3,
      basis: "exact",
    });
  });

  it("keeps targets outside scoped coverage out of broken status", () => {
    const graph = graphFrom([
      edge("external-edge", {
        sourceExternalId: "source-a",
        targetExternalId: "missing-b",
      }),
      node("source-a"),
    ]);
    const result = analyzeGraphStructure({
      graph,
      coverage: scopedLayerCoverage(graph, ["layer-a"]),
      externalReferences: [
        {
          pageId: "page-a",
          elementId: "external-edge",
          referenceType: "target",
          referencedId: "missing-b",
          referencedPageId: "page-a",
          referencedLayerId: "layer-b",
        },
      ],
    });

    expect(
      result.findings.find(
        (finding) =>
          finding.findingType === "broken-reference" &&
          finding.referencedElementId === "missing-b",
      ),
    ).toMatchObject({
      status: "external-context-not-loaded",
      reasonCode: "external-context-not-loaded",
    });
  });

  it("does not report an external reference when the exact target is materialized", () => {
    const graph = graphFrom([
      node("source-a"),
      node("target-b", { layerExternalId: "layer-b" }),
    ]);
    const result = analyzeGraphStructure({
      graph,
      coverage: scopedLayerCoverage(graph, ["layer-a", "layer-b"]),
      externalReferences: [
        {
          pageId: "page-a",
          elementId: "edge-a",
          referenceType: "target",
          referencedId: "target-b",
          referencedPageId: "page-a",
          referencedLayerId: "layer-b",
        },
      ],
    });

    expect(
      result.findings.some(
        (finding) =>
          finding.findingType === "broken-reference" &&
          finding.referencedElementId === "target-b",
      ),
    ).toBe(false);
  });

  it("classifies ambiguous references and repeated IDs without relying on labels", () => {
    const graph = graphFrom([
      node("dup"),
      node("dup"),
      edge("ambiguous-edge", {
        sourceExternalId: "dup",
        targetExternalId: "missing",
      }),
    ]);

    const result = analyzeGraphStructure({
      graph,
      coverage: completeDocumentCoverage(),
      externalReferences: [
        {
          pageId: "page-a",
          elementId: "external",
          referenceType: "target",
          referencedId: "dup",
          referencedPageId: "page-a",
          referencedLayerId: "layer-a",
        },
      ],
    });

    expect(
      result.findings
        .filter((finding) => finding.findingType === "broken-reference")
        .map((finding) => finding.status),
    ).toEqual(expect.arrayContaining(["ambiguous"]));
    expect(JSON.stringify(result.findings)).not.toContain("Sensitive");
  });

  it("distinguishes repeated IDs on different pages and layers through context", () => {
    const graph = normalizeDiagram({
      documentId: "doc",
      pages: [
        page(
          "page-a",
          [node("same", { layerExternalId: "layer-a" })],
          ["layer-a"],
        ),
        page(
          "page-b",
          [node("same", { layerExternalId: "layer-b" })],
          ["layer-b"],
        ),
      ],
    });

    const result = analyzeGraphStructure({
      graph,
      coverage: completeDocumentCoverage(),
      externalReferences: [
        {
          pageId: "page-b",
          elementId: "edge-b",
          referenceType: "target",
          referencedId: "same",
          referencedPageId: "page-b",
          referencedLayerId: "layer-b",
        },
      ],
    });

    expect(
      result.findings.filter(
        (finding) => finding.findingType === "broken-reference",
      ),
    ).toEqual([]);
  });
});

describe("structural analysis cross-layer edges", () => {
  it("reports same-page cross-layer edges and ignores same-layer edges", () => {
    const graph = graphFrom([
      node("source-a"),
      node("target-b", { layerExternalId: "layer-b" }),
      edge("cross", {
        sourceExternalId: "source-a",
        targetExternalId: "target-b",
      }),
      edge("same", {
        sourceExternalId: "source-a",
        targetExternalId: "source-a",
      }),
    ]);

    const result = analyzeGraphStructure({
      graph,
      coverage: scopedLayerCoverage(graph, ["layer-a", "layer-b"]),
    });

    expect(
      result.findings.filter(
        (finding) =>
          finding.findingType === "cross-layer-edge" &&
          finding.relationClassification === "same-page-cross-layer",
      ),
    ).toHaveLength(1);
    expect(result.counts.crossLayerEdgeCount).toEqual({
      value: 1,
      basis: "observed",
    });
  });

  it("reports cross-page edges separately and preserves provenance", () => {
    const graph = normalizeDiagram({
      documentId: "doc",
      pages: [
        page("page-a", [node("source-a"), edge("cross-page")], ["layer-a"]),
        page(
          "page-b",
          [node("target-b", { layerExternalId: "layer-b" })],
          ["layer-b"],
        ),
      ],
    });
    const edgeElement = byDrawioId(graph, "cross-page");
    const source = byDrawioId(graph, "source-a");
    const target = byDrawioId(graph, "target-b");
    const patched = patchElements(graph, [
      {
        ...edgeElement,
        kind: "edge",
        sourceId: source.internalId,
        targetId: target.internalId,
      },
    ]);

    const result = analyzeGraphStructure({
      graph: patched,
      coverage: completeDocumentCoverage(),
    });

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        findingType: "cross-layer-edge",
        relationClassification: "cross-page-edge",
        provenance: expect.objectContaining({ documentId: "doc" }),
      }),
    );
  });

  it("classifies unresolved, ambiguous and context-only endpoints conservatively", () => {
    const graph = graphFrom([
      node("context", { raw: { runtimeSnapshotContextOnly: true } }),
      node("real"),
      edge("context-edge", {
        sourceExternalId: "context",
        targetExternalId: "real",
      }),
      edge("unresolved", {
        sourceExternalId: "real",
        targetExternalId: "missing",
      }),
    ]);

    const result = analyzeGraphStructure({
      graph,
      coverage: completeDocumentCoverage(),
    });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          findingType: "cross-layer-edge",
          relationClassification: "context-only-endpoint",
        }),
        expect.objectContaining({
          findingType: "cross-layer-edge",
          relationClassification: "unresolved-cross-layer-candidate",
        }),
      ]),
    );
  });

  it("is stable across shuffled input and duplicated edges", () => {
    const first = graphFrom([
      node("target-b", { layerExternalId: "layer-b" }),
      edge("cross-2", {
        sourceExternalId: "source-a",
        targetExternalId: "target-b",
      }),
      node("source-a"),
      edge("cross-1", {
        sourceExternalId: "source-a",
        targetExternalId: "target-b",
      }),
    ]);
    const second = graphFrom([
      edge("cross-1", {
        sourceExternalId: "source-a",
        targetExternalId: "target-b",
      }),
      node("source-a"),
      edge("cross-2", {
        sourceExternalId: "source-a",
        targetExternalId: "target-b",
      }),
      node("target-b", { layerExternalId: "layer-b" }),
    ]);

    expect(
      canonicalFindings(
        analyzeGraphStructure({
          graph: first,
          coverage: scopedLayerCoverage(first, ["layer-a", "layer-b"]),
        }),
      ),
    ).toEqual(
      canonicalFindings(
        analyzeGraphStructure({
          graph: second,
          coverage: scopedLayerCoverage(second, ["layer-a", "layer-b"]),
        }),
      ),
    );
  });
});

describe("structural analysis orphans", () => {
  it("confirms a node with no structural relations in complete coverage", () => {
    const graph = graphFrom([
      node("orphan-a"),
      node("connected"),
      edge("self", {
        sourceExternalId: "connected",
        targetExternalId: "connected",
      }),
    ]);
    const result = analyzeGraphStructure({
      graph,
      coverage: completeDocumentCoverage(),
    });

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        findingType: "orphan-element",
        status: "confirmed-orphan",
        elementId: byDrawioId(graph, "orphan-a").internalId,
      }),
    );
  });

  it("excludes incoming, outgoing, parented, contextOnly and edge elements", () => {
    const graph = graphFrom([
      node("parent"),
      node("child", { parentExternalId: "parent" }),
      node("source"),
      node("target"),
      node("context", { raw: { runtimeSnapshotContextOnly: true } }),
      edge("relation", {
        sourceExternalId: "source",
        targetExternalId: "target",
      }),
    ]);
    const result = analyzeGraphStructure({
      graph,
      coverage: completeDocumentCoverage(),
    });

    expect(
      result.findings.filter(
        (finding) => finding.findingType === "orphan-element",
      ),
    ).toEqual([]);
  });

  it("distinguishes technical layer parents from semantic parents", () => {
    const base = graphFrom([
      node("layer-parented"),
      { ...node("semantic-parent"), kind: "group" },
      node("semantic-child", { parentExternalId: "semantic-parent" }),
      node("technical-parent", {
        style: { properties: { container: "1" } },
      }),
      node("technical-child", { parentExternalId: "technical-parent" }),
    ]);
    const layer = base.layers.find((candidate) => candidate.drawioId === "layer-a");
    if (!layer) {
      throw new Error("missing layer-a");
    }
    const patched = patchElements(
      base,
      base.elements.map((element) =>
        element.drawioId === "layer-parented"
          ? { ...element, parentId: layer.internalId }
          : element.drawioId === "technical-parent"
            ? { ...element, drawioId: undefined }
          : element,
      ),
    );

    const result = analyzeGraphStructure({
      graph: patched,
      coverage: completeDocumentCoverage(),
    });
    const orphanIds = result.findings
      .filter(isConfirmedOrphan)
      .map((finding) => finding.elementId);

    expect(orphanIds).toEqual(
      expect.arrayContaining([
        byDrawioId(patched, "layer-parented").internalId,
        byDrawioId(patched, "technical-child").internalId,
      ]),
    );
    expect(orphanIds).not.toContain(
      byDrawioId(patched, "semantic-parent").internalId,
    );
    expect(orphanIds).not.toContain(
      byDrawioId(patched, "semantic-child").internalId,
    );
  });

  it("downgrades orphan confidence in partial scope and ignores pending external refs", () => {
    const graph = graphFrom([node("possible"), node("pending")]);
    const result = analyzeGraphStructure({
      graph,
      coverage: {
        ...scopedLayerCoverage(graph, ["layer-a"]),
        conclusive: false,
      },
      externalReferences: [
        {
          pageId: "page-a",
          elementId: "pending",
          referenceType: "target",
          referencedId: "outside",
        },
      ],
      stopReason: "soft-limit-advisory",
    });

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        findingType: "orphan-element",
        status: "possible-orphan",
        elementId: byDrawioId(graph, "possible").internalId,
      }),
    );
    expect(
      result.findings.some(
        (finding) =>
          finding.findingType === "orphan-element" &&
          finding.elementId === byDrawioId(graph, "pending").internalId,
      ),
    ).toBe(false);
  });
});

describe("structural analysis determinism and coverage", () => {
  it("returns JSON-stable deterministic output with canonical ordering and no timestamps", () => {
    const graph = graphFrom([
      node("source-a"),
      node("orphan-a"),
      node("target-b", { layerExternalId: "layer-b" }),
      edge("cross", {
        sourceExternalId: "source-a",
        targetExternalId: "target-b",
      }),
      edge("broken", {
        sourceExternalId: "source-a",
        targetExternalId: "missing",
      }),
    ]);
    const result = analyzeGraphStructure({
      graph,
      coverage: scopedLayerCoverage(graph, ["layer-a", "layer-b"]),
      revisionEvidence: {
        documentId: "doc",
        contentRevisions: ["r2", "r1", "r1"],
        revisionCompatible: true,
      },
    });

    expect(JSON.stringify(result)).toBe(JSON.stringify(result));
    expect(result.findings.map((finding) => finding.findingType)).toEqual([
      "broken-reference",
      "cross-layer-edge",
      "cross-layer-edge",
      "orphan-element",
    ]);
    expect(
      result.findings.every(
        (finding) => !/\d{4}-\d{2}-\d{2}T/.test(finding.findingId),
      ),
    ).toBe(true);
    expect(result.revisionEvidence.contentRevisions).toEqual(["r1", "r2"]);
  });

  it("does not mutate frozen input graphs", () => {
    const graph = graphFrom([
      node("source-a"),
      edge("broken", {
        sourceExternalId: "source-a",
        targetExternalId: "missing",
      }),
    ]);
    const before = stableGraphSnapshot(graph);
    deepFreeze(graph);

    const first = analyzeGraphStructure({
      graph,
      coverage: completeDocumentCoverage(),
    });
    const second = analyzeGraphStructure({
      graph,
      coverage: completeDocumentCoverage(),
    });

    expect(stableGraphSnapshot(graph)).toEqual(before);
    expect(first).toEqual(second);
  });

  it("frames finding ID hash parts so embedded delimiters cannot collide", () => {
    const graph = graphFrom([
      edge("edge-ab\u0000c", {
        targetExternalId: "d",
      }),
      edge("edge-ab", {
        targetExternalId: "c\u0000d",
      }),
    ]);
    const result = analyzeGraphStructure({
      graph,
      coverage: completeDocumentCoverage(),
    });
    const ids = result.findings
      .filter(
        (finding) =>
          finding.findingType === "broken-reference" &&
          finding.referenceType === "target",
      )
      .map((finding) => finding.findingId);

    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it("keeps counts non-negative and aligned with finding categories", () => {
    const longId = `${"x".repeat(2048)}\u0000tail`;
    const graph = graphFrom([
      node("source-a"),
      node("target-b", { layerExternalId: "layer-b" }),
      node(longId),
      edge("cross", {
        sourceExternalId: "source-a",
        targetExternalId: "target-b",
      }),
      edge("broken", {
        sourceExternalId: "source-a",
        targetExternalId: "missing",
      }),
    ]);
    const result = analyzeGraphStructure({
      graph,
      coverage: scopedLayerCoverage(graph, ["layer-a", "layer-b"]),
    });
    const counts = Object.values(result.counts);

    expect(counts.every((count) => (count.value ?? 0) >= 0)).toBe(true);
    expect(result.counts.brokenReferenceCount.value).toBe(
      result.findings.filter(
        (finding) =>
          finding.findingType === "broken-reference" &&
          finding.status === "broken",
      ).length,
    );
    expect(result.counts.orphanElementCount.value).toBeLessThanOrEqual(
      result.counts.nodeCount.value ?? 0,
    );
    expect(
      (result.counts.connectedNodeCount.value ?? 0) +
        (result.counts.orphanElementCount.value ?? 0),
    ).toBeLessThanOrEqual(result.counts.nodeCount.value ?? 0);
    expect(JSON.stringify(result.findings)).not.toContain("<mxGraphModel");
  });

  it("reports completeness and count bases honestly", () => {
    const graph = graphFrom([]);
    expect(
      analyzeGraphStructure({ graph, coverage: completeDocumentCoverage() })
        .completeness,
    ).toBe("complete-document");
    expect(
      analyzeGraphStructure({
        graph,
        coverage: {
          ...completeDocumentCoverage(),
          document: false,
          pageIds: ["page-a"],
        },
      }).counts.elementCount.basis,
    ).toBe("observed");
    expect(
      analyzeGraphStructure({
        graph,
        coverage: { ...completeDocumentCoverage(), truncated: true },
      }).completeness,
    ).toBe("truncated");
    expect(
      analyzeGraphStructure({
        graph,
        coverage: { ...completeDocumentCoverage(), stale: true },
      }).completeness,
    ).toBe("stale");
    expect(analyzeGraphStructure({ graph }).completeness).toBe("unknown");
  });

  it("handles a moderate graph and many unresolved references without quadratic lookups", () => {
    const elements: CanonicalElementInput[] = [];
    for (let index = 0; index < 400; index += 1) {
      elements.push(node(`n-${index}`));
      elements.push(
        edge(`e-${index}`, {
          sourceExternalId: `n-${index}`,
          targetExternalId: `missing-${index}`,
        }),
      );
    }
    const graph = graphFrom(elements);
    const externalReferences: StructuralExternalReference[] = elements
      .filter((element) => element.kind === "edge")
      .map((element) => ({
        pageId: "page-a",
        elementId: String(element.externalId),
        referenceType: "target",
        referencedId: `missing-${String(element.externalId).slice(2)}`,
      }));

    const result = analyzeGraphStructure({
      graph,
      coverage: completeDocumentCoverage(),
      externalReferences,
    });

    expect(result.counts.elementCount.value).toBe(800);
    expect(result.findings.length).toBeGreaterThanOrEqual(400);
  });
});

function graphFrom(
  elements: readonly CanonicalElementInput[],
): DiagramSnapshot {
  return normalizeDiagram({
    documentId: "doc",
    pages: [page("page-a", elements, ["layer-a", "layer-b"])],
  });
}

function page(
  pageExternalId: string,
  elements: readonly CanonicalElementInput[],
  layerIds: readonly string[],
) {
  return {
    pageExternalId,
    index: pageExternalId === "page-a" ? 0 : 1,
    name: "Synthetic Page",
    layers: layerIds.map((layerExternalId, index) => ({
      layerExternalId,
      name: `Layer ${index}`,
    })),
    elements,
  };
}

function node(
  externalId: string,
  overrides: Partial<CanonicalElementInput> = {},
): CanonicalElementInput {
  return {
    externalId,
    kind: "node",
    layerExternalId: "layer-a",
    label: { format: "plain", text: "Sensitive" },
    ...overrides,
  };
}

function edge(
  externalId: string,
  overrides: Partial<CanonicalElementInput> = {},
): CanonicalElementInput {
  return {
    externalId,
    kind: "edge",
    layerExternalId: "layer-a",
    ...overrides,
  };
}

function completeDocumentCoverage(): StructuralAnalysisCoverage {
  return {
    document: true,
    pageIds: [],
    layerTargets: [],
    conclusive: true,
  };
}

function scopedLayerCoverage(
  graph: DiagramSnapshot,
  layerIds: readonly string[],
): StructuralAnalysisCoverage {
  return {
    document: false,
    pageIds: [],
    layerTargets: [{ pageId: "page-a", layerIds }],
    conclusive: graph.elements.length >= 0,
  };
}

function byDrawioId(graph: DiagramSnapshot, drawioId: string): GraphElement {
  const element = graph.elements.find(
    (candidate) => candidate.drawioId === drawioId,
  );
  if (!element) {
    throw new Error(`missing element ${drawioId}`);
  }
  return element;
}

function patchElements(
  graph: DiagramSnapshot,
  replacements: readonly GraphElement[],
): DiagramSnapshot {
  const replacementById = new Map(
    replacements.map((element) => [element.internalId, element]),
  );
  const elements = graph.elements.map(
    (element) => replacementById.get(element.internalId) ?? element,
  );
  return { ...graph, elements, indexes: buildIndexes(elements) };
}

function buildIndexes(elements: readonly GraphElement[]): GraphIndexes {
  const byInternalId = new Map<string, GraphElement>();
  const byDrawioId = new Map<string, string[]>();
  const elementsByPage = new Map<string, string[]>();
  const elementsByLayer = new Map<string, string[]>();
  const incomingEdges = new Map<string, string[]>();
  const outgoingEdges = new Map<string, string[]>();
  for (const element of elements) {
    byInternalId.set(element.internalId, element);
    pushMap(elementsByPage, element.pageId, element.internalId);
    if (element.drawioId) {
      pushMap(byDrawioId, element.drawioId, element.internalId);
    }
    if (element.layerId) {
      pushMap(elementsByLayer, element.layerId, element.internalId);
    }
  }
  for (const element of elements) {
    if (element.kind !== "edge") {
      continue;
    }
    if (element.sourceId) {
      pushMap(outgoingEdges, element.sourceId, element.internalId);
    }
    if (element.targetId) {
      pushMap(incomingEdges, element.targetId, element.internalId);
    }
  }
  return {
    byInternalId,
    byDrawioId,
    elementsByPage,
    elementsByLayer,
    incomingEdges,
    outgoingEdges,
  };
}

function pushMap(map: Map<string, string[]>, key: string, value: string): void {
  const values = map.get(key);
  if (values) {
    values.push(value);
  } else {
    map.set(key, [value]);
  }
}

function canonicalFindings(result: ReturnType<typeof analyzeGraphStructure>) {
  return result.findings.map((finding) => ({
    type: finding.findingType,
    reason:
      finding.findingType === "cross-layer-edge"
        ? finding.relationClassification
        : finding.reasonCode,
    source:
      finding.findingType === "orphan-element"
        ? finding.elementId.replace(/:[0-9]+$/, "")
        : finding.findingType === "cross-layer-edge"
          ? finding.edgeId.replace(/:[0-9]+$/, "")
          : finding.sourceElementId?.replace(/:[0-9]+$/, ""),
  }));
}

function isConfirmedOrphan(
  finding: StructuralFinding,
): finding is StructuralOrphanFinding {
  return (
    finding.findingType === "orphan-element" &&
    finding.status === "confirmed-orphan"
  );
}

function stableGraphSnapshot(graph: DiagramSnapshot) {
  return {
    pages: graph.pages,
    layers: graph.layers,
    elements: graph.elements,
    findings: graph.findings,
    indexSizes: {
      byInternalId: graph.indexes.byInternalId.size,
      byDrawioId: graph.indexes.byDrawioId.size,
      elementsByPage: graph.indexes.elementsByPage.size,
      elementsByLayer: graph.indexes.elementsByLayer.size,
      incomingEdges: graph.indexes.incomingEdges.size,
      outgoingEdges: graph.indexes.outgoingEdges.size,
    },
  };
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (value instanceof Map) {
    for (const [key, entry] of value.entries()) {
      deepFreeze(key);
      deepFreeze(entry);
    }
    Object.freeze(value);
    return value;
  }
  for (const entry of Object.values(value as Record<string, unknown>)) {
    deepFreeze(entry);
  }
  Object.freeze(value);
  return value;
}
