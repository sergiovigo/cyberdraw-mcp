import type {
  RealBenchmarkFixtureName,
  RealFixtureRuntime,
  RealFixtureSpec,
  RealFixtureSummary,
} from "./real-types.js";
import { realFixtureSpecs } from "./real-scenarios.js";

type RealContext = {
  readonly client: {
    callTool(input: { name: string; arguments: Record<string, unknown> }): Promise<unknown>;
  };
  readonly page: {
    evaluate<R, A = unknown>(fn: (arg: A) => R, arg?: A): Promise<R>;
    waitForFunction(fn: () => boolean): Promise<unknown>;
  };
};

type ToolPayload<T> = { readonly success?: boolean; readonly result?: T };
type PageInfo = { readonly id: string; readonly index: number };

export async function installRealFixture(
  context: RealContext,
  fixtureName: RealBenchmarkFixtureName,
  seed: number,
): Promise<RealFixtureRuntime> {
  const spec = realFixtureSpecs[fixtureName];
  const pages: PageInfo[] = [];
  const firstPage = await callTool<PageInfo>(context, "rename-page", {
    page: { index: 0 },
    name: `M7 ${fixtureName} 0`,
  });
  pages.push(firstPage);

  await importPageXml(context, firstPage.id, buildPageXml(spec, seed, 0));

  for (let pageIndex = 1; pageIndex < spec.pages; pageIndex += 1) {
    const created = await callTool<PageInfo>(context, "create-page", {
      name: `M7 ${fixtureName} ${pageIndex}`,
    });
    pages.push(created);
    await importPageXml(context, created.id, buildPageXml(spec, seed, pageIndex));
  }

  await context.page.evaluate((pageId: string) => {
    const ui = (window as any).ui;
    const page = Array.isArray(ui?.pages)
      ? ui.pages.find((candidate: any) => {
          const id = candidate?.getId?.() ?? candidate?.id;
          return String(id) === pageId;
        })
      : null;
    if (page && typeof ui?.selectPage === "function") {
      ui.selectPage(page);
    }
  }, firstPage.id);

  await context.page.waitForFunction(() => {
    const graph = (window as any).ui?.editor?.graph;
    const model = graph?.getModel?.();
    return Boolean(model?.cells && Object.keys(model.cells).length > 3);
  });

  const layerIds = buildLayerIds(spec);
  return {
    fixture: fixtureName,
    seed,
    documentId: undefined,
    pages: pages.map((page, index) => ({ id: page.id, index, layerIds })),
    summary: summarizeFixture(spec),
    importantIds: importantIdsForPage(0, spec),
  };
}

export function buildPageXml(
  spec: RealFixtureSpec,
  seed: number,
  pageIndex: number,
): string {
  const random = mulberry32(seed + pageIndex * 9973);
  const cells = [
    '<mxCell id="0"/>',
    '<mxCell id="1" parent="0"/>',
  ];
  for (let layerIndex = 0; layerIndex < spec.layersPerPage; layerIndex += 1) {
    const visible = layerIndex === spec.layersPerPage - 1 ? ' visible="0"' : "";
    cells.push(
      `<mxCell id="${layerId(layerIndex)}" value="Layer ${layerIndex}" parent="0"${visible}/>`,
    );
  }

  for (let groupIndex = 0; groupIndex < spec.groupsPerPage; groupIndex += 1) {
    const id = groupId(pageIndex, groupIndex);
    cells.push(
      `<mxCell id="${id}" value="Group ${groupIndex}" style="group;container=1;" vertex="1" connectable="0" parent="${layerId(0)}"><mxGeometry x="${40 + groupIndex * 180}" y="40" width="140" height="120" as="geometry"/></mxCell>`,
    );
  }

  const vertexIds: string[] = [];
  for (let layerIndex = 0; layerIndex < spec.layersPerPage; layerIndex += 1) {
    for (let item = 0; item < spec.verticesPerLayer; item += 1) {
      const id = vertexId(pageIndex, layerIndex, item);
      vertexIds.push(id);
      const groupParent =
        layerIndex === 1 && item === 0 ? groupId(pageIndex, 0) : layerId(layerIndex);
      const label = syntheticText(`M7 ${pageIndex}-${layerIndex}-${item}`, spec.labelBytes);
      const attrs = metadataAttributes(spec.metadataKeys, pageIndex, layerIndex, item);
      const x = 40 + (item % 12) * 70 + Math.floor(random() * 10);
      const y = 210 + layerIndex * 150 + Math.floor(item / 12) * 50;
      cells.push(
        `<object label="${escapeXml(label)}"${attrs} id="${id}"><mxCell style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="${groupParent}"><mxGeometry x="${x}" y="${y}" width="58" height="32" as="geometry"/></mxCell></object>`,
      );
    }
  }

  for (let edgeIndex = 0; edgeIndex < spec.edgesPerPage; edgeIndex += 1) {
    const source = vertexIds[edgeIndex % vertexIds.length]!;
    const target = vertexIds[(edgeIndex * 7 + 3) % vertexIds.length]!;
    const parentLayer =
      edgeIndex === 0 ? layerId(2 % spec.layersPerPage) : layerId(edgeIndex % spec.layersPerPage);
    const id = edgeId(pageIndex, edgeIndex);
    cells.push(
      `<mxCell id="${id}" value="e${edgeIndex}" edge="1" parent="${parentLayer}" source="${source}" target="${target}"><mxGeometry relative="1" as="geometry"><mxPoint x="120" y="120" as="targetPoint"/></mxGeometry></mxCell>`,
    );
  }

  return `<mxGraphModel dx="1200" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1200" math="0" shadow="0"><root>${cells.join("")}</root></mxGraphModel>`;
}

export function summarizeFixture(spec: RealFixtureSpec): RealFixtureSummary {
  const nodes = spec.pages * spec.layersPerPage * spec.verticesPerLayer;
  const groups = spec.pages * spec.groupsPerPage;
  const edges = spec.pages * spec.edgesPerPage;
  return {
    pages: spec.pages,
    layers: spec.pages * spec.layersPerPage,
    elements: nodes + groups + edges,
    nodes,
    edges,
    groups,
    hiddenLayers: spec.pages,
    metadataKeysApprox: nodes * spec.metadataKeys,
    labelBytesApprox: nodes * spec.labelBytes,
  };
}

export function importantIdsForPage(
  pageIndex: number,
  spec: RealFixtureSpec,
): RealFixtureRuntime["importantIds"] {
  return {
    vertex: vertexId(pageIndex, 0, 0),
    secondVertex: vertexId(pageIndex, 0, 1),
    group: groupId(pageIndex, 0),
    groupedVertex: vertexId(pageIndex, 1, 0),
    edge: edgeId(pageIndex, 0),
    externalTerminalEdge: edgeId(pageIndex, 1),
    hiddenLayer: layerId(spec.layersPerPage - 1),
    contextLayer: layerId(1),
    crossLayer: layerId(2 % spec.layersPerPage),
    externalReferenceLayer: layerId(1),
  };
}

function buildLayerIds(spec: RealFixtureSpec): readonly string[] {
  return Array.from({ length: spec.layersPerPage }, (_, index) => layerId(index));
}

async function importPageXml(
  context: RealContext,
  pageId: string,
  data: string,
): Promise<void> {
  await callTool<unknown>(context, "import-diagram", {
    target_page: { id: pageId },
    data,
    format: "xml",
    mode: "replace",
    filename: "m7-fixture.drawio",
  });
}

async function callTool<T>(
  context: RealContext,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const raw = (await context.client.callTool({ name, arguments: args })) as {
    readonly isError?: boolean;
    readonly content?: readonly { readonly type: string; readonly text?: string }[];
  };
  if (raw.isError) {
    throw new Error(`Tool ${name} failed while preparing M7 fixture`);
  }
  const text = raw.content?.find((entry) => entry.type === "text")?.text ?? "{}";
  const payload = JSON.parse(text) as ToolPayload<T>;
  if (payload.success === false) {
    throw new Error(`Tool ${name} returned unsuccessful payload`);
  }
  return payload.result as T;
}

function layerId(index: number): string {
  return `m7-layer-${index}`;
}

function vertexId(pageIndex: number, layerIndex: number, item: number): string {
  return `m7-p${pageIndex}-l${layerIndex}-v${item}`;
}

function groupId(pageIndex: number, item: number): string {
  return `m7-p${pageIndex}-g${item}`;
}

function edgeId(pageIndex: number, item: number): string {
  return `m7-p${pageIndex}-e${item}`;
}

function metadataAttributes(
  count: number,
  pageIndex: number,
  layerIndex: number,
  item: number,
): string {
  return Array.from(
    { length: count },
    (_, index) =>
      ` data_m7_${index}="${pageIndex}_${layerIndex}_${item}_${index}"`,
  ).join("");
}

function syntheticText(prefix: string, bytes: number): string {
  const suffix = "x".repeat(Math.max(0, bytes - prefix.length - 1));
  return `${prefix} ${suffix}`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}
