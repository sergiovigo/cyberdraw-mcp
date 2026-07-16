import type { DiagramSnapshot, GraphIndexes } from "./types.js";

type SerializableIndexes = {
  readonly byInternalId: readonly string[];
  readonly byDrawioId: readonly (readonly [string, readonly string[]])[];
  readonly elementsByPage: readonly (readonly [string, readonly string[]])[];
  readonly elementsByLayer: readonly (readonly [string, readonly string[]])[];
  readonly incomingEdges: readonly (readonly [string, readonly string[]])[];
  readonly outgoingEdges: readonly (readonly [string, readonly string[]])[];
};

export function toSerializableSnapshot(snapshot: DiagramSnapshot) {
  return {
    ...snapshot,
    indexes: serializeIndexes(snapshot.indexes),
  };
}

export function serializeSnapshot(snapshot: DiagramSnapshot): string {
  return JSON.stringify(toSerializableSnapshot(snapshot), null, 2);
}

function serializeIndexes(indexes: GraphIndexes): SerializableIndexes {
  return {
    byInternalId: Array.from(indexes.byInternalId.keys()).sort(),
    byDrawioId: sortedEntries(indexes.byDrawioId),
    elementsByPage: sortedEntries(indexes.elementsByPage),
    elementsByLayer: sortedEntries(indexes.elementsByLayer),
    incomingEdges: sortedEntries(indexes.incomingEdges),
    outgoingEdges: sortedEntries(indexes.outgoingEdges),
  };
}

function sortedEntries(
  map: ReadonlyMap<string, readonly string[]>,
): readonly (readonly [string, readonly string[]])[] {
  return Array.from(map.entries())
    .map(([key, values]) => [key, [...values].sort()] as const)
    .sort(([a], [b]) => a.localeCompare(b));
}
