import type {
  RuntimeSnapshot,
  RuntimeSnapshotScope,
} from "cyberdraw-runtime-contract";

export type BenchmarkFixtureName = "small" | "medium" | "large" | "hard-limit";
export type BenchmarkFormat = "human" | "json" | "markdown";

export type BenchmarkConfig = {
  readonly fixtures: readonly BenchmarkFixtureName[];
  readonly scenarioNames?: readonly string[];
  readonly iterations: number;
  readonly warmup: number;
  readonly seed: number;
  readonly includeRaw: boolean;
  readonly format: BenchmarkFormat;
};

export type SyntheticDiagram = {
  readonly fixture: BenchmarkFixtureName;
  readonly seed: number;
  readonly runtimeVersion: string;
  readonly documentId: string;
  readonly pages: readonly SyntheticPage[];
  readonly selectedIds: readonly string[];
  readonly summary: FixtureSummary;
};

export type SyntheticPage = {
  readonly id: string;
  readonly index: number;
  readonly name: string;
  readonly visible: boolean;
  readonly background: boolean;
  readonly layers: readonly SyntheticLayer[];
  readonly elements: readonly SyntheticElement[];
};

export type SyntheticLayer = {
  readonly id: string;
  readonly pageId: string;
  readonly index: number;
  readonly name: string;
  readonly visible: boolean;
  readonly locked: boolean;
};

export type SyntheticElement = {
  readonly id: string;
  readonly pageId: string;
  readonly layerId: string;
  readonly parentId?: string;
  readonly sourceId?: string;
  readonly targetId?: string;
  readonly type: "vertex" | "edge" | "group" | "unknown";
  readonly labelText: string;
  readonly style: string;
  readonly metadata: Readonly<Record<string, string>>;
  readonly geometry: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
};

export type FixtureSummary = {
  readonly pages: number;
  readonly layers: number;
  readonly elements: number;
  readonly nodes: number;
  readonly edges: number;
  readonly groups: number;
  readonly maxGroupDepth: number;
  readonly metadataKeysApprox: number;
  readonly labelBytesApprox: number;
};

export type BenchmarkScenario = {
  readonly name: string;
  readonly category:
    | "document"
    | "pages"
    | "layers"
    | "selection"
    | "freshness"
    | "graph-model";
  readonly description: string;
  readonly scope: RuntimeSnapshotScope;
  readonly mutate?: "none" | "inside-scope" | "outside-scope" | "selection-only";
  readonly partial?: boolean;
};

export type BenchmarkSample = {
  readonly scopeResolutionMs: number;
  readonly syntheticTraversalMs: number;
  readonly syntheticExtractionMs: number;
  readonly canonicalizationMs: number;
  readonly contentRevisionMs: number;
  readonly selectionRevisionMs: number;
  readonly serializationMs: number;
  readonly validationMs: number;
  readonly adapterMs: number;
  readonly normalizationMs: number;
  readonly freshnessMs: number;
  readonly totalMs: number;
  readonly jsonBytes: number;
  readonly heapBeforeBytes: number;
  readonly heapAfterBytes: number;
  readonly heapDeltaBytes: number;
};

export type SampleSummary = {
  readonly median: number;
  readonly p95: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly stdev: number;
};

export type BenchmarkMetricSummary = {
  readonly scopeResolutionMs: SampleSummary;
  readonly syntheticTraversalMs: SampleSummary;
  readonly syntheticExtractionMs: SampleSummary;
  readonly canonicalizationMs: SampleSummary;
  readonly contentRevisionMs: SampleSummary;
  readonly selectionRevisionMs: SampleSummary;
  readonly serializationMs: SampleSummary;
  readonly validationMs: SampleSummary;
  readonly adapterMs: SampleSummary;
  readonly normalizationMs: SampleSummary;
  readonly freshnessMs: SampleSummary;
  readonly totalMs: SampleSummary;
  readonly jsonBytes: SampleSummary;
  readonly heapDeltaBytes: SampleSummary;
};

export type BenchmarkRunResult = {
  readonly fixture: BenchmarkFixtureName;
  readonly scenario: BenchmarkScenario;
  readonly seed: number;
  readonly iterations: number;
  readonly warmup: number;
  readonly fixtureSummary: FixtureSummary;
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
  readonly documentBaselineBytes?: number;
  readonly scopedDocumentRatio?: number;
  readonly payloadReductionPercent?: number;
  readonly timeReductionPercent?: number;
  readonly graphModelFindings: number;
  readonly metrics: BenchmarkMetricSummary;
  readonly notes: readonly string[];
};

export type BenchmarkSuiteResult = {
  readonly generatedAt: string;
  readonly benchmarkVersion: "m6-runtime-snapshot-benchmarks-v1";
  readonly environment: {
    readonly node: string;
    readonly pnpm: string;
    readonly os: string;
    readonly arch: string;
    readonly commit: string;
  };
  readonly config: BenchmarkConfig;
  readonly results: readonly BenchmarkRunResult[];
};

export type ExtractedSnapshot = {
  readonly snapshot?: RuntimeSnapshot;
  readonly attemptedJsonBytes?: number;
  readonly traversal: {
    readonly pagesVisited: number;
    readonly layersVisited: number;
    readonly elementsInspected: number;
    readonly elementsIncluded: number;
    readonly contextOnlyElements: number;
    readonly externalReferences: number;
  };
  readonly hardLimitOutcome: "within-limit" | "soft-limit" | "hard-limit-error";
};
