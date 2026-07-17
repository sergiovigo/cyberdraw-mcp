import type {
  BenchmarkConfig,
  BenchmarkFixtureName,
  FixtureSummary,
  SyntheticDiagram,
  SyntheticElement,
  SyntheticLayer,
  SyntheticPage,
} from "./types.js";

type FixturePreset = {
  readonly pages: number;
  readonly layersPerPage: number;
  readonly elements: number;
  readonly edgeEvery: number;
  readonly groupEvery: number;
  readonly metadataKeys: number;
  readonly labelLength: number;
  readonly nestedGroupDepth: number;
};

export const FIXTURE_PRESETS: Record<BenchmarkFixtureName, FixturePreset> = {
  small: {
    pages: 2,
    layersPerPage: 4,
    elements: 360,
    edgeEvery: 7,
    groupEvery: 31,
    metadataKeys: 3,
    labelLength: 24,
    nestedGroupDepth: 2,
  },
  medium: {
    pages: 5,
    layersPerPage: 6,
    elements: 2_000,
    edgeEvery: 5,
    groupEvery: 29,
    metadataKeys: 5,
    labelLength: 42,
    nestedGroupDepth: 3,
  },
  large: {
    pages: 10,
    layersPerPage: 8,
    elements: 20_000,
    edgeEvery: 4,
    groupEvery: 41,
    metadataKeys: 6,
    labelLength: 56,
    nestedGroupDepth: 4,
  },
  "hard-limit": {
    pages: 12,
    layersPerPage: 8,
    elements: 31_000,
    edgeEvery: 4,
    groupEvery: 37,
    metadataKeys: 8,
    labelLength: 160,
    nestedGroupDepth: 4,
  },
};

export const defaultBenchmarkConfig: BenchmarkConfig = {
  fixtures: ["small", "medium", "large", "hard-limit"],
  iterations: 15,
  warmup: 3,
  seed: 42_4242,
  includeRaw: true,
  format: "human",
};

export function buildSyntheticDiagram(
  fixture: BenchmarkFixtureName,
  seed: number,
): SyntheticDiagram {
  const preset = FIXTURE_PRESETS[fixture];
  const random = mulberry32(seed + fixture.length * 997);
  const pages = buildPages(fixture, preset, random);
  const selectedIds = selectStableElements(pages);
  return {
    fixture,
    seed,
    runtimeVersion: "synthetic-drawio-runtime-m6",
    documentId: `synthetic-${fixture}-${seed}`,
    pages,
    selectedIds,
    summary: summarizeFixture(pages),
  };
}

function buildPages(
  fixture: BenchmarkFixtureName,
  preset: FixturePreset,
  random: () => number,
): SyntheticPage[] {
  const pages: SyntheticPage[] = [];
  const elementsPerPage = distribute(preset.elements, preset.pages);
  for (let pageIndex = 0; pageIndex < preset.pages; pageIndex += 1) {
    const pageId = `${fixture}-page-${pageIndex}`;
    const layers = Array.from(
      { length: preset.layersPerPage },
      (_, layerIndex): SyntheticLayer => ({
        id: `${pageId}-layer-${layerIndex}`,
        pageId,
        index: layerIndex,
        name: `Layer ${layerIndex}`,
        visible: layerIndex % 5 !== 4,
        locked: layerIndex % 7 === 6,
      }),
    );
    const elements = buildPageElements({
      fixture,
      pageId,
      pageIndex,
      count: elementsPerPage[pageIndex] ?? 0,
      layers,
      preset,
      random,
    });
    pages.push({
      id: pageId,
      index: pageIndex,
      name: `M6 ${fixture} page ${pageIndex}`,
      visible: pageIndex === 0,
      background: pageIndex !== 0,
      layers,
      elements,
    });
  }
  return pages;
}

function buildPageElements(options: {
  readonly fixture: BenchmarkFixtureName;
  readonly pageId: string;
  readonly pageIndex: number;
  readonly count: number;
  readonly layers: readonly SyntheticLayer[];
  readonly preset: FixturePreset;
  readonly random: () => number;
}): SyntheticElement[] {
  const elements: SyntheticElement[] = [];
  const nodeIds: string[] = [];
  const groupStack: string[] = [];
  for (let index = 0; index < options.count; index += 1) {
    const layer = options.layers[index % options.layers.length]!;
    const id = `${options.pageId}-el-${index}`;
    const isGroup = index > 0 && index % options.preset.groupEvery === 0;
    const isEdge = nodeIds.length > 2 && index % options.preset.edgeEvery === 0;
    const type = isGroup ? "group" : isEdge ? "edge" : "vertex";
    if (isGroup) {
      groupStack.push(id);
      if (groupStack.length > options.preset.nestedGroupDepth) {
        groupStack.shift();
      }
    }
    const parentId =
      !isGroup && groupStack.length > 0 && index % 3 !== 0
        ? groupStack[groupStack.length - 1]
        : undefined;
    const sourceIndex = Math.floor(options.random() * Math.max(1, nodeIds.length));
    const targetIndex = Math.floor(options.random() * Math.max(1, nodeIds.length));
    const crossLayerTarget =
      isEdge && index % 11 === 0 && nodeIds.length > 0
        ? nodeIds[Math.max(0, targetIndex - 3)]
        : nodeIds[targetIndex];
    const element: SyntheticElement = {
      id,
      pageId: options.pageId,
      layerId: layer.id,
      ...(parentId ? { parentId } : {}),
      ...(isEdge ? { sourceId: nodeIds[sourceIndex] } : {}),
      ...(isEdge && crossLayerTarget ? { targetId: crossLayerTarget } : {}),
      type,
      labelText: buildLabel(options.fixture, options.pageIndex, index, options.preset.labelLength),
      style: type === "edge"
        ? "endArrow=classic;html=1;rounded=0;"
        : type === "group"
          ? "group"
          : "rounded=1;whiteSpace=wrap;html=1;",
      metadata: buildMetadata(options.fixture, index, options.preset.metadataKeys),
      geometry: {
        x: (index % 40) * 32,
        y: Math.floor(index / 40) * 24,
        width: 80 + (index % 5) * 4,
        height: 40 + (index % 3) * 4,
      },
    };
    elements.push(element);
    if (type !== "edge") {
      nodeIds.push(id);
    }
  }
  return elements;
}

function distribute(total: number, buckets: number): number[] {
  const base = Math.floor(total / buckets);
  let remainder = total % buckets;
  return Array.from({ length: buckets }, () => base + (remainder-- > 0 ? 1 : 0));
}

function buildLabel(
  fixture: BenchmarkFixtureName,
  pageIndex: number,
  elementIndex: number,
  length: number,
): string {
  const prefix = `Synthetic ${fixture} p${pageIndex} e${elementIndex} `;
  if (prefix.length >= length) {
    return prefix;
  }
  return `${prefix}${"x".repeat(length - prefix.length)}`;
}

function buildMetadata(
  fixture: BenchmarkFixtureName,
  elementIndex: number,
  keys: number,
): Readonly<Record<string, string>> {
  const metadata: Record<string, string> = {};
  for (let index = 0; index < keys; index += 1) {
    metadata[`m${index}`] = `${fixture}-synthetic-${elementIndex}-${index}`;
  }
  return metadata;
}

function selectStableElements(pages: readonly SyntheticPage[]): string[] {
  const firstPage = pages[0];
  if (!firstPage) {
    return [];
  }
  const group = firstPage.elements.find((element) => element.type === "group");
  const edge = firstPage.elements.find((element) => element.type === "edge");
  const node = firstPage.elements.find((element) => element.type === "vertex");
  return [node?.id, group?.id, edge?.id].filter((id): id is string => id !== undefined);
}

function summarizeFixture(pages: readonly SyntheticPage[]): FixtureSummary {
  const elements = pages.flatMap((page) => page.elements);
  const labels = elements.reduce((sum, element) => sum + Buffer.byteLength(element.labelText, "utf8"), 0);
  return {
    pages: pages.length,
    layers: pages.reduce((sum, page) => sum + page.layers.length, 0),
    elements: elements.length,
    nodes: elements.filter((element) => element.type === "vertex").length,
    edges: elements.filter((element) => element.type === "edge").length,
    groups: elements.filter((element) => element.type === "group").length,
    maxGroupDepth: Math.max(
      0,
      ...elements.map((element) => element.parentId?.split("-").length ?? 0),
    ),
    metadataKeysApprox: elements.reduce(
      (sum, element) => sum + Object.keys(element.metadata).length,
      0,
    ),
    labelBytesApprox: labels,
  };
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
