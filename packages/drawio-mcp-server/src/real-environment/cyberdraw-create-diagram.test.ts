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
});
