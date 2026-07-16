import type { DiagramSnapshot, GraphElement, InternalId } from "./types.js";

export function getElement(
  snapshot: DiagramSnapshot,
  internalId: InternalId,
): GraphElement | undefined {
  return snapshot.indexes.byInternalId.get(internalId);
}

export function getElementsByDrawioId(
  snapshot: DiagramSnapshot,
  drawioId: string,
): readonly GraphElement[] {
  return (snapshot.indexes.byDrawioId.get(drawioId) ?? [])
    .map((id) => snapshot.indexes.byInternalId.get(id))
    .filter((element): element is GraphElement => element !== undefined);
}

export function getElementsByPage(
  snapshot: DiagramSnapshot,
  pageInternalId: InternalId,
): readonly GraphElement[] {
  return (snapshot.indexes.elementsByPage.get(pageInternalId) ?? [])
    .map((id) => snapshot.indexes.byInternalId.get(id))
    .filter((element): element is GraphElement => element !== undefined);
}

export function getElementsByLayer(
  snapshot: DiagramSnapshot,
  layerInternalId: InternalId,
): readonly GraphElement[] {
  return (snapshot.indexes.elementsByLayer.get(layerInternalId) ?? [])
    .map((id) => snapshot.indexes.byInternalId.get(id))
    .filter((element): element is GraphElement => element !== undefined);
}

export function incomingEdges(
  snapshot: DiagramSnapshot,
  elementInternalId: InternalId,
): readonly GraphElement[] {
  return (snapshot.indexes.incomingEdges.get(elementInternalId) ?? [])
    .map((id) => snapshot.indexes.byInternalId.get(id))
    .filter((element): element is GraphElement => element !== undefined);
}

export function outgoingEdges(
  snapshot: DiagramSnapshot,
  elementInternalId: InternalId,
): readonly GraphElement[] {
  return (snapshot.indexes.outgoingEdges.get(elementInternalId) ?? [])
    .map((id) => snapshot.indexes.byInternalId.get(id))
    .filter((element): element is GraphElement => element !== undefined);
}
