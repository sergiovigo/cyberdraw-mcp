import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { requestCyberdrawRuntimeSnapshot } from "./cyberdraw-runtime-snapshot.js";
import { create_request_queue } from "./request_queue.js";
import type { BusListener, Context } from "./types.js";

describe("cyberdraw runtime snapshot internal channel", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("times out when an older plugin peer does not support the internal message", async () => {
    const sent: unknown[] = [];
    const context: Context = {
      bus: {
        send_to_extension: (message) => {
          sent.push(message);
        },
        on_reply_from_extension: () => () => {},
      },
      id_generator: { generate: () => "request-1" },
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
        }),
      },
      log: {
        debug: () => {},
        log: () => {},
      },
    };

    await expect(
      requestCyberdrawRuntimeSnapshot(context, {}, { replyTimeoutMs: 5 }),
    ).rejects.toThrow(
      "Timed out waiting for reply to `cyberdraw.runtimeSnapshot.v1`",
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      __event: "cyberdraw.runtimeSnapshot.v1",
      __request_id: "request-1",
      target_document: { id: "doc-1" },
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
      result: { ok: true },
    });

    await expect(second).resolves.toEqual({ ok: true });
    expect(sent).toHaveLength(2);
  });
});

function createTestContext(options: {
  readonly sent: unknown[];
  readonly generate: () => string;
  readonly onReply: (
    eventName: string,
    listener: BusListener<Record<string, unknown>>,
  ) => () => void;
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
      }),
    },
    log: {
      debug: () => {},
      log: () => {},
    },
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}
