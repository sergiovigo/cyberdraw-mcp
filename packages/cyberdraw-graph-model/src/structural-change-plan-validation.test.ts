import { describe, expect, it } from "@jest/globals";

import {
  planStructuralChanges,
  type StructuralChangePlan,
  type StructuralChangePlanPolicy,
  type StructuralChangeProposal,
  type StructuralPlanConflict,
} from "./structural-change-plan.js";
import {
  validateStructuralChangePlan,
  type StructuralChangePlanValidationInput,
  type StructuralChangePlanValidationOutcome,
} from "./structural-change-plan-validation.js";
import type {
  StructuralAnalysisResult,
  StructuralFinding,
} from "./structural-analysis.js";
import type { StructuralAnalysisQueryResult } from "./structural-query.js";

describe("structural change plan validation input and limits", () => {
  it("rejects empty input, unknown mode, unknown fields and unsafe JSON", () => {
    const valid = validInput();
    const cases = [
      validateStructuralChangePlan({} as never),
      validateStructuralChangePlan({ ...valid, mode: "open" as never }),
      validateStructuralChangePlan({ ...valid, extra: true } as never),
      validateStructuralChangePlan({
        ...valid,
        plan: { ...valid.plan, extra: true } as never,
      }),
      validateStructuralChangePlan({
        ...valid,
        plan: { ...valid.plan, planId: "x".repeat(600) },
      }),
      validateStructuralChangePlan({
        ...valid,
        limits: { maxPlanBytes: 10 },
      }),
      validateStructuralChangePlan({
        ...valid,
        limits: { maxCanonicalizationDepth: 1 },
      }),
      validateStructuralChangePlan({
        ...valid,
        plan: {
          ...valid.plan,
          selectedFindingCount: Number.NaN,
        } as never,
      }),
      validateStructuralChangePlan(pollutedInput(valid)),
    ];

    expect(cases.map((result) => result.outcome)).toEqual([
      "invalid-input",
      "invalid-input",
      "invalid-input",
      "invalid-input",
      "invalid-input",
      "limit-exceeded",
      "limit-exceeded",
      "invalid-input",
      "invalid-input",
    ]);
    expect(
      (Object.prototype as Record<string, unknown>).polluted,
    ).toBeUndefined();
  });

  it("distinguishes missing query result in full-internal from integrity-only", () => {
    const analysis = analysisResult();
    const query = queryResult(analysis, [analysis.findings[0]!]);
    const plan = planStructuralChanges({
      analysis,
      queryResult: query,
      policy: { allowDetachBrokenTerminals: true },
    });

    expect(
      validateStructuralChangePlan({
        plan,
        analysis,
        mode: "integrity-only",
        expectedPolicy: { allowDetachBrokenTerminals: true },
      }).outcome,
    ).toBe("valid-with-limitations");
    expect(
      validateStructuralChangePlan({
        plan,
        analysis,
        mode: "full-internal",
        expectedPolicy: { allowDetachBrokenTerminals: true },
      }).outcome,
    ).toBe("incompatible-query-result");
  });

  it("does not assert current findings, target existence, revision or coverage in integrity-only", () => {
    const analysis = analysisResult();
    const policy = { allowDetachBrokenTerminals: true };
    const plan = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-broken-target"],
      policy,
    });
    const unrelatedAnalysis = analysisResult({
      documentId: "other-doc",
      findings: [],
      completeness: "truncated",
    });

    const result = validateStructuralChangePlan({
      plan,
      analysis: unrelatedAnalysis,
      expectedPolicy: policy,
      currentRevisionEvidence: { documentRevisions: ["different-revision"] },
      mode: "integrity-only",
    });

    expect(result.outcome).toBe("valid-with-limitations");
    expect(result.documentIdentity.status).toBe("not-verifiable");
    expect(result.revisionStatus).toBe("not-verifiable");
    expect(result.coverageStatus).toBe("not-verifiable");
    expect(result.proposalResults[0]).toMatchObject({
      findingStatus: "not-verifiable",
      targetIdentityStatus: "not-verifiable",
      revisionStatus: "not-verifiable",
      coverageStatus: "not-verifiable",
    });
  });
});

describe("structural change plan validation integrity and tampering", () => {
  it("validates a conservative plan, detach plan and explicit orphan delete plan", () => {
    const analysis = analysisResult();
    const conservative = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-broken-target", "f-cross", "f-orphan"],
    });
    const detach = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-broken-target"],
      policy: { allowDetachBrokenTerminals: true },
    });
    const deletion = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-orphan"],
      policy: { allowDeleteConfirmedOrphans: true },
    });

    expect(validate(conservative, analysis).outcome).toBe(
      "manual-review-required",
    );
    expect(
      validate(detach, analysis, {
        allowDetachBrokenTerminals: true,
      }).outcome,
    ).toBe("valid-with-limitations");
    expect(
      validate(deletion, analysis, {
        allowDeleteConfirmedOrphans: true,
      }).outcome,
    ).toBe("valid-with-limitations");
  });

  const tamperingCases: readonly [
    string,
    (plan: StructuralChangePlan) => StructuralChangePlan,
  ][] = [
    ["planId modified", (plan) => ({ ...plan, planId: "m11-plan-deadbeef" })],
    [
      "proposalId modified",
      (plan) =>
        ({
          ...plan,
          proposals: [
            { ...plan.proposals[0]!, proposalId: "m11-proposal-bad" },
          ],
        }) as unknown as StructuralChangePlan,
    ],
    [
      "conflictId modified",
      (plan) =>
        withConflict(plan, (conflict) => ({
          ...conflict,
          conflictId: "m11-conflict-bad",
        })),
    ],
    [
      "operation modified",
      (plan) =>
        ({
          ...plan,
          proposals: [
            {
              ...plan.proposals[0]!,
              operation: {
                operationType: "remove-edge",
                target: { edgeId: "edge-broken" },
              },
            },
          ],
        }) as unknown as StructuralChangePlan,
    ],
    [
      "target modified",
      (plan) =>
        ({
          ...plan,
          proposals: [
            {
              ...plan.proposals[0]!,
              target: { ...plan.proposals[0]!.target, layerId: "layer-b" },
            },
          ],
        }) as StructuralChangePlan,
    ],
    [
      "sourceFindingIds modified",
      (plan) =>
        ({
          ...plan,
          proposals: [{ ...plan.proposals[0]!, sourceFindingIds: ["f-other"] }],
        }) as StructuralChangePlan,
    ],
    [
      "coverage modified",
      (plan) => ({
        ...plan,
        coverage: { ...plan.coverage, conclusive: false },
      }),
    ],
    ["revision modified", (plan) => ({ ...plan, documentRevision: "rev-x" })],
    ["count modified", (plan) => ({ ...plan, proposalCount: 99 })],
    ["skippedCount modified", (plan) => ({ ...plan, skippedCount: 99 })],
    [
      "summary modified",
      (plan) => ({
        ...plan,
        summary: { ...plan.summary, planned: 99 },
      }),
    ],
    ["outcome modified", (plan) => ({ ...plan, outcome: "no-op" })],
    ["proposal removed", (plan) => ({ ...plan, proposals: [] })],
    [
      "proposal added",
      (plan) =>
        ({
          ...plan,
          proposals: [
            ...plan.proposals,
            { ...plan.proposals[0]!, proposalId: "m11-proposal-added" },
          ],
        }) as StructuralChangePlan,
    ],
    [
      "precondition modified",
      (plan) =>
        ({
          ...plan,
          proposals: [
            {
              ...plan.proposals[0]!,
              preconditions: [
                {
                  code: "finding-still-exists" as const,
                  target: { elementId: "changed" },
                },
              ],
            },
          ],
        }) as StructuralChangePlan,
    ],
    [
      "postcondition modified",
      (plan) =>
        ({
          ...plan,
          proposals: [
            {
              ...plan.proposals[0]!,
              expectedPostconditions: [
                { code: "manual-review-required" as const },
              ],
            },
          ],
        }) as StructuralChangePlan,
    ],
    [
      "rationale modified",
      (plan) =>
        ({
          ...plan,
          proposals: [{ ...plan.proposals[0]!, rationaleCode: "changed" }],
        }) as StructuralChangePlan,
    ],
    [
      "ordering manipulated",
      (plan) =>
        ({
          ...plan,
          selectedFindingIds: ["z-finding", "a-finding"],
          selectedFindingCount: 2,
        }) as StructuralChangePlan,
    ],
  ];

  it.each(tamperingCases)("detects tampering: %s", (_name, mutate) => {
    const analysis = analysisResult();
    const policy = { allowDetachBrokenTerminals: true };
    const plan = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-broken-target"],
      policy,
    });

    expect(validate(mutate(plan), analysis, policy).outcome).toBe(
      "tampered-plan",
    );
  });

  describe("structural change plan validation outcome precedence", () => {
    it.each([
      [
        "invalid input + stale",
        (plan: StructuralChangePlan) =>
          ({ ...plan, extra: true, documentRevision: "rev-x" }) as never,
        "invalid-input",
        undefined,
        undefined,
      ],
      [
        "tampered + stale",
        (plan: StructuralChangePlan) => ({ ...plan, planId: "m11-plan-bad" }),
        "tampered-plan",
        undefined,
        undefined,
      ],
      [
        "incompatible analysis + policy mismatch",
        (plan: StructuralChangePlan) => plan,
        "tampered-plan",
        analysisResult({ documentId: "other-doc" }),
        { name: "review-only" } satisfies StructuralChangePlanPolicy,
      ],
      [
        "conflict + unsupported operation",
        (plan: StructuralChangePlan) =>
          ({
            ...plan,
            proposals: [
              {
                ...plan.proposals[0]!,
                operation: { operationType: "execute", target: {} },
              },
            ],
          }) as unknown as StructuralChangePlan,
        "tampered-plan",
        undefined,
        undefined,
      ],
    ])(
      "%s",
      (
        _name,
        mutate,
        expected,
        analysisOverride?: StructuralAnalysisResult,
        policyOverride?: StructuralChangePlanPolicy,
      ) => {
        const analysis = analysisResult();
        const policy = { allowDetachBrokenTerminals: true };
        const plan = planStructuralChanges({
          analysis,
          selectedFindingIds: ["f-broken-target"],
          policy,
        });
        const result = validateStructuralChangePlan({
          plan: mutate(plan),
          analysis: analysisOverride ?? analysis,
          expectedPolicy: policyOverride ?? policy,
          currentRevisionEvidence: { documentRevisions: ["rev-2"] },
          mode: "analysis-correlated",
        });

        expect(result.outcome).toBe(expected);
      },
    );

    it("prioritizes stale over declared conflicts when the stored plan is intact", () => {
      const analysis = analysisResult({
        findings: [
          brokenFinding("f-source", "missing-source", "source"),
          brokenFinding("f-target", "missing-target", "source"),
        ],
      });
      const policy = { allowDetachBrokenTerminals: true };
      const plan = planStructuralChanges({
        analysis,
        selectedFindingIds: ["f-source", "f-target"],
        policy,
      });

      const result = validateStructuralChangePlan({
        plan,
        analysis,
        expectedPolicy: policy,
        currentRevisionEvidence: { documentRevisions: ["rev-2"] },
        mode: "analysis-correlated",
      });

      expect(plan.conflicts.length).toBeGreaterThan(0);
      expect(result.outcome).toBe("stale-plan");
    });

    it("handles zero, no-op and review-only proposal sets deterministically", () => {
      const analysis = analysisResult();
      const empty = planStructuralChanges({ analysis, selectedFindingIds: [] });
      const noOpAnalysis = analysisResult({
        findings: [
          {
            ...brokenFinding("f-unresolved", "missing-terminal"),
            status: "unresolved",
            reasonCode: "reference-not-proven-broken",
          },
        ],
      });
      const noOp = planStructuralChanges({
        analysis: noOpAnalysis,
        selectedFindingIds: ["f-unresolved"],
      });
      const reviewAnalysis = analysisResult({
        findings: [
          {
            ...brokenFinding("f-ambiguous", "missing-terminal"),
            status: "ambiguous",
            reasonCode: "ambiguous-reference",
          },
        ],
      });
      const review = planStructuralChanges({
        analysis: reviewAnalysis,
        selectedFindingIds: ["f-ambiguous"],
      });

      expect(
        validateStructuralChangePlan({
          plan: empty,
          analysis,
          mode: "integrity-only",
        }).outcome,
      ).toBe("valid-with-limitations");
      expect(
        validateStructuralChangePlan({
          plan: noOp,
          analysis: noOpAnalysis,
          mode: "integrity-only",
        }).outcome,
      ).toBe("valid-with-limitations");
      expect(
        validateStructuralChangePlan({
          plan: review,
          analysis: reviewAnalysis,
          mode: "integrity-only",
        }).outcome,
      ).toBe("manual-review-required");
    });
  });
});

describe("structural change plan validation correlation", () => {
  const correlationCases: readonly [
    string,
    (analysis: StructuralAnalysisResult) => StructuralAnalysisResult,
    StructuralChangePlanValidationOutcome,
    string?,
  ][] = [
    [
      "document mismatch",
      (analysis) => ({
        ...analysis,
        documentId: "doc-2",
      }),
      "incompatible-analysis",
      undefined,
    ],
    ["revision mismatch", (analysis) => analysis, "stale-plan", "rev-2"],
    [
      "analysisVersion mismatch",
      (analysis) =>
        ({
          ...analysis,
          analysisVersion: "cyberdraw.structural-analysis.v2",
        }) as unknown as StructuralAnalysisResult,
      "incompatible-analysis",
      undefined,
    ],
    [
      "finding missing",
      (analysis) => ({
        ...analysis,
        findings: [],
      }),
      "precondition-failed",
      undefined,
    ],
    [
      "finding changed",
      (analysis) => ({
        ...analysis,
        findings: [
          {
            ...analysis.findings[0]!,
            referencedElementId: "changed",
          } as StructuralFinding,
        ],
      }),
      "precondition-failed",
      undefined,
    ],
    [
      "finding moved to another layer",
      (analysis) => ({
        ...analysis,
        findings: [
          {
            ...analysis.findings[0]!,
            layerId: "layer-b",
          } as StructuralFinding,
        ],
      }),
      "precondition-failed",
      undefined,
    ],
    [
      "coverage changed",
      (analysis) => ({
        ...analysis,
        coverage: { ...analysis.coverage, conclusive: false },
      }),
      "incompatible-analysis",
      undefined,
    ],
    [
      "completeness changed",
      (analysis) => ({
        ...analysis,
        completeness: "partial" as const,
      }),
      "incompatible-analysis",
      undefined,
    ],
  ];

  it.each(correlationCases)(
    "%s",
    (_name, mutateAnalysis, outcome, currentRevision) => {
      const analysis = analysisResult();
      const policy = { allowDetachBrokenTerminals: true };
      const plan = planStructuralChanges({
        analysis,
        selectedFindingIds: ["f-broken-target"],
        policy,
      });

      const result = validateStructuralChangePlan({
        plan,
        analysis: mutateAnalysis(analysis),
        expectedPolicy: policy,
        currentRevisionEvidence: currentRevision
          ? { documentRevisions: [currentRevision] }
          : undefined,
        mode: "analysis-correlated",
      });
      expect(result.outcome).toBe(outcome);
    },
  );

  it("blocks incompatible query material and policy mismatch", () => {
    const analysis = analysisResult();
    const query = queryResult(analysis, [analysis.findings[0]!]);
    const plan = planStructuralChanges({
      analysis,
      queryResult: query,
      policy: { allowDetachBrokenTerminals: true },
    });

    expect(
      validateStructuralChangePlan({
        plan,
        analysis,
        queryResult: {
          ...query,
          coverage: { ...query.coverage, conclusive: false },
        },
        expectedPolicy: { allowDetachBrokenTerminals: true },
        mode: "full-internal",
      }).outcome,
    ).toBe("incompatible-query-result");
    expect(
      validateStructuralChangePlan({
        plan,
        analysis,
        queryResult: query,
        expectedPolicy: { name: "review-only" },
        mode: "full-internal",
      }).outcome,
    ).toBe("tampered-plan");
  });

  it.each([
    [
      "query document",
      (query: StructuralAnalysisQueryResult) => ({
        ...query,
        documentId: "other-doc",
      }),
    ],
    [
      "query finding content",
      (query: StructuralAnalysisQueryResult) => ({
        ...query,
        results: [{ ...query.results[0]!, referencedElementId: "changed" }],
      }),
    ],
    [
      "query pagination",
      (query: StructuralAnalysisQueryResult) => ({
        ...query,
        returned: query.returned + 1,
      }),
    ],
    [
      "query ordering",
      (query: StructuralAnalysisQueryResult) => ({
        ...query,
        ordering: "finding-id" as const,
      }),
    ],
    [
      "query diagnostics",
      (query: StructuralAnalysisQueryResult) => ({
        ...query,
        queryDiagnostics: [
          { code: "limit-clamped" as const, severity: "warn" as const },
        ],
      }),
    ],
    [
      "query outcome",
      (query: StructuralAnalysisQueryResult) => ({
        ...query,
        outcome: "insufficient-coverage" as const,
      }),
    ],
  ])("blocks altered M10 material: %s", (_name, mutateQuery) => {
    const analysis = analysisResult();
    const query = queryResult(analysis, [analysis.findings[0]!]);
    const policy = { allowDetachBrokenTerminals: true };
    const plan = planStructuralChanges({
      analysis,
      queryResult: query,
      policy,
    });

    expect(
      validateStructuralChangePlan({
        plan,
        analysis,
        queryResult: mutateQuery(query),
        expectedPolicy: policy,
        mode: "full-internal",
      }).outcome,
    ).toBe("incompatible-query-result");
  });
});

describe("structural change plan validation preconditions, operations and conflicts", () => {
  it.each([
    "detach-terminal",
    "remove-edge",
    "delete-element",
    "retain-element",
    "move-element-to-layer",
    "reconnect-edge",
    "load-external-context",
    "review",
    "no-op",
  ])("accepts closed operation schema: %s", (operationType) => {
    const analysis = analysisResult();
    const proposal = proposalForOperation(operationType);
    const plan = planWithProposal(analysis, proposal);
    const result = validate(plan, analysis, {
      allowDetachBrokenTerminals: true,
      allowRemoveDanglingEdges: true,
      allowDeleteConfirmedOrphans: true,
      allowCrossLayerReconnect: true,
    });

    expect(result.proposalResults[0]?.operationIntegrity).toBe("passed");
  });

  it("rejects unknown preconditions, unknown postconditions and unsupported operations", () => {
    const analysis = analysisResult();
    const policy = { allowDetachBrokenTerminals: true };
    const plan = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-broken-target"],
      policy,
    });

    expect(
      validateStructuralChangePlan({
        plan: {
          ...plan,
          proposals: [
            {
              ...plan.proposals[0]!,
              preconditions: [{ code: "eval" as never }],
            },
          ],
        },
        analysis,
        expectedPolicy: policy,
        mode: "integrity-only",
      }).outcome,
    ).toBe("invalid-input");
    expect(
      validateStructuralChangePlan({
        plan: {
          ...plan,
          proposals: [
            {
              ...plan.proposals[0]!,
              expectedPostconditions: [{ code: "guaranteed" as never }],
            },
          ],
        },
        analysis,
        expectedPolicy: policy,
        mode: "integrity-only",
      }).outcome,
    ).toBe("invalid-input");
    expect(
      validateStructuralChangePlan({
        plan: {
          ...plan,
          proposals: [
            {
              ...plan.proposals[0]!,
              operation: {
                operationType: "execute" as never,
                target: {},
              },
            },
          ],
        },
        analysis,
        expectedPolicy: policy,
        mode: "analysis-correlated",
      }).outcome,
    ).toBe("tampered-plan");
  });

  it("detects missing and invented conflicts", () => {
    const analysis = analysisResult({
      findings: [
        brokenFinding("f-source", "missing-source", "source"),
        brokenFinding("f-target", "missing-target", "source"),
      ],
    });
    const policy = { allowDetachBrokenTerminals: true };
    const conflictPlan = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-source", "f-target"],
      policy,
    });
    const missing = { ...conflictPlan, conflicts: [] };
    const oneProposalPlan = planStructuralChanges({
      analysis: analysisResult(),
      selectedFindingIds: ["f-broken-target"],
      policy,
    });
    const invented = {
      ...oneProposalPlan,
      conflicts: [
        {
          ...conflictPlan.conflicts[0]!,
          proposalIds: [oneProposalPlan.proposals[0]!.proposalId],
        },
      ],
      conflictCount: conflictPlan.conflicts.length,
      summary: {
        planned: 1,
        noOp: 0,
        manualReview: 0,
        blocked: 0,
        conflicts: 1,
      },
    };

    expect(validate(missing, analysis, policy).outcome).toBe("tampered-plan");
    expect(validate(invented, analysisResult(), policy).outcome).toBe(
      "tampered-plan",
    );
  });
});

describe("structural change plan validation purity and deterministic IDs", () => {
  it("does not mutate frozen inputs and returns defensive JSON-compatible copies", () => {
    const analysis = deepFreeze(analysisResult());
    const policy = deepFreeze({
      allowDetachBrokenTerminals: true,
    } satisfies StructuralChangePlanPolicy);
    const plan = deepFreeze(
      planStructuralChanges({
        analysis,
        selectedFindingIds: ["f-broken-target"],
        policy,
      }),
    );
    const query = deepFreeze(queryResult(analysis, [analysis.findings[0]!]));

    const first = validateStructuralChangePlan({
      plan,
      analysis,
      queryResult: query,
      expectedPolicy: policy,
      mode: "analysis-correlated",
    });
    const second = validateStructuralChangePlan({
      plan,
      analysis,
      queryResult: query,
      expectedPolicy: policy,
      mode: "analysis-correlated",
    });

    expect(second).toEqual(first);
    expect(first.validationId).toMatch(/^m12-validation-/);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(JSON.stringify(first)).not.toMatch(
      /source label|<mxGraphModel|\/home\/|localhost|OPENAI|process\.env|command|callback|eval|Function/,
    );
  });

  it("changes validationId for revision, outcome and failed precondition changes", () => {
    const analysis = analysisResult();
    const policy = { allowDetachBrokenTerminals: true };
    const plan = planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-broken-target"],
      policy,
    });
    const validResult = validate(plan, analysis, policy);
    const stale = validateStructuralChangePlan({
      plan,
      analysis,
      expectedPolicy: policy,
      currentRevisionEvidence: { documentRevisions: ["rev-2"] },
      mode: "analysis-correlated",
    });
    const changed = validate(
      plan,
      {
        ...analysis,
        findings: [
          {
            ...analysis.findings[0]!,
            status: "ambiguous",
          } as StructuralFinding,
        ],
      },
      policy,
    );

    expect(
      new Set([
        validResult.validationId,
        stale.validationId,
        changed.validationId,
      ]).size,
    ).toBe(3);
  });
});

function validate(
  plan: StructuralChangePlan,
  analysis: StructuralAnalysisResult,
  expectedPolicy?: StructuralChangePlanPolicy,
): ReturnType<typeof validateStructuralChangePlan> {
  return validateStructuralChangePlan({
    plan,
    analysis,
    expectedPolicy,
    mode: "analysis-correlated",
  });
}

function validInput(): StructuralChangePlanValidationInput {
  const analysis = analysisResult();
  const policy = { allowDetachBrokenTerminals: true };
  return {
    plan: planStructuralChanges({
      analysis,
      selectedFindingIds: ["f-broken-target"],
      policy,
    }),
    analysis,
    expectedPolicy: policy,
    mode: "analysis-correlated",
  };
}

function pollutedInput(
  input: StructuralChangePlanValidationInput,
): StructuralChangePlanValidationInput {
  const polluted = { ...input } as StructuralChangePlanValidationInput;
  Object.defineProperty(polluted, "__proto__", {
    value: { polluted: true },
    enumerable: true,
  });
  return polluted;
}

function withConflict(
  plan: StructuralChangePlan,
  mutate: (conflict: StructuralPlanConflict) => StructuralPlanConflict,
): StructuralChangePlan {
  const analysis = analysisResult({
    findings: [
      brokenFinding("f-source", "missing-source", "source"),
      brokenFinding("f-target", "missing-target", "source"),
    ],
  });
  const conflictPlan = planStructuralChanges({
    analysis,
    selectedFindingIds: ["f-source", "f-target"],
    policy: { allowDetachBrokenTerminals: true },
  });
  return {
    ...plan,
    proposals: conflictPlan.proposals,
    conflicts: [mutate(conflictPlan.conflicts[0]!)],
    conflictCount: 1,
  };
}

function planWithProposal(
  analysis: StructuralAnalysisResult,
  proposal: StructuralChangeProposal,
): StructuralChangePlan {
  const plan = planStructuralChanges({
    analysis,
    selectedFindingIds: ["f-broken-target"],
    policy: { allowDetachBrokenTerminals: true },
  });
  return {
    ...plan,
    proposals: [proposal],
    selectedFindingIds: ["f-broken-target"],
    selectedFindingCount: 1,
    proposalCount: 1,
    conflictCount: 0,
    conflicts: [],
    manualReviewCount: proposal.status === "review-required" ? 1 : 0,
    summary: {
      planned: proposal.status === "proposed" ? 1 : 0,
      noOp: proposal.status === "no-op" ? 1 : 0,
      manualReview: proposal.status === "review-required" ? 1 : 0,
      blocked: proposal.status === "blocked" ? 1 : 0,
      conflicts: 0,
    },
  };
}

function proposalForOperation(
  operationType: string,
  status: StructuralChangeProposal["status"] = "proposed",
): StructuralChangeProposal {
  const analysis = analysisResult();
  const base = planStructuralChanges({
    analysis,
    selectedFindingIds: ["f-broken-target"],
    policy: { allowDetachBrokenTerminals: true },
  }).proposals[0]!;
  const operation =
    operationType === "remove-edge"
      ? { operationType, target: { edgeId: "edge-broken" } }
      : operationType === "delete-element" || operationType === "retain-element"
        ? { operationType, target: { elementId: "edge-broken" } }
        : operationType === "move-element-to-layer"
          ? {
              operationType,
              target: { elementId: "edge-broken", layerId: "layer-a" },
            }
          : operationType === "reconnect-edge"
            ? {
                operationType,
                target: {
                  edgeId: "edge-broken",
                  terminal: "target",
                  elementId: "missing-terminal",
                },
              }
            : operationType === "load-external-context"
              ? {
                  operationType,
                  target: {
                    pageId: "page-a",
                    layerId: "layer-a",
                    referencedElementId: "missing-terminal",
                  },
                }
              : operationType === "review" || operationType === "no-op"
                ? { operationType, target: base.target }
                : {
                    operationType: "detach-terminal",
                    target: { edgeId: "edge-broken", terminal: "target" },
                  };
  return {
    ...base,
    operation: operation as StructuralChangeProposal["operation"],
    proposalId: base.proposalId,
    status,
  };
}

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

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const entry of Object.values(value)) {
      deepFreeze(entry);
    }
  }
  return value;
}
