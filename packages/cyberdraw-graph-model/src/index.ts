export { fromLegacyPagedModel, toCanonicalDiagramInput } from "./legacy-adapter.js";
export {
  fromRuntimeSnapshot,
  toCanonicalRuntimeSnapshotInput,
} from "./runtime-snapshot-adapter.js";
export {
  provisionalDiagramId,
  provisionalElementId,
  provisionalLayerId,
  provisionalPageId,
} from "./identity.js";
export { normalizeDiagram } from "./normalize.js";
export {
  getElement,
  getElementsByDrawioId,
  getElementsByLayer,
  getElementsByPage,
  incomingEdges,
  outgoingEdges,
} from "./queries.js";
export { serializeSnapshot, toSerializableSnapshot } from "./serialize.js";
export { validateBrokenReferences } from "./validation.js";
export type {
  BrokenReferenceFinding,
  CanonicalDiagramInput,
  CanonicalElementInput,
  CanonicalLayerInput,
  CanonicalPageInput,
  DiagramSnapshot,
  EdgeElement,
  Geometry,
  GraphElement,
  GroupElement,
  Label,
  LayerSnapshot,
  NodeElement,
  PageSnapshot,
  SourceRef,
  Style,
  UnknownElement,
} from "./types.js";
