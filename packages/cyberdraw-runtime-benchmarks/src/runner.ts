import { execFileSync } from "node:child_process";
import { arch, type } from "node:os";
import { performance } from "node:perf_hooks";
import {
  stableStringify,
  validateRuntimeSnapshotResponseForRequest,
  type RuntimeSnapshot,
} from "cyberdraw-runtime-contract";
import {
  fromRuntimeSnapshot,
  toCanonicalRuntimeSnapshotInput,
} from "cyberdraw-graph-model";
import { buildBenchmarkScenarios } from "./scenarios.js";
import { extractSyntheticRuntimeSnapshot } from "./synthetic-extractor.js";
import { buildSyntheticDiagram, defaultBenchmarkConfig } from "./synthetic-fixtures.js";
import { summarizeSamples } from "./stats.js";
import type {
  BenchmarkConfig,
  BenchmarkMetricSummary,
  BenchmarkRunResult,
  BenchmarkSample,
  BenchmarkScenario,
  BenchmarkSuiteResult,
  SyntheticDiagram,
} from "./types.js";

export async function runBenchmarkSuite(
  config: Partial<BenchmarkConfig> = {},
): Promise<BenchmarkSuiteResult> {
  const resolved: BenchmarkConfig = {
    ...defaultBenchmarkConfig,
    ...config,
    fixtures: config.fixtures ?? defaultBenchmarkConfig.fixtures,
    scenarioNames: config.scenarioNames,
  };
  const results: BenchmarkRunResult[] = [];
  const documentBaselines = new Map<string, { bytes: number; totalMs: number }>();
  for (const fixture of resolved.fixtures) {
    const diagram = buildSyntheticDiagram(fixture, resolved.seed);
    const scenarios = buildBenchmarkScenarios(diagram).filter((scenario) =>
      resolved.scenarioNames ? resolved.scenarioNames.includes(scenario.name) : true,
    );
    const documentScenario =
      scenarios.find((scenario) => scenario.name === "document") ??
      buildBenchmarkScenarios(diagram).find((scenario) => scenario.name === "document")!;
    if (!documentBaselines.has(fixture)) {
      const baseline = runScenario(diagram, documentScenario, resolved);
      documentBaselines.set(fixture, {
        bytes: baseline.metrics.jsonBytes.median,
        totalMs: baseline.metrics.totalMs.median,
      });
      if (scenarios.includes(documentScenario)) {
        results.push(baseline);
      }
    }
    for (const scenario of scenarios) {
      if (scenario.name === "document") {
        continue;
      }
      const result = runScenario(diagram, scenario, resolved);
      const baseline = documentBaselines.get(fixture);
      if (baseline && baseline.bytes > 0) {
        results.push({
          ...result,
          documentBaselineBytes: baseline.bytes,
          scopedDocumentRatio: result.metrics.jsonBytes.median / baseline.bytes,
          payloadReductionPercent:
            100 - (result.metrics.jsonBytes.median / baseline.bytes) * 100,
          timeReductionPercent:
            baseline.totalMs > 0
              ? 100 - (result.metrics.totalMs.median / baseline.totalMs) * 100
              : undefined,
        });
      } else {
        results.push(result);
      }
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    benchmarkVersion: "m6-runtime-snapshot-benchmarks-v1",
    environment: {
      node: process.version,
      pnpm: readPnpmVersion(),
      os: type(),
      arch: arch(),
      commit: readCommit(),
    },
    config: resolved,
    results,
  };
}

function runScenario(
  diagram: SyntheticDiagram,
  scenario: BenchmarkScenario,
  config: BenchmarkConfig,
): BenchmarkRunResult {
  const samples: BenchmarkSample[] = [];
  let lastSnapshot: RuntimeSnapshot | undefined;
  let lastTraversal = {
    pagesVisited: 0,
    layersVisited: 0,
    elementsInspected: 0,
    elementsIncluded: 0,
    contextOnlyElements: 0,
    externalReferences: 0,
  };
  let hardLimitOutcome: BenchmarkRunResult["hardLimitOutcome"] = "within-limit";
  let graphModelFindings = 0;
  const totalRuns = config.warmup + config.iterations;
  for (let run = 0; run < totalRuns; run += 1) {
    const heapBeforeBytes = process.memoryUsage().heapUsed;
    const totalStart = performance.now();
    const scopeStart = performance.now();
    const extraction = extractSyntheticRuntimeSnapshot(diagram, scenario, {
      includeRaw: config.includeRaw,
    });
    const scopeResolutionMs = performance.now() - scopeStart;
    lastTraversal = extraction.traversal;
    hardLimitOutcome = extraction.hardLimitOutcome;
    if (!extraction.snapshot) {
      const totalMs = performance.now() - totalStart;
      const sample = zeroSample({
        scopeResolutionMs,
        totalMs,
        jsonBytes: extraction.attemptedJsonBytes ?? 0,
        heapBeforeBytes,
        heapAfterBytes: process.memoryUsage().heapUsed,
      });
      if (run >= config.warmup) {
        samples.push(sample);
      }
      continue;
    }
    const snapshot = extraction.snapshot;
    lastSnapshot = snapshot;
    const canonicalStart = performance.now();
    const canonical = stableStringify(snapshot);
    const canonicalizationMs = performance.now() - canonicalStart;
    const revisionStart = performance.now();
    stableStringify(snapshot.document.revisionSignals);
    const contentRevisionMs = performance.now() - revisionStart;
    const selectionRevisionStart = performance.now();
    if (snapshot.document.revisionSignals.selectionRevision) {
      stableStringify(snapshot.document.revisionSignals.selectionRevision);
    }
    const selectionRevisionMs = performance.now() - selectionRevisionStart;
    const serializationStart = performance.now();
    const json = JSON.stringify(snapshot);
    const jsonBytes = Buffer.byteLength(json, "utf8");
    const serializationMs = performance.now() - serializationStart;
    const validationStart = performance.now();
    const validation = validateRuntimeSnapshotResponseForRequest(
      JSON.parse(json),
      scenario.scope,
    );
    const validationMs = performance.now() - validationStart;
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    const adapterStart = performance.now();
    const canonicalInput = toCanonicalRuntimeSnapshotInput(validation.snapshot);
    const adapterMs = performance.now() - adapterStart;
    const normalizationStart = performance.now();
    const graph = fromRuntimeSnapshot(validation.snapshot);
    const normalizationMs = performance.now() - normalizationStart;
    graphModelFindings = graph.findings.length;
    const freshnessStart = performance.now();
    compareFreshness(snapshot, mutateSnapshotForFreshness(snapshot, scenario));
    const freshnessMs = performance.now() - freshnessStart;
    const totalMs = performance.now() - totalStart;
    const heapAfterBytes = process.memoryUsage().heapUsed;
    void canonical;
    void canonicalInput;
    const sample: BenchmarkSample = {
      scopeResolutionMs,
      syntheticTraversalMs: snapshot.performance.extractionMs,
      syntheticExtractionMs: scopeResolutionMs,
      canonicalizationMs,
      contentRevisionMs,
      selectionRevisionMs,
      serializationMs,
      validationMs,
      adapterMs,
      normalizationMs,
      freshnessMs,
      totalMs,
      jsonBytes,
      heapBeforeBytes,
      heapAfterBytes,
      heapDeltaBytes: heapAfterBytes - heapBeforeBytes,
    };
    if (run >= config.warmup) {
      samples.push(sample);
    }
  }
  return {
    fixture: diagram.fixture,
    scenario,
    seed: diagram.seed,
    iterations: config.iterations,
    warmup: config.warmup,
    fixtureSummary: diagram.summary,
    counts: {
      ...lastTraversal,
      diagnostics: lastSnapshot?.diagnostics.length ?? 0,
    },
    hardLimitOutcome,
    graphModelFindings,
    metrics: summarizeBenchmarkSamples(samples),
    notes: notesForScenario(scenario, hardLimitOutcome),
  };
}

function summarizeBenchmarkSamples(
  samples: readonly BenchmarkSample[],
): BenchmarkMetricSummary {
  return {
    scopeResolutionMs: summarizeSamples(samples.map((sample) => sample.scopeResolutionMs)),
    syntheticTraversalMs: summarizeSamples(samples.map((sample) => sample.syntheticTraversalMs)),
    syntheticExtractionMs: summarizeSamples(samples.map((sample) => sample.syntheticExtractionMs)),
    canonicalizationMs: summarizeSamples(samples.map((sample) => sample.canonicalizationMs)),
    contentRevisionMs: summarizeSamples(samples.map((sample) => sample.contentRevisionMs)),
    selectionRevisionMs: summarizeSamples(samples.map((sample) => sample.selectionRevisionMs)),
    serializationMs: summarizeSamples(samples.map((sample) => sample.serializationMs)),
    validationMs: summarizeSamples(samples.map((sample) => sample.validationMs)),
    adapterMs: summarizeSamples(samples.map((sample) => sample.adapterMs)),
    normalizationMs: summarizeSamples(samples.map((sample) => sample.normalizationMs)),
    freshnessMs: summarizeSamples(samples.map((sample) => sample.freshnessMs)),
    totalMs: summarizeSamples(samples.map((sample) => sample.totalMs)),
    jsonBytes: summarizeSamples(samples.map((sample) => sample.jsonBytes)),
    heapDeltaBytes: summarizeSamples(samples.map((sample) => sample.heapDeltaBytes)),
  };
}

function zeroSample(input: {
  readonly scopeResolutionMs: number;
  readonly totalMs: number;
  readonly jsonBytes: number;
  readonly heapBeforeBytes: number;
  readonly heapAfterBytes: number;
}): BenchmarkSample {
  return {
    scopeResolutionMs: input.scopeResolutionMs,
    syntheticTraversalMs: 0,
    syntheticExtractionMs: input.scopeResolutionMs,
    canonicalizationMs: 0,
    contentRevisionMs: 0,
    selectionRevisionMs: 0,
    serializationMs: 0,
    validationMs: 0,
    adapterMs: 0,
    normalizationMs: 0,
    freshnessMs: 0,
    totalMs: input.totalMs,
    jsonBytes: input.jsonBytes,
    heapBeforeBytes: input.heapBeforeBytes,
    heapAfterBytes: input.heapAfterBytes,
    heapDeltaBytes: input.heapAfterBytes - input.heapBeforeBytes,
  };
}

function mutateSnapshotForFreshness(
  snapshot: RuntimeSnapshot,
  scenario: BenchmarkScenario,
): RuntimeSnapshot {
  if (scenario.mutate === "inside-scope") {
    return {
      ...snapshot,
      document: {
        ...snapshot.document,
        revisionSignals: {
          ...snapshot.document.revisionSignals,
          contentRevision: "cyberdraw-content-v1:fnv1a64:ffffffffffffffff",
        },
      },
    };
  }
  if (scenario.mutate === "outside-scope" || scenario.mutate === "selection-only") {
    return snapshot;
  }
  return snapshot;
}

function compareFreshness(expected: RuntimeSnapshot, current: RuntimeSnapshot): string {
  if (
    expected.schemaVersion !== current.schemaVersion ||
    expected.contractVersion !== current.contractVersion
  ) {
    return "contract-changed";
  }
  if (
    expected.document.revisionSignals.documentId !==
    current.document.revisionSignals.documentId
  ) {
    return "document-changed";
  }
  if (
    stableStringify(expected.scope.requestedScope) !==
      stableStringify(current.scope.requestedScope) ||
    stableStringify(expected.scope.resolvedScope) !==
      stableStringify(current.scope.resolvedScope)
  ) {
    return "scope-changed";
  }
  if (stableStringify(expected.limits) !== stableStringify(current.limits)) {
    return "limits-changed";
  }
  if (
    expected.completeness.status !== "complete" ||
    current.completeness.status !== "complete"
  ) {
    return "snapshot-partial";
  }
  return expected.document.revisionSignals.contentRevision ===
    current.document.revisionSignals.contentRevision
    ? "fresh"
    : "content-changed";
}

function notesForScenario(
  scenario: BenchmarkScenario,
  hardLimitOutcome: BenchmarkRunResult["hardLimitOutcome"],
): readonly string[] {
  const notes = [];
  if (scenario.category === "selection") {
    notes.push("Selection scope is UI-bound; synthetic benchmark models selected IDs only.");
  }
  if (hardLimitOutcome === "hard-limit-error") {
    notes.push("Snapshot would exceed the current hard limit; downstream validation/adapter stages are intentionally skipped.");
  }
  if (scenario.partial) {
    notes.push("Partial snapshot is non-conclusive and suppresses definitive broken-reference interpretation.");
  }
  return notes;
}

function readCommit(): string {
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

function readPnpmVersion(): string {
  try {
    return execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}
