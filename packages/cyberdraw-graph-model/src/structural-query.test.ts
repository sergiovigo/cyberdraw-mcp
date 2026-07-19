import { describe, expect, it } from "@jest/globals";

import {
  queryStructuralAnalysis,
  type StructuralFindingFilters,
  type StructuralAnalysisQuery,
} from "./structural-query.js";
import type {
  StructuralAnalysisResult,
  StructuralBrokenReferenceFinding,
  StructuralFinding,
} from "./structural-analysis.js";

describe("structural query validation", () => {
  it("rejects empty, unknown, unsafe and over-broad queries", () => {
    const analysis = analysisResult();
    const cases: readonly StructuralAnalysisQuery[] = [
      {} as StructuralAnalysisQuery,
      { kind: "unknown" } as unknown as StructuralAnalysisQuery,
      {
        kind: "list-findings",
        unknownFilter: true,
      } as unknown as StructuralAnalysisQuery,
      { kind: "list-findings", offset: -1 },
      { kind: "list-findings", limit: -1 },
      {
        kind: "list-findings",
        order: "label",
      } as unknown as StructuralAnalysisQuery,
      {
        kind: "list-findings",
        order: null,
      } as unknown as StructuralAnalysisQuery,
      {
        kind: "list-findings",
        coverageRequirement: null,
      } as unknown as StructuralAnalysisQuery,
      {
        kind: "summarize",
        groupBy: "label",
      } as unknown as StructuralAnalysisQuery,
      {
        kind: "list-findings",
        filters: { findingTypes: ["not-real"] },
      } as unknown as StructuralAnalysisQuery,
      {
        kind: "list-findings",
        filters: { elementIds: ["x".repeat(513)] },
      },
      {
        kind: "list-findings",
        filters: { elementIds: [""] },
      },
      {
        kind: "list-findings",
        filters: {
          pageIds: Array.from({ length: 51 }, (_, index) => `p${index}`),
        },
      },
    ];

    for (const query of cases) {
      const result = queryStructuralAnalysis({ analysis, query });
      expect(result.outcome).toBe("invalid-query");
      expect(result.queryDiagnostics.length).toBeGreaterThan(0);
      expect(result.results).toEqual([]);
    }
  });

  it("detects prototype pollution shaped inputs", () => {
    const analysis = analysisResult();
    const polluted = JSON.parse(
      '{"kind":"list-findings","filters":{"__proto__":{"x":1}}}',
    );

    const result = queryStructuralAnalysis({
      analysis,
      query: polluted as StructuralAnalysisQuery,
    });

    expect(result.outcome).toBe("invalid-query");
    expect(
      result.queryDiagnostics.map((diagnostic) => diagnostic.code),
    ).toContain("invalid-filter");
  });

  it("clamps excessive limits explicitly and allows limit zero", () => {
    const analysis = analysisResult();
    const clamped = queryStructuralAnalysis({
      analysis,
      query: { kind: "list-findings", limit: 1_000 },
      limits: { maxLimit: 2 },
    });
    const empty = queryStructuralAnalysis({
      analysis,
      query: { kind: "list-findings", limit: 0 },
    });

    expect(clamped.limit).toBe(2);
    expect(clamped.returned).toBe(2);
    expect(clamped.queryDiagnostics).toContainEqual(
      expect.objectContaining({ code: "limit-clamped" }),
    );
    expect(empty.returned).toBe(0);
    expect(empty.hasMore).toBe(true);
  });

  it("rejects unsafe numbers, inherited properties and array-like filters", () => {
    const analysis = analysisResult();
    const inherited = Object.create({ inherited: true });
    inherited.kind = "list-findings";
    const arrayLikeFilters = {
      kind: "list-findings",
      filters: { pageIds: { 0: "page-a", length: 1 } },
    };
    const cases: readonly StructuralAnalysisQuery[] = [
      { kind: "list-findings", offset: Number.NaN },
      { kind: "list-findings", offset: Number.POSITIVE_INFINITY },
      { kind: "list-findings", offset: 1.5 },
      { kind: "list-findings", offset: Number.MAX_SAFE_INTEGER + 1 },
      { kind: "list-findings", limit: Number.NaN },
      { kind: "list-findings", limit: Number.POSITIVE_INFINITY },
      { kind: "list-findings", limit: 1.5 },
      { kind: "list-findings", limit: Number.MAX_SAFE_INTEGER + 1 },
      inherited as StructuralAnalysisQuery,
      arrayLikeFilters as unknown as StructuralAnalysisQuery,
    ];

    for (const query of cases) {
      expect(queryStructuralAnalysis({ analysis, query }).outcome).toBe(
        "invalid-query",
      );
    }
  });

  it("accepts null-prototype query objects and leaves Object.prototype untouched", () => {
    const analysis = analysisResult();
    const query = Object.create(null) as Record<string, unknown>;
    query.kind = "list-findings";
    query.filters = Object.create(null) as Record<string, unknown>;
    (query.filters as Record<string, unknown>).pageIds = ["page-a"];

    const result = queryStructuralAnalysis({
      analysis,
      query: query as unknown as StructuralAnalysisQuery,
    });

    expect(result.outcome).toBe("ok");
    expect(
      (Object.prototype as Record<string, unknown>).polluted,
    ).toBeUndefined();
  });

  it("rejects malicious prototype keys without polluting global objects", () => {
    const analysis = analysisResult();
    const malicious = [
      JSON.parse(
        '{"kind":"list-findings","filters":{"__proto__":{"polluted":true}}}',
      ),
      JSON.parse(
        '{"kind":"list-findings","filters":{"constructor":{"polluted":true}}}',
      ),
      JSON.parse(
        '{"kind":"list-findings","filters":{"prototype":{"polluted":true}}}',
      ),
    ] as StructuralAnalysisQuery[];

    for (const query of malicious) {
      expect(queryStructuralAnalysis({ analysis, query }).outcome).toBe(
        "invalid-query",
      );
    }
    expect(
      (Object.prototype as Record<string, unknown>).polluted,
    ).toBeUndefined();
  });
});

describe("structural query filters", () => {
  it("filters exact values with OR within categories and AND across categories", () => {
    const analysis = analysisResult();
    const byType = queryStructuralAnalysis({
      analysis,
      query: {
        kind: "list-findings",
        filters: {
          findingTypes: ["broken-reference", "cross-layer-edge"],
        },
      },
    });
    const andOr = queryStructuralAnalysis({
      analysis,
      query: {
        kind: "list-findings",
        filters: {
          findingTypes: ["broken-reference", "cross-layer-edge"],
          pageIds: ["page-a"],
          layerIds: ["layer-b"],
        },
      },
    });

    expect(byType.results.map((finding) => finding.findingType)).toEqual([
      "broken-reference",
      "cross-layer-edge",
      "cross-layer-edge",
    ]);
    expect(andOr.results).toHaveLength(1);
    expect(andOr.results[0]).toMatchObject({
      findingType: "cross-layer-edge",
      findingId: "f-cross",
    });
  });

  it("treats empty arrays as absent filters and normalizes duplicates independent of order", () => {
    const analysis = analysisResult();
    const absent = queryStructuralAnalysis({
      analysis,
      query: { kind: "list-findings", filters: {} },
    });
    const empty = queryStructuralAnalysis({
      analysis,
      query: { kind: "list-findings", filters: { pageIds: [] } },
    });
    const duplicated = queryStructuralAnalysis({
      analysis,
      query: {
        kind: "list-findings",
        filters: { pageIds: ["page-a", "page-a"], layerIds: ["layer-a"] },
      },
    });
    const reordered = queryStructuralAnalysis({
      analysis,
      query: {
        kind: "list-findings",
        filters: { layerIds: ["layer-a"], pageIds: ["page-a"] },
      },
    });

    expect(ids(empty)).toEqual(ids(absent));
    expect(ids(duplicated)).toEqual(ids(reordered));
  });

  it("covers AND combinations beyond type/page/layer", () => {
    const analysis = analysisResult();

    expect(
      ids(
        query(analysis, {
          classifications: ["broken"],
          reasonCodes: ["missing_edge_target"],
        }),
      ),
    ).toEqual(["f-broken"]);
    expect(
      ids(
        query(analysis, {
          sourceIds: ["node-source"],
          targetIds: ["node-target"],
        }),
      ),
    ).toEqual(["f-cross"]);
    expect(
      ids(
        query(analysis, {
          elementIds: ["node-source"],
          sourceIds: ["node-source"],
          referencedIds: ["missing-terminal"],
        }),
      ),
    ).toEqual(["f-broken"]);
    expect(
      ids(
        query(analysis, {
          findingTypes: ["broken-reference"],
          pageIds: ["page-a", "page-b"],
          layerIds: ["layer-missing", "layer-b"],
        }),
      ),
    ).toEqual([]);
  });

  it("supports status/classification, reason, page, layer, source, target and referenced filters", () => {
    const analysis = analysisResult();

    expect(
      ids(query(analysis, { classifications: ["confirmed-orphan"] })),
    ).toEqual(["f-orphan"]);
    expect(
      ids(query(analysis, { reasonCodes: ["missing_edge_target"] })),
    ).toEqual(["f-broken"]);
    expect(ids(query(analysis, { pageIds: ["page-a"] }))).toEqual([
      "f-broken",
      "f-context",
      "f-cross",
      "f-orphan",
    ]);
    expect(ids(query(analysis, { layerIds: ["layer-a"] }))).toEqual([
      "f-broken",
      "f-context",
      "f-cross",
      "f-orphan",
    ]);
    expect(ids(query(analysis, { sourceIds: ["node-source"] }))).toEqual([
      "f-broken",
      "f-context",
      "f-cross",
    ]);
    expect(ids(query(analysis, { targetIds: ["node-target"] }))).toEqual([
      "f-cross",
    ]);
    expect(
      ids(query(analysis, { referencedIds: ["missing-terminal"] })),
    ).toEqual(["f-broken"]);
    expect(ids(query(analysis, { classifications: ["ambiguous"] }))).toEqual(
      [],
    );
  });

  it("matches elementIds across element, source, target, referenced and edge fields only", () => {
    const analysis = analysisResult();

    expect(ids(query(analysis, { elementIds: ["edge-cross"] }))).toEqual([
      "f-cross",
    ]);
    expect(ids(query(analysis, { elementIds: ["node-source"] }))).toEqual([
      "f-broken",
      "f-context",
      "f-cross",
    ]);
    expect(ids(query(analysis, { elementIds: ["missing-terminal"] }))).toEqual([
      "f-broken",
    ]);
    expect(ids(query(analysis, { elementIds: ["node-orphan"] }))).toEqual([
      "f-orphan",
    ]);
    expect(
      JSON.stringify(query(analysis, { elementIds: ["Sensitive"] }).results),
    ).toBe("[]");
  });

  it("does not match elementIds against findingId, page, layer, reason, diagnostics or provenance text", () => {
    const base = baseFindings()[0]! as StructuralBrokenReferenceFinding;
    const finding: StructuralBrokenReferenceFinding = {
      ...base,
      findingId: "needle",
      reasonCode: "needle",
      pageId: "needle-page",
      layerId: "needle-layer",
      provenance: { sourceName: "needle" },
    };
    const analysis = analysisResult([finding]);

    expect(ids(query(analysis, { elementIds: ["needle"] }))).toEqual([]);
    expect(ids(query(analysis, { elementIds: ["needle-page"] }))).toEqual([]);
    expect(ids(query(analysis, { elementIds: ["needle-layer"] }))).toEqual([]);
  });

  it("can exclude context-only findings", () => {
    const analysis = analysisResult();
    const result = queryStructuralAnalysis({
      analysis,
      query: {
        kind: "list-findings",
        filters: { includeContextOnly: false },
      },
    });

    expect(ids(result)).not.toContain("f-context");
  });
});

describe("structural query ordering and pagination", () => {
  it("returns deterministic canonical output from reordered input", () => {
    const canonical = queryStructuralAnalysis({
      analysis: analysisResult(),
      query: { kind: "list-findings" },
    });
    const reordered = queryStructuralAnalysis({
      analysis: analysisResult([...baseFindings()].reverse()),
      query: { kind: "list-findings" },
    });

    expect(ids(reordered)).toEqual(ids(canonical));
    expect(JSON.stringify(reordered.results)).toBe(
      JSON.stringify(canonical.results),
    );
  });

  it("supports closed orders and stable pagination without duplicates", () => {
    const analysis = analysisResult();
    const byId = queryStructuralAnalysis({
      analysis,
      query: { kind: "list-findings", order: "finding-id" },
    });
    const pageOne = queryStructuralAnalysis({
      analysis,
      query: { kind: "list-findings", order: "finding-id", limit: 2 },
    });
    const pageTwo = queryStructuralAnalysis({
      analysis,
      query: {
        kind: "list-findings",
        order: "finding-id",
        offset: 2,
        limit: 2,
      },
    });
    const outside = queryStructuralAnalysis({
      analysis,
      query: { kind: "list-findings", offset: 99, limit: 10 },
    });
    const pageLayer = queryStructuralAnalysis({
      analysis,
      query: { kind: "list-findings", order: "page-layer" },
    });
    const findingType = queryStructuralAnalysis({
      analysis,
      query: { kind: "list-findings", order: "finding-type" },
    });

    expect(ids(byId)).toEqual(["f-broken", "f-context", "f-cross", "f-orphan"]);
    expect(new Set([...ids(pageOne), ...ids(pageTwo)]).size).toBe(4);
    expect(pageOne.hasMore).toBe(true);
    expect(pageTwo.hasMore).toBe(false);
    expect(outside.results).toEqual([]);
    expect(pageLayer.ordering).toBe("page-layer");
    expect(findingType.ordering).toBe("finding-type");
    expect(JSON.stringify(byId)).toBe(JSON.stringify(byId));
  });

  it("handles total-boundary offsets, empty results and overflow-safe hasMore", () => {
    const analysis = analysisResult();
    const atTotal = queryStructuralAnalysis({
      analysis,
      query: { kind: "list-findings", offset: 4, limit: 1 },
    });
    const beyondTotal = queryStructuralAnalysis({
      analysis,
      query: { kind: "list-findings", offset: 5, limit: 1 },
    });
    const hugeOffset = queryStructuralAnalysis({
      analysis,
      query: {
        kind: "list-findings",
        offset: Number.MAX_SAFE_INTEGER,
        limit: 500,
      },
    });
    const noMatches = queryStructuralAnalysis({
      analysis,
      query: {
        kind: "list-findings",
        filters: { pageIds: ["missing-page"] },
      },
    });

    expect(atTotal).toMatchObject({
      totalMatched: 4,
      returned: 0,
      hasMore: false,
    });
    expect(beyondTotal.returned).toBe(0);
    expect(beyondTotal.hasMore).toBe(false);
    expect(hugeOffset.returned).toBe(0);
    expect(hugeOffset.hasMore).toBe(false);
    expect(noMatches).toMatchObject({
      totalMatched: 0,
      returned: 0,
      hasMore: false,
      results: [],
    });
  });

  it("uses findingId as a final tie-breaker for otherwise equal findings", () => {
    const base = baseFindings()[0]!;
    const first = { ...base, findingId: "unicode-ñ" };
    const second = { ...base, findingId: "unicode-\u0000a" };
    const result = queryStructuralAnalysis({
      analysis: analysisResult([first, second]),
      query: { kind: "list-findings", order: "canonical" },
    });

    expect(ids(result)).toEqual(["unicode-\u0000a", "unicode-ñ"]);
  });
});

describe("structural query coverage", () => {
  it("honors coverage requirements and does not treat stale as partial", () => {
    const completeDocument = analysisResult(undefined, "complete-document");
    const targetScopes = analysisResult(undefined, "complete-target-scopes");
    const partial = analysisResult(undefined, "partial");
    const truncated = analysisResult(undefined, "truncated");
    const stale = analysisResult(undefined, "stale");
    const unknown = analysisResult(undefined, "unknown");

    expect(requirement(completeDocument, "complete-document").outcome).toBe(
      "ok",
    );
    expect(requirement(targetScopes, "complete-target-scopes").outcome).toBe(
      "ok",
    );
    expect(requirement(partial, "any").outcome).toBe("ok");
    expect(requirement(truncated, "non-stale").outcome).toBe("ok");
    expect(requirement(unknown, "non-stale").outcome).toBe("ok");
    expect(requirement(partial, "complete-target-scopes").outcome).toBe(
      "insufficient-coverage",
    );
    expect(requirement(stale, "non-stale")).toMatchObject({
      outcome: "insufficient-coverage",
      queryDiagnostics: [expect.objectContaining({ code: "stale-analysis" })],
    });
    expect(requirement(stale, "any")).toMatchObject({
      outcome: "insufficient-coverage",
      results: [],
      queryDiagnostics: [expect.objectContaining({ code: "stale-analysis" })],
    });
    expect(
      queryStructuralAnalysis({
        analysis: stale,
        query: { kind: "counts", coverageRequirement: "any" },
      }).summary,
    ).toBeUndefined();
    expect(requirement(targetScopes, "complete-document").results).toEqual([]);
  });
});

describe("structural query lookup", () => {
  it("uses exact findingId, reports not found and rejects duplicate IDs", () => {
    const analysis = analysisResult();
    const found = queryStructuralAnalysis({
      analysis,
      query: { kind: "get-finding", findingId: "f-broken" },
    });
    const prefix = queryStructuralAnalysis({
      analysis,
      query: { kind: "get-finding", findingId: "f" },
    });
    const duplicate = queryStructuralAnalysis({
      analysis: analysisResult([
        baseFindings()[0]!,
        {
          ...baseFindings()[1]!,
          findingId: "f-broken",
          reasonCode: "different-structure",
        },
      ]),
      query: { kind: "get-finding", findingId: "f-broken" },
    });

    expect(found.finding?.findingId).toBe("f-broken");
    expect(prefix.finding).toBeUndefined();
    expect(prefix.queryDiagnostics).toContainEqual(
      expect.objectContaining({ code: "finding-not-found" }),
    );
    expect(duplicate.outcome).toBe("validation-failed");
  });
});

describe("structural query summaries and counts", () => {
  it("builds deterministic buckets by supported groups", () => {
    const analysis = analysisResult();

    expect(bucketPairs(summary(analysis, "finding-type"))).toEqual([
      ["broken-reference", 1],
      ["cross-layer-edge", 2],
      ["orphan-element", 1],
    ]);
    expect(bucketPairs(summary(analysis, "classification"))).toEqual([
      ["broken", 1],
      ["confirmed-orphan", 1],
      ["context-only-endpoint", 1],
      ["same-page-cross-layer", 1],
    ]);
    expect(bucketPairs(summary(analysis, "reason-code"))).toContainEqual([
      "missing_edge_target",
      1,
    ]);
    expect(bucketPairs(summary(analysis, "page"))).toEqual([["page-a", 4]]);
    expect(bucketPairs(summary(analysis, "layer"))).toEqual([
      ["layer-a", 4],
      ["layer-b", 1],
    ]);
    expect(bucketPairs(summary(analysis, "coverage"))).toEqual([
      ["complete-target-scopes", 4],
    ]);
  });

  it("enforces max buckets and preserves M9 counts without recomputing categories", () => {
    const analysis = analysisResult();
    const tooMany = queryStructuralAnalysis({
      analysis,
      query: { kind: "summarize", groupBy: "reason-code" },
      limits: { maxGroupBuckets: 1 },
    });
    const counts = queryStructuralAnalysis({
      analysis,
      query: { kind: "counts" },
    });

    expect(tooMany.outcome).toBe("validation-failed");
    expect(counts.summary?.counts).not.toBe(analysis.counts);
    expect(counts.summary?.counts).toMatchObject({
      brokenReferenceCount: { value: 1, basis: "observed" },
      unresolvedExternalReferenceCount: { value: 7, basis: "observed" },
      orphanElementCount: { value: 1, basis: "observed" },
      crossLayerEdgeCount: { value: 1, basis: "observed" },
    });
  });

  it("rejects more than one hundred buckets without truncating silently", () => {
    const many = Array.from({ length: 101 }, (_, index) => ({
      ...baseFindings()[0]!,
      findingId: `f-${index}`,
      reasonCode: `reason-${index}`,
      sourceElementId: `source-${index}`,
    })) satisfies StructuralFinding[];

    const result = queryStructuralAnalysis({
      analysis: analysisResult(many),
      query: { kind: "summarize", groupBy: "reason-code" },
    });

    expect(result).toMatchObject({
      outcome: "validation-failed",
      returned: 0,
      queryDiagnostics: [
        expect.objectContaining({ code: "validation-failed" }),
      ],
    });
    expect(result).not.toHaveProperty("groups");
  });
});

describe("structural query purity", () => {
  it("does not mutate frozen input and returns the same output for the same input", () => {
    const analysis = deepFreeze(analysisResult());
    const queryInput = deepFreeze({
      kind: "list-findings" as const,
      order: "finding-id" as const,
      filters: {
        pageIds: ["page-a"],
        layerIds: ["layer-a"],
      },
    });
    const before = JSON.stringify({ analysis, queryInput });
    const first = queryStructuralAnalysis({
      analysis,
      query: queryInput,
    });
    const second = queryStructuralAnalysis({
      analysis,
      query: queryInput,
    });

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(JSON.stringify({ analysis, queryInput })).toBe(before);
    expect(analysis.findings).toHaveLength(4);
  });

  it("does not expose mutable input references through output arrays or counts", () => {
    const sharedIds = ["page-a", "page-a"];
    const queryInput = {
      kind: "list-findings" as const,
      filters: { pageIds: sharedIds, layerIds: sharedIds },
      order: "finding-id" as const,
      limit: 2,
    };
    const analysis = analysisResult();
    const result = queryStructuralAnalysis({ analysis, query: queryInput });
    const countsResult = queryStructuralAnalysis({
      analysis,
      query: { kind: "counts" },
    });

    (result.results as StructuralFinding[]).length = 0;
    if (countsResult.summary?.counts.brokenReferenceCount) {
      (
        countsResult.summary.counts.brokenReferenceCount as { value?: number }
      ).value = 99;
    }

    expect(analysis.findings).toHaveLength(4);
    expect(analysis.counts.brokenReferenceCount.value).toBe(1);
    expect(sharedIds).toEqual(["page-a", "page-a"]);
  });
});

function query(
  analysis: StructuralAnalysisResult,
  filters: StructuralFindingFilters,
) {
  return queryStructuralAnalysis({
    analysis,
    query: { kind: "list-findings", filters },
  });
}

function requirement(
  analysis: StructuralAnalysisResult,
  coverageRequirement:
    | "any"
    | "non-stale"
    | "complete-target-scopes"
    | "complete-document",
) {
  return queryStructuralAnalysis({
    analysis,
    query: { kind: "list-findings", coverageRequirement },
  });
}

function summary(
  analysis: StructuralAnalysisResult,
  groupBy:
    | "finding-type"
    | "classification"
    | "reason-code"
    | "page"
    | "layer"
    | "coverage",
) {
  return queryStructuralAnalysis({
    analysis,
    query: { kind: "summarize", groupBy },
  });
}

function ids(result: { readonly results: readonly StructuralFinding[] }) {
  return result.results.map((finding) => finding.findingId);
}

function bucketPairs(result: ReturnType<typeof queryStructuralAnalysis>) {
  return (result.groups ?? []).map(
    (bucket) => [bucket.key, bucket.count] as const,
  );
}

function analysisResult(
  findings: readonly StructuralFinding[] = baseFindings(),
  completeness: StructuralAnalysisResult["completeness"] = "complete-target-scopes",
): StructuralAnalysisResult {
  return {
    analysisVersion: "cyberdraw.structural-analysis.v1",
    documentId: "doc",
    revisionEvidence: {
      documentId: "doc",
      contentRevisions: ["r1"],
      documentRevisions: ["dr1"],
      revisionCompatible: completeness !== "stale",
    },
    coverage: coverage(completeness),
    counts: {
      pageCount: { value: 1, basis: basis(completeness) },
      layerCount: { value: 2, basis: basis(completeness) },
      elementCount: { value: 5, basis: basis(completeness) },
      nodeCount: { value: 3, basis: basis(completeness) },
      edgeCount: { value: 2, basis: basis(completeness) },
      connectedNodeCount: { value: 2, basis: basis(completeness) },
      orphanElementCount: { value: 1, basis: basis(completeness) },
      brokenReferenceCount: { value: 1, basis: basis(completeness) },
      crossLayerEdgeCount: { value: 1, basis: basis(completeness) },
      unresolvedExternalReferenceCount: {
        value: 7,
        basis: basis(completeness),
      },
      contextOnlyElementCount: { value: 1, basis: basis(completeness) },
    },
    findings,
    diagnostics: [{ code: "external-context-required", severity: "warn" }],
    limitations: ["complete target scopes do not prove whole-document absence"],
    completeness,
    stopReason: "intent-satisfied",
    limits: { measuredBytes: 1234 },
  };
}

function baseFindings(): readonly StructuralFinding[] {
  const findingCoverage = {
    completeness: "complete-target-scopes" as const,
    document: false,
    pageCovered: true,
    layerCovered: true,
    conclusive: true,
  };
  return [
    {
      findingId: "f-broken",
      findingType: "broken-reference",
      referenceType: "target",
      status: "broken",
      sourceElementId: "node-source",
      referencedElementId: "missing-terminal",
      pageId: "page-a",
      layerId: "layer-a",
      reasonCode: "missing_edge_target",
      coverage: findingCoverage,
      confidence: "confirmed",
      provenance: {
        documentId: "doc",
        pageId: "page-a",
        drawioId: "edge-broken",
      },
    },
    {
      findingId: "f-cross",
      findingType: "cross-layer-edge",
      edgeId: "edge-cross",
      sourceElementId: "node-source",
      targetElementId: "node-target",
      sourcePageId: "page-a",
      sourceLayerId: "layer-a",
      targetPageId: "page-a",
      targetLayerId: "layer-b",
      relationClassification: "same-page-cross-layer",
      reasonCode: "same-page-cross-layer",
      coverage: findingCoverage,
      confidence: "confirmed",
      provenance: {
        documentId: "doc",
        pageId: "page-a",
        drawioId: "edge-cross",
      },
    },
    {
      findingId: "f-context",
      findingType: "cross-layer-edge",
      edgeId: "edge-context",
      sourceElementId: "node-source",
      targetElementId: "node-context",
      sourcePageId: "page-a",
      sourceLayerId: "layer-a",
      targetPageId: "page-a",
      targetLayerId: "layer-a",
      relationClassification: "context-only-endpoint",
      reasonCode: "context-only-endpoint",
      coverage: findingCoverage,
      confidence: "incomplete",
    },
    {
      findingId: "f-orphan",
      findingType: "orphan-element",
      status: "confirmed-orphan",
      elementId: "node-orphan",
      pageId: "page-a",
      layerId: "layer-a",
      reasonCode: "no-structural-relations",
      coverage: findingCoverage,
      confidence: "confirmed",
      provenance: {
        documentId: "doc",
        pageId: "page-a",
        drawioId: "node-orphan",
      },
    },
  ];
}

function coverage(
  completeness: StructuralAnalysisResult["completeness"],
): StructuralAnalysisResult["coverage"] {
  return {
    document: completeness === "complete-document",
    pageIds: ["page-a"],
    layerTargets: [{ pageId: "page-a", layerIds: ["layer-a", "layer-b"] }],
    conclusive:
      completeness === "complete-document" ||
      completeness === "complete-target-scopes",
    truncated: completeness === "truncated",
    stale: completeness === "stale",
    completeness,
  };
}

function basis(completeness: StructuralAnalysisResult["completeness"]) {
  switch (completeness) {
    case "complete-document":
      return "exact" as const;
    case "complete-target-scopes":
      return "observed" as const;
    case "partial":
    case "truncated":
      return "partial" as const;
    case "stale":
    case "unknown":
      return "unknown" as const;
  }
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  for (const entry of Object.values(value as Record<string, unknown>)) {
    deepFreeze(entry);
  }
  Object.freeze(value);
  return value;
}
