import { execFileSync } from "node:child_process";
import { arch, type } from "node:os";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { fromRuntimeSnapshot, toCanonicalRuntimeSnapshotInput } from "cyberdraw-graph-model";
import { stableStringify, type RuntimeSnapshot } from "cyberdraw-runtime-contract";
import { summarizeSamples } from "./stats.js";
import { installRealFixture } from "./real-fixtures.js";
import { buildRealBenchmarkScenarios, defaultRealBenchmarkConfig } from "./real-scenarios.js";
import type {
  MeasuredRuntimeSnapshotResult,
  RealBenchmarkConfig,
  RealBenchmarkMetricSummary,
  RealBenchmarkRunResult,
  RealBenchmarkSample,
  RealBenchmarkScenario,
  RealBenchmarkSuiteResult,
  UiPreservationResult,
} from "./real-types.js";

type HarnessModule = {
  createRealEnvironmentContext(): Promise<RealContext>;
  disposeRealEnvironmentContext(context: RealContext | undefined): Promise<void>;
  resetDiagram(context: RealContext): Promise<void>;
};

type SnapshotModule = {
  requestCyberdrawRuntimeSnapshotMeasured(
    context: unknown,
    request: unknown,
    options?: { readonly replyTimeoutMs?: number },
  ): Promise<MeasuredRuntimeSnapshotResult>;
};

type RealContext = {
  readonly app: { readonly context: unknown };
  readonly client: {
    callTool(input: { name: string; arguments: Record<string, unknown> }): Promise<unknown>;
    listTools(): Promise<{ readonly tools: readonly { readonly name: string }[] }>;
  };
  readonly page: {
    evaluate<R, A = unknown>(fn: (arg: A) => R, arg?: A): Promise<R>;
    waitForTimeout(ms: number): Promise<void>;
    waitForFunction(fn: () => boolean): Promise<unknown>;
  };
};

type EditorState = {
  readonly currentPageId: string | null;
  readonly selectionIds: readonly string[];
  readonly zoom: number | null;
  readonly scrollX: number | null;
  readonly scrollY: number | null;
  readonly dialogs: number;
  readonly editing: boolean;
  readonly cellCount: number;
};

export async function runRealBenchmarkSuite(
  config: Partial<RealBenchmarkConfig> = {},
): Promise<RealBenchmarkSuiteResult> {
  const resolved: RealBenchmarkConfig = {
    ...defaultRealBenchmarkConfig,
    ...config,
    fixtures: config.fixtures ?? defaultRealBenchmarkConfig.fixtures,
    scenarioNames: config.scenarioNames ?? defaultRealBenchmarkConfig.scenarioNames,
  };
  const harness = await importHarness();
  const snapshotModule = await importSnapshotModule();
  const results: RealBenchmarkRunResult[] = [];
  let context: RealContext | undefined;
  let drawioRuntimeVersion: string | undefined;

  try {
    context = await harness.createRealEnvironmentContext();
    drawioRuntimeVersion = await readDrawioRuntimeVersion(context);
    const tools = await context.client.listTools();
    if (tools.tools.some((tool) => tool.name === "cyberdraw.runtimeSnapshot.v1")) {
      throw new Error("Internal runtime snapshot event is exposed as a public MCP tool");
    }

    for (const fixtureName of resolved.fixtures) {
      await harness.resetDiagram(context);
      const fixture = await installRealFixture(context, fixtureName, resolved.seed);
      const allScenarios = buildRealBenchmarkScenarios(fixture);
      const scenarios = allScenarios.filter((scenario) =>
        resolved.scenarioNames ? resolved.scenarioNames.includes(scenario.name) : true,
      );
      const documentBaseline = await runScenario(
        context,
        snapshotModule,
        fixture,
        allScenarios.find((scenario) => scenario.name === "document")!,
        resolved,
      );
      if (scenarios.some((scenario) => scenario.name === "document")) {
        results.push(documentBaseline);
      }
      for (const scenario of scenarios) {
        if (scenario.name === "document") {
          continue;
        }
        const run = await runScenario(context, snapshotModule, fixture, scenario, resolved);
        results.push({
          ...run,
          documentBaselineBytes: documentBaseline.metrics.jsonBytes.median,
          payloadReductionPercent:
            documentBaseline.metrics.jsonBytes.median > 0
              ? 100 -
                (run.metrics.jsonBytes.median /
                  documentBaseline.metrics.jsonBytes.median) *
                  100
              : undefined,
        });
      }
    }
  } finally {
    await harness.disposeRealEnvironmentContext(context);
  }

  return {
    generatedAt: new Date().toISOString(),
    benchmarkVersion: "m7-real-environment-snapshot-benchmarks-v1",
    environment: {
      node: process.version,
      pnpm: readPnpmVersion(),
      os: type(),
      arch: arch(),
      commit: readCommit(),
      drawioRuntimeVersion,
      transport: "http-ws",
      httpsCaddy: "failed",
    },
    config: resolved,
    results,
  };
}

async function runScenario(
  context: RealContext,
  snapshotModule: SnapshotModule,
  fixture: Awaited<ReturnType<typeof installRealFixture>>,
  scenario: RealBenchmarkScenario,
  config: RealBenchmarkConfig,
): Promise<RealBenchmarkRunResult> {
  const samples: RealBenchmarkSample[] = [];
  let lastSnapshot: RuntimeSnapshot | undefined;
  let graphModelFindings = 0;
  let uiPreservation: UiPreservationResult = {
    activePagePreserved: true,
    selectionPreserved: true,
    zoomPreserved: true,
    scrollPreserved: "unavailable",
    noDialogsOpen: true,
    noEditing: true,
  };
  let freshnessOutcome: string | undefined;
  const totalRuns = config.warmup + config.iterations;
  for (let run = 0; run < totalRuns; run += 1) {
    await prepareSelection(context, scenario.selectionIds ?? []);
    const beforeState = await readEditorState(context);
    const heapBeforeBytes = process.memoryUsage().heapUsed;
    const totalStarted = performance.now();
    let measured: MeasuredRuntimeSnapshotResult;
    try {
      measured = await requestMeasuredSnapshot(context, snapshotModule, scenario, config);
    } catch (error) {
      const afterState = await readEditorState(context);
      uiPreservation = compareUiState(beforeState, afterState);
      await restoreUiState(context, beforeState);
      const heapAfterBytes = process.memoryUsage().heapUsed;
      const sample = zeroRealSample({
        totalScenarioMs: performance.now() - totalStarted,
        heapDeltaBytes: heapAfterBytes - heapBeforeBytes,
      });
      if (run >= config.warmup) {
        samples.push(sample);
      }
      continue;
    }
    const snapshot = measured.snapshot;
    lastSnapshot = snapshot;
    const postExtractionState = await readEditorState(context);
    uiPreservation = compareUiState(beforeState, postExtractionState);
    const adapterStarted = performance.now();
    const canonicalInput = toCanonicalRuntimeSnapshotInput(snapshot);
    const adapterMs = performance.now() - adapterStarted;
    const normalizationStarted = performance.now();
    const graph = fromRuntimeSnapshot(snapshot);
    const normalizationMs = performance.now() - normalizationStarted;
    graphModelFindings = graph.findings.length;
    const freshnessStarted = performance.now();
    freshnessOutcome = await measureFreshness(context, snapshotModule, snapshot, scenario, config);
    const freshnessMs = performance.now() - freshnessStarted;
    await restoreUiState(context, beforeState);
    await context.page.waitForTimeout(0);
    const heapAfterBytes = process.memoryUsage().heapUsed;
    const jsonBytes =
      snapshot.payload.measuredJsonBytes ?? Buffer.byteLength(JSON.stringify(snapshot), "utf8");
    const sample: RealBenchmarkSample = {
      pluginExtractionMs: snapshot.performance.extractionMs,
      pluginScopeResolutionMs: snapshot.performance.scopeResolutionMs ?? 0,
      pluginTraversalMs: snapshot.performance.traversalMs ?? 0,
      pluginSnapshotAssemblyMs: snapshot.performance.snapshotAssemblyMs ?? 0,
      pluginRevisionMs: snapshot.performance.revisionMs ?? 0,
      pluginSerializationMs: snapshot.performance.serializationMs,
      pluginTotalMs: snapshot.performance.totalPluginMs ?? snapshot.performance.extractionMs,
      websocketRoundTripMs: measured.metrics.websocketRoundTripMs,
      serverParseMs: measured.metrics.serverParseMs,
      serverValidationMs: measured.metrics.serverValidationMs,
      adapterMs,
      normalizationMs,
      freshnessMs,
      totalScenarioMs: performance.now() - totalStarted,
      jsonBytes,
      heapDeltaBytes: heapAfterBytes - heapBeforeBytes,
      mainThreadTimerDriftMs: snapshot.performance.mainThreadTimerDriftMs ?? 0,
      mainThreadRafDelayMs: snapshot.performance.mainThreadRafDelayMs ?? 0,
      longTaskCount: snapshot.performance.longTaskCount ?? 0,
    };
    void canonicalInput;
    if (run >= config.warmup) {
      samples.push(sample);
    }
  }
  return {
    fixture: fixture.fixture,
    scenario,
    seed: fixture.seed,
    iterations: config.iterations,
    warmup: config.warmup,
    fixtureSummary: fixture.summary,
    counts: countsFromSnapshot(lastSnapshot),
    hardLimitOutcome: hardLimitOutcome(lastSnapshot),
    freshnessOutcome,
    graphModelFindings,
    uiPreservation,
    metrics: summarizeRealSamples(samples),
    notes: notesForScenario(scenario),
  };
}

async function requestMeasuredSnapshot(
  context: RealContext,
  snapshotModule: SnapshotModule,
  scenario: RealBenchmarkScenario,
  config: RealBenchmarkConfig,
): Promise<MeasuredRuntimeSnapshotResult> {
  return snapshotModule.requestCyberdrawRuntimeSnapshotMeasured(
    context.app.context,
    {
      includeRaw: config.includeRaw,
      measureMainThreadImpact: true,
      scope: scenario.scope,
      limits: scenario.limits,
    },
    { replyTimeoutMs: 90_000 },
  );
}

async function measureFreshness(
  context: RealContext,
  snapshotModule: SnapshotModule,
  baseline: RuntimeSnapshot,
  scenario: RealBenchmarkScenario,
  config: RealBenchmarkConfig,
): Promise<string> {
  if (!scenario.mutate || scenario.mutate === "none") {
    const current = await requestMeasuredSnapshot(context, snapshotModule, scenario, config);
    return compareRevisions(baseline, current.snapshot);
  }
  if (scenario.mutate === "selection-only") {
    await prepareSelection(context, []);
  } else {
    await mutateFixtureCell(context, scenario.mutate);
  }
  const current = await requestMeasuredSnapshot(context, snapshotModule, scenario, config);
  return compareRevisions(baseline, current.snapshot);
}

async function mutateFixtureCell(
  context: RealContext,
  mutation: "inside-scope" | "outside-scope",
): Promise<void> {
  await context.page.evaluate((mode) => {
    const ui = (window as any).ui;
    const graph = ui?.editor?.graph;
    const model = graph?.getModel?.();
    const targetPage = mode === "inside-scope" ? ui?.pages?.[0] : ui?.pages?.[1];
    const original = ui?.currentPage;
    if (targetPage && targetPage !== original && typeof ui?.selectPage === "function") {
      ui.selectPage(targetPage);
    }
    const cell = model?.getCell?.(mode === "inside-scope" ? "m7-p0-l0-v0" : "m7-p1-l0-v0");
    model?.beginUpdate?.();
    try {
      if (cell) {
        const runtimeWindow = window as any;
        runtimeWindow.__M7_FRESHNESS_COUNTER__ =
          (runtimeWindow.__M7_FRESHNESS_COUNTER__ ?? 0) + 1;
        model.setValue(
          cell,
          `M7 changed ${mode} ${runtimeWindow.__M7_FRESHNESS_COUNTER__}`,
        );
      }
    } finally {
      model?.endUpdate?.();
      if (original && targetPage !== original && typeof ui?.selectPage === "function") {
        ui.selectPage(original);
      }
    }
  }, mutation);
}

async function prepareSelection(
  context: RealContext,
  ids: readonly string[],
): Promise<void> {
  await context.page.evaluate((selectionIds) => {
    const graph = (window as any).ui?.editor?.graph;
    const model = graph?.getModel?.();
    const cells = selectionIds
      .map((id) => model?.getCell?.(id))
      .filter((cell) => cell != null);
    graph?.setSelectionCells?.(cells);
  }, [...ids]);
}

async function readEditorState(context: RealContext): Promise<EditorState> {
  return context.page.evaluate(() => {
    const ui = (window as any).ui;
    const graph = ui?.editor?.graph;
    const view = graph?.view;
    const container = graph?.container;
    const selection = graph?.getSelectionCells?.() ?? [];
    const model = graph?.getModel?.();
    return {
      currentPageId: ui?.currentPage?.getId?.() ?? ui?.currentPage?.id ?? null,
      selectionIds: Array.isArray(selection)
        ? selection.map((cell: any) => String(cell.id)).sort()
        : [],
      zoom: typeof view?.scale === "number" ? view.scale : null,
      scrollX: typeof container?.scrollLeft === "number" ? container.scrollLeft : null,
      scrollY: typeof container?.scrollTop === "number" ? container.scrollTop : null,
      dialogs: document.querySelectorAll(".geDialog, .mxWindow").length,
      editing: typeof graph?.isEditing === "function" ? graph.isEditing() : false,
      cellCount: model?.cells ? Object.keys(model.cells).length : 0,
    };
  });
}

async function restoreUiState(
  context: RealContext,
  state: EditorState,
): Promise<void> {
  await context.page.evaluate((target) => {
    const ui = (window as any).ui;
    const graph = ui?.editor?.graph;
    const model = graph?.getModel?.();
    const page = Array.isArray(ui?.pages)
      ? ui.pages.find((candidate: any) => {
          const id = candidate?.getId?.() ?? candidate?.id;
          return String(id) === target.currentPageId;
        })
      : null;
    if (page && typeof ui?.selectPage === "function") {
      ui.selectPage(page);
    }
    graph?.setSelectionCells?.(
      target.selectionIds
        .map((id: string) => model?.getCell?.(id))
        .filter((cell: any) => cell != null),
    );
    if (graph?.view && typeof target.zoom === "number") {
      graph.view.scale = target.zoom;
    }
    if (graph?.container && typeof target.scrollX === "number") {
      graph.container.scrollLeft = target.scrollX;
      graph.container.scrollTop = target.scrollY ?? graph.container.scrollTop;
    }
  }, state);
}

function compareUiState(
  before: EditorState,
  after: EditorState,
): UiPreservationResult {
  return {
    activePagePreserved: before.currentPageId === after.currentPageId,
    selectionPreserved:
      stableStringify(before.selectionIds) === stableStringify(after.selectionIds),
    zoomPreserved: before.zoom === after.zoom,
    scrollPreserved:
      before.scrollX === null || before.scrollY === null
        ? "unavailable"
        : before.scrollX === after.scrollX && before.scrollY === after.scrollY,
    noDialogsOpen: after.dialogs === 0,
    noEditing: after.editing === false,
  };
}

function compareRevisions(expected: RuntimeSnapshot, current: RuntimeSnapshot): string {
  if (
    expected.document.revisionSignals.contentRevision ===
    current.document.revisionSignals.contentRevision
  ) {
    if (
      expected.document.revisionSignals.selectionRevision !==
      current.document.revisionSignals.selectionRevision
    ) {
      return "selection-changed";
    }
    return "fresh";
  }
  return "content-changed";
}

function countsFromSnapshot(snapshot: RuntimeSnapshot | undefined) {
  const layersVisited =
    snapshot?.scope.includedLayers.reduce(
      (sum, entry) => sum + entry.layerIds.length,
      0,
    ) ?? 0;
  return {
    pagesVisited: snapshot?.scope.includedPages.length ?? 0,
    layersVisited,
    elementsInspected: snapshot?.scope.includedElementCount ?? 0,
    elementsIncluded: snapshot?.scope.includedElementCount ?? 0,
    contextOnlyElements: snapshot?.scope.contextElementCount ?? 0,
    externalReferences: snapshot?.scope.externalReferences.length ?? 0,
    diagnostics: snapshot?.diagnostics.length ?? 0,
  };
}

function hardLimitOutcome(
  snapshot: RuntimeSnapshot | undefined,
): RealBenchmarkRunResult["hardLimitOutcome"] {
  if (!snapshot) {
    return "hard-limit-error";
  }
  if (
    snapshot.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "snapshot_hard_limit_reached" ||
        diagnostic.code === "snapshot_size_limit_reached",
    )
  ) {
    return "hard-limit-error";
  }
  if (
    snapshot.completeness.status === "partial" ||
    snapshot.diagnostics.some((diagnostic) => diagnostic.code === "snapshot_soft_limit_reached")
  ) {
    return "soft-limit";
  }
  return "within-limit";
}

function summarizeRealSamples(
  samples: readonly RealBenchmarkSample[],
): RealBenchmarkMetricSummary {
  const keys = [
    "pluginExtractionMs",
    "pluginScopeResolutionMs",
    "pluginTraversalMs",
    "pluginSnapshotAssemblyMs",
    "pluginRevisionMs",
    "pluginSerializationMs",
    "pluginTotalMs",
    "websocketRoundTripMs",
    "serverParseMs",
    "serverValidationMs",
    "adapterMs",
    "normalizationMs",
    "freshnessMs",
    "totalScenarioMs",
    "jsonBytes",
    "heapDeltaBytes",
    "mainThreadTimerDriftMs",
    "mainThreadRafDelayMs",
    "longTaskCount",
  ] as const;
  return Object.fromEntries(
    keys.map((key) => [key, summarizeSamples(samples.map((sample) => sample[key]))]),
  ) as RealBenchmarkMetricSummary;
}

function zeroRealSample(input: {
  readonly totalScenarioMs: number;
  readonly heapDeltaBytes: number;
}): RealBenchmarkSample {
  return {
    pluginExtractionMs: 0,
    pluginScopeResolutionMs: 0,
    pluginTraversalMs: 0,
    pluginSnapshotAssemblyMs: 0,
    pluginRevisionMs: 0,
    pluginSerializationMs: 0,
    pluginTotalMs: 0,
    websocketRoundTripMs: 0,
    serverParseMs: 0,
    serverValidationMs: 0,
    adapterMs: 0,
    normalizationMs: 0,
    freshnessMs: 0,
    totalScenarioMs: input.totalScenarioMs,
    jsonBytes: 0,
    heapDeltaBytes: input.heapDeltaBytes,
    mainThreadTimerDriftMs: 0,
    mainThreadRafDelayMs: 0,
    longTaskCount: 0,
  };
}

function notesForScenario(scenario: RealBenchmarkScenario): readonly string[] {
  const notes = [];
  if (scenario.category === "selection") {
    notes.push("Selection scope is UI-bound and requires controlled selection setup.");
  }
  if (scenario.name === "pages-missing") {
    notes.push("Missing page scenario is expected to be partial and diagnostic-bearing.");
  }
  return notes;
}

async function readDrawioRuntimeVersion(
  context: RealContext,
): Promise<string | undefined> {
  return context.page.evaluate(() => {
    const runtimeWindow = window as any;
    return (
      runtimeWindow?.EditorUi?.VERSION ??
      runtimeWindow?.Draw?.VERSION ??
      runtimeWindow?.mxClient?.VERSION
    );
  });
}

async function importHarness(): Promise<HarnessModule> {
  const base = dirname(fileURLToPath(import.meta.url));
  return import(
    pathToFileURL(
      resolve(base, "../../drawio-mcp-server/build/real-environment/harness.js"),
    ).href
  ) as Promise<HarnessModule>;
}

async function importSnapshotModule(): Promise<SnapshotModule> {
  const base = dirname(fileURLToPath(import.meta.url));
  return import(
    pathToFileURL(resolve(base, "../../drawio-mcp-server/build/cyberdraw-runtime-snapshot.js")).href
  ) as Promise<SnapshotModule>;
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
