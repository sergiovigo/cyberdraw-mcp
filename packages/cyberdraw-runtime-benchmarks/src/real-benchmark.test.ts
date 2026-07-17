import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { summarizeSamples } from "./stats.js";
import { buildPageXml, importantIdsForPage, summarizeFixture } from "./real-fixtures.js";
import { formatRealMarkdown } from "./real-format.js";
import {
  buildRealBenchmarkScenarios,
  defaultRealBenchmarkConfig,
  parseRealScenarioNames,
  realFixtureSpecs,
} from "./real-scenarios.js";
import type { RealBenchmarkSuiteResult, RealFixtureRuntime } from "./real-types.js";

describe("M7 real-environment benchmark structure", () => {
  it("generates deterministic synthetic draw.io page XML from a seed", () => {
    const first = buildPageXml(realFixtureSpecs.small, 424242, 0);
    const second = buildPageXml(realFixtureSpecs.small, 424242, 0);
    const different = buildPageXml(realFixtureSpecs.small, 424243, 0);
    expect(first).toBe(second);
    expect(first).not.toBe(different);
    expect(first).toContain("m7-p0-l0-v0");
    expect(first).not.toContain("/home/");
  });

  it("defines required real scenario categories", () => {
    const runtime = fakeRuntime();
    const scenarios = buildRealBenchmarkScenarios(runtime);
    const names = scenarios.map((scenario) => scenario.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "document",
        "pages-visible",
        "pages-background",
        "pages-missing",
        "layers-hidden",
        "layers-context-only",
        "selection-empty",
        "selection-multiple",
        "freshness-inside-scope",
        "freshness-outside-scope",
      ]),
    );
    expect(parseRealScenarioNames("document,pages-visible")).toEqual([
      "document",
      "pages-visible",
    ]);
  });

  it("keeps warmup and iteration configuration explicit", () => {
    expect(defaultRealBenchmarkConfig.warmup).toBeGreaterThanOrEqual(0);
    expect(defaultRealBenchmarkConfig.iterations).toBeGreaterThan(0);
    expect(defaultRealBenchmarkConfig.scenarioNames).not.toContain("all");
  });

  it("activates main-thread impact measurement explicitly from the real M7 benchmark", () => {
    const runnerSource = readFileSync(
      resolve("src/real-runner.ts"),
      "utf8",
    );
    expect(runnerSource).toContain("measureMainThreadImpact: true");
  });

  it("summarizes statistics without absolute timing assertions", () => {
    expect(summarizeSamples([3, 1, 2])).toMatchObject({
      median: 2,
      p95: 3,
      min: 1,
      max: 3,
    });
  });

  it("formats valid JSON-derived Markdown without sensitive content", () => {
    const result: RealBenchmarkSuiteResult = {
      generatedAt: "2026-07-17T00:00:00.000Z",
      benchmarkVersion: "m7-real-environment-snapshot-benchmarks-v1",
      environment: {
        node: "v24.18.0",
        pnpm: "10.8.1",
        os: "Linux",
        arch: "x64",
        commit: "test",
        drawioRuntimeVersion: "30.3.12",
        transport: "http-ws",
        httpsCaddy: "failed",
      },
      config: defaultRealBenchmarkConfig,
      results: [],
    };
    expect(JSON.parse(JSON.stringify(result)).benchmarkVersion).toBe(
      "m7-real-environment-snapshot-benchmarks-v1",
    );
    const markdown = formatRealMarkdown(result);
    expect(markdown).toContain("M7 Real-Environment");
    expect(markdown).not.toMatch(/\/home\/|sergiovigo|OPENAI|SECRET|<mxGraphModel/);
  });
});

function fakeRuntime(): RealFixtureRuntime {
  const spec = realFixtureSpecs.small;
  return {
    fixture: "small",
    seed: 424242,
    pages: [
      { id: "page-0", index: 0, layerIds: ["m7-layer-0", "m7-layer-1"] },
      { id: "page-1", index: 1, layerIds: ["m7-layer-0", "m7-layer-1"] },
    ],
    summary: summarizeFixture(spec),
    importantIds: importantIdsForPage(0, spec),
  };
}
