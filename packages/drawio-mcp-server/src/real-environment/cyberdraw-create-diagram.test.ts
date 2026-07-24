import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

import { expectNoBrowserErrors, expectNoServerErrors } from "./assertions.js";
import {
  createRealEnvironmentContext,
  disposeRealEnvironmentContext,
  resetDiagram,
} from "./harness.js";
import { callToolJson } from "./tools.js";
import type { RealEnvironmentContext } from "./types.js";

const FLOWCHART = "flowchart LR\n  User[User] --> WAF[WAF]\n  WAF --> DB[(DB)]";
const INCIDENT_RESPONSE_FLOW =
  "flowchart LR\n" +
  "  A[Alert] --> B[Triage]\n" +
  "  B --> C[Investigate]\n" +
  "  C --> D[Contain]\n" +
  "  D --> E[Recover]";

type PageInfo = {
  index: number;
  id: string;
  name: string;
  is_current: boolean;
};

describe("real environment/cyberdraw_create_diagram", () => {
  let context: RealEnvironmentContext;

  beforeAll(async () => {
    context = await createRealEnvironmentContext();
  }, 180000);

  afterAll(async () => {
    await disposeRealEnvironmentContext(context);
  });

  it("creates one visible new page through the public M15 wrapper without XML output", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: beforePagesPayload } = await callToolJson<{
      success: boolean;
      result: PageInfo[];
    }>(context, "list-pages", {});
    expect(beforePagesPayload.success).toBe(true);

    const { payload } = await callToolJson<{
      version: string;
      outcome: string;
      created?: { pageId?: string; pageName?: string };
      safety?: {
        mutatesDiagram?: boolean;
        mutationAttempted?: boolean;
        mutationInvocations?: number;
      };
    }>(context, "cyberdraw_create_diagram", {
      format: "mermaid",
      mermaidType: "flowchart",
      insertMode: "new-page",
      mermaid: FLOWCHART,
      title: "M15 Runtime Smoke",
      limits: { maxBytes: 12000 },
    });

    expect(payload).toEqual({
      version: "m15-v1",
      outcome: "accepted",
      created: {
        pageId: expect.any(String),
        pageName: "M15 Runtime Smoke",
      },
      safety: {
        mutatesDiagram: true,
        mutationAttempted: true,
        mutationInvocations: 1,
      },
    });
    expect(JSON.stringify(payload)).not.toContain("mxGraphModel");
    expect(JSON.stringify(payload)).not.toContain("mxCell");

    const { payload: afterPagesPayload } = await callToolJson<{
      success: boolean;
      result: PageInfo[];
    }>(context, "list-pages", {});
    expect(afterPagesPayload.success).toBe(true);
    expect(afterPagesPayload.result).toHaveLength(
      beforePagesPayload.result.length + 1,
    );
    expect(afterPagesPayload.result.at(-1)).toMatchObject({
      id: payload.created?.pageId,
      name: "M15 Runtime Smoke",
      is_current: true,
    });

    const { payload: createdModelPayload } = await callToolJson<{
      success: boolean;
      result?: { cells?: unknown[] } | unknown[];
    }>(context, "list-paged-model", {
      target_page: { id: String(payload.created?.pageId ?? "") },
      page: 0,
      page_size: 50,
      filter: { cell_type: "vertex" },
    });
    expect(createdModelPayload.success).toBe(true);
    const createdModel = createdModelPayload.result;
    const createdCells = Array.isArray(createdModel)
      ? createdModel
      : Array.isArray(createdModel?.cells)
        ? createdModel.cells
        : [];
    expect(createdCells.length).toBeGreaterThan(0);

    await expectNoBrowserErrors(context, "cyberdraw_create_diagram");
    await expectNoServerErrors(
      context,
      "cyberdraw_create_diagram",
      logCountBefore,
    );
  }, 180000);

  it("reproduces the M15.3 incident response demo through the public wrapper", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const conceptualPrompt =
      "Create a simple incident response flow: Alert -> Triage -> Investigate -> Contain -> Recover";
    expect(conceptualPrompt).toContain("incident response flow");

    const { payload: beforePagesPayload } = await callToolJson<{
      success: boolean;
      result: PageInfo[];
    }>(context, "list-pages", {});
    expect(beforePagesPayload.success).toBe(true);

    const { payload } = await callToolJson<{
      version: string;
      outcome: string;
      created?: { pageId?: string; pageName?: string };
      safety?: {
        mutatesDiagram?: boolean;
        mutationAttempted?: boolean;
        mutationInvocations?: number;
      };
    }>(context, "cyberdraw_create_diagram", {
      format: "mermaid",
      mermaidType: "flowchart",
      insertMode: "new-page",
      mermaid: INCIDENT_RESPONSE_FLOW,
      title: "Incident Response Flow",
      limits: { maxBytes: 12000 },
    });

    expect(payload).toEqual({
      version: "m15-v1",
      outcome: "accepted",
      created: {
        pageId: expect.any(String),
        pageName: "Incident Response Flow",
      },
      safety: {
        mutatesDiagram: true,
        mutationAttempted: true,
        mutationInvocations: 1,
      },
    });

    const serializedPayload = JSON.stringify(payload);
    expect(serializedPayload).not.toContain("mxGraphModel");
    expect(serializedPayload).not.toContain("mxCell");
    expect(serializedPayload).not.toContain("mermaid_source");
    expect(serializedPayload).not.toContain("rawResponse");

    const { payload: afterPagesPayload } = await callToolJson<{
      success: boolean;
      result: PageInfo[];
    }>(context, "list-pages", {});
    expect(afterPagesPayload.success).toBe(true);
    expect(afterPagesPayload.result).toHaveLength(
      beforePagesPayload.result.length + 1,
    );
    expect(afterPagesPayload.result.at(-1)).toMatchObject({
      id: payload.created?.pageId,
      name: "Incident Response Flow",
      is_current: true,
    });

    const { payload: createdVerticesPayload } = await callToolJson<{
      success: boolean;
      result?:
        | { cells?: Array<{ cell_type?: string }> }
        | Array<{ cell_type?: string }>;
    }>(context, "list-paged-model", {
      target_page: { id: String(payload.created?.pageId ?? "") },
      page: 0,
      page_size: 50,
      filter: { cell_type: "vertex" },
    });
    expect(createdVerticesPayload.success).toBe(true);
    const createdVerticesModel = createdVerticesPayload.result;
    const createdVertices = Array.isArray(createdVerticesModel)
      ? createdVerticesModel
      : Array.isArray(createdVerticesModel?.cells)
        ? createdVerticesModel.cells
        : [];
    expect(createdVertices.length).toBeGreaterThan(0);

    const { payload: createdEdgesPayload } = await callToolJson<{
      success: boolean;
      result?:
        | { cells?: Array<{ cell_type?: string }> }
        | Array<{ cell_type?: string }>;
    }>(context, "list-paged-model", {
      target_page: { id: String(payload.created?.pageId ?? "") },
      page: 0,
      page_size: 50,
      filter: { cell_type: "edge" },
    });
    expect(createdEdgesPayload.success).toBe(true);
    const createdEdgesModel = createdEdgesPayload.result;
    const createdEdges = Array.isArray(createdEdgesModel)
      ? createdEdgesModel
      : Array.isArray(createdEdgesModel?.cells)
        ? createdEdgesModel.cells
        : [];
    expect(createdEdges.length).toBeGreaterThan(0);

    await expectNoBrowserErrors(context, "cyberdraw_create_diagram");
    await expectNoServerErrors(
      context,
      "cyberdraw_create_diagram",
      logCountBefore,
    );
  }, 180000);
});
