import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

import {
  createRealEnvironmentContext,
  disposeRealEnvironmentContext,
  resetDiagram,
  selectCell,
} from "./harness.js";
import { expectNoBrowserErrors, expectNoServerErrors } from "./assertions.js";
import { callToolJson } from "./tools.js";
import { expectToolSuccess, unwrapToolPayload } from "./test-helpers.js";
import type { RealEnvironmentContext } from "./types.js";
import { requestCyberdrawRuntimeSnapshot } from "../cyberdraw-runtime-snapshot.js";

type PageInfo = {
  index: number;
  id: string;
  name: string;
  is_current: boolean;
};

type RuntimeSnapshot = {
  schemaVersion: "cyberdraw.runtime-snapshot.v1";
  document: {
    currentPageId?: string;
    revisionSignals: {
      contentRevision: string;
      semanticRevision?: string;
    };
  };
  pages: Array<{
    id: string;
    visible: boolean;
    background: boolean;
    layers: Array<{ id: string; pageId: string }>;
    elements: Array<{
      id: string;
      pageId: string;
      layerId?: string;
      parentId?: string;
      sourceId?: string;
      targetId?: string;
      label?: { text?: string; html?: string };
    }>;
  }>;
  diagnostics: Array<{ code: string; pageId?: string; elementId?: string }>;
  truncated: boolean;
  performance: {
    extractionMs: number;
    serializationMs: number;
    approximateJsonBytes: number;
  };
};

describe("real environment/runtime snapshot", () => {
  let context: RealEnvironmentContext;

  beforeAll(async () => {
    context = await createRealEnvironmentContext();
  }, 180000);

  afterAll(async () => {
    await disposeRealEnvironmentContext(context);
  });

  it("extracts visible and background pages without changing public tools or editor state", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: renamedPayload } = await callToolJson<{
      success: boolean;
      result: PageInfo;
    }>(context, "rename-page", {
      page: { index: 0 },
      name: "Snapshot Visible",
    });
    expectToolSuccess(renamedPayload);
    const visiblePage = unwrapToolPayload<PageInfo>(renamedPayload);

    const { payload: visibleRectPayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      target_page: { id: visiblePage.id },
      x: 60,
      y: 80,
      width: 160,
      height: 80,
      text: "<b>Visible Runtime</b>",
      style: "rounded=1;whiteSpace=wrap;html=1;",
    });
    expectToolSuccess(visibleRectPayload);
    const visibleRect = unwrapToolPayload<{ id: string }>(visibleRectPayload);

    const { payload: backgroundPagePayload } = await callToolJson<{
      success: boolean;
      result: PageInfo;
    }>(context, "create-page", {
      name: "Snapshot Background",
    });
    expectToolSuccess(backgroundPagePayload);
    const backgroundPage = unwrapToolPayload<PageInfo>(backgroundPagePayload);

    const { payload: backgroundRectPayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      target_page: { id: backgroundPage.id },
      x: 260,
      y: 180,
      width: 160,
      height: 80,
      text: "Background Runtime",
    });
    expectToolSuccess(backgroundRectPayload);
    const backgroundRect = unwrapToolPayload<{ id: string }>(backgroundRectPayload);

    const { payload: edgePayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-edge", {
      target_page: { id: visiblePage.id },
      source_id: visibleRect.id,
      target_id: visibleRect.id,
      text: "Self edge",
      points: [{ x: 140, y: 40 }],
    });
    expectToolSuccess(edgePayload);

    await selectCell(context.page, visibleRect.id);
    const beforeState = await readEditorState(context);

    const snapshot = (await requestCyberdrawRuntimeSnapshot(context.app.context, {
      includeRaw: true,
    })) as RuntimeSnapshot;

    expect(snapshot.schemaVersion).toBe("cyberdraw.runtime-snapshot.v1");
    expect(snapshot.document.currentPageId).toBe(visiblePage.id);
    expect(snapshot.pages).toHaveLength(2);
    expect(snapshot.pages.find((page) => page.id === visiblePage.id)?.visible).toBe(true);
    expect(snapshot.pages.find((page) => page.id === backgroundPage.id)?.background).toBe(true);
    expect(
      snapshot.pages
        .find((page) => page.id === visiblePage.id)
        ?.elements.some((element) => element.id === visibleRect.id),
    ).toBe(true);
    expect(
      snapshot.pages
        .find((page) => page.id === backgroundPage.id)
        ?.elements.some((element) => element.id === backgroundRect.id),
    ).toBe(true);
    expect(snapshot.document.revisionSignals.contentRevision).toMatch(/^fnv1a32:/);
    expect(snapshot.document.revisionSignals.semanticRevision).toBeUndefined();
    expect(snapshot.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "semantic_revision_deferred",
    );
    expect(JSON.parse(JSON.stringify(snapshot)).schemaVersion).toBe(
      "cyberdraw.runtime-snapshot.v1",
    );

    const equivalent = (await requestCyberdrawRuntimeSnapshot(context.app.context, {
      includeRaw: true,
    })) as RuntimeSnapshot;
    expect(equivalent.document.revisionSignals.contentRevision).toBe(
      snapshot.document.revisionSignals.contentRevision,
    );

    const afterState = await readEditorState(context);
    expect(afterState).toEqual(beforeState);

    const truncated = (await requestCyberdrawRuntimeSnapshot(context.app.context, {
      limits: { maxElementsPerPage: 1 },
    })) as RuntimeSnapshot;
    expect(truncated.truncated).toBe(true);
    expect(truncated.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "element_limit_reached",
    );
    expect(truncated.document.revisionSignals.contentRevision).not.toBe(
      snapshot.document.revisionSignals.contentRevision,
    );

    await context.page.evaluate((cellId: string) => {
      const graph = (window as any).ui?.editor?.graph;
      const model = graph?.getModel?.();
      const cell = model?.getCell?.(cellId);
      model?.beginUpdate?.();
      try {
        model?.setValue?.(cell, "Manual Runtime Edit");
      } finally {
        model?.endUpdate?.();
      }
    }, visibleRect.id);

    const changed = (await requestCyberdrawRuntimeSnapshot(context.app.context, {})) as RuntimeSnapshot;
    expect(changed.document.revisionSignals.contentRevision).not.toBe(
      snapshot.document.revisionSignals.contentRevision,
    );

    const tools = await context.client.listTools();
    expect(tools.tools.map((tool) => tool.name)).not.toContain(
      "cyberdraw.runtimeSnapshot.v1",
    );

    await expectNoBrowserErrors(context, "runtime-snapshot");
    await expectNoServerErrors(context, "runtime-snapshot", logCountBefore);
  }, 180000);
});

async function readEditorState(context: RealEnvironmentContext) {
  return context.page.evaluate(() => {
    const ui = (window as any).ui;
    const graph = ui?.editor?.graph;
    const currentId = ui?.currentPage?.getId?.() ?? ui?.currentPage?.id ?? null;
    const selection = graph?.getSelectionCells?.() ?? [];
    return {
      currentPageId: currentId,
      selectionIds: Array.isArray(selection)
        ? selection.map((cell: any) => String(cell.id)).sort()
        : [],
      editing: typeof graph?.isEditing === "function" ? graph.isEditing() : false,
    };
  });
}
