import type {
  BrokenReferenceFinding,
  DiagramSnapshot,
  GraphElement,
  PageSnapshot,
} from "./types.js";

export function validateBrokenReferences(
  snapshot: DiagramSnapshot,
): readonly BrokenReferenceFinding[] {
  const findings: BrokenReferenceFinding[] = [];
  const pageIds = new Set(snapshot.pages.map((page) => page.internalId));
  const layerIds = new Set(snapshot.layers.map((layer) => layer.internalId));
  const elementIds = new Set(snapshot.elements.map((element) => element.internalId));
  const pageById = new Map(snapshot.pages.map((page) => [page.internalId, page]));

  for (const element of snapshot.elements) {
    if (!pageIds.has(element.pageId)) {
      findings.push(
        finding("missing_page", element, "page", undefined, element.pageId),
      );
    }
    if (element.layerId && !layerIds.has(element.layerId)) {
      findings.push(
        finding("missing_layer", element, "layer", undefined, element.layerId),
      );
    }
    if (element.parentId && !elementIds.has(element.parentId)) {
      findings.push(
        finding("missing_parent", element, "parent", undefined, element.parentId),
      );
    }
    if (element.kind === "edge") {
      if (element.sourceId && !elementIds.has(element.sourceId)) {
        findings.push(
          finding("missing_edge_source", element, "source", undefined, element.sourceId),
        );
      }
      if (element.targetId && !elementIds.has(element.targetId)) {
        findings.push(
          finding("missing_edge_target", element, "target", undefined, element.targetId),
        );
      }
    }
  }

  for (const page of snapshot.pages) {
    for (const elementId of page.elementIds) {
      if (!elementIds.has(elementId)) {
        findings.push(pageFinding(page, "missing_child", "child", elementId));
      }
    }
    for (const layerId of page.layerIds) {
      if (!layerIds.has(layerId)) {
        findings.push(pageFinding(page, "missing_layer", "layer", layerId));
      }
    }
  }

  return findings.map((entry) => ({
    ...entry,
    page:
      entry.elementInternalId !== undefined
        ? pageEvidence(pageById.get(elementPage(snapshot, entry.elementInternalId) ?? ""))
        : entry.page,
  }));
}

function elementPage(
  snapshot: DiagramSnapshot,
  elementInternalId: string,
): string | undefined {
  return snapshot.indexes.byInternalId.get(elementInternalId)?.pageId;
}

function finding(
  code: BrokenReferenceFinding["code"],
  element: GraphElement,
  referenceType: BrokenReferenceFinding["referenceType"],
  drawioId?: string,
  internalId?: string,
): BrokenReferenceFinding {
  return {
    category: "broken-reference",
    code,
    message: `${code} for ${referenceType} on '${element.internalId}'`,
    elementInternalId: element.internalId,
    referenceType,
    ...(drawioId ? { referencedDrawioId: drawioId } : {}),
    ...(internalId ? { referencedInternalId: internalId } : {}),
    evidence: {
      pageId: element.pageId,
      drawioId: element.drawioId ?? null,
    },
  };
}

function pageFinding(
  page: PageSnapshot,
  code: BrokenReferenceFinding["code"],
  referenceType: BrokenReferenceFinding["referenceType"],
  internalId: string,
): BrokenReferenceFinding {
  return {
    category: "broken-reference",
    code,
    message: `${code} for ${referenceType} on page '${page.internalId}'`,
    referenceType,
    referencedInternalId: internalId,
    page: pageEvidence(page),
    evidence: { pageId: page.internalId },
  };
}

function pageEvidence(page: PageSnapshot | undefined) {
  return page
    ? {
        internalId: page.internalId,
        ...(page.drawioId ? { drawioId: page.drawioId } : {}),
        index: page.index,
        name: page.name,
      }
    : undefined;
}
