import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { requestCyberdrawRuntimeSnapshot } from "./cyberdraw-runtime-snapshot.js";
import { create_request_queue } from "./request_queue.js";
import type { BusListener, Context } from "./types.js";
import {
  createRuntimeCapabilities,
  type RuntimeSnapshot,
} from "cyberdraw-runtime-contract";

describe("cyberdraw runtime snapshot internal channel", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("fails immediately when an older plugin peer does not advertise the capability", async () => {
    const sent: unknown[] = [];
    const context = createTestContext({
      sent,
      generate: () => "request-1",
      onReply: () => () => {},
      runtimeCapabilities: null,
    });

    await expect(
      requestCyberdrawRuntimeSnapshot(context, {}, { replyTimeoutMs: 5 }),
    ).rejects.toThrow(
      "does not support cyberdraw.runtimeSnapshot.v1",
    );
    expect(sent).toHaveLength(0);
  });

  it("fails immediately for unsupported capability versions", async () => {
    const sent: unknown[] = [];
    const context = createTestContext({
      sent,
      generate: () => "request-1",
      onReply: () => () => {},
      runtimeCapabilities: {
        contractVersion: 999,
        capabilities: [
          {
            name: "cyberdraw.runtimeSnapshot.v1",
            contractVersion: 999,
            snapshotVersion: 1,
            features: {
              contentRevision: true,
              backgroundPages: true,
              truncationDiagnostics: true,
            },
          },
        ],
      },
    });

    await expect(
      requestCyberdrawRuntimeSnapshot(context, {}, { replyTimeoutMs: 5 }),
    ).rejects.toThrow("does not support cyberdraw.runtimeSnapshot.v1");
    expect(sent).toHaveLength(0);
  });

  it("fails immediately for malformed capabilities", async () => {
    const sent: unknown[] = [];
    const context = createTestContext({
      sent,
      generate: () => "request-1",
      onReply: () => () => {},
      runtimeCapabilities: { capabilities: [{ name: "cyberdraw.runtimeSnapshot.v1" }] },
    });

    await expect(
      requestCyberdrawRuntimeSnapshot(context, {}, { replyTimeoutMs: 5 }),
    ).rejects.toThrow("does not support cyberdraw.runtimeSnapshot.v1");
    expect(sent).toHaveLength(0);
  });

  it("sends to a modern peer with the runtime snapshot capability", async () => {
    const listeners = new Map<string, BusListener<Record<string, unknown>>>();
    const sent: unknown[] = [];
    const context = createTestContext({
      sent,
      generate: () => "request-1",
      onReply: (eventName, listener) => {
        listeners.set(eventName, listener);
        return () => {};
      },
      runtimeCapabilities: createRuntimeCapabilities(),
    });

    const request = requestCyberdrawRuntimeSnapshot(context, {});
    await flushMicrotasks();

    expect(sent[0]).toMatchObject({
      __event: "cyberdraw.runtimeSnapshot.v1",
      __request_id: "request-1",
      target_document: { id: "doc-1" },
    });
    listeners.get("cyberdraw.runtimeSnapshot.v1.request-1")?.({
      __event: "cyberdraw.runtimeSnapshot.v1.request-1",
      success: true,
      result: snapshot(),
    });
    await expect(request).resolves.toMatchObject({
      schemaVersion: "cyberdraw.runtime-snapshot.v1",
    });
  });

  it("ignores a late timed-out reply and resolves the next request by request id", async () => {
    jest.useFakeTimers();
    const listeners = new Map<string, BusListener<Record<string, unknown>>>();
    const sent: unknown[] = [];
    const requestIds = ["request-1", "request-2"];
    const context = createTestContext({
      sent,
      generate: () => requestIds.shift() ?? "unexpected-request",
      onReply: (eventName, listener) => {
        listeners.set(eventName, listener);
        return () => {
          listeners.delete(eventName);
        };
      },
      runtimeCapabilities: createRuntimeCapabilities(),
    });

    const first = requestCyberdrawRuntimeSnapshot(context, {}, { replyTimeoutMs: 25 });
    const firstFailure = expect(first).rejects.toThrow(
      "Timed out waiting for reply to `cyberdraw.runtimeSnapshot.v1` after 25ms",
    );
    await jest.advanceTimersByTimeAsync(25);
    await firstFailure;
    await flushMicrotasks();
    expect(listeners.has("cyberdraw.runtimeSnapshot.v1.request-1")).toBe(false);

    const second = requestCyberdrawRuntimeSnapshot(context, {}, { replyTimeoutMs: 25 });
    await flushMicrotasks();

    listeners.get("cyberdraw.runtimeSnapshot.v1.request-1")?.({
      __event: "cyberdraw.runtimeSnapshot.v1.request-1",
      success: true,
      result: { stale: true },
    });
    listeners.get("cyberdraw.runtimeSnapshot.v1.request-2")?.({
      __event: "cyberdraw.runtimeSnapshot.v1.request-2",
      success: true,
      result: snapshot(),
    });

    await expect(second).resolves.toMatchObject({
      schemaVersion: "cyberdraw.runtime-snapshot.v1",
    });
    expect(sent).toHaveLength(2);
  });

  it("times out when a modern peer advertises support but does not respond", async () => {
    jest.useFakeTimers();
    const sent: unknown[] = [];
    const context = createTestContext({
      sent,
      generate: () => "request-1",
      onReply: () => () => {},
      runtimeCapabilities: createRuntimeCapabilities(),
    });

    const request = requestCyberdrawRuntimeSnapshot(context, {}, { replyTimeoutMs: 25 });
    const failure = expect(request).rejects.toThrow(
      "Timed out waiting for reply to `cyberdraw.runtimeSnapshot.v1` after 25ms",
    );
    await jest.advanceTimersByTimeAsync(25);
    await failure;
    expect(sent).toHaveLength(1);
  });
});

function createTestContext(options: {
  readonly sent: unknown[];
  readonly generate: () => string;
  readonly onReply: (
    eventName: string,
    listener: BusListener<Record<string, unknown>>,
  ) => () => void;
  readonly runtimeCapabilities?: unknown;
}): Context {
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
    id_generator: { generate: options.generate },
    request_queue: create_request_queue({
      debug: () => {},
      log: () => {},
    }),
    document_routing: {
      list_documents: async () => [],
      resolve_target_document: async () => ({
        connection_id: "connection-1",
        target_document: { id: "doc-1" },
        document: {
          id: "doc-1",
          title: null,
          mode: null,
          hash: null,
          file_url: null,
          page_count: 1,
          current_page: null,
        },
        runtime_capabilities:
          "runtimeCapabilities" in options
            ? options.runtimeCapabilities
            : createRuntimeCapabilities(),
      }),
    },
    log: {
      debug: () => {},
      log: () => {},
    },
  };
}

function snapshot(): RuntimeSnapshot {
  return {
    schemaVersion: "cyberdraw.runtime-snapshot.v1",
    contractVersion: 1,
    document: {
      id: "doc-1",
      pageCount: 1,
      capturedAt: "2026-07-16T00:00:00.000Z",
      revisionSignals: {
        documentId: "doc-1",
        pageIds: ["page-1"],
        scope: { kind: "document" },
        complete: true,
        contentRevision: "cyberdraw-content-v1:fnv1a64:0000000000000001",
      },
    },
    pages: [],
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
      approximateJsonBytes: 100,
      measuredJsonBytes: 100,
      softLimitBytes: 12 * 1024 * 1024,
      hardLimitBytes: 16 * 1024 * 1024,
    },
    performance: {
      extractionMs: 1,
      serializationMs: 1,
      approximateJsonBytes: 100,
    },
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}
