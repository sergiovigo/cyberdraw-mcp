import type {
  RuntimeSnapshot,
  RuntimeSnapshotLimits,
  RuntimeSnapshotScope,
} from "cyberdraw-runtime-contract";
import type { SampleSummary } from "./types.js";

export type RealBenchmarkFixtureName =
  | "small"
  | "medium"
  | "large"
  | "soft-limit"
  | "hard-limit";

export type RealBenchmarkScenarioCategory =
  | "document"
  | "pages"
  | "layers"
  | "selection"
  | "freshness";

export type RealBenchmarkScenarioName =
  | "document"
  | "pages-visible"
  | "pages-background"
  | "pages-two"
  | "pages-missing"
  | "layers-small"
  | "layers-many"
  | "layers-hidden"
  | "layers-context-only"
  | "layers-cross-layer-edge"
  | "layers-external-references"
  | "selection-empty"
  | "selection-one"
  | "selection-multiple"
  | "selection-group"
  | "selection-edge"
  | "selection-external-terminals"
  | "freshness-no-change"
  | "freshness-inside-scope"
  | "freshness-outside-scope"
  | "freshness-selection-only";

export type RealFixtureSpec = {
  readonly name: RealBenchmarkFixtureName;
  readonly pages: number;
  readonly layersPerPage: number;
  readonly verticesPerLayer: number;
  readonly groupsPerPage: number;
  readonly edgesPerPage: number;
  readonly labelBytes: number;
  readonly metadataKeys: number;
};

export type RealFixtureSummary = {
  readonly pages: number;
  readonly layers: number;
  readonly elements: number;
  readonly nodes: number;
  readonly edges: number;
  readonly groups: number;
  readonly hiddenLayers: number;
  readonly metadataKeysApprox: number;
  readonly labelBytesApprox: number;
};

export type RealFixtureRuntime = {
  readonly fixture: RealBenchmarkFixtureName;
  readonly seed: number;
  readonly documentId?: string;
  readonly pages: readonly RealPageRuntime[];
  readonly summary: RealFixtureSummary;
  readonly importantIds: {
    readonly vertex: string;
    readonly secondVertex: string;
    readonly group: string;
    readonly groupedVertex: string;
    readonly edge: string;
    readonly externalTerminalEdge: string;
    readonly hiddenLayer: string;
    readonly contextLayer: string;
    readonly crossLayer: string;
    readonly externalReferenceLayer: string;
  };
};

export type RealPageRuntime = {
  readonly id: string;
  readonly index: number;
  readonly layerIds: readonly string[];
};

export type RealBenchmarkScenario = {
  readonly name: RealBenchmarkScenarioName;
  readonly category: RealBenchmarkScenarioCategory;
  readonly description: string;
  readonly scope: RuntimeSnapshotScope;
  readonly selectionIds?: readonly string[];
  readonly mutate?: "none" | "inside-scope" | "outside-scope" | "selection-only";
  readonly limits?: Partial<RuntimeSnapshotLimits>;
};

export type RealBenchmarkConfig = {
  readonly fixtures: readonly RealBenchmarkFixtureName[];
  readonly scenarioNames?: readonly RealBenchmarkScenarioName[];
  readonly iterations: number;
  readonly warmup: number;
  readonly seed: number;
  readonly includeRaw: boolean;
};

export type RealBenchmarkSample = {
  readonly pluginExtractionMs: number;
  readonly pluginScopeResolutionMs: number;
  readonly pluginTraversalMs: number;
  readonly pluginSnapshotAssemblyMs: number;
  readonly pluginRevisionMs: number;
  readonly pluginSerializationMs: number;
  readonly pluginTotalMs: number;
  readonly websocketRoundTripMs: number;
  readonly serverParseMs: number;
  readonly serverValidationMs: number;
  readonly adapterMs: number;
  readonly normalizationMs: number;
  readonly freshnessMs: number;
  readonly totalScenarioMs: number;
  readonly jsonBytes: number;
  readonly heapDeltaBytes: number;
  readonly mainThreadTimerDriftMs: number;
  readonly mainThreadRafDelayMs: number;
  readonly longTaskCount: number;
};

export type RealBenchmarkMetricSummary = {
  readonly [Key in keyof RealBenchmarkSample]: SampleSummary;
};

export type UiPreservationResult = {
  readonly activePagePreserved: boolean;
  readonly selectionPreserved: boolean;
  readonly zoomPreserved: boolean;
  readonly scrollPreserved: boolean | "unavailable";
  readonly noDialogsOpen: boolean;
  readonly noEditing: boolean;
};

export type RealBenchmarkRunResult = {
  readonly fixture: RealBenchmarkFixtureName;
  readonly scenario: RealBenchmarkScenario;
  readonly seed: number;
  readonly iterations: number;
  readonly warmup: number;
  readonly fixtureSummary: RealFixtureSummary;
  readonly counts: {
    readonly pagesVisited: number;
    readonly layersVisited: number;
    readonly elementsInspected: number;
    readonly elementsIncluded: number;
    readonly contextOnlyElements: number;
    readonly externalReferences: number;
    readonly diagnostics: number;
  };
  readonly hardLimitOutcome: "within-limit" | "soft-limit" | "hard-limit-error";
  readonly freshnessOutcome?: string;
  readonly documentBaselineBytes?: number;
  readonly payloadReductionPercent?: number;
  readonly graphModelFindings: number;
  readonly uiPreservation: UiPreservationResult;
  readonly metrics: RealBenchmarkMetricSummary;
  readonly notes: readonly string[];
};

export type RealBenchmarkSuiteResult = {
  readonly generatedAt: string;
  readonly benchmarkVersion: "m7-real-environment-snapshot-benchmarks-v1";
  readonly environment: {
    readonly node: string;
    readonly pnpm: string;
    readonly os: string;
    readonly arch: string;
    readonly commit: string;
    readonly drawioRuntimeVersion?: string;
    readonly transport: "http-ws";
    readonly httpsCaddy: "not-run" | "failed" | "passed";
  };
  readonly config: RealBenchmarkConfig;
  readonly results: readonly RealBenchmarkRunResult[];
};

export type MeasuredRuntimeSnapshotResult = {
  readonly snapshot: RuntimeSnapshot;
  readonly metrics: {
    readonly websocketRoundTripMs: number;
    readonly serverParseMs: number;
    readonly serverValidationMs: number;
  };
};
