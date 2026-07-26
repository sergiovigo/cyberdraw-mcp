import { describe, expect, it } from "@jest/globals";

import {
  createPrivateIdentitySignature,
  type StableIdentityEvidence,
} from "./identity.js";
import {
  diffSemanticSnapshots,
  type SemanticDiffClassification,
  type SemanticDiffCompleteness,
  type SemanticDiffEntityResult,
  type SemanticDiffOutcome,
  type SemanticDiffResult,
} from "./semantic-diff.js";
import { normalizeDiagram } from "./normalize.js";
import type {
  CanonicalDiagramInput,
  CanonicalElementInput,
  DiagramSnapshot,
  JsonValue,
} from "./types.js";

type FixtureExpectation = {
  readonly outcome?: SemanticDiffOutcome;
  readonly classification?: SemanticDiffClassification;
  readonly absentClassification?: SemanticDiffClassification;
  readonly reasonCode?: string;
  readonly entityType?: SemanticDiffEntityResult["entityType"];
  readonly identityStatus?: SemanticDiffEntityResult["identityStatus"];
  readonly resultCount?: number;
};

describe("pure semantic diff fixture matrix", () => {
  const fixtures: readonly {
    readonly name: string;
    readonly input: () => Parameters<typeof diffSemanticSnapshots>[0];
    readonly expect: FixtureExpectation;
    readonly rationale: string;
  }[] = [
    {
      name: "01 identical snapshots",
      input: () => diffInput(baseDiagram(), baseDiagram()),
      expect: { outcome: "ok", classification: "UNCHANGED" },
      rationale: "EXACT continuity with unchanged compared dimensions",
    },
    {
      name: "02 reordered candidates and snapshots",
      input: () => diffInput(reorderedDiagram(), baseDiagram()),
      expect: { outcome: "ok", classification: "UNCHANGED" },
      rationale: "canonical output ignores input ordering",
    },
    {
      name: "03 node geometry change",
      input: () =>
        diffInput(
          baseDiagram(),
          baseDiagram({ nodeA: { geometry: { x: 80, y: 10, width: 40, height: 30 } } }),
        ),
      expect: { classification: "MOVED", reasonCode: "geometry-changed" },
      rationale: "MOVED is authoritative only with EXACT continuity",
    },
    {
      name: "04 node label change",
      input: () =>
        diffInput(baseDiagram(), baseDiagram({ nodeA: { label: label("Alert Updated") } })),
      expect: { classification: "MODIFIED", reasonCode: "content-changed" },
      rationale: "label equality is field equality, not global semantic equality",
    },
    {
      name: "05 node style metadata change",
      input: () =>
        diffInput(
          baseDiagram(),
          baseDiagram({
            nodeA: {
              metadata: { severity: "high" },
              style: style({ fillColor: "#ff0000" }),
            },
          }),
        ),
      expect: { classification: "MODIFIED", reasonCode: "metadata-changed" },
      rationale: "style and metadata changes are dimensional modifications",
    },
    {
      name: "06 node layer move",
      input: () =>
        diffInput(baseDiagram(), baseDiagram({ nodeA: { layerExternalId: "layer-b" } })),
      expect: { classification: "MOVED", reasonCode: "container-changed" },
      rationale: "layer context can change without breaking EXACT continuity",
    },
    {
      name: "07 node page move requires exact continuity",
      input: () =>
        diffInput(
          singleNodeDiagram("doc-a", "page-a", "node-a", {
            identityOverrides: [{ externalId: "node-a", signature: "node-a" }],
          }),
          singleNodeDiagram("doc-a", "page-b", "node-a", {
            identityOverrides: [{ externalId: "node-a", signature: "node-a" }],
          }),
        ),
      expect: {
        outcome: "ok",
        identityStatus: "PROBABLE",
        absentClassification: "MOVED",
        reasonCode: "probable-identity-review-required",
      },
      rationale: "PROBABLE exposes movement evidence but never derives MOVED",
    },
    {
      name: "08 node deleted",
      input: () => diffInput(baseDiagram(), baseDiagram({ removeNodeB: true })),
      expect: { classification: "REMOVED", reasonCode: "removed-absence-proven" },
      rationale: "REMOVED requires observed base, comparable target coverage and no unresolved candidate",
    },
    {
      name: "09 visually identical node recreated with new raw ID",
      input: () =>
        diffInput(
          singleNodeDiagram("doc-a", "page-a", "node-a", {
            labelText: "Same",
            geometry: { x: 10, y: 10, width: 40, height: 20 },
          }),
          singleNodeDiagram("doc-a", "page-a", "node-new", {
            labelText: "Same",
            geometry: { x: 10, y: 10, width: 40, height: 20 },
          }),
        ),
      expect: {
        entityType: "element",
        absentClassification: "UNCHANGED",
        reasonCode: "added-absence-proven",
      },
      rationale: "same content with different identity is not unchanged",
    },
    {
      name: "10 node cloned",
      input: () =>
        diffInput(
          singleNodeDiagram("doc-a", "page-a", "node-a", {
            identityOverrides: [
              {
                externalId: "node-a",
                signature: "clone",
                conflictCodes: ["rewritten-raw-anchor"],
              },
            ],
          }),
          twoSimilarNodesDiagram("doc-a", "page-a", ["clone-a", "clone-b"], "clone"),
        ),
      expect: { classification: "AMBIGUOUS", reasonCode: "ambiguous-identity" },
      rationale: "multiple signature-compatible candidates are ambiguous",
    },
    {
      name: "11 copy paste",
      input: () =>
        diffInput(
          singleNodeDiagram("doc-a", "page-a", "node-a"),
          twoNodeDiagram("doc-a", "page-a", ["node-a", "node-copy"]),
        ),
      expect: { classification: "ADDED", reasonCode: "added-absence-proven" },
      rationale: "copy/paste creates an added entity only when no unresolved candidate blocks absence",
    },
    {
      name: "12 rewritten import ID is review required",
      input: () =>
        diffInput(
          singleNodeDiagram("doc-a", "page-a", "old-node", {
            identityOverrides: [
              {
                externalId: "old-node",
                signature: "imported",
                conflictCodes: ["rewritten-raw-anchor"],
              },
            ],
          }),
          singleNodeDiagram("doc-a", "page-a", "new-node", {
            identityOverrides: [{ externalId: "new-node", signature: "imported" }],
          }),
        ),
      expect: {
        identityStatus: "PROBABLE",
        absentClassification: "MOVED",
        reasonCode: "probable-identity-review-required",
      },
      rationale: "rewritten IDs do not authorize moved or added/removed conclusions",
    },
    {
      name: "13 duplicate raw IDs",
      input: () =>
        diffInput(
          singleNodeDiagram("doc-a", "page-a", "dup"),
          twoNodeDiagram("doc-a", "page-a", ["dup", "dup"]),
        ),
      expect: { classification: "AMBIGUOUS", reasonCode: "ambiguous-raw-anchor" },
      rationale: "duplicate anchors must not be silently resolved",
    },
    {
      name: "14 ambiguous identity match",
      input: () =>
        diffInput(
          singleNodeDiagram("doc-a", "page-a", "node-a", {
            identityOverrides: [
              {
                externalId: "node-a",
                signature: "shape",
                conflictCodes: ["rewritten-raw-anchor"],
              },
            ],
          }),
          twoSimilarNodesDiagram("doc-a", "page-a", ["shape-a", "shape-b"], "shape"),
        ),
      expect: { classification: "AMBIGUOUS" },
      rationale: "multiple probable candidates produce AMBIGUOUS",
    },
    {
      name: "15 missing raw IDs",
      input: () =>
        diffInput(
          missingIdDiagram("doc-a", "page-a", "Same", "missing"),
          missingIdDiagram("doc-a", "page-a", "Same", "missing"),
        ),
      expect: {
        identityStatus: "PROBABLE",
        absentClassification: "ADDED",
        reasonCode: "probable-identity-review-required",
      },
      rationale: "missing IDs plus content evidence remain review-required",
    },
    {
      name: "16 layer rename",
      input: () =>
        diffInput(baseDiagram(), baseDiagram({ layerAName: "Renamed Layer" })),
      expect: { entityType: "layer", classification: "MODIFIED" },
      rationale: "layer rename is a content dimension change",
    },
    {
      name: "17 page rename",
      input: () => diffInput(baseDiagram(), baseDiagram({ pageAName: "Renamed Page" })),
      expect: { entityType: "page", classification: "MODIFIED" },
      rationale: "page rename is a content dimension change",
    },
    {
      name: "18 edge unchanged",
      input: () => diffInput(baseDiagram(), baseDiagram()),
      expect: { entityType: "edge", classification: "UNCHANGED" },
      rationale: "edge identity continuity with unchanged endpoints is unchanged",
    },
    {
      name: "19 edge label style changed",
      input: () =>
        diffInput(
          baseDiagram(),
          baseDiagram({
            edgeAB: {
              label: label("routes to"),
              style: style({ strokeColor: "#00ff00" }),
            },
          }),
        ),
      expect: { entityType: "edge", classification: "MODIFIED" },
      rationale: "edge content/style changes are preserved apart from connectivity",
    },
    {
      name: "20 edge endpoint changed",
      input: () =>
        diffInput(baseDiagram(), baseDiagram({ edgeAB: { targetExternalId: "node-c" }, includeNodeC: true })),
      expect: { entityType: "edge", classification: "REWIRED" },
      rationale: "same edge anchor plus changed endpoints is identity continuity with semantic rewire",
    },
    {
      name: "21 edge removed",
      input: () => diffInput(baseDiagram(), baseDiagram({ removeEdge: true })),
      expect: { entityType: "edge", classification: "REMOVED" },
      rationale: "edge absence can be proven under complete comparable coverage",
    },
    {
      name: "22 edge added",
      input: () => diffInput(baseDiagram({ removeEdge: true }), baseDiagram()),
      expect: { entityType: "edge", classification: "ADDED" },
      rationale: "edge addition can be proven under complete comparable coverage",
    },
    {
      name: "23 external reference target changed",
      input: () =>
        diffInput(baseDiagram(), baseDiagram(), {
          baseExternalReferences: [
            { pageId: "page:0:drawio:page-a", elementId: "edge-a", referencedId: "node-b" },
          ],
          targetExternalReferences: [
            { pageId: "page:0:drawio:page-a", elementId: "edge-a", referencedId: "node-c" },
          ],
        }),
      expect: { entityType: "external-reference", classification: "REWIRED" },
      rationale: "external reference target changes are connectivity evidence",
    },
    {
      name: "24 equivalent snapshots different ordering",
      input: () => diffInput(baseDiagram(), reorderedDiagram()),
      expect: { outcome: "ok", classification: "UNCHANGED" },
      rationale: "canonical output order is deterministic",
    },
    {
      name: "25 partial scope A vs document scope B",
      input: () =>
        diffInput(baseDiagram(), baseDiagram(), {
          baseCompleteness: "partial",
          baseCoverage: partialPageCoverage(baseDiagram()),
        }),
      expect: { outcome: "partial", reasonCode: "coverage-partial" },
      rationale: "partial scope cannot claim complete-document diff",
    },
    {
      name: "26 layer scope A vs different layer scope B",
      input: () =>
        diffInput(baseDiagram(), baseDiagram(), {
          baseCoverage: layerCoverage(baseDiagram(), "layer-a"),
          targetCoverage: layerCoverage(baseDiagram(), "layer-b"),
          baseCompleteness: "complete-target-scopes",
          targetCompleteness: "complete-target-scopes",
        }),
      expect: { outcome: "incomparable", resultCount: 0 },
      rationale: "INCOMPARABLE is comparison outcome, not entity classification",
    },
    {
      name: "27 stale base revision",
      input: () =>
        diffInput(baseDiagram(), baseDiagram(), {
          baseRevisionCompatible: false,
        }),
      expect: { outcome: "stale", resultCount: 0, reasonCode: "stale-base" },
      rationale: "stale base prevents fake entity classifications",
    },
    {
      name: "28 stale target revision",
      input: () =>
        diffInput(baseDiagram(), baseDiagram(), {
          targetRevisionCompatible: false,
        }),
      expect: { outcome: "stale", resultCount: 0, reasonCode: "stale-target" },
      rationale: "stale target prevents fake entity classifications",
    },
    {
      name: "29 entity outside observed scope",
      input: () =>
        diffInput(baseDiagram(), baseDiagram({ removeNodeB: true }), {
          baseCompleteness: "partial",
          targetCompleteness: "partial",
        }),
      expect: { outcome: "partial", absentClassification: "REMOVED", reasonCode: "absence-not-proven" },
      rationale: "entity outside observed scope does not prove absence",
    },
    {
      name: "30 identical content but different identity",
      input: () =>
        diffInput(
          singleNodeDiagram("doc-a", "page-a", "node-a", { labelText: "Same" }),
          singleNodeDiagram("doc-a", "page-a", "node-b", { labelText: "Same" }),
        ),
      expect: {
        entityType: "element",
        absentClassification: "UNCHANGED",
        reasonCode: "added-absence-proven",
      },
      rationale: "content equality is not identity continuity",
    },
  ];

  for (const fixture of fixtures) {
    it(`${fixture.name}: ${fixture.rationale}`, () => {
      const result = diffSemanticSnapshots(fixture.input());
      assertFixture(result, fixture.expect);
    });
  }
});

describe("pure semantic diff determinism and privacy", () => {
  it("returns the same JSON-compatible result for repeated equivalent inputs", () => {
    const input = diffInput(reorderedDiagram(), baseDiagram());

    expect(diffSemanticSnapshots(input)).toEqual(diffSemanticSnapshots(input));
    expect(JSON.parse(JSON.stringify(diffSemanticSnapshots(input)))).toEqual(
      diffSemanticSnapshots(input),
    );
  });

  it("does not mutate inputs", () => {
    const input = diffInput(baseDiagram(), baseDiagram({ nodeA: { label: label("Changed") } }));
    const before = JSON.stringify(input);

    diffSemanticSnapshots(input);

    expect(JSON.stringify(input)).toBe(before);
  });

  it("does not expose private identity signatures or signature material", () => {
    const result = diffSemanticSnapshots(diffInput(baseDiagram(), baseDiagram()));
    const publicJson = JSON.stringify(result);

    expect(publicJson).not.toContain("privateSignature");
    expect(publicJson).not.toContain("cyberdraw-private-signature");
  });
});

describe("semantic diff entity-level coverage", () => {
  it("keeps target changes outside partial base scope unclassified", () => {
    const base = baseDiagram({ nodeA: { layerExternalId: "layer-b" } });
    const target = baseDiagram({
      nodeA: { layerExternalId: "layer-b", label: label("Changed outside base") },
    });
    const result = diffSemanticSnapshots(
      diffInput(base, target, {
        baseCoverage: layerCoverage(base, "layer-a"),
        baseCompleteness: "complete-target-scopes",
      }),
    );
    const nodeA = entityByRef(result, "node-a");

    expect(nodeA?.classifications).toEqual([]);
    expect(nodeA?.dimensions.coverage).toBe("not-compared");
    expect(nodeA?.reasonCodes).toContain("coverage-partial");
  });

  it("does not remove a base entity outside target observed scope", () => {
    const base = baseDiagram({ nodeA: { layerExternalId: "layer-b" } });
    const target = baseDiagram({
      nodeA: { layerExternalId: "layer-b", label: label("Target hidden") },
    });
    const result = diffSemanticSnapshots(
      diffInput(base, target, {
        targetCoverage: layerCoverage(target, "layer-a"),
        targetCompleteness: "complete-target-scopes",
      }),
    );
    const nodeA = entityByRef(result, "node-a");

    expect(nodeA?.classifications).toEqual([]);
    expect(nodeA?.reasonCodes).toContain("coverage-partial");
  });

  it("does not add a target entity outside base observed scope", () => {
    const base = baseDiagram({ removeNodeB: true });
    const target = baseDiagram({
      nodeA: { layerExternalId: "layer-a" },
      nodeB: { layerExternalId: "layer-b" },
      edgeAB: { layerExternalId: "layer-a" },
    });
    const result = diffSemanticSnapshots(
      diffInput(base, target, {
        baseCoverage: layerCoverage(base, "layer-a"),
        baseCompleteness: "complete-target-scopes",
      }),
    );
    const nodeB = entityByRef(result, "node-b");

    expect(nodeB?.classifications).toEqual([]);
    expect(nodeB?.reasonCodes).toContain("absence-not-proven");
  });

  it("does not authoritatively classify exact identity outside comparable scope", () => {
    const base = baseDiagram({ nodeA: { layerExternalId: "layer-b" } });
    const target = baseDiagram({ nodeA: { layerExternalId: "layer-b" } });
    const result = diffSemanticSnapshots(
      diffInput(base, target, {
        baseCoverage: layerCoverage(base, "layer-a"),
        baseCompleteness: "partial",
      }),
    );
    const nodeA = entityByRef(result, "node-a");

    expect(nodeA?.identityStatus).toBe("EXACT");
    expect(nodeA?.classifications).toEqual([]);
    expect(nodeA?.dimensions.coverage).toBe("not-compared");
  });

  it("blocks definitive added and removed when reverse probable evidence is unresolved", () => {
    const base = singleNodeDiagram("doc-a", "page-a", "old-node", {
      identityOverrides: [{ externalId: "old-node", signature: "rewritten" }],
    });
    const target = singleNodeDiagram("doc-a", "page-a", "new-node", {
      identityOverrides: [
        {
          externalId: "new-node",
          signature: "rewritten",
          conflictCodes: ["rewritten-raw-anchor"],
        },
      ],
    });
    const result = diffSemanticSnapshots(diffInput(base, target));

    expect(
      result.entityResults.some((entry) =>
        entry.classifications.includes("REMOVED"),
      ),
    ).toBe(false);
    expect(
      result.entityResults.some((entry) =>
        entry.classifications.includes("ADDED"),
      ),
    ).toBe(false);
    expect(result.reasonCodes).toContain("probable-identity-review-required");
  });

  it("limits complete-target-scopes absence proof to entities inside the covered scope", () => {
    const base = baseDiagram({ nodeA: { layerExternalId: "layer-b" } });
    const target = baseDiagram({
      nodeA: { layerExternalId: "layer-b" },
      removeNodeB: true,
    });
    const result = diffSemanticSnapshots(
      diffInput(base, target, {
        baseCoverage: layerCoverage(base, "layer-a"),
        targetCoverage: layerCoverage(target, "layer-a"),
        baseCompleteness: "complete-target-scopes",
        targetCompleteness: "complete-target-scopes",
      }),
    );
    const nodeA = entityByRef(result, "node-a");

    expect(nodeA?.classifications).toEqual([]);
    expect(nodeA?.reasonCodes).toContain("coverage-partial");
    expect(
      result.entityResults.some((entry) =>
        entry.classifications.includes("REMOVED") &&
        entry.baseEntityRef?.snapshotScopedId.includes("node-a"),
      ),
    ).toBe(false);
  });

  it("does not remove a real missing entity outside target coverage", () => {
    const base = baseDiagram({
      nodeA: { layerExternalId: "layer-b" },
      removeNodeB: true,
      removeEdge: true,
    });
    const target = baseDiagram({
      removeNodeA: true,
      removeNodeB: true,
      removeEdge: true,
    });
    const result = diffSemanticSnapshots(
      diffInput(base, target, {
        targetCoverage: layerCoverage(target, "layer-a"),
        targetCompleteness: "complete-target-scopes",
      }),
    );
    const nodeA = entityByRef(result, "node-a");

    expect(nodeA?.classifications).not.toContain("REMOVED");
    expect(["unknown", "not-compared"]).toContain(nodeA?.dimensions.existence);
    expect(nodeA?.reasonCodes).toContain("absence-not-proven");
  });

  it("removes a real missing entity inside matching target scopes", () => {
    const base = baseDiagram({ removeNodeB: true, removeEdge: true });
    const target = baseDiagram({
      removeNodeA: true,
      removeNodeB: true,
      removeEdge: true,
    });
    const result = diffSemanticSnapshots(
      diffInput(base, target, {
        baseCoverage: layerCoverage(base, "layer-a"),
        targetCoverage: layerCoverage(target, "layer-a"),
        baseCompleteness: "complete-target-scopes",
        targetCompleteness: "complete-target-scopes",
      }),
    );
    const nodeA = entityByRef(result, "node-a");

    expect(nodeA?.classifications).toContain("REMOVED");
    expect(nodeA?.reasonCodes).toContain("removed-absence-proven");
  });
});

function assertFixture(
  result: SemanticDiffResult,
  expected: FixtureExpectation,
) {
  if (expected.outcome) {
    expect(result.outcome).toBe(expected.outcome);
  }
  if (expected.resultCount !== undefined) {
    expect(result.entityResults).toHaveLength(expected.resultCount);
  }
  if (expected.reasonCode) {
    expect(result.reasonCodes).toContain(expected.reasonCode);
  }
  if (expected.classification) {
    expect(
      result.entityResults.some(
        (entry) =>
          (!expected.entityType || entry.entityType === expected.entityType) &&
          entry.classifications.includes(expected.classification!),
      ),
    ).toBe(true);
  }
  if (expected.absentClassification) {
    expect(
      result.entityResults.some(
        (entry) =>
          (!expected.entityType || entry.entityType === expected.entityType) &&
          entry.classifications.includes(expected.absentClassification!),
      ),
    ).toBe(false);
  }
  if (expected.identityStatus) {
    expect(
      result.entityResults.some(
        (entry) => entry.identityStatus === expected.identityStatus,
      ),
    ).toBe(true);
  }
}

function entityByRef(
  result: SemanticDiffResult,
  rawAnchor: string,
): SemanticDiffEntityResult | undefined {
  return result.entityResults.find(
    (entry) =>
      entry.baseEntityRef?.snapshotScopedId.includes(rawAnchor) ||
      entry.targetEntityRef?.snapshotScopedId.includes(rawAnchor),
  );
}

function diffInput(
  base: DiagramSnapshot,
  target: DiagramSnapshot,
  options: {
    readonly baseCoverage?: Parameters<typeof diffSemanticSnapshots>[0]["base"]["coverage"];
    readonly targetCoverage?: Parameters<typeof diffSemanticSnapshots>[0]["target"]["coverage"];
    readonly baseCompleteness?: Parameters<typeof diffSemanticSnapshots>[0]["base"]["completeness"];
    readonly targetCompleteness?: Parameters<typeof diffSemanticSnapshots>[0]["target"]["completeness"];
    readonly baseRevisionCompatible?: boolean;
    readonly targetRevisionCompatible?: boolean;
    readonly baseExternalReferences?: Parameters<typeof diffSemanticSnapshots>[0]["base"]["externalReferences"];
    readonly targetExternalReferences?: Parameters<typeof diffSemanticSnapshots>[0]["target"]["externalReferences"];
  } = {},
): Parameters<typeof diffSemanticSnapshots>[0] {
  return {
    base: {
      graph: base,
      coverage: options.baseCoverage ?? completeCoverage(base),
      completeness: options.baseCompleteness ?? "complete-document",
      revisionEvidence: {
        documentId: base.source.documentId,
        contentRevisions: ["rev-a"],
        revisionCompatible: options.baseRevisionCompatible,
      },
      externalReferences: options.baseExternalReferences,
      identityEvidence: identityOverrides(base),
    },
    target: {
      graph: target,
      coverage: options.targetCoverage ?? completeCoverage(target),
      completeness: options.targetCompleteness ?? "complete-document",
      revisionEvidence: {
        documentId: target.source.documentId,
        contentRevisions: ["rev-b"],
        revisionCompatible: options.targetRevisionCompatible,
      },
      externalReferences: options.targetExternalReferences,
      identityEvidence: identityOverrides(target),
    },
  };
}

function baseDiagram(
  options: {
    readonly pageAName?: string;
    readonly layerAName?: string;
    readonly nodeA?: Partial<CanonicalElementInput>;
    readonly nodeB?: Partial<CanonicalElementInput>;
    readonly edgeAB?: Partial<CanonicalElementInput>;
    readonly removeNodeA?: boolean;
    readonly removeNodeB?: boolean;
    readonly removeEdge?: boolean;
    readonly includeNodeC?: boolean;
  } = {},
): DiagramSnapshot {
  const elements: CanonicalElementInput[] = [
    ...(options.removeNodeA
      ? []
      : [
          node("node-a", {
            label: label("Alert"),
            geometry: { x: 0, y: 0, width: 40, height: 20 },
            ...options.nodeA,
          }),
        ]),
    ...(options.removeNodeB
      ? []
      : [
          node("node-b", {
            label: label("Triage"),
            geometry: { x: 80, y: 0, width: 40, height: 20 },
            ...options.nodeB,
          }),
        ]),
    ...(options.includeNodeC
      ? [
          node("node-c", {
            label: label("Recover"),
            geometry: { x: 160, y: 0, width: 40, height: 20 },
          }),
        ]
      : []),
    ...(options.removeEdge
      ? []
      : [
          edge("edge-ab", "node-a", "node-b", {
            label: label("then"),
            ...options.edgeAB,
          }),
        ]),
  ];
  return graph({
    pages: [
      {
        pageExternalId: "page-a",
        name: options.pageAName ?? "Page A",
        index: 0,
        layers: [
          { layerExternalId: "layer-a", name: options.layerAName ?? "Layer A" },
          { layerExternalId: "layer-b", name: "Layer B" },
        ],
        elements,
      },
    ],
  });
}

function reorderedDiagram(): DiagramSnapshot {
  return graph({
    pages: [
      {
        pageExternalId: "page-a",
        name: "Page A",
        index: 0,
        layers: [
          { layerExternalId: "layer-b", name: "Layer B" },
          { layerExternalId: "layer-a", name: "Layer A" },
        ],
        elements: [
          edge("edge-ab", "node-a", "node-b", { label: label("then") }),
          node("node-b", {
            label: label("Triage"),
            geometry: { x: 80, y: 0, width: 40, height: 20 },
          }),
          node("node-a", {
            label: label("Alert"),
            geometry: { x: 0, y: 0, width: 40, height: 20 },
          }),
        ],
      },
    ],
  });
}

function singleNodeDiagram(
  documentId: string,
  pageExternalId: string,
  nodeExternalId: string,
  options: {
    readonly labelText?: string;
    readonly geometry?: CanonicalElementInput["geometry"];
    readonly identityOverrides?: readonly IdentityOverride[];
  } = {},
): DiagramSnapshot {
  return graph(
    {
      documentId,
      pages: [
        {
          pageExternalId,
          name: pageExternalId,
          index: pageExternalId === "page-a" ? 0 : 1,
          layers: [{ layerExternalId: "layer-a", name: "Layer A" }],
          elements: [
            node(nodeExternalId, {
              label: label(options.labelText ?? "Node"),
              geometry: options.geometry ?? { x: 0, y: 0, width: 40, height: 20 },
              metadata: identityOverrideMetadata(options.identityOverrides, nodeExternalId),
            }),
          ],
        },
      ],
    },
    options.identityOverrides,
  );
}

function twoNodeDiagram(
  documentId: string,
  pageExternalId: string,
  externalIds: readonly string[],
): DiagramSnapshot {
  return graph({
    documentId,
    pages: [
      {
        pageExternalId,
        name: pageExternalId,
        index: 0,
        layers: [{ layerExternalId: "layer-a", name: "Layer A" }],
        elements: externalIds.map((id, index) =>
          node(id, {
            label: label(index === 0 ? "Primary" : "Copy"),
            geometry: { x: index * 80, y: 0, width: 40, height: 20 },
          }),
        ),
      },
    ],
  });
}

function twoSimilarNodesDiagram(
  documentId: string,
  pageExternalId: string,
  externalIds: readonly string[],
  signature: string,
): DiagramSnapshot {
  return graph(
    {
      documentId,
      pages: [
        {
          pageExternalId,
          name: pageExternalId,
          index: 0,
          layers: [{ layerExternalId: "layer-a", name: "Layer A" }],
          elements: externalIds.map((id, index) =>
            node(id, {
              label: label("Same"),
              geometry: { x: index * 80, y: 0, width: 40, height: 20 },
              metadata: identityOverrideMetadata([{ externalId: id, signature }], id),
            }),
          ),
        },
      ],
    },
    externalIds.map((externalId) => ({ externalId, signature })),
  );
}

function missingIdDiagram(
  documentId: string,
  pageExternalId: string,
  labelText: string,
  signature: string,
): DiagramSnapshot {
  return graph(
    {
      documentId,
      pages: [
        {
          pageExternalId,
          name: pageExternalId,
          index: 0,
          layers: [{ layerExternalId: "layer-a", name: "Layer A" }],
          elements: [
            node(undefined, {
              label: label(labelText),
              geometry: { x: 0, y: 0, width: 40, height: 20 },
              metadata: { identitySignature: signature },
            }),
          ],
        },
      ],
    },
    [{ externalId: undefined, signature }],
  );
}

type IdentityOverride = {
  readonly externalId?: string;
  readonly signature: string;
  readonly conflictCodes?: StableIdentityEvidence["conflictCodes"];
};

function graph(
  input: CanonicalDiagramInput,
  identity?: readonly IdentityOverride[],
): DiagramSnapshot {
  const snapshot = normalizeDiagram(
    {
      documentId: input.documentId ?? "doc-a",
      pages: input.pages,
    },
    { source: { kind: "fixture", documentId: String(input.documentId ?? "doc-a") } },
  );
  return attachIdentityOverrides(snapshot, identity ?? collectMetadataOverrides(snapshot));
}

function attachIdentityOverrides(
  snapshot: DiagramSnapshot,
  overrides: readonly IdentityOverride[],
): DiagramSnapshot {
  if (overrides.length === 0) {
    return snapshot;
  }
  const metadata = Object.fromEntries(
    overrides.map((override) => [
      override.externalId ?? "__missing__",
      {
        signature: override.signature,
        conflictCodes: override.conflictCodes ?? [],
      },
    ]),
  );
  return {
    ...snapshot,
    source: {
      ...snapshot.source,
      sourceName: JSON.stringify({ identityOverrides: metadata }),
    },
  };
}

function collectMetadataOverrides(snapshot: DiagramSnapshot): readonly IdentityOverride[] {
  const overrides: IdentityOverride[] = [];
  for (const element of snapshot.elements) {
    const signature = element.metadata?.identitySignature;
    if (typeof signature === "string") {
      overrides.push({
        externalId: element.drawioId,
        signature,
      });
    }
  }
  return overrides;
}

function identityOverrides(snapshot: DiagramSnapshot): readonly StableIdentityEvidence[] {
  if (!snapshot.source.sourceName) {
    return [];
  }
  const parsed = JSON.parse(snapshot.source.sourceName) as {
    readonly identityOverrides?: Readonly<Record<string, {
      readonly signature: string;
      readonly conflictCodes?: StableIdentityEvidence["conflictCodes"];
    }>>;
  };
  const overrides = parsed.identityOverrides ?? {};
  const evidence: StableIdentityEvidence[] = [];
  for (const element of snapshot.elements) {
    const override = overrides[element.drawioId ?? "__missing__"];
    if (override) {
      evidence.push({
        identityId: element.internalId,
        entityType: element.kind === "edge" ? "edge" : "element",
        documentId: snapshot.source.documentId,
        pageId: element.pageId,
        layerId: element.layerId,
        ...(element.drawioId ? { rawAnchor: element.drawioId } : {}),
        privateSignature: createPrivateIdentitySignature({
          parts: ["semantic-diff-test", override.signature],
        }),
        ...(override.conflictCodes?.length
          ? { conflictCodes: override.conflictCodes }
          : {}),
      });
    }
  }
  return evidence;
}

function identityOverrideMetadata(
  overrides: readonly IdentityOverride[] | undefined,
  externalId: string,
): Readonly<Record<string, JsonValue>> | undefined {
  const match = overrides?.find((override) => override.externalId === externalId);
  return match ? { identitySignature: match.signature } : undefined;
}

function node(
  externalId: string | undefined,
  overrides: Partial<CanonicalElementInput> = {},
): CanonicalElementInput {
  return {
    kind: "node",
    ...(externalId ? { externalId } : {}),
    layerExternalId: "layer-a",
    label: label("Node"),
    geometry: { x: 0, y: 0, width: 40, height: 20 },
    ...overrides,
  };
}

function edge(
  externalId: string,
  sourceExternalId: string,
  targetExternalId: string,
  overrides: Partial<CanonicalElementInput> = {},
): CanonicalElementInput {
  return {
    kind: "edge",
    externalId,
    layerExternalId: "layer-a",
    sourceExternalId,
    targetExternalId,
    label: label("edge"),
    ...overrides,
  };
}

function label(text: string) {
  return { format: "plain" as const, text };
}

function style(properties: Readonly<Record<string, string>>) {
  return { properties };
}

function completeCoverage(graph: DiagramSnapshot) {
  return {
    document: true,
    pageIds: graph.pages.map((page) => page.internalId),
    layerTargets: [],
    conclusive: true,
    completeness: "complete-document" as const,
  };
}

function partialPageCoverage(graph: DiagramSnapshot) {
  return {
    document: false,
    pageIds: [graph.pages[0]!.internalId],
    layerTargets: [],
    conclusive: false,
    completeness: "partial" as const,
  };
}

function layerCoverage(graph: DiagramSnapshot, layerDrawioId: string) {
  const layer = graph.layers.find((entry) => entry.drawioId === layerDrawioId)!;
  return {
    document: false,
    pageIds: [],
    layerTargets: [{ pageId: layer.pageId, layerIds: [layer.internalId] }],
    conclusive: true,
    completeness: "complete-target-scopes" as const,
  };
}
