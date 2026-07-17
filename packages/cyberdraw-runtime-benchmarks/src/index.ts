export {
  FIXTURE_PRESETS,
  buildSyntheticDiagram,
  defaultBenchmarkConfig,
} from "./synthetic-fixtures.js";
export { buildBenchmarkScenarios } from "./scenarios.js";
export { runBenchmarkSuite } from "./runner.js";
export { percentile, summarizeSamples } from "./stats.js";
export type {
  BenchmarkConfig,
  BenchmarkFixtureName,
  BenchmarkFormat,
  BenchmarkRunResult,
  BenchmarkScenario,
  BenchmarkSuiteResult,
  SyntheticDiagram,
} from "./types.js";
