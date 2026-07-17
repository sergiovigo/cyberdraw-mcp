import { describe, expect, it } from "@jest/globals";

import {
  defaultSnapshotPlanLimits,
  planHierarchicalSnapshot,
  scopeKey,
  type DiagramInventory,
  type SnapshotPlanLimits,
} from "./index.js";

describe("hierarchical snapshot planner", () => {
  it("prefers non-empty selection for selection intent", () => {
    const plan = planHierarchicalSnapshot({
      inventory: inventory({ selectionCount: 2 }),
      intent: { kind: "inspect-selection" },
      limits: limits(),
    });

    expect(plan.steps.map((step) => step.requestedScope.kind)).toEqual([
      "selection",
    ]);
    expect(plan.decisions.map((decision) => decision.code)).toContain(
      "selection-preferred",
    );
  });

  it("falls back to visible page for empty selection", () => {
    const plan = planHierarchicalSnapshot({
      inventory: inventory({ selectionCount: 0 }),
      intent: { kind: "inspect-selection" },
      limits: limits(),
    });

    expect(plan.steps[0]?.requestedScope).toEqual({
      kind: "pages",
      pageIds: ["p1"],
    });
    expect(plan.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "selection-empty",
    );
  });

  it("prefers explicit layers and pages", () => {
    const layerPlan = planHierarchicalSnapshot({
      inventory: inventory(),
      intent: {
        kind: "inspect-layers",
        layers: [{ pageId: "p1", layerIds: ["l2", "l1"] }],
      },
      limits: limits(),
    });
    const pagePlan = planHierarchicalSnapshot({
      inventory: inventory(),
      intent: { kind: "inspect-pages", pageIds: ["p2", "p1", "p1"] },
      limits: limits(),
    });

    expect(layerPlan.steps[0]?.requestedScope).toEqual({
      kind: "layers",
      pageId: "p1",
      layerIds: ["l1", "l2"],
    });
    expect(pagePlan.steps[0]?.requestedScope).toEqual({
      kind: "pages",
      pageIds: ["p1", "p2"],
    });
  });

  it("uses visible page default for local analysis", () => {
    const plan = planHierarchicalSnapshot({
      inventory: inventory(),
      intent: { kind: "inspect-visible-page" },
      limits: limits(),
    });

    expect(plan.steps[0]?.reason).toBe("visible-page-default");
  });

  it("uses document only when bounded and rejects document hard-limit risk", () => {
    const bounded = planHierarchicalSnapshot({
      inventory: inventory(),
      intent: { kind: "inspect-document" },
      limits: limits(),
    });
    const large = planHierarchicalSnapshot({
      inventory: inventory({ pageElementCounts: [50_000, 50_000] }),
      intent: { kind: "analyze-structure" },
      limits: limits({ hardSnapshotBytes: 1_000_000 }),
    });

    expect(bounded.steps[0]?.requestedScope).toEqual({ kind: "document" });
    expect(large.steps).toHaveLength(0);
    expect(large.stopReason).toBe("hard-limit-reached");
    expect(large.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "hard-limit-avoidance",
    );
  });

  it("fails safely for complete-document intent with hard-limit risk", () => {
    const plan = planHierarchicalSnapshot({
      inventory: inventory({ pageElementCounts: [50_000, 50_000] }),
      intent: { kind: "inspect-document", requireCompleteDocument: true },
      limits: limits({ hardSnapshotBytes: 1_000_000 }),
    });

    expect(plan.steps).toHaveLength(0);
    expect(plan.stopReason).toBe("hard-limit-reached");
    expect(plan.decisions.map((decision) => decision.code)).not.toContain(
      "document-bounded",
    );
  });

  it("reports incomplete inventory and missing targets", () => {
    const plan = planHierarchicalSnapshot({
      inventory: { ...inventory(), completeness: "partial" },
      intent: { kind: "inspect-pages", pageIds: ["missing"] },
      limits: limits(),
    });

    expect(plan.stopReason).toBe("missing-target");
    expect(plan.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["incomplete-inventory", "missing-target"]),
    );
  });

  it("is deterministic, deduplicates equivalent scopes and has deterministic step ids", () => {
    const input = {
      inventory: inventory(),
      intent: { kind: "inspect-pages" as const, pageIds: ["p2", "p1", "p2"] },
      limits: limits(),
    };

    const first = planHierarchicalSnapshot(input);
    const second = planHierarchicalSnapshot(input);

    expect(first).toEqual(second);
    expect(first.steps).toHaveLength(1);
    expect(first.steps[0]?.id).toBe("step-01-pages-p1-p2");
    expect(scopeKey(first.steps[0]!.requestedScope)).toBe("pages:p1,p2");
  });

  it("honors maximum steps and unsupported scopes", () => {
    const maxSteps = planHierarchicalSnapshot({
      inventory: inventory(),
      intent: { kind: "inspect-pages", pageIds: ["p1", "p2"] },
      limits: limits({ maxPlanSteps: 0 }),
    });
    const unsupported = planHierarchicalSnapshot({
      inventory: inventory(),
      intent: { kind: "inspect-selection" },
      limits: limits(),
      supportedScopes: ["document", "pages"],
    });

    expect(maxSteps.stopReason).toBe("max-steps-reached");
    expect(unsupported.stopReason).toBe("unsupported-scope");
  });

  it("emits structured diagnostics without sensitive labels", () => {
    const plan = planHierarchicalSnapshot({
      inventory: inventory({ pageNames: ["Sensitive Page Name"] }),
      intent: {
        kind: "inspect-layers",
        layers: [{ pageId: "p1", layerIds: ["missing"] }],
      },
      limits: limits(),
    });

    const serialized = JSON.stringify(plan.diagnostics);
    expect(serialized).not.toContain("Sensitive Page Name");
    expect(plan.diagnostics.every((diagnostic) => diagnostic.code)).toBe(true);
  });
});

function limits(overrides: Partial<SnapshotPlanLimits> = {}) {
  return defaultSnapshotPlanLimits({
    softSnapshotBytes: 12_000_000,
    hardSnapshotBytes: 16_000_000,
    ...overrides,
  });
}

function inventory(
  options: {
    readonly selectionCount?: number;
    readonly pageElementCounts?: readonly number[];
    readonly pageNames?: readonly string[];
  } = {},
): DiagramInventory {
  const counts = options.pageElementCounts ?? [10, 20];
  return {
    schemaVersion: "cyberdraw.diagram-inventory.v1",
    documentId: "doc-1",
    contentRevision: "rev-1",
    activePageId: "p1",
    completeness: "complete",
    selection: {
      pageId: "p1",
      count: { value: options.selectionCount ?? 1, basis: "observed" },
    },
    pages: counts.map((count, index) => ({
      id: `p${index + 1}`,
      name: options.pageNames?.[index],
      order: index,
      active: index === 0,
      approximateElementCount: { value: count, basis: "observed" },
      layers: [
        {
          id: "l1",
          order: 0,
          visible: true,
          locked: false,
          approximateElementCount: {
            value: Math.ceil(count / 2),
            basis: "observed",
          },
        },
        {
          id: "l2",
          order: 1,
          visible: true,
          locked: false,
          approximateElementCount: {
            value: Math.floor(count / 2),
            basis: "observed",
          },
        },
      ],
    })),
    diagnostics: [],
  };
}
