import type { LegacyPagedModelInput } from "../legacy-adapter.js";

export const simpleValidDiagram: LegacyPagedModelInput = {
  documentId: "doc-simple",
  pages: [
    {
      page: { id: "page-main", index: 0, name: "Main" },
      layers: [{ id: "layer-default", name: "Default Layer", visible: true }],
      cells: [
        {
          id: "web",
          value: "Web",
          geometry: { x: 40, y: 40, width: 120, height: 60 },
          style: "rounded=1;whiteSpace=wrap;html=1;",
          edge: false,
          layer: { id: "layer-default", name: "Default Layer" },
        },
        {
          id: "api",
          value: "API",
          geometry: { x: 240, y: 40, width: 120, height: 60 },
          style: "rounded=1;whiteSpace=wrap;html=1;",
          edge: false,
          layer: { id: "layer-default", name: "Default Layer" },
        },
        {
          id: "edge-web-api",
          value: "HTTPS",
          geometry: { relative: true, points: [{ x: 180, y: 70 }] },
          style: "endArrow=classic;html=1;rounded=0;",
          edge: true,
          parent: { id: "layer-default" },
          source: { id: "web" },
          target: { id: "api" },
          layer: { id: "layer-default", name: "Default Layer" },
        },
      ],
    },
  ],
};

export const multiPageDiagram: LegacyPagedModelInput = {
  documentId: "doc-pages",
  pages: [
    {
      page: { id: "page-a", index: 0, name: "A" },
      layers: [{ id: "layer-a", name: "Layer A" }],
      cells: [
        {
          id: "shared",
          value: "A node",
          edge: false,
          layer: { id: "layer-a", name: "Layer A" },
        },
      ],
    },
    {
      page: { id: "page-b", index: 1, name: "B" },
      layers: [{ id: "layer-b", name: "Layer B" }],
      cells: [
        {
          id: "shared",
          value: "B node",
          edge: false,
          layer: { id: "layer-b", name: "Layer B" },
        },
      ],
    },
  ],
};

export const multiLayerDiagram: LegacyPagedModelInput = {
  documentId: "doc-layers",
  pages: [
    {
      page: { id: "page-layers", index: 0, name: "Layers" },
      layers: [
        { id: "layer-visible", name: "Visible", visible: true, locked: false },
        { id: "layer-locked", name: "Locked", visible: false, locked: true },
      ],
      cells: [
        {
          id: "n1",
          value: "Visible node",
          edge: false,
          layer: { id: "layer-visible", name: "Visible" },
        },
        {
          id: "n2",
          value: "Locked node",
          edge: false,
          layer: { id: "layer-locked", name: "Locked" },
        },
      ],
    },
  ],
};

export const duplicateIdsDiagram: LegacyPagedModelInput = {
  documentId: "doc-duplicates",
  pages: [
    {
      page: { id: "page-duplicates", index: 0, name: "Duplicates" },
      layers: [{ id: "layer-default", name: "Default" }],
      cells: [
        { id: "dup", value: "One", edge: false, layer: { id: "layer-default" } },
        { id: "dup", value: "Two", edge: false, layer: { id: "layer-default" } },
        {
          id: "edge-ambiguous",
          value: "",
          edge: true,
          source: { id: "dup" },
          target: { id: "dup" },
          layer: { id: "layer-default" },
        },
      ],
    },
  ],
};

export const brokenSourceDiagram: LegacyPagedModelInput = {
  documentId: "doc-broken-source",
  pages: [
    {
      page: { id: "page-source", index: 0, name: "Broken source" },
      layers: [{ id: "layer-default", name: "Default" }],
      cells: [
        { id: "target", value: "Target", edge: false, layer: { id: "layer-default" } },
        {
          id: "edge",
          edge: true,
          source: { id: "missing-source" },
          target: { id: "target" },
          layer: { id: "layer-default" },
        },
      ],
    },
  ],
};

export const brokenTargetDiagram: LegacyPagedModelInput = {
  documentId: "doc-broken-target",
  pages: [
    {
      page: { id: "page-target", index: 0, name: "Broken target" },
      layers: [{ id: "layer-default", name: "Default" }],
      cells: [
        { id: "source", value: "Source", edge: false, layer: { id: "layer-default" } },
        {
          id: "edge",
          edge: true,
          source: { id: "source" },
          target: { id: "missing-target" },
          layer: { id: "layer-default" },
        },
      ],
    },
  ],
};

export const brokenParentDiagram: LegacyPagedModelInput = {
  documentId: "doc-broken-parent",
  pages: [
    {
      page: { id: "page-parent", index: 0, name: "Broken parent" },
      layers: [{ id: "layer-default", name: "Default" }],
      cells: [
        {
          id: "child",
          value: "Child",
          edge: false,
          parent: { id: "missing-parent" },
          layer: { id: "layer-default" },
        },
      ],
    },
  ],
};

export const brokenLayerDiagram: LegacyPagedModelInput = {
  documentId: "doc-broken-layer",
  pages: [
    {
      page: { id: "page-layer", index: 0, name: "Broken layer" },
      layers: [{ id: "layer-default", name: "Default" }],
      cells: [
        {
          id: "node",
          value: "Node",
          edge: false,
          layer: { id: "missing-layer", name: "Missing" },
        },
      ],
    },
  ],
};

export const elementWithoutIdDiagram: LegacyPagedModelInput = {
  documentId: "doc-without-id",
  pages: [
    {
      page: { id: "page-without-id", index: 0, name: "Without ID" },
      layers: [{ id: "layer-default", name: "Default" }],
      cells: [
        { value: "No ID", edge: false, layer: { id: "layer-default" } },
      ],
    },
  ],
};

export const unknownElementDiagram: LegacyPagedModelInput = {
  documentId: "doc-unknown",
  pages: [
    {
      page: { id: "page-unknown", index: 0, name: "Unknown" },
      layers: [{ id: "layer-default", name: "Default" }],
      cells: [
        {
          id: "unknown",
          value: { nodeName: "mxCell", attributes: { label: "Unknown" } },
          edge: undefined,
          vertex: false,
          layer: { id: "layer-default" },
        },
      ],
    },
  ],
};

export const parentCycleDiagram: LegacyPagedModelInput = {
  documentId: "doc-cycle",
  pages: [
    {
      page: { id: "page-cycle", index: 0, name: "Cycle" },
      layers: [{ id: "layer-default", name: "Default" }],
      cells: [
        { id: "a", value: "A", edge: false, parent: { id: "b" }, layer: { id: "layer-default" } },
        { id: "b", value: "B", edge: false, parent: { id: "a" }, layer: { id: "layer-default" } },
      ],
    },
  ],
};

export const dangerousMetadataDiagram: LegacyPagedModelInput = {
  documentId: "doc-dangerous",
  pages: [
    {
      page: { id: "page-dangerous", index: 0, name: "Dangerous" },
      layers: [{ id: "layer-default", name: "Default" }],
      cells: [
        {
          id: "html",
          value: {
            nodeName: "object",
            attributes: {
              label: "<b>Service</b>",
              owner: "platform",
              __proto__: "polluted",
              constructor: "bad",
              prototype: "bad",
            },
          },
          style: "html=1;rounded=1;__proto__=bad;",
          edge: false,
          layer: { id: "layer-default" },
        },
      ],
    },
  ],
};

export const materializedMissingChildDiagram: LegacyPagedModelInput = {
  documentId: "doc-child",
  pages: [
    {
      page: { id: "page-child", index: 0, name: "Child refs" },
      layers: [{ id: "layer-default", name: "Default" }],
      cells: [
        {
          id: "parent",
          value: "Parent",
          edge: false,
          childIds: ["missing-child"],
          layer: { id: "layer-default" },
        },
      ],
    },
  ],
};

export const backgroundPageDerivedDiagram: LegacyPagedModelInput = {
  documentId: "doc-background",
  pages: [
    {
      page: { id: "page-visible", index: 0, name: "Visible" },
      layers: [{ id: "layer-visible", name: "Visible layer" }],
      cells: [
        {
          id: "visible-node",
          value: "Visible",
          edge: false,
          layer: { id: "layer-visible" },
        },
      ],
    },
    {
      page: { id: "page-background", index: 1, name: "Background" },
      layers: [{ id: "layer-background", name: "Background layer" }],
      cells: [
        {
          id: "background-node",
          value: "Background",
          edge: false,
          layer: { id: "layer-background" },
        },
      ],
    },
  ],
};
