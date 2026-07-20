import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  detectCyberdrawContractVersion,
  validateCyberdrawPublicRequest,
} from "./public-contract-model.js";

describe("M14 public contract version detection", () => {
  it.each([
    ["default analyze", { mode: "analyze" }],
    ["query", { mode: "query", query: { findingTypes: ["broken-reference"] } }],
    ["query.operation list", { mode: "query", query: { operation: "list" } }],
    ["plan", { mode: "plan" }],
    ["validate", { mode: "validate" }],
  ])("classifies M13-compatible %s as m13-v1", (_name, input) => {
    expect(detectCyberdrawContractVersion(input)).toBe("m13-v1");
  });

  it.each([
    ["scope.pageIds", { mode: "query", scope: { pageIds: ["page-a"] } }],
    [
      "scope.layerTargets",
      {
        mode: "query",
        scope: { layerTargets: [{ pageId: "page-a", layerIds: ["layer-a"] }] },
      },
    ],
    ["scope.document", { mode: "analyze", scope: { document: true } }],
    ["query.operation count", { mode: "query", query: { operation: "count" } }],
    [
      "query.operation summarize",
      { mode: "query", query: { operation: "summarize" } },
    ],
    [
      "coverageRequirements",
      { mode: "query", coverageRequirements: { nonStale: true } },
    ],
    ["limits", { mode: "query", limits: { maxPages: 2 } }],
  ])(
    "classifies M14 trigger %s as m14-v1 or invalid when rejected",
    (_name, input) => {
      const detected = detectCyberdrawContractVersion(input);
      expect(["m14-v1", "invalid"]).toContain(detected);
    },
  );

  it("does not activate M14 for unknown fields", () => {
    expect(detectCyberdrawContractVersion({ mode: "query", extra: true })).toBe(
      "invalid",
    );
  });

  it("rejects mixed known M14 and unknown fields", () => {
    expect(
      detectCyberdrawContractVersion({
        mode: "query",
        scope: { pageIds: ["page-a"] },
        extra: true,
      }),
    ).toBe("invalid");
  });

  it("distinguishes detected version, rejected request and normalized request", () => {
    expect(
      detectCyberdrawContractVersion({
        mode: "analyze",
        scope: { document: true },
      }),
    ).toBe("m14-v1");
    expect(
      detectCyberdrawContractVersion({
        mode: "query",
        coverageRequirements: "bad",
      }),
    ).toBe("m14-v1");
    expect(
      detectCyberdrawContractVersion({
        mode: "query",
        limits: { maxPages: 0 },
      }),
    ).toBe("m14-v1");
    expect(
      detectCyberdrawContractVersion({
        mode: "plan",
        query: { operation: "count" },
      }),
    ).toBe("invalid");

    const rejected = validateCyberdrawPublicRequest({
      mode: "analyze",
      scope: { document: true },
    });
    expect(rejected.ok).toBe(false);
    expect(rejected.version).toBe("m14-v1");
    expect("request" in rejected).toBe(false);
  });

  it("keeps current M13 fields and options compatible", () => {
    const input = {
      mode: "validate",
      scope: { pageId: "page-a", layerId: "layer-a" },
      expansion: {
        enabled: true,
        maxScopes: 2,
        maxDepth: 1,
        maxBytes: 1024,
      },
      query: {
        findingTypes: ["broken-reference"],
        classifications: ["broken"],
        confidences: ["confirmed"],
        pageIds: ["page-a"],
        layerIds: ["layer-a"],
        findingIds: ["finding-a"],
        order: "page-layer",
        offset: 0,
        limit: 10,
      },
      planning: {
        policy: "review-only",
        selectedFindingIds: ["finding-a"],
      },
      validation: {
        mode: "full-internal",
      },
      response: {
        includeFindings: true,
        includeSummary: true,
        includePlan: true,
        includeValidation: true,
        includeDiagnostics: false,
      },
    };

    expect(detectCyberdrawContractVersion(input)).toBe("m13-v1");
    expect(validateCyberdrawPublicRequest(input).ok).toBe(true);
  });
});

describe("M14 public scope normalization", () => {
  it("normalizes omitted scope as default without activating M14", () => {
    const result = validateCyberdrawPublicRequest({ mode: "analyze" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected accepted request");
    }
    expect(result.version).toBe("m13-v1");
    expect(result.request.normalizedScope).toEqual({ kind: "default" });
  });

  it("normalizes one page and multiple pages deterministically", () => {
    const single = validateCyberdrawPublicRequest({
      mode: "query",
      scope: { pageIds: [" page-b "] },
    });
    const multiple = validateCyberdrawPublicRequest({
      mode: "query",
      scope: { pageIds: ["page-c", "page-a", "page-b"] },
    });

    expect(single.ok).toBe(true);
    expect(multiple.ok).toBe(true);
    if (!single.ok || !multiple.ok) {
      throw new Error("expected accepted requests");
    }
    expect(single.request.normalizedScope).toEqual({
      kind: "page",
      pageTargets: [{ pageId: "page-b" }],
    });
    expect(multiple.request.normalizedScope).toEqual({
      kind: "page",
      pageTargets: [
        { pageId: "page-a" },
        { pageId: "page-b" },
        { pageId: "page-c" },
      ],
    });
  });

  it("normalizes one layer target and multiple layer targets deterministically", () => {
    const result = validateCyberdrawPublicRequest({
      mode: "query",
      scope: {
        layerTargets: [
          { pageId: "page-b", layerIds: ["layer-2", "layer-1"] },
          { pageId: "page-a", layerIds: [" layer-a "] },
        ],
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected accepted request");
    }
    expect(result.request.normalizedScope).toEqual({
      kind: "layer",
      layerTargets: [
        { pageId: "page-a", layerIds: ["layer-a"] },
        { pageId: "page-b", layerIds: ["layer-1", "layer-2"] },
      ],
    });
  });

  it("normalizes mixed page and layer scope when targets do not overlap", () => {
    const result = validateCyberdrawPublicRequest({
      mode: "query",
      scope: {
        pageIds: ["page-a"],
        layerTargets: [{ pageId: "page-b", layerIds: ["layer-1"] }],
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected accepted request");
    }
    expect(result.request.normalizedScope).toEqual({
      kind: "mixed",
      pageTargets: [{ pageId: "page-a" }],
      layerTargets: [{ pageId: "page-b", layerIds: ["layer-1"] }],
    });
  });

  it("rejects duplicate IDs after trim without mutating the input", () => {
    const input = {
      mode: "query",
      scope: {
        pageIds: ["page-b", "page-a", " page-a "],
        layerTargets: [{ pageId: "page-c", layerIds: ["layer-b", "layer-b"] }],
      },
    };
    const before = JSON.stringify(input);
    const result = validateCyberdrawPublicRequest(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(result.ok).toBe(false);
    expect(result.issues.map((entry) => entry.reasonCode)).toContain(
      "duplicate-scope-target",
    );
  });

  it.each([
    [{ mode: "query", scope: { pageIds: [] } }, "empty-scope"],
    [{ mode: "query", scope: { layerTargets: [] } }, "empty-scope"],
    [{ mode: "query", scope: { pageIds: [" "] } }, "empty-scope"],
    [
      {
        mode: "query",
        scope: {
          pageIds: ["page-a"],
          layerTargets: [{ pageId: "page-a", layerIds: ["layer-a"] }],
        },
      },
      "duplicate-scope-target",
    ],
    [
      { mode: "analyze", scope: { document: true } },
      "document-scope-not-supported",
    ],
    [
      {
        mode: "query",
        scope: { document: true, pageIds: ["page-a"] },
      },
      "document-scope-not-supported",
    ],
    [
      {
        mode: "query",
        scope: { pageId: "page-a", pageIds: ["page-b"] },
      },
      "duplicate-scope-target",
    ],
  ])("rejects invalid explicit scope with %s", (input, reasonCode) => {
    const result = validateCyberdrawPublicRequest(input);

    expect(result.ok).toBe(false);
    expect(result.issues.map((entry) => entry.reasonCode)).toContain(
      reasonCode,
    );
  });

  it("treats scope object forms deterministically", () => {
    expect(
      validateCyberdrawPublicRequest({ mode: "query", scope: {} }),
    ).toMatchObject({
      ok: true,
      version: "m13-v1",
    });
    expect(
      validateCyberdrawPublicRequest({
        mode: "query",
        scope: { layerId: "layer-a" },
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateCyberdrawPublicRequest({ mode: "query", scope: null }).ok,
    ).toBe(false);
    expect(
      validateCyberdrawPublicRequest({ mode: "query", scope: [] }).ok,
    ).toBe(false);
  });
});

describe("M14 public query semantics", () => {
  it.each([
    [{ mode: "query", query: { operation: "count" } }, "count"],
    [{ mode: "query", query: { operation: "summarize" } }, "summarize"],
    [{ mode: "query", query: {} }, "list"],
    [{ mode: "query" }, "list"],
    [{ mode: "plan", query: { findingTypes: ["broken-reference"] } }, "plan"],
    [
      { mode: "validate", query: { findingTypes: ["broken-reference"] } },
      "validate",
    ],
  ])("normalizes supported query operation %#", (input, operation) => {
    const result = validateCyberdrawPublicRequest(input);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected accepted request");
    }
    expect(result.request.operation).toBe(operation);
  });

  it.each([
    { mode: "query", query: { operation: "delete" } },
    { mode: "count" },
    { mode: "summarize" },
    { mode: "plan", query: { operation: "count" } },
    { mode: "validate", query: { operation: "summarize" } },
    { mode: "query", query: { operation: "Count" } },
    { mode: "query", query: { operation: " count " } },
  ])("rejects unsupported operation %#", (input) => {
    const result = validateCyberdrawPublicRequest(input);

    expect(result.ok).toBe(false);
    expect(result.issues.map((entry) => entry.reasonCode)).toContain(
      "unsupported-query-operation",
    );
  });

  it("rejects unknown query fields as schema errors", () => {
    const result = validateCyberdrawPublicRequest({
      mode: "query",
      query: { unknown: true },
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ path: ["query", "unknown"] }),
    );
  });

  it("rejects query null and arrays", () => {
    expect(
      validateCyberdrawPublicRequest({ mode: "query", query: null }).ok,
    ).toBe(false);
    expect(
      validateCyberdrawPublicRequest({ mode: "query", query: [] }).ok,
    ).toBe(false);
  });
});

describe("M14 coverage requirement validation", () => {
  it.each([
    { coverageRequirements: { nonStale: true } },
    { coverageRequirements: { completeTargetScopes: true } },
    { coverageRequirements: { nonStale: false, completeTargetScopes: true } },
    { coverageRequirements: { minimum: "nonStale" } },
    { coverageRequirements: { minimum: "completeTargetScopes" } },
  ])("accepts valid coverageRequirements %#", (input) => {
    const result = validateCyberdrawPublicRequest({ mode: "query", ...input });

    expect(result.ok).toBe(true);
  });

  it.each([
    { coverageRequirements: true },
    { coverageRequirements: null },
    { coverageRequirements: [] },
    { coverageRequirements: { nonStale: "true" } },
    { coverageRequirements: { completeTargetScopes: 1 } },
    { coverageRequirements: { minimum: "completeDocument" } },
    { coverageRequirements: { unknown: true } },
  ])("rejects invalid coverageRequirements %#", (input) => {
    const result = validateCyberdrawPublicRequest({ mode: "query", ...input });

    expect(result.ok).toBe(false);
  });

  it("normalizes coverageRequirements in stable order", () => {
    const result = validateCyberdrawPublicRequest({
      mode: "query",
      coverageRequirements: { completeTargetScopes: true, nonStale: true },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected accepted request");
    }
    expect(result.request.coverageRequirements?.minimum).toEqual([
      "completeTargetScopes",
      "nonStale",
    ]);
  });
});

describe("M14 limits validation", () => {
  it.each([
    "maxPages",
    "maxLayers",
    "maxFindings",
    "maxProposals",
    "maxExpansionSteps",
    "maxExecutionTime",
  ] as const)("accepts supported positive integer limit %s", (key) => {
    const result = validateCyberdrawPublicRequest({
      mode: "query",
      limits: { [key]: 1 },
    });

    expect(result.ok).toBe(true);
  });

  it.each([
    { maxPages: 0 },
    { maxPages: -0 },
    { maxPages: -1 },
    { maxPages: 1.5 },
    { maxPages: Number.POSITIVE_INFINITY },
    { maxPages: Number.NaN },
    { maxPages: 1n },
    { maxPages: null },
    { maxPages: "1" },
    { unknown: 1 },
  ])("rejects invalid limit %#", (limits) => {
    const result = validateCyberdrawPublicRequest({ mode: "query", limits });

    expect(result.ok).toBe(false);
  });

  it("leaves unspecified limits undefined and enforces injected absolute caps", () => {
    const unspecified = validateCyberdrawPublicRequest({ mode: "query" });
    const overCap = validateCyberdrawPublicRequest(
      { mode: "query", limits: { maxPages: 3 } },
      { maxPages: 2 },
    );

    expect(unspecified.ok).toBe(true);
    if (!unspecified.ok) {
      throw new Error("expected accepted request");
    }
    expect(unspecified.request.limits).toBeUndefined();
    expect(overCap.ok).toBe(false);
    expect(overCap.issues.map((entry) => entry.reasonCode)).toContain(
      "scope-too-broad",
    );
  });

  it("rejects invalid internal caps deterministically", () => {
    const result = validateCyberdrawPublicRequest(
      { mode: "query", limits: { maxPages: 1 } },
      { maxPages: 0 },
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ path: ["config", "maxPages"] }),
    );
  });
});

describe("M14 public model purity", () => {
  it("is deterministic, repeatable and does not mutate input", () => {
    const input = {
      mode: "query",
      scope: {
        pageIds: ["page-b", "page-a"],
        layerTargets: [{ pageId: "page-c", layerIds: ["layer-2", "layer-1"] }],
      },
      query: { operation: "count" },
      coverageRequirements: { nonStale: true },
      limits: { maxPages: 2 },
    };
    const before = JSON.stringify(input);

    const first = validateCyberdrawPublicRequest(input);
    const second = validateCyberdrawPublicRequest(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(first).toEqual(second);
    expect(detectCyberdrawContractVersion(input)).toBe("m14-v1");
  });

  it("validates frozen inputs and does not retain mutable input references", () => {
    const input = deepFreeze({
      mode: "query",
      scope: {
        pageIds: ["page-b", "page-a"],
        layerTargets: [{ pageId: "page-c", layerIds: ["layer-2", "layer-1"] }],
      },
      query: { operation: "summarize" },
      coverageRequirements: { nonStale: true },
      limits: { maxPages: 3 },
    });

    const result = validateCyberdrawPublicRequest(input);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected accepted request");
    }
    expect(result.request.normalizedScope).toEqual({
      kind: "mixed",
      pageTargets: [{ pageId: "page-a" }, { pageId: "page-b" }],
      layerTargets: [{ pageId: "page-c", layerIds: ["layer-1", "layer-2"] }],
    });
    (input.scope.pageIds as string[]).includes("page-a");
    expect(result.request.normalizedScope).not.toBe(input.scope);
  });

  it("rejects non-plain and accessor objects without invoking getters", () => {
    class RequestClass {
      mode = "query";
    }
    let getterInvoked = false;
    const accessor = {};
    Object.defineProperty(accessor, "mode", {
      enumerable: true,
      get() {
        getterInvoked = true;
        return "query";
      },
    });
    const symbolObject = { mode: "query", [Symbol("x")]: true };

    expect(validateCyberdrawPublicRequest(new Date()).ok).toBe(false);
    expect(validateCyberdrawPublicRequest(new Map()).ok).toBe(false);
    expect(validateCyberdrawPublicRequest(new RequestClass()).ok).toBe(false);
    expect(
      validateCyberdrawPublicRequest(Object.create({ mode: "query" })).ok,
    ).toBe(false);
    expect(validateCyberdrawPublicRequest(accessor).ok).toBe(false);
    expect(getterInvoked).toBe(false);
    expect(validateCyberdrawPublicRequest(symbolObject).ok).toBe(false);
  });

  it("orders issues deterministically for equivalent invalid requests", () => {
    const first = validateCyberdrawPublicRequest({
      mode: "query",
      scope: { pageIds: [], layerTargets: [] },
      limits: { maxPages: 0 },
    });
    const second = validateCyberdrawPublicRequest({
      limits: { maxPages: 0 },
      scope: { layerTargets: [], pageIds: [] },
      mode: "query",
    });

    expect(first).toEqual(second);
  });

  it("does not import runtime, server, planner, analyzer or mutation adapters", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "public-contract-model.ts"),
      "utf8",
    );

    expect(source).not.toContain("drawio-mcp-server");
    expect(source).not.toContain("cyberdraw-runtime-contract");
    expect(source).not.toContain("runtime-snapshot");
    expect(source).not.toContain("structural-analysis");
    expect(source).not.toContain("structural-query");
    expect(source).not.toContain("structural-change-plan");
    expect(source).not.toContain("mutation");
  });
});

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}
