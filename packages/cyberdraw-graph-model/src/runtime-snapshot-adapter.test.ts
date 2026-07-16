import { describe, expect, it } from "@jest/globals";

import {
  fromRuntimeSnapshot,
  normalizeDiagram,
  serializeSnapshot,
  toCanonicalRuntimeSnapshotInput,
} from "./index.js";
import {
  equivalentRuntimeSnapshotFixture,
  runtimeSnapshotFixture,
} from "./fixtures/runtime-snapshot-fixtures.js";

describe("runtime snapshot adapter", () => {
  it("converts runtime snapshots to CanonicalDiagramInput", () => {
    const canonical = toCanonicalRuntimeSnapshotInput(runtimeSnapshotFixture);

    expect(canonical.documentId).toBe("runtime-doc");
    expect(canonical.pages).toHaveLength(2);
    expect(canonical.pages?.[0]?.layers).toHaveLength(2);
    expect(canonical.pages?.[0]?.elements).toHaveLength(5);
    expect(canonical.pages?.[1]?.elements).toHaveLength(2);
  });

  it("normalizes runtime snapshot pages, layers, groups and edges", () => {
    const snapshot = fromRuntimeSnapshot(runtimeSnapshotFixture);

    expect(snapshot.pages.map((page) => page.drawioId)).toEqual([
      "page-visible",
      "page-background",
    ]);
    expect(snapshot.layers.map((layer) => layer.drawioId)).toContain(
      "layer-locked",
    );

    const edge = snapshot.elements.find((element) => element.drawioId === "edge-a-b");
    expect(edge?.kind).toBe("edge");
    if (edge?.kind !== "edge") {
      throw new Error("expected edge");
    }
    expect(edge.sourceId).toContain("node-a");
    expect(edge.targetId).toContain("node-b");
    expect(edge.geometry?.relative).toBe(true);
    expect(edge.geometry?.points).toEqual([{ x: 170, y: 90 }]);

    const group = snapshot.elements.find((element) => element.drawioId === "group-1");
    expect(group?.kind).toBe("group");
  });

  it("classifies layer parent separately from containment parent", () => {
    const snapshot = fromRuntimeSnapshot(runtimeSnapshotFixture);
    const nodeB = snapshot.elements.find((element) => element.drawioId === "node-b");

    expect(nodeB?.layerId).toContain("layer-locked");
    expect(nodeB?.parentId).toBeUndefined();
  });

  it("keeps unknown elements and reports broken references", () => {
    const snapshot = fromRuntimeSnapshot(runtimeSnapshotFixture);
    const unknown = snapshot.elements.find((element) => element.drawioId === "unknown-1");

    expect(unknown?.kind).toBe("unknown");
    expect(snapshot.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(["missing_parent", "missing_edge_target"]),
    );
  });

  it("preserves HTML and dangerous metadata as inert sanitized data", () => {
    const snapshot = fromRuntimeSnapshot(runtimeSnapshotFixture);
    const nodeA = snapshot.elements.find((element) => element.drawioId === "node-a");

    expect(nodeA?.label).toEqual({
      format: "html",
      text: "Web",
      html: "<b>Web</b>",
    });
    expect(nodeA?.metadata?.owner).toBe("team-a");
    expect(nodeA?.metadata).not.toHaveProperty("constructor");
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("does not mutate input and is deterministic for equivalent input", () => {
    const input = structuredClone(runtimeSnapshotFixture);
    const before = JSON.stringify(input);
    const first = serializeSnapshot(fromRuntimeSnapshot(input));
    const second = serializeSnapshot(fromRuntimeSnapshot(equivalentRuntimeSnapshotFixture));

    expect(first).toBe(second);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("supports runtime fixture to graph model normalize flow", () => {
    const canonical = toCanonicalRuntimeSnapshotInput(runtimeSnapshotFixture);
    const snapshot = normalizeDiagram(canonical);

    expect(snapshot.schemaVersion).toBe("0.1-spike");
    expect(snapshot.elements).toHaveLength(7);
    expect(JSON.stringify(snapshot, (_key, value) => value instanceof Map ? [...value] : value)).toContain(
      "background-node",
    );
  });
});
