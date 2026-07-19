import { describe, expect, it } from "@jest/globals";

import {
  planStructuralChanges,
  type StructuralChangePlanPolicy,
} from "./structural-change-plan.js";
import type {
  StructuralAnalysisResult,
  StructuralFinding,
} from "./structural-analysis.js";
import type { StructuralAnalysisQueryResult } from "./structural-query.js";

describe("structural change plan validation", () => {
  it("rejects empty input, unknown policy fields, missing findings, stale coverage and limits", () => {
    const analysis = analysisResult();
    const cases = [
      planStructuralChanges({} as never),
      planStructuralChanges({
        analysis,
        selectedFindingIds: ["missing"],
      }),
      planStructuralChanges({
        analysis,
        selectedFindingIds: ["f-broken-target"],
        unexpected: true,
      } as never),
      planStructuralChanges({
        analysis,
        selectedFindingIds: ["f-broken-target"],
        policy: { mode: "unsafe" } as never,
      }),
      planStructuralChanges({
        analysis,
        selectedFindingIds: ["f-broken-target"],
        limits: { maxSelectedFindings: -1 },
      }),
      planStructuralChanges({
        analysis,
        selectedFindingIds: ["x".repeat(600)],
      }),
      planStructuralChanges({
        analysis: analysisResult({ completeness: "stale" }),
        selectedFindingIds: ["f-broken-target"],
      }),
      planStructuralChanges({
        analysis,
        selectedFindingIds: ["f-broken-target"],
        reviewContext: { expectedDocumentRevision: "different" },
      }),
      planStructuralChanges({
        analysis,
        selectedFindingIds: ["f-broken-target", "f-orphan"],
        limits: { maxSelectedFindings: 1 },
      }),
    ];

    expect(cases.map((plan) => plan.outcome)).toEqual([
      "invalid-input",
      "validation-failed",
      "invalid-input",
      "invalid-input",
      "validation-failed",
      "invalid-input",
      "stale-analysis",
      "validation-failed",
      "validation-failed",
    ]);
  });

  it("rejects incompatible query results and accepts ok query selection", () => {
    const analysis = analysisResult();
    const okQuery = queryResult(analysis, [analysis.findings[0]!]);
    const badQuery = { ...okQuery, outcome: "insufficient-coverage" as const };
    const incompatible = {
      ...okQuery,
      completeness: "complete-document" as const,
    };
    const otherDocument = analysisResult({ documentId: "doc-2" });
    const otherRevision = analysisResult({ documentRevision: "rev-2" });
    const alteredFinding = {
      ...okQuery,
      results: [
        {
          ...analysis.findings[0]!,
          reasonCode: "altered-query-finding",
        } as StructuralFinding,
      ],
    };

    expect(
      planStructuralChanges({ analysis, queryResult: badQuery }).outcome,
    ).toBe("insufficient-coverage");
    expect(
      planStructuralChanges({ analysis, queryResult: incompatible }).outcome,
    ).toBe("validation-failed");
    expect(
      planStructuralChanges({ analysis: otherDocument, queryResult: okQuery })
        .outcome,
    ).toBe("validation-failed");
    expect(
      planStructuralChanges({ analysis: otherRevision, queryResult: okQuery })
        .outcome,
    ).toBe("validation-failed");
    expect(
      planStructuralChanges({ analysis, queryResult: alteredFinding }).outcome,
    ).toBe("validation-failed");
    expect(
      planStructuralChanges({
        analysis,
        queryResult: okQuery,
        policy: { allowDetachBrokenTerminals: true },
      }).proposalCount,
    ).toBe(1);
  });

  it("detects duplicate finding IDs with different content", () => {
    const analysis = analysisResult({
      findings: [
        brokenFinding("f-dup", "missing-a"),
        brokenFinding("f-dup", "missing-b"),
      ],
    });

    const plan = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-dup"],
    });

    expect(plan.outcome).toBe("validation-failed");
    expect(plan.diagnostics.planningDiagnostics).toContainEqual(
      expect.objectContaining({ code: "duplicate-finding-id" }),
    );
  });

  it("defends against prototype pollution shaped selection", () => {
    const analysis = analysisResult();
    const polluted = JSON.parse(
      '{"analysis":{},"selectedFindingIds":["f-broken-target"],"__proto__":{"polluted":true}}',
    );
    polluted.analysis = analysis;

    const plan = planStructuralChanges(polluted);

    expect(plan.outcome).toBe("invalid-input");
    expect(
      (Object.prototype as Record<string, unknown>).polluted,
    ).toBeUndefined();
  });

  it("rejects inherited policy fields, incorrect policy types and policy contradictions", () => {
    const analysis = analysisResult();
    const inherited = Object.create({ inherited: true });
    inherited.allowDetachBrokenTerminals = true;

    expect(
      planStructuralChanges({
        analysis,
        selectedFindingIds: ["f-broken-target"],
        policy: inherited,
      }).outcome,
    ).toBe("invalid-input");
    expect(
      planStructuralChanges({
        analysis,
        selectedFindingIds: ["f-broken-target"],
        policy: { allowDetachBrokenTerminals: "yes" } as never,
      }).outcome,
    ).toBe("invalid-input");
    expect(
      planStructuralChanges({
        analysis,
        selectedFindingIds: ["f-orphan"],
        policy: {
          name: "review-only",
          allowDeleteConfirmedOrphans: true,
        },
      }).outcome,
    ).toBe("blocked-by-policy");
    expect(
      planStructuralChanges({
        analysis,
        selectedFindingIds: ["f-broken-target"],
        policy: {
          allowDetachBrokenTerminals: true,
          allowRemoveDanglingEdges: true,
        },
      }).outcome,
    ).toBe("blocked-by-policy");
  });
});

describe("structural change plan deterministic IDs", () => {
  it("keeps plan and proposal IDs stable across repeated and reordered input", () => {
    const analysis = analysisResult();
    const first = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-orphan", "f-broken-target"],
      policy: {
        allowDetachBrokenTerminals: true,
        allowDeleteConfirmedOrphans: true,
      },
    });
    const second = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-broken-target", "f-orphan"],
      policy: {
        allowDeleteConfirmedOrphans: true,
        allowDetachBrokenTerminals: true,
      },
    });

    expect(second.planId).toBe(first.planId);
    expect(second.proposals.map((proposal) => proposal.proposalId)).toEqual(
      first.proposals.map((proposal) => proposal.proposalId),
    );
    expect(first.planId.startsWith("m11-plan-")).toBe(true);
    expect(
      first.proposals.every((proposal) =>
        proposal.proposalId.startsWith("m11-proposal-"),
      ),
    ).toBe(true);
    expect(JSON.stringify(first)).not.toContain("Sensitive");
    expect(JSON.stringify(first)).not.toContain("<mxGraphModel");
  });

  it("changes plan IDs for policy, revision and selected finding changes", () => {
    const analysis = analysisResult();
    const base = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-broken-target"],
    });
    const policy = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-broken-target"],
      policy: { allowDetachBrokenTerminals: true },
    });
    const revision = planStructuralChanges({
      analysis: analysisResult({ documentRevision: "rev-2" }),
      selectedFindingIds: ["f-broken-target"],
    });
    const finding = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-orphan"],
    });

    expect(
      new Set([base.planId, policy.planId, revision.planId, finding.planId])
        .size,
    ).toBe(4);
  });
});

describe("structural change plan policy behavior", () => {
  it("handles broken references conservatively and never invents replacements", () => {
    const analysis = analysisResult();
    const conservative = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-broken-target"],
    });
    const detach = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-broken-target"],
      policy: { allowDetachBrokenTerminals: true },
    });
    const remove = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-broken-target"],
      policy: { allowRemoveDanglingEdges: true },
    });

    expect(conservative.outcome).toBe("manual-review");
    expect(detach.proposals[0]).toMatchObject({
      proposalType: "detach-broken-terminal",
      operation: {
        operationType: "detach-terminal",
        target: { edgeId: "edge-broken", terminal: "target" },
      },
    });
    expect(remove.proposals[0]?.proposalType).toBe("remove-dangling-edge");
    expect(JSON.stringify(detach)).not.toContain("replace-terminal-reference");
  });

  it("keeps ambiguous and unresolved external references non-destructive", () => {
    const analysis = analysisResult({
      findings: [
        {
          ...brokenFinding("f-ambiguous", "target-x"),
          status: "ambiguous",
          reasonCode: "external-reference-ambiguous",
        },
        {
          ...brokenFinding("f-external", "target-y"),
          status: "external-context-not-loaded",
          reasonCode: "external-context-not-loaded",
          referencedPageId: "page-b",
          referencedLayerId: "layer-b",
        },
      ],
    });
    const plan = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-ambiguous", "f-external"],
      policy: { allowDetachBrokenTerminals: true },
    });

    expect(plan.outcome).toBe("manual-review");
    expect(plan.proposals.map((proposal) => proposal.proposalType)).toEqual([
      "load-external-context",
      "manual-review",
    ]);
  });

  it("does not delete orphans by default and allows delete only with explicit policy", () => {
    const analysis = analysisResult();
    const conservative = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-orphan"],
    });
    const retain = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-orphan"],
      policy: { orphanDefaultAction: "retain" },
    });
    const deletion = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-orphan"],
      policy: { allowDeleteConfirmedOrphans: true },
    });
    const possible = planStructuralChanges({
      analysis: analysisResult({
        findings: [
          {
            ...orphanFinding("f-possible"),
            status: "possible-orphan",
            confidence: "incomplete",
          },
        ],
      }),
      selectedFindingIds: ["f-possible"],
      policy: { allowDeleteConfirmedOrphans: true },
    });

    expect(conservative.proposals[0]?.proposalType).toBe("manual-review");
    expect(retain.proposals[0]?.proposalType).toBe("retain-orphan-element");
    expect(deletion.proposals[0]?.proposalType).toBe("delete-orphan-element");
    expect(possible.proposals[0]?.proposalType).toBe("manual-review");
  });

  it("treats cross-layer findings as review or no-op, not errors", () => {
    const analysis = analysisResult();
    const review = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-cross"],
    });
    const noop = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-cross"],
      policy: { crossLayerDefaultAction: "no-op" },
    });

    expect(review.outcome).toBe("manual-review");
    expect(review.proposals[0]?.proposalType).toBe("review-cross-layer-edge");
    expect(noop.outcome).toBe("no-op");
    expect(noop.proposals[0]?.proposalType).toBe("no-op");
    const reconnectWithoutStrategy = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-cross"],
      policy: { allowCrossLayerReconnect: true },
    });
    expect(reconnectWithoutStrategy.outcome).toBe("manual-review");
    expect(reconnectWithoutStrategy.proposals[0]).toMatchObject({
      proposalType: "manual-review",
      operation: { operationType: "review" },
      rationaleCode: "cross-layer-reconnect-strategy-missing",
    });
  });

  it("blocks destructive policies on partial, truncated and unknown coverage", () => {
    for (const completeness of ["partial", "truncated", "unknown"] as const) {
      const plan = planStructuralChanges({
        analysis: analysisResult({ completeness }),
        selectedFindingIds: ["f-orphan"],
        policy: { allowDeleteConfirmedOrphans: true },
      });
      expect(plan.proposals[0]?.proposalType).toBe("manual-review");
      expect(plan.proposals[0]?.riskFlags).toContain("requires-review");
    }
    expect(
      planStructuralChanges({
        analysis: analysisResult(),
        selectedFindingIds: ["f-orphan"],
        policy: { requireCompleteDocument: true },
      }).outcome,
    ).toBe("insufficient-coverage");
  });
});

describe("structural change plan conflicts and purity", () => {
  it("deduplicates exact repeated findings without changing output", () => {
    const analysis = analysisResult();
    const plan = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-broken-target", "f-broken-target"],
      policy: { allowDetachBrokenTerminals: true },
    });

    expect(plan.proposalCount).toBe(1);
    expect(plan.selectedFindingIds).toEqual(["f-broken-target"]);
  });

  it("detects conflicting terminal proposals deterministically", () => {
    const analysis = analysisResult({
      findings: [
        brokenFinding("f-source", "missing-source", "source"),
        brokenFinding("f-target", "missing-target", "source"),
      ],
    });

    const plan = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-target", "f-source"],
      policy: { allowDetachBrokenTerminals: true },
    });

    expect(plan.outcome).toBe("conflict");
    expect(plan.conflicts[0]).toMatchObject({
      conflictType: "same-terminal",
      resolution: "manual-review",
    });
    expect(plan.conflicts[0]?.conflictId.startsWith("m11-conflict-")).toBe(
      true,
    );
  });

  it("is JSON-compatible and does not mutate frozen inputs", () => {
    const analysis = deepFreeze(analysisResult());
    const policy = deepFreeze({
      allowDetachBrokenTerminals: true,
    } satisfies StructuralChangePlanPolicy);
    const ids = deepFreeze(["f-broken-target"]);

    const first = planStructuralChanges({
      analysis,
      selectedFindingIds: ids,
      policy,
    });
    const second = planStructuralChanges({
      analysis,
      selectedFindingIds: ids,
      policy,
    });

    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(second).toEqual(first);
    first.selectedFindingIds.slice().reverse();
    expect(
      planStructuralChanges({ analysis, selectedFindingIds: ids, policy }),
    ).toEqual(first);
  });

  it("keeps operations non-executable and output detached from later input mutation", () => {
    const analysis = analysisResult();
    const plan = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-broken-target", "f-orphan", "f-cross"],
      policy: { allowDetachBrokenTerminals: true },
    });
    const encoded = JSON.stringify(plan);

    expect(JSON.parse(encoded)).toEqual(plan);
    for (const proposal of plan.proposals) {
      expect(jsonCompatible(proposal.operation)).toBe(true);
      expect(JSON.stringify(proposal.operation)).not.toMatch(
        /function|script|command|xml|mxGraphModel|eval|callback|selector|payload|path|url/i,
      );
    }

    (analysis.findings as StructuralFinding[]).length = 0;
    expect(plan.selectedFindingIds).toEqual([
      "f-broken-target",
      "f-cross",
      "f-orphan",
    ]);
    expect(plan.proposalCount).toBe(3);
  });
});

function analysisResult(
  options: {
    readonly completeness?: StructuralAnalysisResult["completeness"];
    readonly documentId?: string;
    readonly documentRevision?: string;
    readonly findings?: readonly StructuralFinding[];
  } = {},
): StructuralAnalysisResult {
  const completeness = options.completeness ?? "complete-target-scopes";
  const documentId = options.documentId ?? "doc-1";
  return {
    analysisVersion: "cyberdraw.structural-analysis.v1",
    documentId,
    revisionEvidence: {
      documentId,
      contentRevisions: ["content-1"],
      documentRevisions: options.documentRevision
        ? [options.documentRevision]
        : ["rev-1"],
      revisionCompatible: completeness !== "stale",
    },
    coverage: {
      document: completeness === "complete-document",
      pageIds: ["page-a"],
      layerTargets: [{ pageId: "page-a", layerIds: ["layer-a", "layer-b"] }],
      conclusive:
        completeness === "complete-document" ||
        completeness === "complete-target-scopes",
      truncated: completeness === "truncated",
      stale: completeness === "stale",
      completeness,
    },
    counts: {
      pageCount: { value: 1, basis: "observed" },
      layerCount: { value: 2, basis: "observed" },
      elementCount: { value: 4, basis: "observed" },
      nodeCount: { value: 2, basis: "observed" },
      edgeCount: { value: 2, basis: "observed" },
      connectedNodeCount: { value: 2, basis: "observed" },
      orphanElementCount: { value: 1, basis: "observed" },
      brokenReferenceCount: { value: 1, basis: "observed" },
      crossLayerEdgeCount: { value: 1, basis: "observed" },
      unresolvedExternalReferenceCount: { value: 0, basis: "observed" },
      contextOnlyElementCount: { value: 0, basis: "observed" },
    },
    findings: options.findings ?? [
      brokenFinding("f-broken-target", "missing-terminal"),
      crossFinding(),
      orphanFinding("f-orphan"),
    ],
    diagnostics: [{ code: "external-context-required", severity: "warn" }],
    limitations: ["complete target scopes, not complete document"],
    completeness,
    stopReason: "intent-satisfied",
    limits: { measuredBytes: 1234 },
  };
}

function brokenFinding(
  findingId: string,
  referencedElementId: string,
  terminal: "source" | "target" = "target",
): Extract<StructuralFinding, { findingType: "broken-reference" }> {
  return {
    findingId,
    findingType: "broken-reference",
    referenceType: terminal,
    status: "broken",
    sourceElementId: "edge-broken",
    referencedElementId,
    pageId: "page-a",
    layerId: "layer-a",
    reasonCode:
      terminal === "target" ? "missing_edge_target" : "missing_edge_source",
    coverage: {
      completeness: "complete-target-scopes",
      document: false,
      pageCovered: true,
      layerCovered: true,
      conclusive: true,
    },
    confidence: "confirmed",
    provenance: { kind: "fixture", documentId: "doc-1", pageId: "page-a" },
  };
}

function crossFinding(): Extract<
  StructuralFinding,
  { findingType: "cross-layer-edge" }
> {
  return {
    findingId: "f-cross",
    findingType: "cross-layer-edge",
    edgeId: "edge-cross",
    sourceElementId: "source-a",
    targetElementId: "target-b",
    sourcePageId: "page-a",
    sourceLayerId: "layer-a",
    targetPageId: "page-a",
    targetLayerId: "layer-b",
    relationClassification: "same-page-cross-layer",
    reasonCode: "same-page-different-layer",
    coverage: {
      completeness: "complete-target-scopes",
      document: false,
      pageCovered: true,
      layerCovered: true,
      conclusive: true,
    },
    confidence: "confirmed",
    provenance: { kind: "fixture", documentId: "doc-1", pageId: "page-a" },
  };
}

function orphanFinding(
  findingId: string,
): Extract<StructuralFinding, { findingType: "orphan-element" }> {
  return {
    findingId,
    findingType: "orphan-element",
    status: "confirmed-orphan",
    elementId: "orphan-a",
    pageId: "page-a",
    layerId: "layer-a",
    reasonCode: "no-structural-relations",
    coverage: {
      completeness: "complete-target-scopes",
      document: false,
      pageCovered: true,
      layerCovered: true,
      conclusive: true,
    },
    confidence: "confirmed",
    provenance: { kind: "fixture", documentId: "doc-1", pageId: "page-a" },
  };
}

function queryResult(
  analysis: StructuralAnalysisResult,
  findings: readonly StructuralFinding[],
): StructuralAnalysisQueryResult {
  return {
    queryVersion: "cyberdraw.structural-query.v1",
    analysisVersion: analysis.analysisVersion,
    documentId: analysis.documentId,
    revisionEvidence: analysis.revisionEvidence,
    kind: "list-findings",
    outcome: "ok",
    results: findings,
    totalMatched: findings.length,
    returned: findings.length,
    offset: 0,
    limit: 100,
    hasMore: false,
    ordering: "canonical",
    coverage: analysis.coverage,
    completeness: analysis.completeness,
    analysisDiagnostics: analysis.diagnostics,
    limitations: analysis.limitations,
    queryDiagnostics: [],
    stopReason: analysis.stopReason,
  };
}

function jsonCompatible(value: unknown, seen = new Set<unknown>()): boolean {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") {
    return Number.isSafeInteger(value) || Number.isFinite(value);
  }
  if (
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "bigint" ||
    value === undefined
  ) {
    return false;
  }
  if (typeof value !== "object") {
    return false;
  }
  if (seen.has(value)) {
    return false;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.every((entry) => jsonCompatible(entry, seen));
  }
  const allowedOperationKeys = new Set([
    "operationType",
    "target",
    "edgeId",
    "terminal",
    "elementId",
    "pageId",
    "layerId",
    "referencedElementId",
  ]);
  for (const key of Object.keys(value)) {
    if (!allowedOperationKeys.has(key) || /script|command|callback|path|url/i.test(key)) {
      return false;
    }
    if (!jsonCompatible((value as Record<string, unknown>)[key], seen)) {
      return false;
    }
  }
  seen.delete(value);
  return true;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const entry of Object.values(value)) {
      deepFreeze(entry);
    }
  }
  return value;
}
