import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "@jest/globals";

import { createDrawioMcpApp, type DrawioMcpApp } from "../index.js";
import { create_request_queue } from "../request_queue.js";
import type { BusListener, Context } from "../types.js";
import {
  analyzeStructurePublic,
  assertNoMutationInvocations,
  parseCyberdrawAnalyzeStructureInput,
  type PublicM14StructuralResponse,
  TOOL_cyberdraw_analyze_structure,
} from "./cyberdraw-analyze-structure.js";
import { defaultConfig } from "../config.js";
import { MemoryLogger } from "../real-environment/logger.js";
import {
  createRuntimeCapabilities,
  type RuntimeSnapshot,
  type RuntimeSnapshotScope,
} from "cyberdraw-runtime-contract";

type TestInventoryKind = "default" | "no-visible-layer" | "stale" | "truncated";

describe("cyberdraw_analyze_structure public tool", () => {
  it("accepts the minimal request and applies safe defaults", () => {
    expect(parseCyberdrawAnalyzeStructureInput({})).toMatchObject({
      mode: "analyze",
      expansion: {
        enabled: true,
        maxScopes: 4,
        maxDepth: 2,
        maxBytes: 2 * 1024 * 1024,
      },
      response: {
        includeFindings: true,
        includeSummary: true,
        includePlan: true,
        includeValidation: true,
        includeDiagnostics: false,
      },
    });
  });

  it("rejects unknown modes, unknown fields and incompatible combinations", () => {
    expect(() =>
      parseCyberdrawAnalyzeStructureInput({ mode: "execute" }),
    ).toThrow();
    expect(() =>
      parseCyberdrawAnalyzeStructureInput({ mode: "analyze", query: {} }),
    ).toThrow();
    expect(() =>
      parseCyberdrawAnalyzeStructureInput({
        mode: "query",
        planning: { policy: "conservative" },
      }),
    ).toThrow();
    expect(() =>
      parseCyberdrawAnalyzeStructureInput({
        mode: "plan",
        validation: { mode: "full-internal" },
      }),
    ).toThrow();
    expect(() =>
      parseCyberdrawAnalyzeStructureInput({ mode: "analyze", extra: true }),
    ).toThrow();
  });

  it("rejects unsafe public input shapes", () => {
    const nullPrototype = Object.create(null);
    expect(() => parseCyberdrawAnalyzeStructureInput(nullPrototype)).toThrow();
    const inherited = Object.create({ inherited: true });
    inherited.mode = "analyze";
    expect(() => parseCyberdrawAnalyzeStructureInput(inherited)).toThrow();
    expect(() =>
      parseCyberdrawAnalyzeStructureInput({
        scope: { layerId: "layer-without-page" },
      }),
    ).toThrow();
    expect(() =>
      parseCyberdrawAnalyzeStructureInput({
        scope: { pageId: "<mxGraphModel />" },
      }),
    ).toThrow();
    expect(() =>
      parseCyberdrawAnalyzeStructureInput({
        scope: { pageId: "https://example.test/diagram" },
      }),
    ).toThrow();
    expect(() =>
      parseCyberdrawAnalyzeStructureInput({
        scope: { pageId: "/tmp/diagram.drawio" },
      }),
    ).toThrow();
    expect(() =>
      parseCyberdrawAnalyzeStructureInput({
        query: { pageIds: Array.from({ length: 51 }, (_, i) => `p${i}`) },
      }),
    ).toThrow();
    expect(() =>
      parseCyberdrawAnalyzeStructureInput({
        query: { limit: 1.5 },
      }),
    ).toThrow();
    expect(() =>
      parseCyberdrawAnalyzeStructureInput({
        expansion: { maxBytes: Number.MAX_SAFE_INTEGER + 10 },
      }),
    ).toThrow();
    expect(() =>
      parseCyberdrawAnalyzeStructureInput({
        planning: { policy: "allow-run-command" },
      }),
    ).toThrow();
    expect(() =>
      parseCyberdrawAnalyzeStructureInput(
        JSON.parse('{"__proto__":{"polluted":true}}'),
      ),
    ).toThrow();
    expect(
      (Object.prototype as Record<string, unknown>).polluted,
    ).toBeUndefined();
    expect(() =>
      parseCyberdrawAnalyzeStructureInput({
        response: { constructor: "not-allowed" },
      }),
    ).toThrow();
    expect(() =>
      parseCyberdrawAnalyzeStructureInput({
        response: {
          nested: { a: { b: { c: { d: { e: { f: { g: true } } } } } } },
        },
      }),
    ).toThrow();
  });

  it("fails closed if a mutation counter is unexpectedly incremented", () => {
    expect(() =>
      assertNoMutationInvocations({ mutationInvocations: 1 }),
    ).toThrow("read-only invariant violated");
    expect(() =>
      assertNoMutationInvocations({ mutationInvocations: 0 }),
    ).not.toThrow();
  });

  it("runs analyze/query/plan/validate once per required phase and returns public-only data", async () => {
    const analyze = await runPublicMode(
      { mode: "analyze" },
      { scope: { pageId: "m9-page", layerId: "layer-a" } },
    );
    expect(analyze.response.mode).toBe("analyze");
    expect(analyze.response.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "broken-reference",
          classification: "broken",
          referencedElementId: "missing-terminal",
        }),
        expect.objectContaining({
          type: "cross-layer-edge",
          classification: "same-page-cross-layer",
        }),
        expect.objectContaining({
          type: "orphan-element",
          classification: "confirmed-orphan",
        }),
      ]),
    );
    expect(analyze.response.scope.documentScopeUsed).toBe(false);
    expect(analyze.response.scope.expanded).toBe(true);
    expect(analyze.response.safety).toEqual({
      readOnly: true,
      mutationAttempted: false,
      mutationInvocations: 0,
    });
    expect(sentScopes(analyze.sent)).toEqual([
      "layers:m9-page:layer-a",
      "layers:m9-page:layer-a",
      "layers:m9-page:layer-b",
    ]);

    const query = await runPublicMode(
      {
        mode: "query",
        query: { findingTypes: ["broken-reference"], limit: 10 },
      },
      { scope: { pageId: "m9-page", layerId: "layer-a" } },
    );
    expect(query.response.query).toMatchObject({
      outcome: "ok",
      totalMatched: 1,
      returned: 1,
    });
    expect(sentScopes(query.sent)).toEqual([
      "layers:m9-page:layer-a",
      "layers:m9-page:layer-a",
      "layers:m9-page:layer-b",
    ]);

    const plan = await runPublicMode(
      {
        mode: "plan",
        query: { findingTypes: ["broken-reference"] },
        planning: { policy: "allow-detach-broken-terminal" },
      },
      { scope: { pageId: "m9-page", layerId: "layer-a" } },
    );
    expect(plan.response.plan).toMatchObject({
      executable: false,
      proposalCount: 1,
      proposals: [
        expect.objectContaining({
          executable: false,
          proposalType: "detach-broken-terminal",
          operationType: "detach-terminal",
        }),
      ],
    });

    const validate = await runPublicMode(
      {
        mode: "validate",
        query: { findingTypes: ["broken-reference"] },
        planning: { policy: "allow-detach-broken-terminal" },
        validation: { mode: "full-internal" },
      },
      { scope: { pageId: "m9-page", layerId: "layer-a" } },
    );
    expect(validate.response.validation).toMatchObject({
      outcome: "valid-with-limitations",
      planIntegrity: "valid",
      revisionStatus: "matched",
      coverageStatus: "matched",
    });

    const serialized = JSON.stringify(validate.response);
    expect(serialized).not.toContain("Layer A");
    expect(serialized).not.toContain("<mxGraphModel");
    expect(serialized).not.toContain("graph");
    expect(serialized).not.toContain('operation":{"operationType');
    expect(serialized).not.toContain("provenance");
    expect(serialized).not.toContain("fingerprint");
  });

  it.each([
    ["analyze", { mode: "analyze" }],
    ["query", { mode: "query", query: { findingTypes: ["broken-reference"] } }],
    ["plan", { mode: "plan", query: { findingTypes: ["broken-reference"] } }],
    [
      "validate",
      {
        mode: "validate",
        query: { findingTypes: ["broken-reference"] },
        planning: { policy: "allow-detach-broken-terminal" },
        validation: { mode: "full-internal" },
      },
    ],
  ])("keeps M13 %s requests on m13-v1", async (_name, input) => {
    const result = await runPublicMode(input);

    expect(result.response.version).toBe("m13-v1");
  });

  it.each([
    ["scope.pageIds", { mode: "query", scope: { pageIds: ["m9-page"] } }],
    [
      "scope.layerTargets",
      {
        mode: "query",
        scope: {
          layerTargets: [{ pageId: "m9-page", layerIds: ["layer-a"] }],
        },
      },
    ],
    ["query.operation count", { mode: "query", query: { operation: "count" } }],
    [
      "query.operation summarize",
      { mode: "query", query: { operation: "summarize" } },
    ],
    [
      "coverageRequirements",
      { mode: "query", coverageRequirements: { nonStale: true } },
    ],
    ["limits", { mode: "query", limits: { maxFindings: 10 } }],
  ])("returns m14-v1 for M14 trigger %s", async (_name, input) => {
    const result = await runRawPublicMode(input);

    expect(result.response.version).toBe("m14-v1");
  });

  it("executes M14 pageIds, layerTargets and mixed scopes without broadening", async () => {
    const page = await runRawPublicMode({
      mode: "query",
      scope: { pageIds: ["m9-page"] },
    });
    const layers = await runRawPublicMode({
      mode: "query",
      scope: {
        layerTargets: [{ pageId: "m9-page", layerIds: ["layer-a", "layer-b"] }],
      },
    });
    const mixed = await runRawPublicMode({
      mode: "query",
      scope: {
        pageIds: ["m14-page"],
        layerTargets: [{ pageId: "m9-page", layerIds: ["layer-a"] }],
      },
    });

    expect(page.response).toMatchObject({
      requestedScope: { scopeType: "page", pageIds: ["m9-page"] },
      executedScope: { document: false, pageIds: ["m9-page"] },
    });
    expect(sentScopes(page.sent)).toEqual(["pages:m9-page", "pages:m9-page"]);
    expect(layers.response.executedScope.layerTargets).toEqual([
      { pageId: "m9-page", layerIds: ["layer-a", "layer-b"] },
    ]);
    expect(sentScopes(layers.sent)).toEqual([
      "layers:m9-page:layer-a,layer-b",
      "layers:m9-page:layer-a,layer-b",
    ]);
    expect(mixed.response.executedScope.pageIds).toEqual([
      "m14-page",
      "m9-page",
    ]);
    expect(mixed.response.requestedScope.layerTargets).toEqual([
      { pageId: "m9-page", layerIds: ["layer-a"] },
    ]);
    expect(mixed.response.executedScope.layerTargets).toEqual([
      { pageId: "m9-page", layerIds: ["layer-a"] },
      { pageId: "m9-page", layerIds: ["layer-b"] },
    ]);
    expect(sentScopes(mixed.sent)).toEqual([
      "pages:m14-page,m9-page",
      "pages:m14-page",
      "layers:m9-page:layer-a",
      "layers:m9-page:layer-b",
    ]);
    expect(JSON.stringify(mixed.response)).not.toContain("documentScopeUsed");
  });

  it("rejects M14 document scope before any snapshot request", async () => {
    const { context, sent } = createInteractiveContext();
    const response = await analyzeStructurePublic(context, {
      mode: "analyze",
      scope: { document: true },
    });

    expect(response).toMatchObject({
      version: "m14-v1",
      outcome: "rejected",
      requestedScope: {
        scopeType: "document",
        rejectedReason: "document-scope-not-supported",
      },
      executedScope: { executed: false, pageIds: [], layerTargets: [] },
      safety: {
        readOnly: true,
        mutationAttempted: false,
        mutationInvocations: 0,
      },
    });
    expect(sentScopes(sent)).toEqual([]);
  });

  it("rejects explicit invalid M14 page and layer without partial execution", async () => {
    const page = await runRawPublicMode({
      mode: "query",
      scope: { pageIds: ["missing-page"] },
    });
    const mixedPage = await runRawPublicMode({
      mode: "query",
      scope: { pageIds: ["m9-page", "missing-page"] },
    });
    const layer = await runRawPublicMode({
      mode: "query",
      scope: {
        layerTargets: [{ pageId: "m9-page", layerIds: ["missing-layer"] }],
      },
    });
    const wrongPageLayer = await runRawPublicMode({
      mode: "query",
      scope: {
        layerTargets: [{ pageId: "m14-page", layerIds: ["layer-a"] }],
      },
    });

    expect(page.response).toMatchObject({
      outcome: "rejected",
      limitations: [{ code: "page-not-found" }],
      executedScope: { executed: false },
      revision: {
        documentId: "m9-doc",
        compatible: true,
        contentRevisionCount: 1,
        documentRevisionCount: 1,
      },
    });
    expect(mixedPage.response).toMatchObject({
      outcome: "rejected",
      limitations: [{ code: "page-not-found" }],
      executedScope: { executed: false },
    });
    expect(layer.response).toMatchObject({
      outcome: "rejected",
      limitations: [{ code: "layer-not-found" }],
      executedScope: { executed: false },
    });
    expect(wrongPageLayer.response).toMatchObject({
      outcome: "rejected",
      limitations: [{ code: "layer-not-found" }],
      executedScope: { executed: false },
    });
    expect(sentScopes(page.sent)).toEqual(["pages:missing-page"]);
    expect(sentScopes(mixedPage.sent)).toEqual(["pages:m9-page,missing-page"]);
    expect(sentScopes(layer.sent)).toEqual(["layers:m9-page:missing-layer"]);
    expect(sentScopes(wrongPageLayer.sent)).toEqual([
      "layers:m14-page:layer-a",
    ]);
  });

  it("rejects M14 duplicate, empty and too broad scopes before target execution", async () => {
    const duplicate = await runRawPublicMode({
      mode: "query",
      scope: {
        pageIds: ["m9-page"],
        layerTargets: [{ pageId: "m9-page", layerIds: ["layer-a"] }],
      },
    });
    const empty = await runRawPublicMode({
      mode: "query",
      scope: { pageIds: [] },
    });
    const tooBroad = await runRawPublicMode({
      mode: "query",
      scope: {
        pageIds: Array.from({ length: 9 }, (_, index) => `page-${index}`),
      },
    });

    expect(duplicate.response.limitations).toEqual([
      { code: "duplicate-scope-target" },
    ]);
    expect(empty.response.limitations).toEqual([{ code: "empty-scope" }]);
    expect(tooBroad.response.limitations).toEqual([
      { code: "scope-too-broad" },
    ]);
    expect(sentScopes(duplicate.sent)).toEqual([]);
    expect(sentScopes(empty.sent)).toEqual([]);
    expect(sentScopes(tooBroad.sent)).toEqual([]);
  });

  it("returns sanitized bounded M14 count and summarize results", async () => {
    const count = await runRawPublicMode({
      mode: "query",
      query: { operation: "count" },
      limits: { maxFindings: 10 },
    });
    const summarize = await runRawPublicMode({
      mode: "query",
      query: { operation: "summarize", groupBy: "finding-type" },
    });

    expect(count.response.results).toMatchObject({
      kind: "count",
      totalFindings: expect.any(Number),
      findingsByType: expect.any(Object),
      findingsByClassification: expect.any(Object),
      findingsByConfidence: expect.any(Object),
      scopesInspected: expect.any(Object),
      proposals: 0,
      validationIssues: 0,
    });
    expect(JSON.stringify(count.response.results)).not.toContain("findingId");
    expect(summarize.response.results).toMatchObject({
      kind: "summary",
      groupBy: "finding-type",
      buckets: expect.any(Array),
    });
    const serialized = JSON.stringify(summarize.response);
    expect(serialized).not.toContain("Layer A");
    expect(serialized).not.toContain("<mxGraphModel");
    expect(serialized).not.toContain("snapshot");
    expect(serialized).not.toContain("graph");
  });

  it("applies M14 count filters before aggregation", async () => {
    const count = await runRawPublicMode({
      mode: "query",
      query: {
        operation: "count",
        findingTypes: ["broken-reference"],
      },
      limits: { maxFindings: 10 },
    });

    expect(count.response.results).toMatchObject({
      kind: "count",
      totalFindings: 1,
      findingsByType: { "broken-reference": 1 },
      findingsByClassification: { broken: 1 },
      findingsByConfidence: { confirmed: 1, contextual: 0, incomplete: 0 },
    });
  });

  it("evaluates M14 coverage requirements without implying complete-document coverage", async () => {
    const nonStale = await runRawPublicMode({
      mode: "query",
      scope: { pageIds: ["m9-page"] },
      coverageRequirements: { nonStale: true },
    });
    const completeTargets = await runRawPublicMode({
      mode: "query",
      scope: {
        layerTargets: [{ pageId: "m9-page", layerIds: ["layer-a"] }],
      },
      coverageRequirements: { completeTargetScopes: true },
    });
    const stale = await runRawPublicMode(
      {
        mode: "query",
        scope: { pageIds: ["m9-page"] },
        coverageRequirements: { nonStale: true },
      },
      { inventoryKind: "stale" },
    );
    const truncated = await runRawPublicMode(
      {
        mode: "query",
        scope: { pageIds: ["m9-page"] },
      },
      { inventoryKind: "truncated" },
    );

    expect(nonStale.response.coverage).toMatchObject({
      conclusive: true,
      stale: false,
      completeDocument: "unsupported",
    });
    expect(completeTargets.response.coverage.completeTargetScopes).toBe(true);
    expect(stale.response).toMatchObject({
      outcome: "rejected",
      coverage: { stale: true },
      limitations: expect.arrayContaining([{ code: "stale-coverage" }]),
    });
    expect(truncated.response).toMatchObject({
      outcome: "partial",
      coverage: { truncated: true },
      limitations: expect.arrayContaining([{ code: "result-limit-reached" }]),
    });
  });

  it("returns M14 ambiguous-document rejection before snapshot execution", async () => {
    const { context, sent } = createInteractiveContext({
      resolveTargetDocument: async () => {
        throw new Error("Multiple Draw.io documents are connected");
      },
    });
    const response = await analyzeStructurePublic(context, {
      mode: "query",
      query: { operation: "count" },
    });

    expect(response).toMatchObject({
      version: "m14-v1",
      outcome: "rejected",
      limitations: [{ code: "ambiguous-document" }],
      executedScope: { executed: false },
    });
    expect(sentScopes(sent)).toEqual([]);
  });

  it("rejects M14 default scope when active page is unavailable", async () => {
    const { context, listeners, sent } = createInteractiveContext();
    const responsePromise = analyzeStructurePublic(context, {
      mode: "query",
      coverageRequirements: { nonStale: true },
    });
    await flushMicrotasks();
    reply(
      listeners,
      "request-1",
      m9RuntimeSnapshot("no-active-page", { kind: "selection" }),
    );

    await expect(responsePromise).resolves.toMatchObject({
      version: "m14-v1",
      outcome: "rejected",
      limitations: [{ code: "active-page-unavailable" }],
      executedScope: { executed: false },
    });
    expect(sentScopes(sent)).toEqual(["selection"]);
  });

  it("rejects unsupported query operation forms and unknown fields before runtime", async () => {
    const unsupported = await runRawPublicMode({
      mode: "query",
      query: { operation: "delete" },
    });
    const badGroup = await runRawPublicMode({
      mode: "query",
      query: { operation: "summarize", groupBy: "label" },
    });
    const { context, sent } = createInteractiveContext();

    const countAsMode = await analyzeStructurePublic(context, {
      mode: "count",
    });
    await expect(
      analyzeStructurePublic(context, {
        mode: "query",
        scope: { pageIds: ["m9-page"] },
        extra: true,
      }),
    ).rejects.toThrow("invalid cyberdraw_analyze_structure request");

    expect(countAsMode).toMatchObject({
      version: "m14-v1",
      outcome: "rejected",
      limitations: [{ code: "unsupported-query-operation" }],
    });
    expect(unsupported.response.limitations).toEqual([
      { code: "unsupported-query-operation" },
    ]);
    expect(badGroup.response.limitations).toEqual([
      { code: "unsupported-query-operation" },
    ]);
    expect(sentScopes(unsupported.sent)).toEqual([]);
    expect(sentScopes(badGroup.sent)).toEqual([]);
    expect(sentScopes(sent)).toEqual([]);
  });

  it("rejects invalid M14 inherited controls before runtime", async () => {
    const inputs = [
      {
        mode: "query",
        scope: { pageIds: ["m9-page"] },
        expansion: { unknown: true },
      },
      {
        mode: "query",
        scope: { pageIds: ["m9-page"] },
        query: { pageIds: [1] },
      },
      {
        mode: "query",
        scope: { pageIds: ["m9-page"] },
        limits: { maxPages: 0 },
      },
      {
        mode: "query",
        scope: { pageIds: ["m9-page"] },
        coverageRequirements: { nonStale: "true" },
      },
    ];

    for (const input of inputs) {
      const { context, sent } = createInteractiveContext();
      const response = await analyzeStructurePublic(context, input);

      expect(response).toMatchObject({
        version: "m14-v1",
        outcome: "rejected",
        executedScope: { executed: false },
        safety: {
          readOnly: true,
          mutationAttempted: false,
          mutationInvocations: 0,
        },
      });
      expect(JSON.stringify(response)).not.toContain("findings");
      expect(sentScopes(sent)).toEqual([]);
    }
  });

  it.each([
    ["mode-only", { mode: "analyze" }],
    ["empty", {}],
    ["empty scope object", { scope: {} }],
  ])(
    "defaults %s requests to current page and visible layer",
    async (_, input) => {
      const result = await runPublicMode(input);

      expect(result.response.scope.requested).toMatchObject({
        defaulted: true,
      });
      expect(result.response.scope.inspected.document).toBe(false);
      expect(result.response.scope.inspected.pageIds).toEqual(["m9-page"]);
      expect(result.response.scope.inspected.layerTargets).toEqual([
        { pageId: "m9-page", layerIds: ["layer-a"] },
        { pageId: "m9-page", layerIds: ["layer-b"] },
      ]);
      expect(result.response.scope.documentScopeUsed).toBe(false);
      expect(result.response.scope.expanded).toBe(true);
      expect(result.response.coverage.document).toBe(false);
      expect(result.response.safety.mutationInvocations).toBe(0);
      expect(sentScopes(result.sent)).toEqual([
        "selection",
        "layers:m9-page:layer-a",
        "layers:m9-page:layer-b",
      ]);
      expect(sentScopes(result.sent)).not.toContain("document");
    },
  );

  it("falls back to current page when no visible layer is resolvable", async () => {
    const result = await runPublicMode(
      { mode: "analyze" },
      { inventoryKind: "no-visible-layer" },
    );

    expect(result.response.scope).toMatchObject({
      requested: { defaulted: true },
      inspected: {
        document: false,
        pageIds: ["m9-page"],
        layerTargets: [],
      },
      documentScopeUsed: false,
    });
    expect(result.response.coverage.document).toBe(false);
    expect(sentScopes(result.sent)).toEqual(["selection", "pages:m9-page"]);
    expect(sentScopes(result.sent)).not.toContain("document");
  });

  it.each(["analyze", "query", "plan", "validate"] as const)(
    "%s shares default scope resolution without document fallback",
    async (mode) => {
      const result = await runPublicMode(defaultInputForMode(mode));

      expect(result.response.mode).toBe(mode);
      expect(result.response.scope.documentScopeUsed).toBe(false);
      expect(result.response.scope.inspected.document).toBe(false);
      expect(sentScopes(result.sent)[0]).toBe("selection");
      expect(sentScopes(result.sent)).not.toContain("document");
      expect(result.response.safety.mutationInvocations).toBe(0);
    },
  );

  it("keeps explicit page and layer scopes unchanged", async () => {
    const page = await runPublicMode(
      { mode: "analyze" },
      { scope: { pageId: "m9-page" } },
    );
    const layer = await runPublicMode(
      { mode: "analyze" },
      { scope: { pageId: "m9-page", layerId: "layer-a" } },
    );

    expect(page.response.scope.requested).toMatchObject({
      pageId: "m9-page",
      defaulted: false,
    });
    expect(page.response.scope.inspected).toMatchObject({
      document: false,
      pageIds: ["m9-page"],
      layerTargets: [],
    });
    expect(sentScopes(page.sent)).toEqual(["pages:m9-page", "pages:m9-page"]);

    expect(layer.response.scope.requested).toMatchObject({
      pageId: "m9-page",
      layerId: "layer-a",
      defaulted: false,
    });
    expect(layer.response.scope.inspected.document).toBe(false);
    expect(layer.response.scope.inspected.pageIds).toEqual(["m9-page"]);
    expect(layer.response.scope.inspected.layerTargets).toEqual([
      { pageId: "m9-page", layerIds: ["layer-a"] },
      { pageId: "m9-page", layerIds: ["layer-b"] },
    ]);
    expect(sentScopes(layer.sent)).toEqual([
      "layers:m9-page:layer-a",
      "layers:m9-page:layer-a",
      "layers:m9-page:layer-b",
    ]);
  });

  it("returns a controlled invalid request for an explicit missing page", async () => {
    const result = await runPublicMode(
      { mode: "analyze" },
      { scope: { pageId: "missing-page" } },
    );

    expect(result.response.outcome).toBe("invalid-request");
    expect(result.response.scope.documentScopeUsed).toBe(false);
    expect(result.response.scope.inspected.document).toBe(false);
    expect(sentScopes(result.sent)).toEqual(["pages:missing-page"]);
  });

  it("returns a controlled limited outcome for an explicit missing layer", async () => {
    const result = await runPublicMode(
      { mode: "analyze" },
      { scope: { pageId: "m9-page", layerId: "missing-layer" } },
    );

    expect(result.response.outcome).toBe("ok-with-limitations");
    expect(result.response.limitations).toEqual(
      expect.arrayContaining([
        { code: "analysis-is-scoped-not-complete-document" },
      ]),
    );
    expect(result.response.scope.documentScopeUsed).toBe(false);
    expect(result.response.scope.inspected.document).toBe(false);
    expect(sentScopes(result.sent)).toEqual([
      "layers:m9-page:missing-layer",
      "layers:m9-page:missing-layer",
    ]);
  });

  it("fails closed when a default scope cannot resolve an active page", async () => {
    const { context, listeners, sent } = createInteractiveContext();
    const responsePromise = analyzeStructurePublic(
      context,
      parseCyberdrawAnalyzeStructureInput({ mode: "analyze" }),
    );
    await flushMicrotasks();
    reply(
      listeners,
      "request-1",
      m9RuntimeSnapshot("no-active-page", { kind: "selection" }),
    );

    await expect(responsePromise).rejects.toThrow(
      "default scope could not resolve the active Draw.io page",
    );
    expect(sentScopes(sent)).toEqual(["selection"]);
  });

  it("fails closed when multiple documents make default routing ambiguous", async () => {
    const { context } = createInteractiveContext({
      resolveTargetDocument: async () => {
        throw new Error("Multiple Draw.io documents are connected");
      },
    });

    await expect(
      analyzeStructurePublic(
        context,
        parseCyberdrawAnalyzeStructureInput({ mode: "analyze" }),
      ),
    ).rejects.toThrow("Multiple Draw.io documents are connected");
  });

  it("keeps deterministic public ordering and canonicalizes reordered arrays", async () => {
    const first = await runPublicMode({
      mode: "query",
      query: {
        findingTypes: ["orphan-element", "broken-reference"],
        pageIds: ["m9-page"],
      },
    });
    const second = await runPublicMode({
      mode: "query",
      query: {
        findingTypes: ["broken-reference", "orphan-element"],
        pageIds: ["m9-page"],
      },
    });

    expect(
      first.response.findings?.map((finding) => finding.findingId),
    ).toEqual(second.response.findings?.map((finding) => finding.findingId));
  });

  it("maps structural outcomes to public outcomes", async () => {
    const insufficient = await runPublicMode({
      mode: "query",
      query: { limit: 10 },
      response: { includeFindings: false },
    });
    expect(insufficient.response.outcome).toBe("ok-with-limitations");

    const limited = await runPublicMode({
      mode: "analyze",
      expansion: { enabled: false, maxScopes: 1, maxDepth: 0, maxBytes: 1000 },
    });
    expect(limited.response.outcome).toBe("ok-with-limitations");
    expect(limited.response.limitations).toEqual(
      expect.arrayContaining([{ code: "expansion-disabled" }]),
    );
  });

  it("lists exactly one public M13 tool through MCP tools/list", async () => {
    let app: DrawioMcpApp | undefined;
    try {
      app = createDrawioMcpApp({
        config: { ...defaultConfig(), logger: "console" },
        log: new MemoryLogger(),
      });
      const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();
      const server = app.createMcpServer();
      const client = new Client({ name: "m13-list-test", version: "1.0.0" });

      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);
      const tools = await client.listTools();
      const names = tools.tools.map((tool) => tool.name);
      expect(
        names.filter((name) => name === TOOL_cyberdraw_analyze_structure),
      ).toHaveLength(1);
      const tool = tools.tools.find(
        (entry) => entry.name === TOOL_cyberdraw_analyze_structure,
      );
      expect(tool?.inputSchema.properties).toHaveProperty("mode");
      expect(tool?.inputSchema.properties).not.toHaveProperty(
        "target_document",
      );
      expect(names).not.toEqual(
        expect.arrayContaining([
          "cyberdraw_apply_structure",
          "cyberdraw_mutate_structure",
        ]),
      );
      await client.close();
    } finally {
      await app?.close();
    }
  });

  it("returns controlled MCP errors for invalid schema and unavailable runtime", async () => {
    let app: DrawioMcpApp | undefined;
    try {
      app = createDrawioMcpApp({
        config: { ...defaultConfig(), logger: "console" },
        log: new MemoryLogger(),
      });
      const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();
      const server = app.createMcpServer();
      const client = new Client({ name: "m13-call-test", version: "1.0.0" });

      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);
      const invalid = await client.callTool({
        name: TOOL_cyberdraw_analyze_structure,
        arguments: { mode: "execute" },
      });
      expect(invalid.isError).toBe(true);
      const unavailable = await client.callTool({
        name: TOOL_cyberdraw_analyze_structure,
        arguments: { mode: "analyze" },
      });
      expect(unavailable.isError).toBe(true);
      expect(JSON.stringify(unavailable.content)).toContain(
        "no active Draw.io diagram",
      );
      await client.close();
    } finally {
      await app?.close();
    }
  });

  it("sanitizes raw runtime plugin errors before returning public MCP errors", async () => {
    const { context, listeners } = createInteractiveContext();
    const request = analyzeStructurePublic(context, { mode: "analyze" });
    await flushMicrotasks();
    listeners.get("cyberdraw.runtimeSnapshot.v1.request-1")?.({
      __event: "cyberdraw.runtimeSnapshot.v1.request-1",
      success: false,
      error: {
        message:
          "Error: failed at /home/user/project/file.ts\n<mxGraphModel><mxCell /></mxGraphModel>",
      },
    });

    await expect(request).rejects.toThrow("Runtime snapshot extraction failed");
    await expect(request).rejects.not.toThrow("<mxGraphModel");
    await expect(request).rejects.not.toThrow("/home/user");
  });
});

async function runPublicMode(
  input: Record<string, unknown>,
  options: {
    readonly scope?: { readonly pageId?: string; readonly layerId?: string };
    readonly inventoryKind?: TestInventoryKind;
  } = {},
) {
  const { context, listeners, sent } = createInteractiveContext();
  const parsedInput = parseCyberdrawAnalyzeStructureInput({
    expansion: { maxScopes: 4, maxDepth: 2, maxBytes: 2 * 1024 * 1024 },
    ...(options.scope ? { scope: options.scope } : {}),
    ...input,
  });
  const responsePromise = analyzeStructurePublic(context, parsedInput);
  await driveRuntimeSnapshotReplies(listeners, sent, options.inventoryKind);
  const response = await responsePromise;
  return { response, sent };
}

async function runRawPublicMode(
  input: Record<string, unknown>,
  options: {
    readonly inventoryKind?: TestInventoryKind;
  } = {},
): Promise<{
  readonly response: PublicM14StructuralResponse;
  readonly sent: readonly unknown[];
}> {
  const { context, listeners, sent } = createInteractiveContext();
  const responsePromise = analyzeStructurePublic(
    context,
    input,
  ) as Promise<PublicM14StructuralResponse>;
  await driveRuntimeSnapshotReplies(listeners, sent, options.inventoryKind);
  const response = await responsePromise;
  return { response, sent };
}

async function driveRuntimeSnapshotReplies(
  listeners: ReadonlyMap<string, BusListener<Record<string, unknown>>>,
  sent: readonly unknown[],
  inventoryKind: TestInventoryKind = "default",
) {
  let replied = 0;
  for (;;) {
    await flushMicrotasks();
    const message = sent[replied] as
      | {
          readonly __request_id?: string;
          readonly scope?: RuntimeSnapshotScope;
        }
      | undefined;
    if (!message?.__request_id || !message.scope) {
      if (replied === sent.length) {
        return;
      }
      throw new Error("Runtime snapshot request was not emitted");
    }
    reply(
      listeners,
      message.__request_id,
      m9RuntimeSnapshotForScope(message.scope, inventoryKind, replied),
    );
    replied += 1;
  }
}

function createInteractiveContext(
  options: {
    readonly resolveTargetDocument?: Context["document_routing"]["resolve_target_document"];
  } = {},
) {
  const listeners = new Map<string, BusListener<Record<string, unknown>>>();
  const sent: unknown[] = [];
  const context = createTestContext({
    sent,
    resolveTargetDocument: options.resolveTargetDocument,
    onReply: (eventName, listener) => {
      listeners.set(eventName, listener);
      return () => listeners.delete(eventName);
    },
  });
  return { context, listeners, sent };
}

function reply(
  listeners: ReadonlyMap<string, BusListener<Record<string, unknown>>>,
  requestId: string,
  result: RuntimeSnapshot,
) {
  listeners.get(`cyberdraw.runtimeSnapshot.v1.${requestId}`)?.({
    __event: `cyberdraw.runtimeSnapshot.v1.${requestId}`,
    success: true,
    result,
  });
}

function createTestContext(options: {
  readonly sent: unknown[];
  readonly resolveTargetDocument?: Context["document_routing"]["resolve_target_document"];
  readonly onReply: (
    eventName: string,
    listener: BusListener<Record<string, unknown>>,
  ) => () => void;
}): Context {
  let nextId = 1;
  return {
    bus: {
      send_to_extension: (message) => {
        options.sent.push(message);
      },
      on_reply_from_extension: (eventName, listener) =>
        options.onReply(
          eventName,
          listener as BusListener<Record<string, unknown>>,
        ),
    },
    id_generator: { generate: () => `request-${nextId++}` },
    request_queue: create_request_queue({
      debug: () => {},
      log: () => {},
    }),
    document_routing: {
      list_documents: async () => [],
      resolve_target_document:
        options.resolveTargetDocument ??
        (async () => ({
          connection_id: "connection-1",
          target_document: { id: "m9-doc" },
          document: {
            id: "m9-doc",
            title: null,
            mode: null,
            hash: null,
            file_url: null,
            page_count: 1,
            current_page: null,
          },
          runtime_capabilities: createRuntimeCapabilities(),
        })),
    },
    log: {
      debug: () => {},
      log: () => {},
    },
  };
}

function defaultInputForMode(
  mode: "analyze" | "query" | "plan" | "validate",
): Record<string, unknown> {
  if (mode === "analyze") {
    return { mode };
  }
  if (mode === "query") {
    return {
      mode,
      query: { findingTypes: ["broken-reference"], limit: 10 },
    };
  }
  if (mode === "plan") {
    return {
      mode,
      query: { findingTypes: ["broken-reference"], limit: 10 },
      planning: { policy: "allow-detach-broken-terminal" },
    };
  }
  return {
    mode,
    query: { findingTypes: ["broken-reference"], limit: 10 },
    planning: { policy: "allow-detach-broken-terminal" },
    validation: { mode: "full-internal" },
  };
}

function sentScopes(sent: readonly unknown[]) {
  return sent.map((message) =>
    testScopeKey((message as { readonly scope: RuntimeSnapshotScope }).scope),
  );
}

function testScopeKey(scope: RuntimeSnapshotScope): string {
  if (scope.kind === "pages") {
    return `pages:${scope.pageIds.join(",")}`;
  }
  if (scope.kind === "layers") {
    return `layers:${scope.pageId}:${scope.layerIds.join(",")}`;
  }
  return scope.kind;
}

function m9RuntimeSnapshotForScope(
  requestedScope: RuntimeSnapshotScope,
  inventoryKind: TestInventoryKind = "default",
  requestIndex = 0,
): RuntimeSnapshot {
  const effectiveInventoryKind =
    requestIndex === 0 &&
    (inventoryKind === "stale" || inventoryKind === "truncated")
      ? "default"
      : inventoryKind;
  if (requestedScope.kind === "selection") {
    return m9RuntimeSnapshot(
      "inventory",
      requestedScope,
      effectiveInventoryKind,
    );
  }
  if (requestedScope.kind === "pages") {
    if (requestedScope.pageIds.includes("missing-page")) {
      return m9RuntimeSnapshot("missing-page", requestedScope);
    }
    return m9RuntimeSnapshot("page", requestedScope, effectiveInventoryKind);
  }
  if (requestedScope.kind === "layers") {
    if (requestedScope.layerIds.includes("missing-layer")) {
      return m9RuntimeSnapshot("missing-layer", requestedScope);
    }
    return m9RuntimeSnapshot(
      requestedScope.layerIds.includes("layer-b") ? "context" : "focus",
      requestedScope,
      effectiveInventoryKind,
    );
  }
  throw new Error("unit test must not request document scope by default");
}

function m9RuntimeSnapshot(
  kind:
    | "inventory"
    | "focus"
    | "context"
    | "page"
    | "missing-page"
    | "missing-layer"
    | "no-active-page",
  requestedScope: RuntimeSnapshotScope,
  inventoryKind: TestInventoryKind = "default",
): RuntimeSnapshot {
  const elements: RuntimeSnapshot["pages"][number]["elements"] =
    kind === "inventory" ||
    kind === "missing-page" ||
    kind === "missing-layer" ||
    kind === "no-active-page"
      ? []
      : kind === "focus"
        ? [
            {
              id: "source-a",
              pageId: "m9-page",
              layerId: "layer-a",
              parentId: "layer-a",
              type: "vertex",
              label: { format: "plain", text: "source-a" },
            },
            {
              id: "orphan-a",
              pageId: "m9-page",
              layerId: "layer-a",
              parentId: "layer-a",
              type: "vertex",
            },
            {
              id: "edge-cross",
              pageId: "m9-page",
              layerId: "layer-a",
              parentId: "layer-a",
              sourceId: "source-a",
              targetId: "target-b",
              type: "edge",
            },
            {
              id: "edge-broken",
              pageId: "m9-page",
              layerId: "layer-a",
              parentId: "layer-a",
              sourceId: "source-a",
              targetId: "missing-terminal",
              type: "edge",
            },
          ]
        : kind === "context"
          ? [
              {
                id: "target-b",
                pageId: "m9-page",
                layerId: "layer-b",
                parentId: "layer-b",
                type: "vertex",
              },
            ]
          : [
              {
                id: "source-a",
                pageId: "m9-page",
                layerId: "layer-a",
                parentId: "layer-a",
                type: "vertex",
                label: { format: "plain", text: "source-a" },
              },
              {
                id: "target-b",
                pageId: "m9-page",
                layerId: "layer-b",
                parentId: "layer-b",
                type: "vertex",
              },
            ];
  const resolvedScope: RuntimeSnapshotScope =
    requestedScope.kind === "selection"
      ? { kind: "selection", pageId: "m9-page" }
      : requestedScope;
  const allPages: RuntimeSnapshot["pages"] = [
    {
      id: "m9-page",
      index: 0,
      name: "M9 synthetic",
      visible: true,
      background: false,
      layers: [
        {
          id: "layer-a",
          name: "Layer A",
          visible: inventoryKind === "default",
          locked: false,
          pageId: "m9-page",
          index: 0,
        },
        {
          id: "layer-b",
          name: "Layer B",
          visible: inventoryKind === "default",
          locked: false,
          pageId: "m9-page",
          index: 1,
        },
      ],
      elements,
    },
    {
      id: "m14-page",
      index: 1,
      name: "M14 synthetic",
      visible: true,
      background: false,
      layers: [
        {
          id: "layer-c",
          name: "Layer C",
          visible: true,
          locked: false,
          pageId: "m14-page",
          index: 0,
        },
      ],
      elements:
        requestedScope.kind === "pages" &&
        requestedScope.pageIds.includes("m14-page")
          ? [
              {
                id: "m14-node",
                pageId: "m14-page",
                layerId: "layer-c",
                parentId: "layer-c",
                type: "vertex",
              },
            ]
          : [],
    },
  ];
  const pages =
    kind === "missing-page"
      ? []
      : requestedScope.kind === "pages"
        ? allPages.filter((page) => requestedScope.pageIds.includes(page.id))
        : requestedScope.kind === "layers"
          ? allPages.filter((page) => page.id === requestedScope.pageId)
          : allPages;
  const includedLayers =
    requestedScope.kind === "layers"
      ? [
          {
            pageId: requestedScope.pageId,
            layerIds: kind === "missing-layer" ? [] : requestedScope.layerIds,
          },
        ]
      : requestedScope.kind === "pages" && kind !== "missing-page"
        ? pages.map((page) => ({
            pageId: page.id,
            layerIds: page.layers.map((layer) => layer.id),
          }))
        : requestedScope.kind === "selection"
          ? pages.map((page) => ({
              pageId: page.id,
              layerIds: page.layers.map((layer) => layer.id),
            }))
          : [];
  return {
    schemaVersion: "cyberdraw.runtime-snapshot.v1",
    contractVersion: 1,
    document: {
      id: "m9-doc",
      pageCount: allPages.length,
      currentPageId: kind === "no-active-page" ? undefined : "m9-page",
      capturedAt: "2026-07-17T00:00:00.000Z",
      revisionSignals: {
        documentId: "m9-doc",
        pageIds: pages.map((page) => page.id),
        scope: resolvedScope,
        requestedScope,
        resolvedScope,
        complete: true,
        contentRevision:
          kind === "focus"
            ? "cyberdraw-content-v1:fnv1a64:00000000000000a1"
            : "cyberdraw-content-v1:fnv1a64:00000000000000b1",
        documentRevision:
          inventoryKind === "stale" && kind !== "inventory"
            ? "cyberdraw-content-v1:fnv1a64:0000000000000010"
            : "cyberdraw-content-v1:fnv1a64:0000000000000009",
      },
    },
    scope: {
      requestedScope,
      resolvedScope,
      includedPages: pages.map((page) => page.id),
      includedLayers,
      includedElementCount: elements.length,
      contextElementCount: 0,
      externalReferences:
        kind === "focus"
          ? [
              {
                pageId: "m9-page",
                elementId: "edge-cross",
                referenceType: "target",
                referencedId: "target-b",
                referencedPageId: "m9-page",
                referencedLayerId: "layer-b",
              },
            ]
          : [],
      missingPageIds: kind === "missing-page" ? ["missing-page"] : [],
      missingLayerIds:
        kind === "missing-layer"
          ? [{ pageId: "m9-page", layerIds: ["missing-layer"] }]
          : [],
      includedContext: false,
      requiresScopeExpansion: kind === "focus",
      conclusive: true,
    },
    pages,
    diagnostics:
      kind === "missing-page"
        ? [
            {
              code: "page_not_found",
              message: "Runtime snapshot requested a page that does not exist.",
              pageId: "missing-page",
            },
          ]
        : kind === "missing-layer"
          ? [
              {
                code: "layer_not_found",
                message:
                  "Runtime snapshot requested a layer that does not exist on the resolved page.",
                pageId: "m9-page",
                layerId: "missing-layer",
              },
            ]
          : [],
    completeness:
      inventoryKind === "truncated" && kind !== "inventory"
        ? { status: "partial", reason: "hard-limit" }
        : { status: "complete" },
    truncated: inventoryKind === "truncated" && kind !== "inventory",
    limits: {
      maxPages: 100,
      maxLayersPerPage: 100,
      maxElementsPerPage: 25_000,
      maxLabelLength: 8_192,
      maxStyleLength: 8_192,
      maxMetadataKeys: 64,
      maxMetadataStringLength: 8_192,
      maxRawDepth: 4,
      maxRawKeys: 64,
      maxArrayItems: 1_000,
      softSnapshotBytes: 12 * 1024 * 1024,
      hardSnapshotBytes: 16 * 1024 * 1024,
    },
    payload: {
      approximateJsonBytes: 1_000,
      measuredJsonBytes: 1_000,
      softLimitBytes: 12 * 1024 * 1024,
      hardLimitBytes: 16 * 1024 * 1024,
    },
    performance: {
      extractionMs: 1,
      serializationMs: 1,
      approximateJsonBytes: 1_000,
    },
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}
