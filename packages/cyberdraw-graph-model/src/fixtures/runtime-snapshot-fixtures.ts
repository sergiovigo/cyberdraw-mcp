import type { RuntimeSnapshotInput } from "../runtime-snapshot-adapter.js";

export const runtimeSnapshotFixture: RuntimeSnapshotInput = {
  schemaVersion: "cyberdraw.runtime-snapshot.v1",
  document: {
    id: "runtime-doc",
    title: "Runtime Fixture",
    runtimeVersion: "30.2.6",
    revisionSignals: {
      contentRevision: "fnv1a32:fixture",
    },
  },
  pages: [
    {
      id: "page-visible",
      index: 0,
      name: "Visible",
      visible: true,
      background: false,
      layers: [
        {
          id: "layer-default",
          name: "Default Layer",
          visible: true,
          locked: false,
          pageId: "page-visible",
          index: 0,
        },
        {
          id: "layer-locked",
          name: "Locked",
          visible: true,
          locked: true,
          pageId: "page-visible",
          index: 1,
        },
      ],
      elements: [
        {
          id: "group-1",
          pageId: "page-visible",
          layerId: "layer-default",
          parentId: "layer-default",
          type: "group",
          label: { format: "plain", text: "Group" },
          style: { raw: "group" },
          geometry: { x: 20, y: 20, width: 300, height: 200 },
        },
        {
          id: "node-a",
          pageId: "page-visible",
          layerId: "layer-default",
          parentId: "group-1",
          type: "vertex",
          label: { format: "html", text: "Web", html: "<b>Web</b>" },
          style: {
            raw: "rounded=1;whiteSpace=wrap;html=1;shape=mxgraph.aws4.resourceIcon;",
          },
          geometry: { x: 40, y: 60, width: 120, height: 60 },
          tags: ["frontend"],
          customAttributes: {
            owner: "team-a",
            constructor: "blocked",
          },
        },
        {
          id: "node-b",
          pageId: "page-visible",
          layerId: "layer-locked",
          parentId: "layer-locked",
          type: "vertex",
          label: { format: "plain", text: "API" },
          geometry: { x: 220, y: 60, width: 120, height: 60 },
        },
        {
          id: "edge-a-b",
          pageId: "page-visible",
          layerId: "layer-default",
          parentId: "layer-default",
          sourceId: "node-a",
          targetId: "node-b",
          type: "edge",
          style: { raw: "endArrow=block;html=1;rounded=0;" },
          geometry: { relative: true },
          waypoints: [{ x: 170, y: 90 }],
          relativeGeometry: true,
        },
        {
          id: "unknown-1",
          pageId: "page-visible",
          layerId: "layer-default",
          parentId: "missing-parent",
          type: "unknown",
          raw: { customRuntimeFlag: true },
        },
      ],
    },
    {
      id: "page-background",
      index: 1,
      name: "Background",
      visible: false,
      background: true,
      layers: [
        {
          id: "background-layer",
          name: "Background Layer",
          visible: true,
          locked: false,
          pageId: "page-background",
          index: 0,
        },
      ],
      elements: [
        {
          id: "background-node",
          pageId: "page-background",
          layerId: "background-layer",
          parentId: "background-layer",
          type: "vertex",
          label: { format: "plain", text: "Background Node" },
        },
        {
          id: "broken-edge",
          pageId: "page-background",
          layerId: "background-layer",
          parentId: "background-layer",
          sourceId: "background-node",
          targetId: "missing-target",
          type: "edge",
        },
      ],
    },
  ],
  diagnostics: [],
  truncated: false,
};

export const equivalentRuntimeSnapshotFixture: RuntimeSnapshotInput = {
  ...runtimeSnapshotFixture,
  document: {
    ...runtimeSnapshotFixture.document,
    revisionSignals: {
      contentRevision: "fnv1a32:other",
    },
  },
};
