import { describe, expect, it } from "@jest/globals";

import { fromLegacyPagedModel } from "./index.js";
import type { LegacyPagedModelInput } from "./legacy-adapter.js";

describe("normalization performance smoke", () => {
  it.each([100, 2_000, 20_000])(
    "normalizes and validates %i elements without product thresholds",
    (count) => {
      const fixture = generateFixture(count);
      const beforeMemory = process.memoryUsage().heapUsed;
      const startedAt = performance.now();
      const snapshot = fromLegacyPagedModel(fixture);
      const normalizedAt = performance.now();
      const findingCount = snapshot.findings.length;
      const finishedAt = performance.now();
      const afterMemory = process.memoryUsage().heapUsed;

      const metrics = {
        count,
        normalizeMs: normalizedAt - startedAt,
        brokenReferenceMs: finishedAt - normalizedAt,
        approxHeapDeltaBytes: afterMemory - beforeMemory,
        findingCount,
      };

      expect(metrics.normalizeMs).toBeGreaterThanOrEqual(0);
      expect(metrics.brokenReferenceMs).toBeGreaterThanOrEqual(0);
      expect(snapshot.elements).toHaveLength(count);
      expect(findingCount).toBe(0);
    },
    60_000,
  );
});

function generateFixture(count: number): LegacyPagedModelInput {
  const cells = [];
  for (let index = 0; index < count; index++) {
    if (index > 0 && index % 5 === 0) {
      cells.push({
        id: `edge-${index}`,
        edge: true,
        source: { id: `node-${index - 1}` },
        target: { id: `node-${index - 2}` },
        layer: { id: "layer-default" },
        style: "endArrow=classic;html=1;",
      });
    } else {
      cells.push({
        id: `node-${index}`,
        edge: false,
        value: `Node ${index}`,
        geometry: { x: index, y: index, width: 80, height: 40 },
        layer: { id: "layer-default" },
        style: "rounded=1;html=1;",
      });
    }
  }

  return {
    documentId: `perf-${count}`,
    pages: [
      {
        page: { id: "page", index: 0, name: "Performance" },
        layers: [{ id: "layer-default", name: "Default" }],
        cells,
      },
    ],
  };
}
