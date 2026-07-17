import { describe, expect, it } from "@jest/globals";

import { formatMarkdown } from "./format.js";
import { runBenchmarkSuite } from "./runner.js";
import { buildBenchmarkScenarios } from "./scenarios.js";
import { buildSyntheticDiagram } from "./synthetic-fixtures.js";
import { percentile, summarizeSamples } from "./stats.js";

describe("cyberdraw runtime benchmark harness", () => {
  it("generates deterministic synthetic fixtures", () => {
    const first = buildSyntheticDiagram("small", 123);
    const second = buildSyntheticDiagram("small", 123);

    expect(first.summary).toEqual(second.summary);
    expect(first.pages[0]?.elements[10]).toEqual(second.pages[0]?.elements[10]);
    expect(first.summary.pages).toBe(2);
    expect(first.summary.elements).toBe(360);
    expect(first.summary.edges).toBeGreaterThan(0);
    expect(first.summary.groups).toBeGreaterThan(0);
  });

  it("defines required scope scenarios", () => {
    const scenarios = buildBenchmarkScenarios(buildSyntheticDiagram("small", 123));
    const categories = new Set(scenarios.map((scenario) => scenario.category));

    expect(categories).toEqual(
      new Set(["document", "pages", "layers", "selection", "freshness", "graph-model"]),
    );
    expect(scenarios.map((scenario) => scenario.name)).toEqual(
      expect.arrayContaining([
        "document",
        "pages-visible",
        "pages-background",
        "layers-cross-layer-edge",
        "selection-empty",
        "freshness-inside-scope",
        "graph-partial-truncated",
      ]),
    );
  });

  it("computes stable percentile summaries", () => {
    expect(percentile([1, 2, 3, 4, 5], 95)).toBe(5);
    expect(summarizeSamples([1, 2, 3]).median).toBe(2);
  });

  it("runs a JSON-serializable smoke benchmark without mutating fixtures", async () => {
    const result = await runBenchmarkSuite({
      fixtures: ["small"],
      scenarioNames: ["document", "pages-visible", "layers-small", "selection-one"],
      iterations: 2,
      warmup: 1,
      seed: 123,
      includeRaw: true,
      format: "json",
    });

    expect(result.results).toHaveLength(4);
    expect(JSON.parse(JSON.stringify(result)).benchmarkVersion).toBe(
      "m6-runtime-snapshot-benchmarks-v1",
    );
    expect(result.results[0]?.metrics.totalMs.median).toBeGreaterThanOrEqual(0);
    expect(result.results[1]?.payloadReductionPercent).toBeGreaterThan(0);
    expect(formatMarkdown(result)).toContain("M6 Runtime Snapshot Benchmark Summary");
    expect(JSON.stringify(result)).not.toContain("__proto__");
  }, 60_000);
});
