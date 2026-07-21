import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

import {
  createRealEnvironmentContext,
  disposeRealEnvironmentContext,
  resetDiagram,
} from "./harness.js";
import { expectNoBrowserErrors, expectNoServerErrors } from "./assertions.js";
import { callToolJson } from "./tools.js";
import { expectToolSuccess, unwrapToolPayload } from "./test-helpers.js";
import type { RealEnvironmentContext } from "./types.js";

type PageInfo = {
  id: string;
};

type IdResult = {
  id: string;
};

type PublicM14Response = {
  version: "m14-v1";
  operation: string;
  outcome: string;
  requestedScope: {
    scopeType: string;
    pageIds: string[];
    layerTargets: Array<{ pageId: string; layerIds: string[] }>;
    rejectedReason?: string;
  };
  executedScope: {
    executed: boolean;
    document: boolean;
    pageIds: string[];
    layerTargets: Array<{ pageId: string; layerIds: string[] }>;
  };
  coverage: {
    completeDocument: "unsupported";
    stale: boolean;
    completeTargetScopes: boolean;
  };
  limitations: Array<{ code: string }>;
  results?: {
    kind: string;
    totalFindings?: number;
    buckets?: Array<{ key: string; count: number }>;
  };
  safety: {
    readOnly: true;
    mutationAttempted: false;
    mutationInvocations: 0;
  };
};

describe("real environment/cyberdraw public M14 contract", () => {
  let context: RealEnvironmentContext;

  beforeAll(async () => {
    context = await createRealEnvironmentContext();
  }, 180000);

  afterAll(async () => {
    await disposeRealEnvironmentContext(context);
  });

  it("validates M14 scopes, aggregate queries, rejections and sanitization through MCP", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: pageOnePayload } = await callToolJson<{
      success: boolean;
      result: PageInfo;
    }>(context, "rename-page", {
      page: { index: 0 },
      name: "M14 Page One",
    });
    expectToolSuccess(pageOnePayload);
    const pageOne = unwrapToolPayload<PageInfo>(pageOnePayload);

    const { payload: pageTwoPayload } = await callToolJson<{
      success: boolean;
      result: PageInfo;
    }>(context, "create-page", { name: "M14 Page Two" });
    expectToolSuccess(pageTwoPayload);
    const pageTwo = unwrapToolPayload<PageInfo>(pageTwoPayload);

    const { payload: layerOnePayload } = await callToolJson<{
      success: boolean;
      result: IdResult;
    }>(context, "create-layer", {
      target_page: { id: pageOne.id },
      name: "M14 Layer One",
    });
    expectToolSuccess(layerOnePayload);
    const layerOne = unwrapToolPayload<IdResult>(layerOnePayload);

    const { payload: layerTwoPayload } = await callToolJson<{
      success: boolean;
      result: IdResult;
    }>(context, "create-layer", {
      target_page: { id: pageOne.id },
      name: "M14 Layer Two",
    });
    expectToolSuccess(layerTwoPayload);
    const layerTwo = unwrapToolPayload<IdResult>(layerTwoPayload);

    const { payload: sourcePayload } = await callToolJson<{
      success: boolean;
      result: IdResult;
    }>(context, "add-rectangle", {
      target_page: { id: pageOne.id },
      x: 80,
      y: 90,
      width: 120,
      height: 70,
      text: "M14 Source Label",
    });
    expectToolSuccess(sourcePayload);
    const source = unwrapToolPayload<IdResult>(sourcePayload);

    const { payload: targetPayload } = await callToolJson<{
      success: boolean;
      result: IdResult;
    }>(context, "add-rectangle", {
      target_page: { id: pageOne.id },
      x: 280,
      y: 90,
      width: 120,
      height: 70,
      text: "M14 Target Label",
    });
    expectToolSuccess(targetPayload);
    const target = unwrapToolPayload<IdResult>(targetPayload);

    await callToolJson(context, "move-cell-to-layer", {
      target_page: { id: pageOne.id },
      cell_id: source.id,
      target_layer_id: layerOne.id,
    });
    await callToolJson(context, "move-cell-to-layer", {
      target_page: { id: pageOne.id },
      cell_id: target.id,
      target_layer_id: layerTwo.id,
    });

    const { payload: edgePayload } = await callToolJson<{
      success: boolean;
      result: IdResult;
    }>(context, "add-edge", {
      target_page: { id: pageOne.id },
      source_id: source.id,
      target_id: target.id,
      text: "M14 Cross Layer Edge",
    });
    expectToolSuccess(edgePayload);

    const { payload: pageTwoRectPayload } = await callToolJson<{
      success: boolean;
      result: IdResult;
    }>(context, "add-rectangle", {
      target_page: { id: pageTwo.id },
      x: 120,
      y: 140,
      width: 120,
      height: 70,
      text: "M14 Page Two Label",
    });
    expectToolSuccess(pageTwoRectPayload);

    const m13 = await callToolJson<any>(
      context,
      "cyberdraw_analyze_structure",
      { mode: "analyze" },
    );
    expect(m13.payload.version).toBe("m13-v1");

    const count = await callToolJson<PublicM14Response>(
      context,
      "cyberdraw_analyze_structure",
      {
        mode: "query",
        scope: { pageIds: [pageOne.id] },
        query: { operation: "count" },
        coverageRequirements: { nonStale: true },
      },
    );
    const summarize = await callToolJson<PublicM14Response>(
      context,
      "cyberdraw_analyze_structure",
      {
        mode: "query",
        scope: { pageIds: [pageOne.id, pageTwo.id] },
        query: { operation: "summarize", groupBy: "finding-type" },
      },
    );
    const layers = await callToolJson<PublicM14Response>(
      context,
      "cyberdraw_analyze_structure",
      {
        mode: "query",
        scope: {
          layerTargets: [
            { pageId: pageOne.id, layerIds: [layerOne.id, layerTwo.id] },
          ],
        },
        query: { operation: "count" },
        coverageRequirements: { completeTargetScopes: true },
      },
    );
    const mixed = await callToolJson<PublicM14Response>(
      context,
      "cyberdraw_analyze_structure",
      {
        mode: "query",
        scope: {
          pageIds: [pageTwo.id],
          layerTargets: [{ pageId: pageOne.id, layerIds: [layerOne.id] }],
        },
        query: { operation: "summarize", groupBy: "finding-type" },
      },
    );
    const documentScope = await callToolJson<PublicM14Response>(
      context,
      "cyberdraw_analyze_structure",
      { mode: "analyze", scope: { document: true } },
    );
    const missingPage = await callToolJson<PublicM14Response>(
      context,
      "cyberdraw_analyze_structure",
      {
        mode: "query",
        scope: { pageIds: [pageOne.id, "missing-m14-page"] },
        query: { operation: "count" },
      },
    );
    const wrongPageLayer = await callToolJson<PublicM14Response>(
      context,
      "cyberdraw_analyze_structure",
      {
        mode: "query",
        scope: {
          layerTargets: [{ pageId: pageTwo.id, layerIds: [layerOne.id] }],
        },
        query: { operation: "count" },
      },
    );
    const duplicate = await callToolJson<PublicM14Response>(
      context,
      "cyberdraw_analyze_structure",
      {
        mode: "query",
        scope: {
          pageIds: [pageOne.id],
          layerTargets: [{ pageId: pageOne.id, layerIds: [layerOne.id] }],
        },
        query: { operation: "count" },
      },
    );
    const emptyScope = await callToolJson<PublicM14Response>(
      context,
      "cyberdraw_analyze_structure",
      {
        mode: "query",
        scope: { pageIds: [] },
        query: { operation: "count" },
      },
    );
    const tooBroad = await callToolJson<PublicM14Response>(
      context,
      "cyberdraw_analyze_structure",
      {
        mode: "query",
        scope: {
          pageIds: Array.from(
            { length: 9 },
            (_, index) => `m14-too-broad-${index}`,
          ),
        },
        query: { operation: "count" },
      },
    );

    expect(count.payload).toMatchObject({
      version: "m14-v1",
      operation: "count",
      requestedScope: { scopeType: "page", pageIds: [pageOne.id] },
      executedScope: { document: false, pageIds: [pageOne.id] },
      coverage: {
        completeDocument: "unsupported",
        stale: false,
        completeTargetScopes: true,
      },
      results: { kind: "count" },
      safety: {
        readOnly: true,
        mutationAttempted: false,
        mutationInvocations: 0,
      },
    });
    expect(count.payload.results?.totalFindings ?? 0).toBeGreaterThan(0);

    expect(summarize.payload).toMatchObject({
      version: "m14-v1",
      operation: "summarize",
      requestedScope: { scopeType: "page" },
      executedScope: { document: false },
      results: { kind: "summary" },
    });
    expect(summarize.payload.executedScope.pageIds).toEqual(
      [pageOne.id, pageTwo.id].sort(),
    );
    expect(summarize.payload.results?.buckets?.length ?? 0).toBeGreaterThan(0);

    expect(layers.payload).toMatchObject({
      version: "m14-v1",
      operation: "count",
      requestedScope: { scopeType: "layer" },
      executedScope: {
        document: false,
        layerTargets: [
          { pageId: pageOne.id, layerIds: [layerOne.id, layerTwo.id].sort() },
        ],
      },
      coverage: { completeTargetScopes: true },
    });

    expect(mixed.payload).toMatchObject({
      version: "m14-v1",
      operation: "summarize",
      requestedScope: { scopeType: "mixed", pageIds: [pageTwo.id] },
      executedScope: { document: false },
    });
    expect(mixed.payload.executedScope.pageIds).toContain(pageTwo.id);
    expect(mixed.payload.executedScope.layerTargets).toEqual([
      { pageId: pageOne.id, layerIds: [layerOne.id] },
    ]);

    expect(documentScope.payload).toMatchObject({
      version: "m14-v1",
      outcome: "rejected",
      requestedScope: {
        scopeType: "document",
        rejectedReason: "document-scope-not-supported",
      },
      executedScope: { executed: false, pageIds: [], layerTargets: [] },
      limitations: [{ code: "document-scope-not-supported" }],
    });
    expect(missingPage.payload).toMatchObject({
      version: "m14-v1",
      outcome: "rejected",
      executedScope: { executed: false, pageIds: [], layerTargets: [] },
      limitations: [{ code: "page-not-found" }],
    });
    expect(wrongPageLayer.payload).toMatchObject({
      version: "m14-v1",
      outcome: "rejected",
      executedScope: { executed: false, pageIds: [], layerTargets: [] },
      limitations: [{ code: "layer-not-found" }],
    });
    expect(duplicate.payload.limitations).toEqual([
      { code: "duplicate-scope-target" },
    ]);
    expect(emptyScope.payload.limitations).toEqual([{ code: "empty-scope" }]);
    expect(tooBroad.payload.limitations).toEqual([{ code: "scope-too-broad" }]);

    for (const response of [
      count.payload,
      summarize.payload,
      layers.payload,
      mixed.payload,
      documentScope.payload,
      missingPage.payload,
      wrongPageLayer.payload,
      duplicate.payload,
      emptyScope.payload,
      tooBroad.payload,
    ]) {
      expect(response.safety).toEqual({
        readOnly: true,
        mutationAttempted: false,
        mutationInvocations: 0,
      });
      expect(response.executedScope.document).toBe(false);
      expect(JSON.stringify(response)).not.toContain("M14 Source Label");
      expect(JSON.stringify(response)).not.toContain("M14 Target Label");
      expect(JSON.stringify(response)).not.toContain("M14 Page Two Label");
      expect(JSON.stringify(response)).not.toContain("<mxGraphModel");
      expect(JSON.stringify(response)).not.toContain("snapshot");
      expect(JSON.stringify(response)).not.toContain("graph");
      expect(JSON.stringify(response)).not.toContain("stopReason");
    }

    const messages = context.logger.entries
      .slice(logCountBefore)
      .map((entry) => entry.message);
    expect(messages.some((message) => message.includes("scope=document"))).toBe(
      false,
    );
    await expectNoBrowserErrors(context, "cyberdraw-public-m14");
    await expectNoServerErrors(context, "cyberdraw-public-m14", logCountBefore);
  }, 180000);
});
