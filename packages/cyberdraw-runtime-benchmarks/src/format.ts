import type {
  BenchmarkRunResult,
  BenchmarkSuiteResult,
} from "./types.js";

export function formatHuman(result: BenchmarkSuiteResult): string {
  const lines = [
    `CyberDraw M6 runtime snapshot benchmark (${result.benchmarkVersion})`,
    `commit=${result.environment.commit} node=${result.environment.node} pnpm=${result.environment.pnpm} os=${result.environment.os} arch=${result.environment.arch}`,
    `iterations=${result.config.iterations} warmup=${result.config.warmup} seed=${result.config.seed}`,
    "",
    "fixture | scenario | scope | bytes p50 | total p50 ms | total p95 ms | payload reduction | time reduction | outcome",
    "--- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---",
  ];
  for (const run of result.results) {
    lines.push(formatRunRow(run));
  }
  return `${lines.join("\n")}\n`;
}

export function formatMarkdown(result: BenchmarkSuiteResult): string {
  return [
    "# M6 Runtime Snapshot Benchmark Summary",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    "## Environment",
    "",
    `- Node: ${result.environment.node}`,
    `- pnpm: ${result.environment.pnpm}`,
    `- OS: ${result.environment.os}`,
    `- Architecture: ${result.environment.arch}`,
    `- Commit: ${result.environment.commit}`,
    `- Iterations: ${result.config.iterations}`,
    `- Warmup: ${result.config.warmup}`,
    `- Seed: ${result.config.seed}`,
    "",
    "## Results",
    "",
    "| Fixture | Scenario | Scope | Bytes p50 | Total p50 ms | Total p95 ms | Adapter p50 ms | Normalize p50 ms | Payload reduction | Time reduction | Outcome |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...result.results.map(formatMarkdownRunRow),
    "",
    "Memory values are process heap deltas observed around each iteration and are approximate, not peak heap measurements.",
    "",
  ].join("\n");
}

function formatRunRow(run: BenchmarkRunResult): string {
  return [
    run.fixture,
    run.scenario.name,
    run.scenario.scope.kind,
    Math.round(run.metrics.jsonBytes.median),
    fixed(run.metrics.totalMs.median),
    fixed(run.metrics.totalMs.p95),
    percent(run.payloadReductionPercent),
    percent(run.timeReductionPercent),
    run.hardLimitOutcome,
  ].join(" | ");
}

function formatMarkdownRunRow(run: BenchmarkRunResult): string {
  return `| ${[
    run.fixture,
    run.scenario.name,
    run.scenario.scope.kind,
    Math.round(run.metrics.jsonBytes.median).toString(),
    fixed(run.metrics.totalMs.median),
    fixed(run.metrics.totalMs.p95),
    fixed(run.metrics.adapterMs.median),
    fixed(run.metrics.normalizationMs.median),
    percent(run.payloadReductionPercent),
    percent(run.timeReductionPercent),
    run.hardLimitOutcome,
  ].join(" | ")} |`;
}

function fixed(value: number | undefined): string {
  return value === undefined ? "n/a" : value.toFixed(2);
}

function percent(value: number | undefined): string {
  return value === undefined ? "n/a" : `${value.toFixed(1)}%`;
}
