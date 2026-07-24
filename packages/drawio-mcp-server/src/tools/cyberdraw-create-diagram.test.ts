import { describe, expect, it, jest } from "@jest/globals";

import type { BusListener, Context } from "../types.js";
import { create_request_queue } from "../request_queue.js";
import {
  createDiagramPublic,
  M15_MAX_MERMAID_BYTES,
  registerCyberdrawCreateDiagramTool,
  TOOL_cyberdraw_create_diagram,
} from "./cyberdraw-create-diagram.js";

const VALID_MERMAID = "flowchart LR\n  User[User] --> WAF[WAF]";

function validRequest(overrides: Record<string, unknown> = {}) {
  return {
    format: "mermaid",
    mermaidType: "flowchart",
    insertMode: "new-page",
    mermaid: VALID_MERMAID,
    limits: { maxBytes: 12000 },
    ...overrides,
  };
}

describe("cyberdraw_create_diagram", () => {
  it("registers the public tool without target_page", () => {
    const server = {
      tool: jest.fn(),
    };

    registerCyberdrawCreateDiagramTool(
      server as never,
      createInteractiveContext().context,
    );

    expect(server.tool).toHaveBeenCalledTimes(1);
    const [name, description, schema] = server.tool.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
      unknown,
    ];
    expect(name).toBe(TOOL_cyberdraw_create_diagram);
    expect(description).toContain("never returns XML");
    expect(Object.keys(schema).sort()).toEqual([
      "format",
      "insertMode",
      "limits",
      "mermaid",
      "mermaidType",
      "target_document",
      "title",
    ]);
    expect(schema).not.toHaveProperty("target_page");
    expect(schema).not.toHaveProperty("filename");
  });

  it("accepts a valid request, delegates once to import-mermaid and returns sanitized m15-v1", async () => {
    const { context, sent, reply, queue } = createInteractiveContext();
    const responsePromise = createDiagramPublic(
      context,
      validRequest({ title: "Web Architecture" }),
    );

    await waitForSent(sent, 1);
    expect(sent[0]).toMatchObject({
      __event: "list-pages",
      target_document: { id: "doc-1" },
      __target_connection_id: "conn-1",
    });
    reply(sent[0], {
      success: true,
      result: [{ id: "page-1", name: "Page 1", is_current: true }],
    });

    await waitForSent(sent, 2);
    expect(sent[1]).toMatchObject({
      __event: "import-mermaid",
      target_document: { id: "doc-1" },
      __target_connection_id: "conn-1",
      mermaid_source: VALID_MERMAID,
      mode: "native",
      insert_mode: "new-page",
      filename: "Web Architecture",
    });
    expect(sent[1]).not.toHaveProperty("target_page");
    reply(sent[1], {
      success: true,
      result: {
        mode: "native",
        cells: 5,
        xml: "<mxGraphModel><root /></mxGraphModel>",
      },
    });

    await waitForSent(sent, 3);
    expect(sent[2]).toMatchObject({
      __event: "list-pages",
      target_document: { id: "doc-1" },
      __target_connection_id: "conn-1",
    });
    reply(sent[2], {
      success: true,
      result: [
        { id: "page-1", name: "Page 1", is_current: false },
        { id: "page-2", name: "Web Architecture", is_current: true },
      ],
    });

    await expect(responsePromise).resolves.toEqual({
      version: "m15-v1",
      outcome: "accepted",
      created: {
        pageId: "page-2",
        pageName: "Web Architecture",
      },
      safety: {
        mutatesDiagram: true,
        mutationAttempted: true,
        mutationInvocations: 1,
      },
    });
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(await responsePromise)).not.toContain("mxGraphModel");
  });

  it("preserves target_document through existing routing", async () => {
    let resolvedInput: Record<string, unknown> | undefined;
    const resolveTargetDocument: Context["document_routing"]["resolve_target_document"] =
      async (input) => {
        resolvedInput = input;
        return {
          connection_id: "conn-2",
          target_document: { id: "doc-2" },
          document: documentInfo("doc-2"),
        };
      };
    const { context, sent, reply } = createInteractiveContext({
      resolveTargetDocument,
    });
    const responsePromise = createDiagramPublic(
      context,
      validRequest({ target_document: { id: "doc-2" } }),
    );

    await waitForSent(sent, 1);
    reply(sent[0], { success: true, result: [] });
    await waitForSent(sent, 2);
    reply(sent[1], { success: true, result: { mode: "native" } });
    await waitForSent(sent, 3);
    reply(sent[2], {
      success: true,
      result: [{ id: "created", name: "Page 2", is_current: true }],
    });

    await expect(responsePromise).resolves.toMatchObject({
      outcome: "accepted",
      created: { pageId: "created" },
    });
    expect(resolvedInput).toMatchObject({
      target_document: { id: "doc-2" },
    });
    expect(sent[1]).toMatchObject({
      target_document: { id: "doc-2" },
      __target_connection_id: "conn-2",
    });
  });

  it.each([
    [
      "unknown field",
      validRequest({ target_page: { index: 0 } }),
      "invalid-request",
    ],
    [
      "non-mermaid format",
      validRequest({ format: "xml" }),
      "unsupported-mermaid-type",
    ],
    [
      "non-flowchart type",
      validRequest({ mermaidType: "sequence" }),
      "unsupported-mermaid-type",
    ],
    [
      "non-new-page insertMode",
      validRequest({ insertMode: "add" }),
      "unsupported-mermaid-type",
    ],
    ["empty Mermaid", validRequest({ mermaid: "" }), "invalid-request"],
    [
      "missing limits",
      { ...validRequest(), limits: undefined },
      "invalid-request",
    ],
    [
      "invalid maxBytes",
      validRequest({ limits: { maxBytes: 0 } }),
      "invalid-request",
    ],
    [
      "maxBytes over cap",
      validRequest({ limits: { maxBytes: M15_MAX_MERMAID_BYTES + 1 } }),
      "invalid-request",
    ],
    [
      "non-flowchart header",
      validRequest({ mermaid: "sequenceDiagram\nA->>B: hi" }),
      "unsupported-mermaid-type",
    ],
    [
      "disallowed script",
      validRequest({ mermaid: "flowchart LR\n  A[<script>] --> B" }),
      "invalid-request",
    ],
    [
      "unknown target_document field",
      validRequest({
        target_document: { id: "doc-1", target_page: { index: 0 } },
      }),
      "invalid-request",
    ],
  ])("rejects %s before runtime", async (_, input, reasonCode) => {
    const { context, sent, queue } = createInteractiveContext();

    await expect(createDiagramPublic(context, input)).resolves.toEqual({
      version: "m15-v1",
      outcome: "rejected",
      reasonCodes: [reasonCode],
      safety: {
        mutatesDiagram: true,
        mutationAttempted: false,
        mutationInvocations: 0,
      },
    });
    expect(sent).toHaveLength(0);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("rejects source exceeding requested maxBytes before runtime", async () => {
    const { context, sent, queue } = createInteractiveContext();

    await expect(
      createDiagramPublic(
        context,
        validRequest({
          mermaid: "flowchart LR\n  A --> B\n  B --> C",
          limits: { maxBytes: 20 },
        }),
      ),
    ).resolves.toMatchObject({
      outcome: "rejected",
      reasonCodes: ["mermaid-too-large"],
      safety: { mutationAttempted: false, mutationInvocations: 0 },
    });
    expect(sent).toHaveLength(0);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("maps ambiguous document routing to pre-runtime rejection", async () => {
    const { context, sent, queue } = createInteractiveContext({
      resolveTargetDocument: async () => {
        throw new Error(
          "Multiple Draw.io documents are connected. Call `list-documents` and retry with `target_document`.",
        );
      },
    });

    await expect(createDiagramPublic(context, validRequest())).resolves.toEqual(
      {
        version: "m15-v1",
        outcome: "rejected",
        reasonCodes: ["ambiguous-document"],
        safety: {
          mutatesDiagram: true,
          mutationAttempted: false,
          mutationInvocations: 0,
        },
      },
    );
    expect(sent).toHaveLength(0);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("maps missing target_document to pre-runtime rejection without mutating", async () => {
    const { context, sent, queue } = createInteractiveContext({
      resolveTargetDocument: async () => {
        throw new Error("Document with ID missing-doc was not found");
      },
    });

    await expect(
      createDiagramPublic(
        context,
        validRequest({ target_document: { id: "missing-doc" } }),
      ),
    ).resolves.toEqual({
      version: "m15-v1",
      outcome: "rejected",
      reasonCodes: ["import-failed"],
      safety: {
        mutatesDiagram: true,
        mutationAttempted: false,
        mutationInvocations: 0,
      },
    });
    expect(sent).toHaveLength(0);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("fails before mutation when the initial page snapshot is malformed", async () => {
    const { context, sent, reply } = createInteractiveContext();
    const responsePromise = createDiagramPublic(context, validRequest());

    await waitForSent(sent, 1);
    reply(sent[0], {
      success: true,
      result: [{ id: 123, name: "Bad Page", is_current: true }],
    });

    const response = await responsePromise;
    expect(response).toEqual({
      version: "m15-v1",
      outcome: "failed",
      reasonCodes: ["import-failed"],
      safety: {
        mutatesDiagram: true,
        mutationAttempted: false,
        mutationInvocations: 0,
      },
    });
    expect(sent).toHaveLength(1);
    expect(JSON.stringify(response)).not.toContain("Bad Page");
  });

  it("fails before mutation when the initial page snapshot fetch fails", async () => {
    const { context, sent, reply } = createInteractiveContext();
    const responsePromise = createDiagramPublic(context, validRequest());

    await waitForSent(sent, 1);
    reply(sent[0], {
      success: false,
      message: "list-pages failed with /home/user/secret <mxGraphModel />",
    });

    const response = await responsePromise;
    expect(response).toEqual({
      version: "m15-v1",
      outcome: "failed",
      reasonCodes: ["import-failed"],
      safety: {
        mutatesDiagram: true,
        mutationAttempted: false,
        mutationInvocations: 0,
      },
    });
    expect(sent).toHaveLength(1);
    expect(JSON.stringify(response)).not.toContain("/home/user/secret");
    expect(JSON.stringify(response)).not.toContain("mxGraphModel");
  });

  it("maps Mermaid render failures without exposing raw plugin output", async () => {
    const { context, sent, reply } = createInteractiveContext();
    const responsePromise = createDiagramPublic(context, validRequest());

    await waitForSent(sent, 1);
    reply(sent[0], { success: true, result: [] });
    await waitForSent(sent, 2);
    reply(sent[1], {
      success: false,
      message:
        "Mermaid render failed: <mxGraphModel><root /></mxGraphModel> stack trace",
    });

    await expect(responsePromise).resolves.toEqual({
      version: "m15-v1",
      outcome: "failed",
      reasonCodes: ["mermaid-render-failed"],
      safety: {
        mutatesDiagram: true,
        mutationAttempted: true,
        mutationInvocations: 1,
      },
      atomic: "unknown",
    });
  });

  it("maps sanitized render failures to mermaid-render-failed", async () => {
    const { context, sent, reply } = createInteractiveContext();
    const responsePromise = createDiagramPublic(context, validRequest());

    await waitForSent(sent, 1);
    reply(sent[0], { success: true, result: [] });
    await waitForSent(sent, 2);
    reply(sent[1], {
      success: false,
      message: "Mermaid render failed: syntax error",
    });

    await expect(responsePromise).resolves.toMatchObject({
      outcome: "failed",
      reasonCodes: ["mermaid-render-failed"],
      safety: { mutationAttempted: true, mutationInvocations: 1 },
      atomic: "unknown",
    });
  });

  it("maps import failures and does not leak XML from the response", async () => {
    const { context, sent, reply } = createInteractiveContext();
    const responsePromise = createDiagramPublic(context, validRequest());

    await waitForSent(sent, 1);
    reply(sent[0], { success: true, result: [] });
    await waitForSent(sent, 2);
    reply(sent[1], {
      success: false,
      message: "Insert after Mermaid conversion failed: bad page",
      result: { xml: "<mxGraphModel />" },
    });

    const response = await responsePromise;
    expect(response).toMatchObject({
      outcome: "failed",
      reasonCodes: ["import-failed"],
      safety: { mutationAttempted: true, mutationInvocations: 1 },
      atomic: "unknown",
    });
    expect(JSON.stringify(response)).not.toContain("mxGraphModel");
    expect(JSON.stringify(response)).not.toContain("bad page");
  });

  it("maps malformed plugin success responses as ambiguous failed imports", async () => {
    const { context, sent, reply } = createInteractiveContext();
    const responsePromise = createDiagramPublic(context, validRequest());

    await waitForSent(sent, 1);
    reply(sent[0], { success: true, result: [] });
    await waitForSent(sent, 2);
    reply(sent[1], {
      success: true,
      result: "not an object <mxGraphModel />",
    });

    const response = await responsePromise;
    expect(response).toEqual({
      version: "m15-v1",
      outcome: "failed",
      reasonCodes: ["import-failed"],
      safety: {
        mutatesDiagram: true,
        mutationAttempted: true,
        mutationInvocations: 1,
      },
      atomic: "unknown",
    });
    expect(JSON.stringify(response)).not.toContain("mxGraphModel");
  });

  it("does not leak nested stack, XML or raw plugin payloads from runtime errors", async () => {
    const { context, sent, reply } = createInteractiveContext();
    const responsePromise = createDiagramPublic(context, validRequest());

    await waitForSent(sent, 1);
    reply(sent[0], { success: true, result: [] });
    await waitForSent(sent, 2);
    reply(sent[1], {
      success: false,
      error: {
        stack:
          "Error: failed at /home/user/project/file.ts\n<mxGraphModel><mxCell /></mxGraphModel>",
        xml: "<mxGraphModel><mxCell /></mxGraphModel>",
        rawResponse: { secret: "full payload" },
      },
    });

    const response = await responsePromise;
    expect(response).toEqual({
      version: "m15-v1",
      outcome: "failed",
      reasonCodes: ["import-failed"],
      safety: {
        mutatesDiagram: true,
        mutationAttempted: true,
        mutationInvocations: 1,
      },
      atomic: "unknown",
    });
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("mxGraphModel");
    expect(serialized).not.toContain("mxCell");
    expect(serialized).not.toContain("/home/user/project");
    expect(serialized).not.toContain("rawResponse");
    expect(serialized).not.toContain("full payload");
  });

  it("fails without created metadata when import succeeds but no new page is visible", async () => {
    const { context, sent, reply } = createInteractiveContext();
    const responsePromise = createDiagramPublic(context, validRequest());

    await waitForSent(sent, 1);
    reply(sent[0], {
      success: true,
      result: [{ id: "page-1", name: "Existing", is_current: false }],
    });
    await waitForSent(sent, 2);
    reply(sent[1], {
      success: true,
      result: {
        mode: "native",
        xml: "<mxGraphModel><root /></mxGraphModel>",
      },
    });
    await waitForSent(sent, 3);
    reply(sent[2], {
      success: true,
      result: [{ id: "page-1", name: "Existing", is_current: true }],
    });

    const response = await responsePromise;
    expect(response).toEqual({
      version: "m15-v1",
      outcome: "failed",
      reasonCodes: ["import-failed"],
      safety: {
        mutatesDiagram: true,
        mutationAttempted: true,
        mutationInvocations: 1,
      },
      atomic: "unknown",
    });
    expect(response).not.toHaveProperty("created");
    expect(JSON.stringify(response)).not.toContain("Existing");
    expect(JSON.stringify(response)).not.toContain("mxGraphModel");
  });

  it("fails without choosing a current page when import reveals multiple new pages", async () => {
    const { context, sent, reply } = createInteractiveContext();
    const responsePromise = createDiagramPublic(context, validRequest());

    await waitForSent(sent, 1);
    reply(sent[0], {
      success: true,
      result: [{ id: "page-1", name: "Existing", is_current: false }],
    });
    await waitForSent(sent, 2);
    reply(sent[1], {
      success: true,
      result: {
        mode: "native",
        xml: "<mxGraphModel><root /></mxGraphModel>",
      },
    });
    await waitForSent(sent, 3);
    reply(sent[2], {
      success: true,
      result: [
        { id: "page-1", name: "Existing", is_current: false },
        { id: "page-2", name: "First New", is_current: false },
        { id: "page-3", name: "Second New", is_current: true },
      ],
    });

    const response = await responsePromise;
    expect(response).toEqual({
      version: "m15-v1",
      outcome: "failed",
      reasonCodes: ["import-failed"],
      safety: {
        mutatesDiagram: true,
        mutationAttempted: true,
        mutationInvocations: 1,
      },
      atomic: "unknown",
    });
    expect(response).not.toHaveProperty("created");
    expect(JSON.stringify(response)).not.toContain("First New");
    expect(JSON.stringify(response)).not.toContain("Second New");
    expect(JSON.stringify(response)).not.toContain("mxGraphModel");
  });

  it("fails with unknown atomicity when the post-import page snapshot is malformed", async () => {
    const { context, sent, reply } = createInteractiveContext();
    const responsePromise = createDiagramPublic(context, validRequest());

    await waitForSent(sent, 1);
    reply(sent[0], { success: true, result: [] });
    await waitForSent(sent, 2);
    reply(sent[1], { success: true, result: { mode: "native" } });
    await waitForSent(sent, 3);
    reply(sent[2], {
      success: true,
      result: [{ id: "created", name: 123, is_current: true }],
    });

    await expect(responsePromise).resolves.toEqual({
      version: "m15-v1",
      outcome: "failed",
      reasonCodes: ["import-failed"],
      safety: {
        mutatesDiagram: true,
        mutationAttempted: true,
        mutationInvocations: 1,
      },
      atomic: "unknown",
    });
  });

  it("fails with unknown atomicity when post-import page verification fails", async () => {
    const { context, sent, reply } = createInteractiveContext();
    const responsePromise = createDiagramPublic(context, validRequest());

    await waitForSent(sent, 1);
    reply(sent[0], { success: true, result: [] });
    await waitForSent(sent, 2);
    reply(sent[1], { success: true, result: { mode: "native" } });
    await waitForSent(sent, 3);
    reply(sent[2], {
      success: false,
      message: "verification failed: C:\\Users\\secret <mxGraphModel />",
    });

    const response = await responsePromise;
    expect(response).toEqual({
      version: "m15-v1",
      outcome: "failed",
      reasonCodes: ["import-failed"],
      safety: {
        mutatesDiagram: true,
        mutationAttempted: true,
        mutationInvocations: 1,
      },
      atomic: "unknown",
    });
    expect(JSON.stringify(response)).not.toContain("Users");
    expect(JSON.stringify(response)).not.toContain("mxGraphModel");
  });

  it("maps runtime timeouts without reporting an import mutation before import", async () => {
    const { context, sent, reply } = createInteractiveContext();
    const responsePromise = createDiagramPublic(context, validRequest());

    await waitForSent(sent, 1);
    reply(sent[0], { success: false, message: "timeout" });

    await expect(responsePromise).resolves.toMatchObject({
      outcome: "failed",
      reasonCodes: ["timeout"],
      safety: { mutationAttempted: false, mutationInvocations: 0 },
    });
  });

  it("maps real reply timeout before mutation and removes the listener", async () => {
    jest.useFakeTimers();
    try {
      const { context, sent, listeners } = createInteractiveContext();
      const responsePromise = createDiagramPublic(context, validRequest());

      await flushPromises();
      expect(sent).toHaveLength(1);
      expect(listeners.size).toBe(1);

      jest.advanceTimersByTime(60_000);
      await expect(responsePromise).resolves.toEqual({
        version: "m15-v1",
        outcome: "failed",
        reasonCodes: ["timeout"],
        safety: {
          mutatesDiagram: true,
          mutationAttempted: false,
          mutationInvocations: 0,
        },
      });
      expect(listeners.size).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it("maps import timeout after mutation dispatch and releases the FIFO queue", async () => {
    jest.useFakeTimers();
    try {
      const realQueue = create_request_queue({
        debug: () => {},
        log: () => {},
      });
      const { context, sent, reply, listeners } = createInteractiveContext({
        requestQueue: realQueue,
      });
      const firstResponsePromise = createDiagramPublic(
        context,
        validRequest({ title: "First" }),
      );

      await flushPromises();
      expect(sent).toHaveLength(1);
      reply(sent[0], { success: true, result: [] });
      await flushPromises();
      expect(sent).toHaveLength(2);
      expect(sent[1]).toMatchObject({ __event: "import-mermaid" });

      jest.advanceTimersByTime(60_000);
      await expect(firstResponsePromise).resolves.toEqual({
        version: "m15-v1",
        outcome: "failed",
        reasonCodes: ["timeout"],
        safety: {
          mutatesDiagram: true,
          mutationAttempted: true,
          mutationInvocations: 1,
        },
        atomic: "unknown",
      });
      expect(listeners.size).toBe(0);

      const secondResponsePromise = createDiagramPublic(
        context,
        validRequest({ title: "Second" }),
      );
      await flushPromises();
      expect(sent).toHaveLength(3);
      reply(sent[2], { success: true, result: [] });
      await flushPromises();
      expect(sent).toHaveLength(4);
      reply(sent[3], { success: true, result: { mode: "native" } });
      await flushPromises();
      expect(sent).toHaveLength(5);
      reply(sent[4], {
        success: true,
        result: [{ id: "created", name: "Second", is_current: true }],
      });

      await expect(secondResponsePromise).resolves.toMatchObject({
        outcome: "accepted",
        safety: { mutationAttempted: true, mutationInvocations: 1 },
      });
      expect(
        sent.filter((message) => message.__event === "import-mermaid"),
      ).toHaveLength(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it("reports no mutation when sending the import request fails before dispatch", async () => {
    const { context, sent, reply } = createInteractiveContext({
      throwOnEvent: "import-mermaid",
    });
    const responsePromise = createDiagramPublic(context, validRequest());

    await waitForSent(sent, 1);
    reply(sent[0], { success: true, result: [] });

    await expect(responsePromise).resolves.toEqual({
      version: "m15-v1",
      outcome: "failed",
      reasonCodes: ["import-failed"],
      safety: {
        mutatesDiagram: true,
        mutationAttempted: false,
        mutationInvocations: 0,
      },
    });
    expect(
      sent.filter((message) => message.__event === "import-mermaid"),
    ).toHaveLength(0);
  });

  it("reports unknown atomicity when post-mutation verification dispatch fails", async () => {
    const { context, sent, reply } = createInteractiveContext({
      throwOnEvent: "list-pages",
      throwOnEventCall: 2,
    });
    const responsePromise = createDiagramPublic(context, validRequest());

    await waitForSent(sent, 1);
    reply(sent[0], { success: true, result: [] });
    await waitForSent(sent, 2);
    reply(sent[1], { success: true, result: { mode: "native" } });

    await expect(responsePromise).resolves.toEqual({
      version: "m15-v1",
      outcome: "failed",
      reasonCodes: ["import-failed"],
      safety: {
        mutatesDiagram: true,
        mutationAttempted: true,
        mutationInvocations: 1,
      },
      atomic: "unknown",
    });
  });

  it("does not retry mutating imports after a plugin rejection", async () => {
    const { context, sent, reply } = createInteractiveContext();
    const responsePromise = createDiagramPublic(context, validRequest());

    await waitForSent(sent, 1);
    reply(sent[0], { success: true, result: [] });
    await waitForSent(sent, 2);
    reply(sent[1], {
      success: false,
      message: "Insert after Mermaid conversion failed",
    });

    await expect(responsePromise).resolves.toMatchObject({
      outcome: "failed",
      safety: { mutationAttempted: true, mutationInvocations: 1 },
      atomic: "unknown",
    });
    expect(
      sent.filter((message) => message.__event === "import-mermaid"),
    ).toHaveLength(1);
  });

  it("serializes the wrapper through the resolved document FIFO key", async () => {
    const { context, sent, reply, queue } = createInteractiveContext({
      resolveTargetDocument: async () => ({
        connection_id: "conn-target",
        target_document: { id: "doc-target" },
        document: documentInfo("doc-target"),
      }),
    });
    const responsePromise = createDiagramPublic(
      context,
      validRequest({ target_document: { id: "doc-target" } }),
    );

    await waitForSent(sent, 1);
    reply(sent[0], { success: true, result: [] });
    await waitForSent(sent, 2);
    reply(sent[1], { success: true, result: { mode: "native" } });
    await waitForSent(sent, 3);
    reply(sent[2], {
      success: true,
      result: [{ id: "created", name: "Created", is_current: true }],
    });

    await expect(responsePromise).resolves.toMatchObject({
      outcome: "accepted",
    });
    expect(queue.enqueue).toHaveBeenCalledWith(
      "conn-target",
      expect.any(Function),
    );
    expect(sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          __event: "import-mermaid",
          target_document: { id: "doc-target" },
          __target_connection_id: "conn-target",
        }),
      ]),
    );
  });
});

function createInteractiveContext(
  options: {
    readonly resolveTargetDocument?: Context["document_routing"]["resolve_target_document"];
    readonly requestQueue?: Context["request_queue"];
    readonly throwOnEvent?: string;
    readonly throwOnEventCall?: number;
  } = {},
) {
  const listeners = new Map<string, BusListener<Record<string, unknown>>>();
  const sent: Record<string, unknown>[] = [];
  const queue = {
    enqueue: jest.fn(<T>(_: string, task: () => Promise<T>) => task()),
  };
  let nextId = 1;
  const eventCounts = new Map<string, number>();
  const context: Context = {
    bus: {
      send_to_extension: (message) => {
        const outgoing = message as Record<string, unknown>;
        const eventName =
          typeof outgoing.__event === "string" ? outgoing.__event : "";
        const nextCount = (eventCounts.get(eventName) ?? 0) + 1;
        eventCounts.set(eventName, nextCount);
        if (
          options.throwOnEvent === eventName &&
          (options.throwOnEventCall === undefined ||
            options.throwOnEventCall === nextCount)
        ) {
          throw new Error(
            "Internal dispatch failed at /home/user/project with <mxGraphModel /> stack",
          );
        }
        sent.push(outgoing);
      },
      on_reply_from_extension: (eventName, listener) => {
        listeners.set(
          eventName,
          listener as BusListener<Record<string, unknown>>,
        );
        return () => listeners.delete(eventName);
      },
    },
    id_generator: { generate: () => `request-${nextId++}` },
    request_queue:
      options.requestQueue ?? (queue as unknown as Context["request_queue"]),
    document_routing: {
      list_documents: async () => [],
      resolve_target_document:
        options.resolveTargetDocument ??
        (async () => ({
          connection_id: "conn-1",
          target_document: { id: "doc-1" },
          document: documentInfo("doc-1"),
        })),
    },
    log: {
      debug: () => {},
      log: () => {},
    },
  };

  return {
    context,
    sent,
    queue,
    listeners,
    reply: (
      message: Record<string, unknown>,
      payload: Record<string, unknown>,
    ) => {
      listeners.get(`${message.__event}.${message.__request_id}`)?.(payload);
    },
  };
}

function documentInfo(id: string) {
  return {
    id,
    title: null,
    mode: null,
    hash: null,
    file_url: null,
    page_count: 1,
    current_page: null,
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

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
