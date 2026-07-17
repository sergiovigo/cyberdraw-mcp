import type {
  BenchmarkScenario,
  SyntheticDiagram,
  SyntheticElement,
} from "./types.js";

export function buildBenchmarkScenarios(
  diagram: SyntheticDiagram,
): BenchmarkScenario[] {
  const first = diagram.pages[0]!;
  const second = diagram.pages[1] ?? first;
  const firstLayer = first.layers[0]!;
  const secondLayer = first.layers[1] ?? firstLayer;
  const edgeLayer = findEdgeLayer(first.elements) ?? firstLayer.id;
  const manyReferenceLayer = first.layers[first.layers.length - 1] ?? firstLayer;
  return [
    {
      name: "document",
      category: "document",
      description: "Full document snapshot.",
      scope: { kind: "document" },
    },
    {
      name: "pages-visible",
      category: "pages",
      description: "Single visible page.",
      scope: { kind: "pages", pageIds: [first.id] },
    },
    {
      name: "pages-background",
      category: "pages",
      description: "Single background page.",
      scope: { kind: "pages", pageIds: [second.id] },
    },
    {
      name: "pages-two",
      category: "pages",
      description: "Two-page subset.",
      scope: { kind: "pages", pageIds: [first.id, second.id] },
    },
    {
      name: "layers-small",
      category: "layers",
      description: "One small layer on the visible page.",
      scope: { kind: "layers", pageId: first.id, layerIds: [firstLayer.id] },
    },
    {
      name: "layers-many",
      category: "layers",
      description: "Several layers on the visible page.",
      scope: {
        kind: "layers",
        pageId: first.id,
        layerIds: [firstLayer.id, secondLayer.id],
      },
    },
    {
      name: "layers-cross-layer-edge",
      category: "layers",
      description: "Layer that includes edges with terminals outside scope.",
      scope: { kind: "layers", pageId: first.id, layerIds: [edgeLayer] },
    },
    {
      name: "layers-many-external-references",
      category: "layers",
      description: "Layer likely to produce many external references.",
      scope: {
        kind: "layers",
        pageId: first.id,
        layerIds: [manyReferenceLayer.id],
      },
    },
    {
      name: "selection-empty",
      category: "selection",
      description: "Empty UI selection.",
      scope: { kind: "selection", pageId: first.id },
      mutate: "selection-only",
    },
    {
      name: "selection-one",
      category: "selection",
      description: "One selected element.",
      scope: { kind: "selection", pageId: first.id },
    },
    {
      name: "selection-multiple",
      category: "selection",
      description: "Multiple selected elements including group and edge when available.",
      scope: { kind: "selection", pageId: first.id },
    },
    {
      name: "freshness-no-change",
      category: "freshness",
      description: "Recapture without content changes.",
      scope: { kind: "pages", pageIds: [first.id] },
      mutate: "none",
    },
    {
      name: "freshness-inside-scope",
      category: "freshness",
      description: "Recapture after content inside scope changes.",
      scope: { kind: "pages", pageIds: [first.id] },
      mutate: "inside-scope",
    },
    {
      name: "freshness-outside-scope",
      category: "freshness",
      description: "Recapture after content outside scope changes.",
      scope: { kind: "pages", pageIds: [first.id] },
      mutate: "outside-scope",
    },
    {
      name: "graph-document",
      category: "graph-model",
      description: "Graph adapter and normalization for complete document.",
      scope: { kind: "document" },
    },
    {
      name: "graph-partial-truncated",
      category: "graph-model",
      description: "Graph adapter and normalization for partial snapshot.",
      scope: { kind: "pages", pageIds: [first.id] },
      partial: true,
    },
  ];
}

function findEdgeLayer(elements: readonly SyntheticElement[]): string | undefined {
  return elements.find((element) => element.type === "edge")?.layerId;
}
