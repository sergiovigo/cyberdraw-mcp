export type InternalId = string;
export type DrawioId = string;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { readonly [key: string]: JsonValue };

export type SourceRef = {
  readonly kind: "adapter" | "external-snapshot" | "fixture";
  readonly sourceName?: string;
  readonly documentId?: string;
  readonly pageId?: string;
  readonly pageIndex?: number;
  readonly drawioId?: string;
  readonly sourceExternalId?: string;
  readonly targetExternalId?: string;
};

export type Geometry = {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly relative?: boolean;
  readonly points?: readonly { readonly x: number; readonly y: number }[];
  readonly raw?: JsonValue;
};

export type Style = {
  readonly raw?: string;
  readonly properties: Readonly<Record<string, string>>;
  readonly uninterpreted?: readonly string[];
};

export type Label = {
  readonly format: "plain" | "html" | "unknown";
  readonly text?: string;
  readonly html?: string;
};

export type ElementKind = "node" | "edge" | "group" | "unknown";

export type ElementBase = {
  readonly internalId: InternalId;
  readonly drawioId?: DrawioId;
  readonly kind: ElementKind;
  readonly pageId: InternalId;
  readonly layerId?: InternalId;
  readonly parentId?: InternalId;
  readonly label?: Label;
  readonly style?: Style;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
  readonly source: SourceRef;
  readonly raw?: JsonValue;
};

export type NodeElement = ElementBase & {
  readonly kind: "node";
  readonly geometry?: Geometry;
};

export type EdgeElement = ElementBase & {
  readonly kind: "edge";
  readonly sourceId?: InternalId;
  readonly targetId?: InternalId;
  readonly geometry?: Geometry;
};

export type GroupElement = ElementBase & {
  readonly kind: "group";
  readonly geometry?: Geometry;
};

export type UnknownElement = ElementBase & {
  readonly kind: "unknown";
};

export type GraphElement =
  | NodeElement
  | EdgeElement
  | GroupElement
  | UnknownElement;

export type PageSnapshot = {
  readonly internalId: InternalId;
  readonly drawioId?: DrawioId;
  readonly index: number;
  readonly name: string;
  readonly layerIds: readonly InternalId[];
  readonly elementIds: readonly InternalId[];
  readonly source: SourceRef;
};

export type LayerSnapshot = {
  readonly internalId: InternalId;
  readonly drawioId?: DrawioId;
  readonly pageId: InternalId;
  readonly name: string;
  readonly visible?: boolean;
  readonly locked?: boolean;
  readonly source: SourceRef;
};

export type BrokenReferenceCode =
  | "duplicate_drawio_id"
  | "ambiguous_drawio_reference"
  | "input_truncated"
  | "missing_edge_source"
  | "missing_edge_target"
  | "missing_parent"
  | "missing_layer"
  | "missing_page"
  | "missing_child"
  | "parent_cycle";

export type ReferenceType =
  | "drawioId"
  | "source"
  | "target"
  | "parent"
  | "layer"
  | "page"
  | "child";

export type BrokenReferenceFinding = {
  readonly category: "normalization-diagnostic" | "broken-reference";
  readonly code: BrokenReferenceCode;
  readonly message: string;
  readonly elementInternalId?: InternalId;
  readonly referenceType: ReferenceType;
  readonly referencedDrawioId?: DrawioId;
  readonly referencedExternalId?: string;
  readonly referencedInternalId?: InternalId;
  readonly page?: {
    readonly internalId: InternalId;
    readonly drawioId?: DrawioId;
    readonly index: number;
    readonly name: string;
  };
  readonly evidence: Readonly<Record<string, JsonValue>>;
};

export type GraphIndexes = {
  readonly byInternalId: ReadonlyMap<InternalId, GraphElement>;
  readonly byDrawioId: ReadonlyMap<DrawioId, readonly InternalId[]>;
  readonly elementsByPage: ReadonlyMap<InternalId, readonly InternalId[]>;
  readonly elementsByLayer: ReadonlyMap<InternalId, readonly InternalId[]>;
  readonly incomingEdges: ReadonlyMap<InternalId, readonly InternalId[]>;
  readonly outgoingEdges: ReadonlyMap<InternalId, readonly InternalId[]>;
};

export type DiagramSnapshot = {
  readonly schemaVersion: "0.1-spike";
  readonly internalId: InternalId;
  readonly source: SourceRef;
  readonly pages: readonly PageSnapshot[];
  readonly layers: readonly LayerSnapshot[];
  readonly elements: readonly GraphElement[];
  readonly indexes: GraphIndexes;
  readonly findings: readonly BrokenReferenceFinding[];
};

export type CanonicalLayerInput = {
  readonly layerExternalId?: unknown;
  readonly name?: unknown;
  readonly visible?: unknown;
  readonly locked?: unknown;
  readonly source?: SourceRef;
};

export type CanonicalElementInput = {
  readonly externalId?: unknown;
  readonly kind?: ElementKind;
  readonly layerExternalId?: unknown;
  readonly parentExternalId?: unknown;
  readonly sourceExternalId?: unknown;
  readonly targetExternalId?: unknown;
  readonly childExternalIds?: readonly unknown[];
  readonly label?: Label;
  readonly style?: Style;
  readonly geometry?: Geometry;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
  readonly raw?: JsonValue;
  readonly source?: SourceRef;
};

export type CanonicalPageInput = {
  readonly pageExternalId?: unknown;
  readonly name?: unknown;
  readonly index?: unknown;
  readonly layers?: readonly CanonicalLayerInput[];
  readonly elements?: readonly CanonicalElementInput[];
  readonly source?: SourceRef;
};

export type CanonicalDiagramInput = {
  readonly documentId?: unknown;
  readonly source?: SourceRef;
  readonly pages?: readonly CanonicalPageInput[];
  readonly elements?: readonly CanonicalElementInput[];
};

export type NormalizationLimits = {
  readonly maxPages: number;
  readonly maxLayersPerPage: number;
  readonly maxElementsPerPage: number;
  readonly maxStringLength: number;
  readonly maxArrayItems: number;
  readonly maxRawDepth: number;
  readonly maxRawKeys: number;
};

export type NormalizeOptions = {
  readonly source?: SourceRef;
  readonly limits?: Partial<NormalizationLimits>;
};
