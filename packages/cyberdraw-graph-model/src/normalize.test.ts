import { describe, expect, it } from "@jest/globals";

import {
  fromLegacyPagedModel,
  getElementsByDrawioId,
  getElementsByLayer,
  getElementsByPage,
  incomingEdges,
  normalizeDiagram,
  outgoingEdges,
  serializeSnapshot,
  toCanonicalDiagramInput,
  toSerializableSnapshot,
  validateBrokenReferences,
} from "./index.js";
import {
  backgroundPageDerivedDiagram,
  brokenLayerDiagram,
  brokenParentDiagram,
  brokenSourceDiagram,
  brokenTargetDiagram,
  dangerousMetadataDiagram,
  duplicateIdsDiagram,
  elementWithoutIdDiagram,
  materializedMissingChildDiagram,
  multiLayerDiagram,
  multiPageDiagram,
  parentCycleDiagram,
  simpleValidDiagram,
  unknownElementDiagram,
} from "./fixtures/legacy-fixtures.js";

describe("normalizeDiagram", () => {
  it("normalizes canonical input without the legacy adapter", () => {
    const snapshot = normalizeDiagram({
      documentId: "canonical-doc",
      source: { kind: "external-snapshot", sourceName: "test-canonical" },
      pages: [
        {
          pageExternalId: "page",
          index: 0,
          name: "Canonical",
          layers: [{ layerExternalId: "layer", name: "Layer" }],
          elements: [
            {
              externalId: "source",
              kind: "node",
              layerExternalId: "layer",
              label: { format: "plain", text: "Source" },
            },
            {
              externalId: "target",
              kind: "node",
              layerExternalId: "layer",
              label: { format: "plain", text: "Target" },
            },
            {
              externalId: "edge",
              kind: "edge",
              layerExternalId: "layer",
              sourceExternalId: "source",
              targetExternalId: "target",
            },
          ],
        },
      ],
    });

    expect(snapshot.source.kind).toBe("external-snapshot");
    expect(snapshot.source.sourceName).toBe("test-canonical");
    expect(snapshot.findings).toEqual([]);
    expect(snapshot.elements).toHaveLength(3);
  });

  it("does not default core source to the legacy adapter", () => {
    const snapshot = normalizeDiagram({ pages: [] });
    expect(snapshot.source.kind).toBe("external-snapshot");
    expect(snapshot.source.sourceName).toBeUndefined();
  });

  it("allows a second simulated source to produce the same canonical snapshot", () => {
    const canonical = {
      documentId: "doc-simple",
      source: { kind: "external-snapshot" as const, sourceName: "simulated-source" },
      pages: [
        {
          pageExternalId: "page-main",
          index: 0,
          name: "Main",
          layers: [{ layerExternalId: "layer-default", name: "Default Layer", visible: true }],
          elements: [
            {
              externalId: "web",
              kind: "node" as const,
              layerExternalId: "layer-default",
              label: { format: "html" as const, text: "Web", html: "Web" },
            },
          ],
        },
      ],
    };
    const first = normalizeDiagram(canonical);
    const second = normalizeDiagram({
      ...canonical,
      source: { kind: "external-snapshot", sourceName: "other" },
    });
    expect(
      first.elements.map(({ internalId, drawioId, kind, pageId }) => ({
        internalId,
        drawioId,
        kind,
        pageId,
      })),
    ).toEqual(
      second.elements.map(({ internalId, drawioId, kind, pageId }) => ({
        internalId,
        drawioId,
        kind,
        pageId,
      })),
    );
  });

  it("normalizes a simple inherited list-paged-model compatible fixture", () => {
    const snapshot = fromLegacyPagedModel(simpleValidDiagram);
    expect(snapshot.schemaVersion).toBe("0.1-spike");
    expect(snapshot.pages).toHaveLength(1);
    expect(snapshot.layers).toHaveLength(1);
    expect(snapshot.elements).toHaveLength(3);
    expect(snapshot.findings).toEqual([]);

    const web = getElementsByDrawioId(snapshot, "web")[0];
    const api = getElementsByDrawioId(snapshot, "api")[0];
    const edge = getElementsByDrawioId(snapshot, "edge-web-api")[0];
    expect(edge.kind).toBe("edge");
    if (edge.kind !== "edge") {
      throw new Error("expected edge");
    }
    expect(edge.sourceId).toBe(web.internalId);
    expect(edge.targetId).toBe(api.internalId);
    expect(outgoingEdges(snapshot, web.internalId).map((entry) => entry.internalId)).toEqual([
      edge.internalId,
    ]);
    expect(incomingEdges(snapshot, api.internalId).map((entry) => entry.internalId)).toEqual([
      edge.internalId,
    ]);
  });

  it("keeps pages, layers and elements separate for multi-page and multi-layer fixtures", () => {
    const pages = fromLegacyPagedModel(multiPageDiagram);
    expect(pages.pages).toHaveLength(2);
    expect(pages.elements.map((element) => element.internalId)).toEqual([
      "element:page:0:drawio:page-a:drawio:shared:0",
      "element:page:1:drawio:page-b:drawio:shared:0",
    ]);
    expect(getElementsByDrawioId(pages, "shared")).toHaveLength(2);

    const layers = fromLegacyPagedModel(multiLayerDiagram);
    expect(layers.layers).toHaveLength(2);
    const lockedLayer = layers.layers.find((layer) => layer.drawioId === "layer-locked");
    expect(lockedLayer?.locked).toBe(true);
    expect(lockedLayer ? getElementsByLayer(layers, lockedLayer.internalId) : []).toHaveLength(1);
  });

  it("is deterministic and does not mutate input", () => {
    const input = structuredClone(simpleValidDiagram);
    const before = JSON.stringify(input);
    const first = serializeSnapshot(fromLegacyPagedModel(input));
    const second = serializeSnapshot(fromLegacyPagedModel(input));
    expect(first).toBe(second);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("serializes indexes to JSON-safe deterministic structures", () => {
    const snapshot = fromLegacyPagedModel(simpleValidDiagram);
    const serialized = serializeSnapshot(snapshot);
    const parsed = JSON.parse(serialized);
    expect(Array.isArray(parsed.indexes.byDrawioId)).toBe(true);
    expect(parsed.indexes.byInternalId).toContain(
      "element:page:0:drawio:page-main:drawio:web:0",
    );
    expect(toSerializableSnapshot(snapshot).indexes.byDrawioId[0][0]).toBe("api");
  });

  it("evaluates provisional identity strategies in fixtures", () => {
    const withId = fromLegacyPagedModel(simpleValidDiagram).elements[0];
    const withoutId = fromLegacyPagedModel(elementWithoutIdDiagram).elements[0];

    expect(withId.internalId).toContain("page:0:drawio:page-main");
    expect(withId.internalId).toContain("drawio:web:0");
    expect(withoutId.drawioId).toBeUndefined();
    expect(withoutId.internalId).toBe(
      "element:page:0:drawio:page-without-id:synthetic:0",
    );
  });

  it("accepts unknown elements and disconnected edges", () => {
    const unknown = fromLegacyPagedModel(unknownElementDiagram).elements[0];
    expect(unknown.kind).toBe("unknown");

    const disconnected = normalizeDiagram({
      pages: [
        {
          pageExternalId: "page",
          layers: [],
          elements: [{ externalId: "edge", kind: "edge" }],
        },
      ],
    });
    expect(disconnected.elements[0].kind).toBe("edge");
    expect(disconnected.findings).toEqual([]);
  });

  it("detects duplicate draw.io ids and ambiguous references", () => {
    const snapshot = fromLegacyPagedModel(duplicateIdsDiagram);
    expect(snapshot.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        "duplicate_drawio_id",
        "ambiguous_drawio_reference",
      ]),
    );
    expect(getElementsByDrawioId(snapshot, "dup")).toHaveLength(2);
  });

  it("detects broken source, target, parent, layer and child references", () => {
    expect(codes(fromLegacyPagedModel(brokenSourceDiagram))).toContain(
      "missing_edge_source",
    );
    expect(codes(fromLegacyPagedModel(brokenTargetDiagram))).toContain(
      "missing_edge_target",
    );
    expect(codes(fromLegacyPagedModel(brokenParentDiagram))).toContain(
      "missing_parent",
    );
    expect(codes(fromLegacyPagedModel(brokenLayerDiagram))).toContain(
      "missing_layer",
    );
    expect(codes(fromLegacyPagedModel(materializedMissingChildDiagram))).toContain(
      "missing_child",
    );
  });

  it("detects missing pages through snapshot validation", () => {
    const snapshot = fromLegacyPagedModel(simpleValidDiagram);
    const element = snapshot.elements[0];
    const malformed = {
      ...snapshot,
      elements: [{ ...element, pageId: "missing-page" }],
      indexes: {
        ...snapshot.indexes,
        byInternalId: new Map([[element.internalId, { ...element, pageId: "missing-page" }]]),
      },
    };
    expect(validateBrokenReferences(malformed).map((finding) => finding.code)).toContain(
      "missing_page",
    );
  });

  it("detects parent cycles without unbounded recursion", () => {
    const snapshot = fromLegacyPagedModel(parentCycleDiagram);
    expect(codes(snapshot)).toContain("parent_cycle");
  });

  it("sanitizes prototype-polluting keys and preserves HTML labels as data", () => {
    const snapshot = fromLegacyPagedModel(dangerousMetadataDiagram);
    const element = snapshot.elements[0];
    expect(element.label?.text).toBe("Service");
    expect(element.label?.html).toBe("<b>Service</b>");
    expect(element.metadata?.owner).toBe("platform");
    expect(Object.prototype.hasOwnProperty.call(element.metadata, "__proto__")).toBe(
      false,
    );
    expect(element.style?.properties.__proto__).toBeUndefined();
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
  });

  it("handles malformed and oversized input with configured limits", () => {
    const snapshot = normalizeDiagram(
      {
        documentId: "doc-malformed",
        pages: [
          {
            pageExternalId: "page",
            layers: [{ layerExternalId: "layer" }, { layerExternalId: "ignored" }],
            elements: [
              {
                externalId: "a".repeat(20),
                kind: "node",
                label: { format: "plain", text: "b".repeat(20) },
                geometry: { points: [{ x: 1, y: 2 }] },
                style: { raw: "key=value;flag", properties: { key: "value" }, uninterpreted: ["flag"] },
                layerExternalId: "layer",
              },
              { externalId: "ignored", kind: "node" },
            ],
          },
        ],
      },
      {
        limits: {
          maxStringLength: 8,
          maxLayersPerPage: 1,
          maxElementsPerPage: 1,
          maxArrayItems: 1,
        },
      },
    );
    expect(snapshot.layers).toHaveLength(1);
    expect(snapshot.elements).toHaveLength(1);
    expect(snapshot.elements[0].drawioId).toBe("aaaaaaaa");
    expect(snapshot.elements[0].label?.text).toBe("b".repeat(20));
    expect(snapshot.findings.map((finding) => finding.code)).toContain("input_truncated");
  });

  it("normalizes a background-page derived fixture without visible-page state", () => {
    const snapshot = fromLegacyPagedModel(backgroundPageDerivedDiagram);
    expect(snapshot.pages).toHaveLength(2);
    const backgroundPage = snapshot.pages[1];
    expect(getElementsByPage(snapshot, backgroundPage.internalId)[0].drawioId).toBe(
      "background-node",
    );
  });
});

describe("legacy adapter boundary", () => {
  it("converts a parent pointing to a known layer into layer membership", () => {
    const canonical = toCanonicalDiagramInput(simpleValidDiagram);
    const edge = canonical.pages?.[0]?.elements?.find((element) => element.externalId === "edge-web-api");
    expect(edge?.layerExternalId).toBe("layer-default");
    expect(edge?.parentExternalId).toBeUndefined();
  });

  it("preserves a parent pointing to a real group as containment", () => {
    const canonical = toCanonicalDiagramInput({
      documentId: "doc-group-parent",
      pages: [
        {
          page: { id: "page", index: 0, name: "Page" },
          layers: [{ id: "layer", name: "Layer" }],
          cells: [
            { id: "group", style: "group", edge: false, layer: { id: "layer" } },
            { id: "child", edge: false, parent: { id: "group" }, layer: { id: "layer" } },
          ],
        },
      ],
    });
    const child = canonical.pages?.[0]?.elements?.find((element) => element.externalId === "child");
    expect(child?.parentExternalId).toBe("group");
    expect(child?.layerExternalId).toBe("layer");
    expect(codes(normalizeDiagram(canonical))).not.toContain("missing_layer");
  });

  it("does not emit missing_layer when a group parent has no explicit layer", () => {
    const snapshot = fromLegacyPagedModel({
      documentId: "doc-group-no-layer",
      pages: [
        {
          page: { id: "page", index: 0, name: "Page" },
          layers: [{ id: "layer", name: "Layer" }],
          cells: [
            { id: "group", style: "group", edge: false, layer: { id: "layer" } },
            { id: "child", edge: false, parent: { id: "group" } },
          ],
        },
      ],
    });
    const child = getElementsByDrawioId(snapshot, "child")[0];
    const group = getElementsByDrawioId(snapshot, "group")[0];
    expect(child.parentId).toBe(group.internalId);
    expect(child.layerId).toBeUndefined();
    expect(codes(snapshot)).not.toContain("missing_layer");
  });

  it("prefers explicit layer over parent-layer fallback", () => {
    const canonical = toCanonicalDiagramInput({
      pages: [
        {
          page: { id: "page", index: 0, name: "Page" },
          layers: [{ id: "layer-a" }, { id: "layer-b" }],
          cells: [
            {
              id: "node",
              edge: false,
              parent: { id: "layer-a" },
              layer: { id: "layer-b" },
            },
          ],
        },
      ],
    });
    const node = canonical.pages?.[0]?.elements?.[0];
    expect(node?.layerExternalId).toBe("layer-b");
    expect(node?.parentExternalId).toBeUndefined();
  });

  it("converts legacy { id } references to simple canonical references", () => {
    const canonical = toCanonicalDiagramInput(simpleValidDiagram);
    const edge = canonical.pages?.[0]?.elements?.find((element) => element.externalId === "edge-web-api");
    expect(edge?.sourceExternalId).toBe("web");
    expect(edge?.targetExternalId).toBe("api");
  });

  it("transforms legacy labels and metadata without leaking mxCell structures to core input", () => {
    const canonical = toCanonicalDiagramInput(dangerousMetadataDiagram);
    const element = canonical.pages?.[0]?.elements?.[0];
    expect(element?.label?.html).toBe("<b>Service</b>");
    expect(element?.metadata?.owner).toBe("platform");
    expect(JSON.stringify(element)).not.toContain("attributes");
    expect(JSON.stringify(element)).not.toContain("nodeName");
  });
});

function codes(snapshot: { findings: readonly { code: string }[] }) {
  return snapshot.findings.map((finding) => finding.code);
}
