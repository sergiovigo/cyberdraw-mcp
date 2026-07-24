import { describe, expect, it } from "@jest/globals";

import {
  createPrivateIdentitySignature,
  matchStableIdentity,
  provisionalDiagramId,
  provisionalElementId,
  provisionalLayerId,
  provisionalPageId,
  type IdentityMatchOutcome,
  type StableIdentityEntityType,
  type StableIdentityEvidence,
} from "./identity.js";

describe("provisional identity policy", () => {
  it("generates deterministic page, layer and element IDs", () => {
    const input = { pageIndex: 0, pageExternalId: "page-a" };
    expect(provisionalDiagramId("doc")).toBe("diagram:drawio:doc");
    expect(provisionalPageId(input)).toBe("page:0:drawio:page-a");
    expect(
      provisionalLayerId({
        ...input,
        layerExternalId: "layer-a",
        appearanceIndex: 1,
      }),
    ).toBe("layer:page:0:drawio:page-a:drawio:layer-a:1");
    expect(
      provisionalElementId({
        ...input,
        elementExternalId: "node-a",
        appearanceIndex: 2,
      }),
    ).toBe("element:page:0:drawio:page-a:drawio:node-a:2");
  });

  it("uses synthetic IDs for missing external IDs", () => {
    expect(provisionalPageId({ pageIndex: 1 })).toBe("page:1:synthetic");
    expect(provisionalElementId({ pageIndex: 1, appearanceIndex: 3 })).toBe(
      "element:page:1:synthetic:synthetic:3",
    );
  });
});

describe("stable identity candidate policy", () => {
  const signature = (value: string) =>
    createPrivateIdentitySignature({ parts: ["node", value] });
  const doc = "doc-a";
  const base = (input: {
    readonly identityId: string;
    readonly entityType?: StableIdentityEntityType;
    readonly pageId?: string;
    readonly layerId?: string;
    readonly rawAnchor?: string;
    readonly signature?: string;
    readonly conflictCodes?: StableIdentityEvidence["conflictCodes"];
  }): StableIdentityEvidence => ({
    identityId: input.identityId,
    entityType: input.entityType ?? "element",
    documentId: doc,
    ...(input.pageId ? { pageId: input.pageId } : {}),
    ...(input.layerId ? { layerId: input.layerId } : {}),
    ...(input.rawAnchor ? { rawAnchor: input.rawAnchor } : {}),
    ...(input.signature
      ? { privateSignature: signature(input.signature) }
      : {}),
    ...(input.conflictCodes ? { conflictCodes: input.conflictCodes } : {}),
  });
  const match = (
    reference: StableIdentityEvidence,
    candidates: readonly StableIdentityEvidence[],
  ) => matchStableIdentity(reference, candidates);

  const cases: readonly {
    readonly name: string;
    readonly reference: StableIdentityEvidence;
    readonly candidates: readonly StableIdentityEvidence[];
    readonly expected: IdentityMatchOutcome;
    readonly rationale: string;
  }[] = [
    {
      name: "same entity, equivalent snapshot",
      reference: base({
        identityId: "a",
        pageId: "page-a",
        layerId: "layer-a",
        rawAnchor: "node-a",
      }),
      candidates: [
        base({
          identityId: "b",
          pageId: "page-a",
          layerId: "layer-a",
          rawAnchor: "node-a",
        }),
      ],
      expected: "EXACT",
      rationale: "unique raw anchor in the same document and page context",
    },
    {
      name: "reordered snapshot",
      reference: base({
        identityId: "a",
        pageId: "page-a",
        rawAnchor: "node-a",
      }),
      candidates: [
        base({ identityId: "z", pageId: "page-a", rawAnchor: "other" }),
        base({ identityId: "b", pageId: "page-a", rawAnchor: "node-a" }),
      ],
      expected: "EXACT",
      rationale: "candidate order does not change raw-anchor matching",
    },
    {
      name: "moved within same layer",
      reference: base({
        identityId: "a",
        pageId: "page-a",
        layerId: "layer-a",
        rawAnchor: "node-a",
        signature: "before",
      }),
      candidates: [
        base({
          identityId: "b",
          pageId: "page-a",
          layerId: "layer-a",
          rawAnchor: "node-a",
          signature: "after",
        }),
      ],
      expected: "EXACT",
      rationale: "geometry/content changes do not override a unique raw anchor",
    },
    {
      name: "moved across layers",
      reference: base({
        identityId: "a",
        pageId: "page-a",
        layerId: "layer-a",
        rawAnchor: "node-a",
      }),
      candidates: [
        base({
          identityId: "b",
          pageId: "page-a",
          layerId: "layer-b",
          rawAnchor: "node-a",
        }),
      ],
      expected: "EXACT",
      rationale: "layer is context evidence for elements, not an automatic break",
    },
    {
      name: "moved across pages",
      reference: base({
        identityId: "a",
        pageId: "page-a",
        rawAnchor: "node-a",
        signature: "node-a",
      }),
      candidates: [
        base({
          identityId: "b",
          pageId: "page-b",
          rawAnchor: "node-a",
          signature: "node-a",
        }),
      ],
      expected: "PROBABLE",
      rationale: "same raw anchor plus signature can only be review-required",
    },
    {
      name: "cloned node",
      reference: base({
        identityId: "a",
        pageId: "page-a",
        signature: "clone-shape",
      }),
      candidates: [
        base({ identityId: "b", pageId: "page-a", signature: "clone-shape" }),
        base({ identityId: "c", pageId: "page-a", signature: "clone-shape" }),
      ],
      expected: "AMBIGUOUS",
      rationale: "same private signature has multiple candidates",
    },
    {
      name: "copied/pasted node",
      reference: base({
        identityId: "a",
        pageId: "page-a",
        rawAnchor: "node-a",
        signature: "copied",
      }),
      candidates: [
        base({
          identityId: "b",
          pageId: "page-a",
          rawAnchor: "node-copy",
          signature: "copied",
        }),
      ],
      expected: "NO_MATCH",
      rationale: "distinct raw IDs with same content are not continuity",
    },
    {
      name: "imported diagram with rewritten IDs",
      reference: base({
        identityId: "a",
        pageId: "page-a",
        rawAnchor: "old-node",
        signature: "imported",
        conflictCodes: ["rewritten-raw-anchor"],
      }),
      candidates: [
        base({
          identityId: "b",
          pageId: "page-a",
          rawAnchor: "new-node",
          signature: "imported",
        }),
      ],
      expected: "PROBABLE",
      rationale: "rewritten IDs can only use private signature evidence",
    },
    {
      name: "duplicate IDs",
      reference: base({
        identityId: "a",
        pageId: "page-a",
        rawAnchor: "dup",
      }),
      candidates: [
        base({ identityId: "b", pageId: "page-a", rawAnchor: "dup" }),
        base({ identityId: "c", pageId: "page-a", rawAnchor: "dup" }),
      ],
      expected: "AMBIGUOUS",
      rationale: "multiple same-context raw anchors must not be guessed",
    },
    {
      name: "missing IDs",
      reference: base({ identityId: "a", pageId: "page-a" }),
      candidates: [base({ identityId: "b", pageId: "page-a" })],
      expected: "NO_MATCH",
      rationale: "missing anchor and missing signature cannot match",
    },
    {
      name: "same content, different entities",
      reference: base({
        identityId: "a",
        pageId: "page-a",
        rawAnchor: "node-a",
        signature: "same-content",
      }),
      candidates: [
        base({
          identityId: "b",
          pageId: "page-a",
          rawAnchor: "node-b",
          signature: "same-content",
        }),
      ],
      expected: "NO_MATCH",
      rationale: "private signature cannot override conflicting raw anchors",
    },
    {
      name: "same ID, conflicting content/context",
      reference: base({
        identityId: "a",
        pageId: "page-a",
        rawAnchor: "node-a",
      }),
      candidates: [
        base({
          identityId: "b",
          pageId: "page-a",
          rawAnchor: "node-a",
          conflictCodes: ["content-conflict"],
        }),
      ],
      expected: "AMBIGUOUS",
      rationale: "explicit conflict prevents exact matching",
    },
    {
      name: "deleted and recreated entity",
      reference: base({
        identityId: "a",
        pageId: "page-a",
        rawAnchor: "deleted",
      }),
      candidates: [
        base({ identityId: "b", pageId: "page-a", rawAnchor: "recreated" }),
      ],
      expected: "NO_MATCH",
      rationale: "no compatible raw anchor or allowed signature evidence",
    },
    {
      name: "renamed layer",
      reference: base({
        identityId: "layer-a",
        entityType: "layer",
        pageId: "page-a",
        rawAnchor: "layer-raw",
        signature: "old-name",
      }),
      candidates: [
        base({
          identityId: "layer-b",
          entityType: "layer",
          pageId: "page-a",
          rawAnchor: "layer-raw",
          signature: "new-name",
        }),
      ],
      expected: "EXACT",
      rationale: "layer name is content, not raw identity",
    },
    {
      name: "duplicated page",
      reference: base({
        identityId: "page-a",
        entityType: "page",
        rawAnchor: "page-raw",
      }),
      candidates: [
        base({ identityId: "page-b", entityType: "page", rawAnchor: "page-raw" }),
        base({ identityId: "page-c", entityType: "page", rawAnchor: "page-raw" }),
      ],
      expected: "AMBIGUOUS",
      rationale: "duplicated page anchors cannot be selected arbitrarily",
    },
    {
      name: "edge with same endpoints",
      reference: base({
        identityId: "edge-a",
        entityType: "edge",
        pageId: "page-a",
        layerId: "layer-a",
        rawAnchor: "edge-raw",
        signature: "source-a-target-b",
      }),
      candidates: [
        base({
          identityId: "edge-b",
          entityType: "edge",
          pageId: "page-a",
          layerId: "layer-a",
          rawAnchor: "edge-raw",
          signature: "source-a-target-b",
        }),
      ],
      expected: "EXACT",
      rationale: "edge raw identity is stable with compatible endpoint context",
    },
    {
      name: "edge endpoint change",
      reference: base({
        identityId: "edge-a",
        entityType: "edge",
        pageId: "page-a",
        rawAnchor: "edge-raw",
        signature: "source-a-target-b",
      }),
      candidates: [
        base({
          identityId: "edge-b",
          entityType: "edge",
          pageId: "page-a",
          rawAnchor: "edge-raw",
          signature: "source-a-target-c",
        }),
      ],
      expected: "EXACT",
      rationale: "edge identity is separate from endpoint relation changes",
    },
    {
      name: "external-reference related identity evidence",
      reference: base({
        identityId: "xref-a",
        entityType: "external-reference",
        pageId: "page-a",
        rawAnchor: "page-a:edge-a:target:node-b",
      }),
      candidates: [
        base({
          identityId: "xref-b",
          entityType: "external-reference",
          pageId: "page-a",
          rawAnchor: "page-a:edge-a:target:node-b",
        }),
      ],
      expected: "EXACT",
      rationale: "external-reference evidence is scoped and exact only by anchor",
    },
  ];

  for (const entry of cases) {
    it(`${entry.name} -> ${entry.expected}`, () => {
      expect(match(entry.reference, entry.candidates).outcome).toBe(
        entry.expected,
      );
      expect(entry.rationale).toEqual(expect.any(String));
    });
  }

  it("does not convert private-signature matches into exact matches", () => {
    const result = match(
      base({ identityId: "a", pageId: "page-a", signature: "same" }),
      [base({ identityId: "b", pageId: "page-a", signature: "same" })],
    );
    expect(result.outcome).toBe("PROBABLE");
    expect(result.matches[0]?.outcome).toBe("PROBABLE");
  });

  it("records layer context changes without breaking element exact matches", () => {
    const result = match(
      base({
        identityId: "a",
        pageId: "page-a",
        layerId: "layer-a",
        rawAnchor: "node-a",
      }),
      [
        base({
          identityId: "b",
          pageId: "page-a",
          layerId: "layer-b",
          rawAnchor: "node-a",
        }),
      ],
    );
    expect(result).toMatchObject({
      outcome: "EXACT",
      reasonCodes: ["exact-raw-anchor", "layer-context-changed"],
    });
  });

  it("is deterministic for the same input and for reordered candidates", () => {
    const reference = base({
      identityId: "a",
      pageId: "page-a",
      rawAnchor: "node-a",
    });
    const candidates = [
      base({ identityId: "c", pageId: "page-a", rawAnchor: "node-a" }),
      base({ identityId: "b", pageId: "page-a", rawAnchor: "node-a" }),
    ];
    expect(match(reference, candidates)).toEqual(match(reference, candidates));
    expect(match(reference, candidates)).toEqual(
      match(reference, [...candidates].reverse()),
    );
  });

  it("does not depend on object property order", () => {
    const reference: StableIdentityEvidence = {
      identityId: "a",
      entityType: "element",
      documentId: doc,
      pageId: "page-a",
      rawAnchor: "node-a",
    };
    const sameReference: StableIdentityEvidence = {
      rawAnchor: "node-a",
      pageId: "page-a",
      documentId: doc,
      entityType: "element",
      identityId: "a",
    };
    const candidates = [
      base({ identityId: "b", pageId: "page-a", rawAnchor: "node-a" }),
    ];
    expect(match(reference, candidates)).toEqual(match(sameReference, candidates));
  });

  it("does not use timestamps or runtime state", () => {
    const reference = base({
      identityId: "a",
      pageId: "page-a",
      rawAnchor: "node-a",
    });
    const candidates = [
      base({ identityId: "b", pageId: "page-a", rawAnchor: "node-a" }),
    ];
    const before = Date.now();
    const first = match(reference, candidates);
    const after = Date.now();
    expect(after).toBeGreaterThanOrEqual(before);
    expect(match(reference, candidates)).toEqual(first);
  });

  it("creates deterministic bounded private signatures without exposing source material", () => {
    const first = createPrivateIdentitySignature(
      { parts: ["secret-label", "geometry-bucket"] },
      { maxPartBytes: 6 },
    );
    const second = createPrivateIdentitySignature(
      { parts: ["secret-label", "geometry-bucket"] },
      { maxPartBytes: 6 },
    );
    expect(first).toEqual(second);
    expect(first.truncated).toBe(true);
    expect(first.value).not.toContain("secret-label");
    expect(first.materialBytes).toBeLessThanOrEqual(4096);
  });

  it("reports duplicate signatures as ambiguous for missing IDs", () => {
    const result = match(
      base({ identityId: "a", pageId: "page-a", signature: "same" }),
      [
        base({ identityId: "b", pageId: "page-a", signature: "same" }),
        base({ identityId: "c", pageId: "page-a", signature: "same" }),
      ],
    );
    expect(result.outcome).toBe("AMBIGUOUS");
    expect(result.reasonCodes).toContain("ambiguous-private-signature");
    expect(result.reasonCodes).toContain("raw-anchor-missing");
  });

  it("treats conflicting page context as probable only with same raw/signature evidence", () => {
    const result = match(
      base({
        identityId: "a",
        pageId: "page-a",
        rawAnchor: "node-a",
        signature: "same",
      }),
      [
        base({
          identityId: "b",
          pageId: "page-b",
          rawAnchor: "node-a",
          signature: "same",
        }),
      ],
    );
    expect(result).toMatchObject({
      outcome: "PROBABLE",
      reasonCodes: ["page-context-changed", "probable-private-signature"],
    });
  });
});
