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
  TOOL_cyberdraw_analyze_structure,
} from "./cyberdraw-analyze-structure.js";
import { defaultConfig } from "../config.js";
import { MemoryLogger } from "../real-environment/logger.js";
import {
  createRuntimeCapabilities,
  type RuntimeSnapshot,
  type RuntimeSnapshotScope,
} from "cyberdraw-runtime-contract";

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
});

async function runPublicMode(
  input: Record<string, unknown>,
  options: {
    readonly scope?: { readonly pageId?: string; readonly layerId?: string };
    readonly inventoryKind?: "default" | "no-visible-layer";
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

async function driveRuntimeSnapshotReplies(
  listeners: ReadonlyMap<string, BusListener<Record<string, unknown>>>,
  sent: readonly unknown[],
  inventoryKind: "default" | "no-visible-layer" = "default",
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
      m9RuntimeSnapshotForScope(message.scope, inventoryKind),
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
  inventoryKind: "default" | "no-visible-layer" = "default",
): RuntimeSnapshot {
  if (requestedScope.kind === "selection") {
    return m9RuntimeSnapshot("inventory", requestedScope, inventoryKind);
  }
  if (requestedScope.kind === "pages") {
    if (requestedScope.pageIds.includes("missing-page")) {
      return m9RuntimeSnapshot("missing-page", requestedScope);
    }
    return m9RuntimeSnapshot("page", requestedScope);
  }
  if (requestedScope.kind === "layers") {
    if (requestedScope.layerIds.includes("missing-layer")) {
      return m9RuntimeSnapshot("missing-layer", requestedScope);
    }
    return m9RuntimeSnapshot(
      requestedScope.layerIds.includes("layer-b") ? "context" : "focus",
      requestedScope,
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
  inventoryKind: "default" | "no-visible-layer" = "default",
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
  const includedLayers =
    requestedScope.kind === "layers"
      ? [
          {
            pageId: requestedScope.pageId,
            layerIds: kind === "missing-layer" ? [] : requestedScope.layerIds,
          },
        ]
      : requestedScope.kind === "pages" && kind !== "missing-page"
        ? [
            {
              pageId: "m9-page",
              layerIds: ["layer-a", "layer-b"],
            },
          ]
        : requestedScope.kind === "selection"
          ? [
              {
                pageId: "m9-page",
                layerIds: ["layer-a", "layer-b"],
              },
            ]
          : [];
  const pages =
    kind === "missing-page"
      ? []
      : [
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
        ];
  return {
    schemaVersion: "cyberdraw.runtime-snapshot.v1",
    contractVersion: 1,
    document: {
      id: "m9-doc",
      pageCount: 1,
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
        documentRevision: "cyberdraw-content-v1:fnv1a64:0000000000000009",
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
    completeness: { status: "complete" },
    truncated: false,
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
