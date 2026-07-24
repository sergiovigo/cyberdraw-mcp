import { describe, expect, it, jest } from "@jest/globals";

import type { BusListener, Context } from "../types.js";
import { registerImportMermaidTool } from "./import-mermaid.js";

describe("import-mermaid public boundary", () => {
  it("does not forward public filename or arbitrary extras to the plugin", async () => {
    const sent: Record<string, unknown>[] = [];
    const listeners = new Map<string, BusListener<Record<string, unknown>>>();
    const server = { tool: jest.fn() };
    const context = createContext(sent, listeners);

    registerImportMermaidTool(server as never, context);

    const handler = server.tool.mock.calls[0]?.[3] as (
      args: Record<string, unknown>,
      extra: unknown,
    ) => Promise<unknown>;
    const responsePromise = handler(
      {
        mermaid_source: "flowchart LR\n  A --> B",
        mode: "native",
        insert_mode: "new-page",
        filename: "Public Filename Probe",
        extra_field: "should not cross",
      },
      {},
    );

    await waitForSent(sent, 1);
    expect(sent[0]).toMatchObject({
      __event: "import-mermaid",
      mermaid_source: "flowchart LR\n  A --> B",
      mode: "native",
      insert_mode: "new-page",
      target_document: { id: "doc-1" },
      __target_connection_id: "conn-1",
    });
    expect(sent[0]).not.toHaveProperty("filename");
    expect(sent[0]).not.toHaveProperty("extra_field");

    listeners.get("import-mermaid.request-1")?.({
      __event: "import-mermaid.request-1",
      success: true,
      result: { success: true },
    });
    await expect(responsePromise).resolves.toMatchObject({
      content: [expect.objectContaining({ type: "text" })],
    });
  });

  it("keeps filename out of the public schema", () => {
    const server = { tool: jest.fn() };

    registerImportMermaidTool(server as never, createContext([], new Map()));

    const schema = server.tool.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(schema).toHaveProperty("mermaid_source");
    expect(schema).toHaveProperty("target_page");
    expect(schema).not.toHaveProperty("filename");
  });
});

function createContext(
  sent: Record<string, unknown>[],
  listeners: Map<string, BusListener<Record<string, unknown>>>,
): Context {
  return {
    bus: {
      send_to_extension: (message) => {
        sent.push(message as Record<string, unknown>);
      },
      on_reply_from_extension: (eventName, listener) => {
        listeners.set(
          eventName,
          listener as BusListener<Record<string, unknown>>,
        );
        return () => listeners.delete(eventName);
      },
    },
    id_generator: { generate: () => "request-1" },
    request_queue: {
      enqueue: async <T>(_: string, task: () => Promise<T>) => task(),
    },
    document_routing: {
      list_documents: async () => [],
      resolve_target_document: async () => ({
        connection_id: "conn-1",
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

async function waitForSent(
  sent: readonly Record<string, unknown>[],
  count: number,
) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (sent.length >= count) {
      return;
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error(`Expected ${count} sent messages, received ${sent.length}`);
}
