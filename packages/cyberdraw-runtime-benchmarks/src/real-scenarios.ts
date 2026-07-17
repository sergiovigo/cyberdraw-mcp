import type {
  RealBenchmarkConfig,
  RealBenchmarkScenario,
  RealBenchmarkScenarioName,
  RealFixtureRuntime,
  RealFixtureSpec,
  RealBenchmarkFixtureName,
} from "./real-types.js";

export const defaultRealBenchmarkConfig: RealBenchmarkConfig = {
  fixtures: ["small"],
  scenarioNames: [
    "document",
    "pages-visible",
    "pages-background",
    "layers-small",
    "selection-empty",
    "selection-multiple",
    "freshness-inside-scope",
    "freshness-outside-scope",
  ],
  iterations: 3,
  warmup: 1,
  seed: 424242,
  includeRaw: true,
};

export const realFixtureSpecs: Record<RealBenchmarkFixtureName, RealFixtureSpec> = {
  small: {
    name: "small",
    pages: 2,
    layersPerPage: 4,
    verticesPerLayer: 18,
    groupsPerPage: 2,
    edgesPerPage: 12,
    labelBytes: 24,
    metadataKeys: 2,
  },
  medium: {
    name: "medium",
    pages: 3,
    layersPerPage: 5,
    verticesPerLayer: 60,
    groupsPerPage: 5,
    edgesPerPage: 45,
    labelBytes: 36,
    metadataKeys: 4,
  },
  large: {
    name: "large",
    pages: 4,
    layersPerPage: 6,
    verticesPerLayer: 125,
    groupsPerPage: 8,
    edgesPerPage: 90,
    labelBytes: 48,
    metadataKeys: 5,
  },
  "soft-limit": {
    name: "soft-limit",
    pages: 2,
    layersPerPage: 5,
    verticesPerLayer: 120,
    groupsPerPage: 4,
    edgesPerPage: 55,
    labelBytes: 8192,
    metadataKeys: 8,
  },
  "hard-limit": {
    name: "hard-limit",
    pages: 2,
    layersPerPage: 5,
    verticesPerLayer: 170,
    groupsPerPage: 4,
    edgesPerPage: 70,
    labelBytes: 8192,
    metadataKeys: 10,
  },
};

export function buildRealBenchmarkScenarios(
  fixture: RealFixtureRuntime,
): RealBenchmarkScenario[] {
  const first = fixture.pages[0]!;
  const second = fixture.pages[1] ?? first;
  const firstLayer = first.layerIds[0]!;
  const secondLayer = first.layerIds[1] ?? firstLayer;
  const hiddenLayer = fixture.importantIds.hiddenLayer;
  const contextLayer = fixture.importantIds.contextLayer;
  const crossLayer = fixture.importantIds.crossLayer;
  const externalReferenceLayer = fixture.importantIds.externalReferenceLayer;
  return [
    {
      name: "document",
      category: "document",
      description: "Full real draw.io document snapshot.",
      scope: { kind: "document" },
    },
    {
      name: "pages-visible",
      category: "pages",
      description: "Visible page only.",
      scope: { kind: "pages", pageIds: [first.id] },
    },
    {
      name: "pages-background",
      category: "pages",
      description: "Background page only.",
      scope: { kind: "pages", pageIds: [second.id] },
    },
    {
      name: "pages-two",
      category: "pages",
      description: "Visible plus one background page.",
      scope: { kind: "pages", pageIds: [first.id, second.id] },
    },
    {
      name: "pages-missing",
      category: "pages",
      description: "Missing page diagnostic.",
      scope: { kind: "pages", pageIds: ["m7-missing-page"] },
    },
    {
      name: "layers-small",
      category: "layers",
      description: "One small visible layer.",
      scope: { kind: "layers", pageId: first.id, layerIds: [firstLayer] },
    },
    {
      name: "layers-many",
      category: "layers",
      description: "Two visible layers.",
      scope: { kind: "layers", pageId: first.id, layerIds: [firstLayer, secondLayer] },
    },
    {
      name: "layers-hidden",
      category: "layers",
      description: "Hidden layer.",
      scope: { kind: "layers", pageId: first.id, layerIds: [hiddenLayer] },
    },
    {
      name: "layers-context-only",
      category: "layers",
      description: "Layer requiring ancestor context.",
      scope: { kind: "layers", pageId: first.id, layerIds: [contextLayer] },
    },
    {
      name: "layers-cross-layer-edge",
      category: "layers",
      description: "Layer containing an edge with cross-layer terminals.",
      scope: { kind: "layers", pageId: first.id, layerIds: [crossLayer] },
    },
    {
      name: "layers-external-references",
      category: "layers",
      description: "Layer producing omitted external references.",
      scope: { kind: "layers", pageId: first.id, layerIds: [externalReferenceLayer] },
    },
    {
      name: "selection-empty",
      category: "selection",
      description: "Empty selection.",
      scope: { kind: "selection", pageId: first.id },
      selectionIds: [],
    },
    {
      name: "selection-one",
      category: "selection",
      description: "One selected vertex.",
      scope: { kind: "selection", pageId: first.id },
      selectionIds: [fixture.importantIds.vertex],
    },
    {
      name: "selection-multiple",
      category: "selection",
      description: "Several selected cells.",
      scope: { kind: "selection", pageId: first.id },
      selectionIds: [
        fixture.importantIds.vertex,
        fixture.importantIds.secondVertex,
        fixture.importantIds.edge,
      ],
    },
    {
      name: "selection-group",
      category: "selection",
      description: "Selected group.",
      scope: { kind: "selection", pageId: first.id },
      selectionIds: [fixture.importantIds.group],
    },
    {
      name: "selection-edge",
      category: "selection",
      description: "Selected edge.",
      scope: { kind: "selection", pageId: first.id },
      selectionIds: [fixture.importantIds.edge],
    },
    {
      name: "selection-external-terminals",
      category: "selection",
      description: "Selected edge with terminals outside selection.",
      scope: { kind: "selection", pageId: first.id },
      selectionIds: [fixture.importantIds.externalTerminalEdge],
    },
    {
      name: "freshness-no-change",
      category: "freshness",
      description: "Recapture without changes.",
      scope: { kind: "pages", pageIds: [first.id] },
      mutate: "none",
    },
    {
      name: "freshness-inside-scope",
      category: "freshness",
      description: "Recapture after mutating a cell inside page scope.",
      scope: { kind: "pages", pageIds: [first.id] },
      mutate: "inside-scope",
    },
    {
      name: "freshness-outside-scope",
      category: "freshness",
      description: "Recapture after mutating a cell outside page scope.",
      scope: { kind: "pages", pageIds: [first.id] },
      mutate: "outside-scope",
    },
    {
      name: "freshness-selection-only",
      category: "freshness",
      description: "Recapture after changing selection only.",
      scope: { kind: "selection", pageId: first.id },
      selectionIds: [fixture.importantIds.vertex],
      mutate: "selection-only",
    },
  ];
}

export function parseRealScenarioNames(
  value: string | undefined,
): readonly RealBenchmarkScenarioName[] | undefined {
  if (!value || value === "all") {
    return undefined;
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean) as RealBenchmarkScenarioName[];
}
