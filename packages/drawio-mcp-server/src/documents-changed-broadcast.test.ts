import WebSocket from "ws";

import { createDrawioMcpApp, type DrawioMcpApp } from "./index.js";
import { MemoryLogger } from "./real-environment/logger.js";
import {
  analyzeStructurePublic,
  parseCyberdrawAnalyzeStructureInput,
} from "./tools/cyberdraw-analyze-structure.js";
import {
  createRuntimeCapabilities,
  CYBERDRAW_RUNTIME_SNAPSHOT_EVENT,
  type RuntimeSnapshot,
  type RuntimeSnapshotScope,
} from "cyberdraw-runtime-contract";

const HOST = "127.0.0.1";

type TestDocument = {
  id: string;
  title: string | null;
  mode: string | null;
  hash: string | null;
  file_url: string | null;
  page_count: number;
  current_page: {
    index: number;
    id: string;
    name: string;
    is_current: true;
  } | null;
};

async function waitForMessage(
  ws: WebSocket,
  predicate: (payload: any) => boolean,
  timeoutMs = 2000,
): Promise<any> {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new Error("timeout waiting for matching WebSocket message"));
    }, timeoutMs);

    function onMessage(data: WebSocket.RawData) {
      const text = typeof data === "string" ? data : data.toString();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        return;
      }
      if (predicate(json)) {
        clearTimeout(timer);
        ws.off("message", onMessage);
        resolve(json);
      }
    }

    ws.on("message", onMessage);
  });
}

async function openClient(port: number): Promise<WebSocket> {
  const ws = new WebSocket(`ws://${HOST}:${port}`);
  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
  // Server sends `sync-document-state` on connect; ignore it here.
  return ws;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

function documentState(
  id: string,
  title: string | null,
  pageId = "page-1",
): TestDocument {
  return {
    id,
    title,
    mode: "device",
    hash: null,
    file_url: null,
    page_count: 1,
    current_page: {
      index: 0,
      id: pageId,
      name: "Page-1",
      is_current: true,
    },
  };
}

function sendDocumentState(ws: WebSocket, document: TestDocument) {
  ws.send(
    JSON.stringify({
      __control: "document-state",
      document,
      runtime: createRuntimeCapabilities(),
    }),
  );
}

function installDocumentStateSyncResponder(
  ws: WebSocket,
  activeDocument: { current: TestDocument | null },
) {
  ws.on("message", (data) => {
    const text = typeof data === "string" ? data : data.toString();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return;
    }
    if (json?.__control === "sync-document-state" && activeDocument.current) {
      sendDocumentState(ws, activeDocument.current);
    }
  });
}

function installRuntimeSnapshotResponder(
  ws: WebSocket,
  activeDocument: { current: TestDocument | null },
  runtimeRequests: unknown[],
) {
  ws.on("message", (data) => {
    const text = typeof data === "string" ? data : data.toString();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return;
    }
    if (json?.__event !== CYBERDRAW_RUNTIME_SNAPSHOT_EVENT) {
      return;
    }
    runtimeRequests.push(json);
    if (!activeDocument.current) {
      return;
    }
    ws.send(
      JSON.stringify({
        __event: `${CYBERDRAW_RUNTIME_SNAPSHOT_EVENT}.${json.__request_id}`,
        __request_id: json.__request_id,
        success: true,
        result: runtimeSnapshot(activeDocument.current, json.scope),
      }),
    );
  });
}

function runtimeSnapshot(
  document: TestDocument,
  requestedScope: RuntimeSnapshotScope,
): RuntimeSnapshot {
  const pageId = document.current_page?.id ?? "page-1";
  const layerId = "layer-1";
  const resolvedScope: RuntimeSnapshotScope =
    requestedScope.kind === "selection"
      ? { kind: "selection", pageId }
      : requestedScope;
  const elements =
    requestedScope.kind === "selection"
      ? []
      : [
          {
            id: "cell-1",
            pageId,
            layerId,
            parentId: layerId,
            type: "vertex" as const,
            label: { format: "plain" as const, text: "A" },
          },
        ];
  const pages = [
    {
      id: pageId,
      index: 0,
      name: document.current_page?.name ?? "Page-1",
      visible: true,
      background: false,
      layers: [
        {
          id: layerId,
          name: "Layer 1",
          visible: true,
          locked: false,
          pageId,
          index: 0,
        },
      ],
      elements,
    },
  ];

  return {
    schemaVersion: "cyberdraw.runtime-snapshot.v1",
    contractVersion: 1,
    document: {
      id: document.id,
      title: document.title ?? undefined,
      mode: document.mode ?? undefined,
      pageCount: document.page_count,
      currentPageId: pageId,
      capturedAt: "2026-07-20T00:00:00.000Z",
      revisionSignals: {
        documentId: document.id,
        pageIds: [pageId],
        scope: resolvedScope,
        requestedScope,
        resolvedScope,
        complete: true,
        contentRevision: "cyberdraw-content-v1:fnv1a64:0000000000000001",
        documentRevision: "cyberdraw-content-v1:fnv1a64:0000000000000002",
      },
    },
    scope: {
      requestedScope,
      resolvedScope,
      includedPages: [pageId],
      includedLayers: [{ pageId, layerIds: [layerId] }],
      includedElementCount: elements.length,
      contextElementCount: 0,
      externalReferences: [],
      missingPageIds: [],
      missingLayerIds: [],
      includedContext: false,
      requiresScopeExpansion: false,
      conclusive: true,
    },
    pages,
    diagnostics: [],
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

async function listDocuments(app: DrawioMcpApp) {
  return app.context.document_routing.list_documents();
}

describe("documents-changed broadcast", () => {
  let app: DrawioMcpApp;
  let logger: MemoryLogger;
  let port: number;

  beforeEach(async () => {
    logger = new MemoryLogger();
    app = createDrawioMcpApp({ log: logger });
    const wsServer = await app.startWebSocketServer(0, HOST);
    port = (wsServer.address() as { port: number }).port;
  });

  afterEach(async () => {
    await app.close();
  });

  it("emits documents-changed after inbound document-state", async () => {
    const ws = await openClient(port);
    const received = waitForMessage(
      ws,
      (json) => json?.__control === "documents-changed",
    );
    ws.send(
      JSON.stringify({
        __control: "document-state",
        document: {
          id: "doc-a",
          title: "Alpha",
          mode: "device",
          hash: null,
          file_url: null,
          page_count: 1,
          current_page: {
            index: 0,
            id: "p1",
            name: "Page-1",
            is_current: true,
          },
        },
      }),
    );
    const payload = await received;
    expect(payload.documents).toHaveLength(1);
    expect(payload.documents[0].id).toBe("doc-a");
    expect(payload.documents[0].title).toBe("Alpha");
    ws.close();
  });

  it("emits documents-changed after inbound document-removed", async () => {
    const ws = await openClient(port);
    ws.send(
      JSON.stringify({
        __control: "document-state",
        document: {
          id: "doc-b",
          title: "Beta",
          mode: "device",
          hash: null,
          file_url: null,
          page_count: 1,
          current_page: null,
        },
      }),
    );
    await waitForMessage(
      ws,
      (json) =>
        json?.__control === "documents-changed" && json.documents.length === 1,
    );

    const removed = waitForMessage(
      ws,
      (json) =>
        json?.__control === "documents-changed" && json.documents.length === 0,
    );
    ws.send(
      JSON.stringify({
        __control: "document-removed",
        document_id: "doc-b",
      }),
    );
    const payload = await removed;
    expect(payload.documents).toEqual([]);
    ws.close();
  });

  it("emits documents-changed to remaining clients after peer disconnect", async () => {
    const clientA = await openClient(port);
    const clientB = await openClient(port);

    clientA.send(
      JSON.stringify({
        __control: "document-state",
        document: {
          id: "doc-c",
          title: "Gamma",
          mode: "device",
          hash: null,
          file_url: null,
          page_count: 1,
          current_page: null,
        },
      }),
    );
    await waitForMessage(
      clientB,
      (json) =>
        json?.__control === "documents-changed" && json.documents.length === 1,
    );

    const drained = waitForMessage(
      clientB,
      (json) =>
        json?.__control === "documents-changed" && json.documents.length === 0,
    );
    clientA.close();
    const payload = await drained;
    expect(payload.documents).toEqual([]);
    clientB.close();
  });

  it("replaces the active document within one connection", async () => {
    const ws = await openClient(port);
    const activeDocument = { current: documentState("doc-a", "Alpha") };
    installDocumentStateSyncResponder(ws, activeDocument);

    const first = waitForMessage(
      ws,
      (json) =>
        json?.__control === "documents-changed" &&
        json.documents.length === 1 &&
        json.documents[0].id === "doc-a",
    );
    sendDocumentState(ws, activeDocument.current);
    await first;

    expect((await listDocuments(app)).map((document) => document.id)).toEqual([
      "doc-a",
    ]);

    activeDocument.current = documentState("doc-b", "Beta");
    const replaced = waitForMessage(
      ws,
      (json) =>
        json?.__control === "documents-changed" &&
        json.documents.length === 1 &&
        json.documents[0].id === "doc-b",
    );
    sendDocumentState(ws, activeDocument.current);
    await replaced;

    const documents = await listDocuments(app);
    expect(documents).toHaveLength(1);
    expect(documents[0]?.id).toBe("doc-b");
    expect(documents.map((document) => document.id)).not.toContain("doc-a");
    ws.close();
  });

  it("updates metadata without duplicating repeated document IDs", async () => {
    const ws = await openClient(port);
    const activeDocument = { current: documentState("doc-a", "Alpha") };
    installDocumentStateSyncResponder(ws, activeDocument);

    const first = waitForMessage(
      ws,
      (json) =>
        json?.__control === "documents-changed" &&
        json.documents[0]?.title === "Alpha",
    );
    sendDocumentState(ws, activeDocument.current);
    await first;

    activeDocument.current = documentState("doc-a", "Alpha Updated");
    const updated = waitForMessage(
      ws,
      (json) =>
        json?.__control === "documents-changed" &&
        json.documents.length === 1 &&
        json.documents[0].id === "doc-a" &&
        json.documents[0].title === "Alpha Updated",
    );
    sendDocumentState(ws, activeDocument.current);
    await updated;

    const documents = await listDocuments(app);
    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      id: "doc-a",
      title: "Alpha Updated",
    });
    ws.close();
  });

  it("keeps two connections as legitimate multiple documents", async () => {
    const clientA = await openClient(port);
    const clientB = await openClient(port);
    const activeA = { current: documentState("doc-a", "Alpha") };
    const activeB = { current: documentState("doc-b", "Beta") };
    installDocumentStateSyncResponder(clientA, activeA);
    installDocumentStateSyncResponder(clientB, activeB);

    const twoDocuments = waitForMessage(
      clientA,
      (json) =>
        json?.__control === "documents-changed" && json.documents.length === 2,
    );
    sendDocumentState(clientA, activeA.current);
    sendDocumentState(clientB, activeB.current);
    await twoDocuments;

    const documents = await listDocuments(app);
    expect(documents.map((document) => document.id).sort()).toEqual([
      "doc-a",
      "doc-b",
    ]);
    await expect(
      app.context.document_routing.resolve_target_document({}),
    ).rejects.toThrow("Multiple Draw.io documents are connected");

    clientA.close();
    clientB.close();
  });

  it("resolves explicit targets to their owning connections", async () => {
    const clientA = await openClient(port);
    const clientB = await openClient(port);
    const activeA = { current: documentState("doc-a", "Alpha") };
    const activeB = { current: documentState("doc-b", "Beta") };
    installDocumentStateSyncResponder(clientA, activeA);
    installDocumentStateSyncResponder(clientB, activeB);

    const twoDocuments = waitForMessage(
      clientB,
      (json) =>
        json?.__control === "documents-changed" && json.documents.length === 2,
    );
    sendDocumentState(clientA, activeA.current);
    sendDocumentState(clientB, activeB.current);
    await twoDocuments;

    const resolvedA =
      await app.context.document_routing.resolve_target_document({
        target_document: { id: "doc-a" },
      });
    const resolvedB =
      await app.context.document_routing.resolve_target_document({
        target_document: { id: "doc-b" },
      });

    expect(resolvedA.document.id).toBe("doc-a");
    expect(resolvedB.document.id).toBe("doc-b");
    expect(resolvedA.connection_id).not.toBe(resolvedB.connection_id);

    clientA.close();
    clientB.close();
  });

  it("keeps M13 default analysis on the latest document for one connection", async () => {
    const ws = await openClient(port);
    const activeDocument = {
      current: documentState("doc-a", "Alpha", "m13-page"),
    };
    const runtimeRequests: unknown[] = [];
    installDocumentStateSyncResponder(ws, activeDocument);
    installRuntimeSnapshotResponder(ws, activeDocument, runtimeRequests);

    sendDocumentState(ws, activeDocument.current);
    expect((await listDocuments(app)).map((document) => document.id)).toEqual([
      "doc-a",
    ]);

    activeDocument.current = documentState("doc-b", "Beta", "m13-page");
    const responsePromise = analyzeStructurePublic(
      app.context,
      parseCyberdrawAnalyzeStructureInput({ mode: "analyze" }),
    );

    await flushMicrotasks();
    const response = await responsePromise;

    expect(runtimeRequests).toHaveLength(2);
    expect(
      runtimeRequests.map(
        (request) =>
          (request as { target_document?: { id?: string } }).target_document
            ?.id,
      ),
    ).toEqual(["doc-b", "doc-b"]);
    expect(
      runtimeRequests.map((request) => {
        const scope = (request as { scope: RuntimeSnapshotScope }).scope;
        return scope.kind === "layers"
          ? `layers:${scope.pageId}:${scope.layerIds.join(",")}`
          : scope.kind;
      }),
    ).toEqual(["selection", "layers:m13-page:layer-1"]);
    expect(response.scope.documentScopeUsed).toBe(false);
    expect(response.scope.inspected.document).toBe(false);
    expect(response.safety.mutationInvocations).toBe(0);

    ws.close();
  });

  it("removes the active document and historical IDs when a connection closes", async () => {
    const ws = await openClient(port);
    const activeDocument = { current: documentState("doc-a", "Alpha") };
    installDocumentStateSyncResponder(ws, activeDocument);

    sendDocumentState(ws, activeDocument.current);
    await waitForMessage(
      ws,
      (json) =>
        json?.__control === "documents-changed" && json.documents.length === 1,
    );

    activeDocument.current = documentState("doc-b", "Beta");
    sendDocumentState(ws, activeDocument.current);
    await waitForMessage(
      ws,
      (json) =>
        json?.__control === "documents-changed" &&
        json.documents.length === 1 &&
        json.documents[0].id === "doc-b",
    );

    ws.close();
    await new Promise<void>((resolve) => ws.once("close", () => resolve()));
    expect(await listDocuments(app)).toEqual([]);
  });
});
