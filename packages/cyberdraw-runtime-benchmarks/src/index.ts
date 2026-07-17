export {
  FIXTURE_PRESETS,
  buildSyntheticDiagram,
  defaultBenchmarkConfig,
} from "./synthetic-fixtures.js";
export { buildBenchmarkScenarios } from "./scenarios.js";
export { runBenchmarkSuite } from "./runner.js";
export { buildPageXml, installRealFixture } from "./real-fixtures.js";
export { formatRealHuman, formatRealMarkdown } from "./real-format.js";
export {
  buildRealBenchmarkScenarios,
  defaultRealBenchmarkConfig,
  parseRealScenarioNames,
  realFixtureSpecs,
} from "./real-scenarios.js";
export { runRealBenchmarkSuite } from "./real-runner.js";
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
export type {
  RealBenchmarkConfig,
  RealBenchmarkFixtureName,
  RealBenchmarkRunResult,
  RealBenchmarkScenario,
  RealBenchmarkSuiteResult,
} from "./real-types.js";
