import type {
  RealBenchmarkRunResult,
  RealBenchmarkSuiteResult,
} from "./real-types.js";

export function formatRealHuman(result: RealBenchmarkSuiteResult): string {
  const lines = [
    `CyberDraw M7 real-environment benchmark (${result.benchmarkVersion})`,
    `commit=${result.environment.commit} node=${result.environment.node} pnpm=${result.environment.pnpm} drawio=${result.environment.drawioRuntimeVersion ?? "unknown"}`,
    `iterations=${result.config.iterations} warmup=${result.config.warmup} seed=${result.config.seed}`,
    "",
    "fixture | scenario | scope | bytes p50 | plugin p50 ms | ws p50 ms | server validation p50 ms | adapter p50 ms | normalize p50 ms | total p50 ms | p95 ms | main-thread drift p50 ms | payload reduction | outcome",
    "--- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---",
    ...result.results.map(formatRealRow),
  ];
  return `${lines.join("\n")}\n`;
}

export function formatRealMarkdown(result: RealBenchmarkSuiteResult): string {
  return [
    "# M7 Real-Environment Runtime Snapshot Benchmark Summary",
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
    `- draw.io runtime: ${result.environment.drawioRuntimeVersion ?? "unknown"}`,
    `- Transport: ${result.environment.transport}`,
    `- HTTPS/Caddy suite: ${result.environment.httpsCaddy}`,
    `- Iterations: ${result.config.iterations}`,
    `- Warmup: ${result.config.warmup}`,
    `- Seed: ${result.config.seed}`,
    "",
    "## Results",
    "",
    "| Fixture | Scenario | Scope | Bytes p50 | Plugin p50 ms | WS p50 ms | Server validation p50 ms | Adapter p50 ms | Normalize p50 ms | Total p50 ms | Total p95 ms | Main-thread drift p50 ms | Payload reduction | Outcome | UI preserved |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
    ...result.results.map(formatRealMarkdownRow),
    "",
    "Memory values are Node process heap deltas around each iteration and are approximate, not peak memory. Main-thread values are timer/RAF drift approximations observed in the browser.",
    "",
  ].join("\n");
}

function formatRealRow(run: RealBenchmarkRunResult): string {
  return [
    run.fixture,
    run.scenario.name,
    run.scenario.scope.kind,
    Math.round(run.metrics.jsonBytes.median),
    fixed(run.metrics.pluginTotalMs.median),
    fixed(run.metrics.websocketRoundTripMs.median),
    fixed(run.metrics.serverValidationMs.median),
    fixed(run.metrics.adapterMs.median),
    fixed(run.metrics.normalizationMs.median),
    fixed(run.metrics.totalScenarioMs.median),
    fixed(run.metrics.totalScenarioMs.p95),
    fixed(run.metrics.mainThreadTimerDriftMs.median),
    percent(run.payloadReductionPercent),
    run.hardLimitOutcome,
  ].join(" | ");
}

function formatRealMarkdownRow(run: RealBenchmarkRunResult): string {
  return `| ${[
    run.fixture,
    run.scenario.name,
    run.scenario.scope.kind,
    Math.round(run.metrics.jsonBytes.median).toString(),
    fixed(run.metrics.pluginTotalMs.median),
    fixed(run.metrics.websocketRoundTripMs.median),
    fixed(run.metrics.serverValidationMs.median),
    fixed(run.metrics.adapterMs.median),
    fixed(run.metrics.normalizationMs.median),
    fixed(run.metrics.totalScenarioMs.median),
    fixed(run.metrics.totalScenarioMs.p95),
    fixed(run.metrics.mainThreadTimerDriftMs.median),
    percent(run.payloadReductionPercent),
    run.hardLimitOutcome,
    uiPreserved(run),
  ].join(" | ")} |`;
}

function uiPreserved(run: RealBenchmarkRunResult): string {
  const result = run.uiPreservation;
  return result.activePagePreserved &&
    result.selectionPreserved &&
    result.zoomPreserved &&
    result.noDialogsOpen &&
    result.noEditing
    ? "yes"
    : "no";
}

function fixed(value: number | undefined): string {
  return value === undefined ? "n/a" : value.toFixed(2);
}

function percent(value: number | undefined): string {
  return value === undefined ? "n/a" : `${value.toFixed(1)}%`;
}
