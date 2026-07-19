import { validateBrokenReferences } from "./validation.js";
import type {
  BrokenReferenceFinding,
  DiagramSnapshot,
  EdgeElement,
  GraphElement,
  JsonValue,
  SourceRef,
} from "./types.js";

export const STRUCTURAL_ANALYSIS_VERSION = "cyberdraw.structural-analysis.v1";
const MAX_FINDING_ID_FIELD_LENGTH = 1024;

export type StructuralCountBasis = "exact" | "observed" | "partial" | "unknown";

export type StructuralCount = {
  readonly value?: number;
  readonly basis: StructuralCountBasis;
};

export type StructuralCompleteness =
  | "complete-document"
  | "complete-target-scopes"
  | "partial"
  | "truncated"
  | "stale"
  | "unknown";

export type StructuralAnalysisCoverage = {
  readonly document: boolean;
  readonly pageIds: readonly string[];
  readonly layerTargets: readonly {
    readonly pageId: string;
    readonly layerIds: readonly string[];
  }[];
  readonly selection?: boolean;
  readonly conclusive: boolean;
  readonly truncated?: boolean;
  readonly stale?: boolean;
  readonly completeness?: StructuralCompleteness;
};

export type StructuralExternalReference = {
  readonly pageId?: string;
  readonly elementId?: string;
  readonly referenceType?: "parent" | "source" | "target" | "edge" | "layer";
  readonly referencedId?: string;
  readonly referencedPageId?: string;
  readonly referencedLayerId?: string;
};

export type StructuralAnalysisInput = {
  readonly graph: DiagramSnapshot;
  readonly coverage?: StructuralAnalysisCoverage;
  readonly externalReferences?: readonly StructuralExternalReference[];
  readonly diagnostics?: readonly StructuralAnalysisDiagnostic[];
  readonly stopReason?: string;
  readonly revisionEvidence?: {
    readonly documentId?: string;
    readonly contentRevisions?: readonly string[];
    readonly documentRevisions?: readonly string[];
    readonly revisionCompatible?: boolean;
  };
  readonly limits?: {
    readonly hardSnapshotBytes?: number;
    readonly softSnapshotBytes?: number;
    readonly measuredBytes?: number;
    readonly estimatedBytes?: number;
  };
};

export type StructuralAnalysisDiagnostic = {
  readonly code: string;
  readonly severity: "debug" | "info" | "warn" | "error";
  readonly pageId?: string;
  readonly layerId?: string;
  readonly elementId?: string;
  readonly detail?: JsonValue;
};

export type StructuralFindingType =
  | "broken-reference"
  | "cross-layer-edge"
  | "orphan-element";

export type StructuralFindingConfidence =
  | "confirmed"
  | "contextual"
  | "incomplete";

export type StructuralCoverageContext = {
  readonly completeness: StructuralCompleteness;
  readonly document: boolean;
  readonly pageCovered: boolean;
  readonly layerCovered: boolean;
  readonly conclusive: boolean;
};

export type BrokenReferenceStatus =
  | "broken"
  | "unresolved"
  | "ambiguous"
  | "outside-coverage"
  | "external-context-not-loaded";

export type StructuralBrokenReferenceFinding = {
  readonly findingId: string;
  readonly findingType: "broken-reference";
  readonly referenceType:
    | "source"
    | "target"
    | "parent"
    | "layer"
    | "page"
    | "child"
    | "drawioId"
    | "edge";
  readonly status: BrokenReferenceStatus;
  readonly sourceElementId?: string;
  readonly referencedElementId?: string;
  readonly pageId?: string;
  readonly layerId?: string;
  readonly referencedPageId?: string;
  readonly referencedLayerId?: string;
  readonly reasonCode: string;
  readonly coverage: StructuralCoverageContext;
  readonly confidence: StructuralFindingConfidence;
  readonly provenance?: MinimalProvenance;
};

export type CrossLayerRelationClassification =
  | "same-page-cross-layer"
  | "cross-page-edge"
  | "unresolved-cross-layer-candidate"
  | "context-only-endpoint";

export type StructuralCrossLayerFinding = {
  readonly findingId: string;
  readonly findingType: "cross-layer-edge";
  readonly edgeId: string;
  readonly sourceElementId?: string;
  readonly targetElementId?: string;
  readonly sourcePageId?: string;
  readonly sourceLayerId?: string;
  readonly targetPageId?: string;
  readonly targetLayerId?: string;
  readonly relationClassification: CrossLayerRelationClassification;
  readonly reasonCode: string;
  readonly coverage: StructuralCoverageContext;
  readonly confidence: StructuralFindingConfidence;
  readonly provenance?: MinimalProvenance;
};

export type OrphanStatus =
  | "confirmed-orphan"
  | "possible-orphan"
  | "excluded-from-orphan-analysis"
  | "outside-coverage";

export type StructuralOrphanFinding = {
  readonly findingId: string;
  readonly findingType: "orphan-element";
  readonly status: OrphanStatus;
  readonly elementId: string;
  readonly pageId?: string;
  readonly layerId?: string;
  readonly reasonCode: string;
  readonly coverage: StructuralCoverageContext;
  readonly confidence: StructuralFindingConfidence;
  readonly provenance?: MinimalProvenance;
};

export type StructuralFinding =
  | StructuralBrokenReferenceFinding
  | StructuralCrossLayerFinding
  | StructuralOrphanFinding;

export type MinimalProvenance = {
  readonly kind?: SourceRef["kind"];
  readonly sourceName?: string;
  readonly documentId?: string;
  readonly pageId?: string;
  readonly drawioId?: string;
};

export type StructuralAnalysisCounts = {
  readonly pageCount: StructuralCount;
  readonly layerCount: StructuralCount;
  readonly elementCount: StructuralCount;
  readonly nodeCount: StructuralCount;
  readonly edgeCount: StructuralCount;
  readonly connectedNodeCount: StructuralCount;
  readonly orphanElementCount: StructuralCount;
  readonly brokenReferenceCount: StructuralCount;
  readonly crossLayerEdgeCount: StructuralCount;
  readonly unresolvedExternalReferenceCount: StructuralCount;
  readonly contextOnlyElementCount: StructuralCount;
};

export type StructuralAnalysisResult = {
  readonly analysisVersion: typeof STRUCTURAL_ANALYSIS_VERSION;
  readonly documentId?: string;
  readonly revisionEvidence: {
    readonly documentId?: string;
    readonly contentRevisions: readonly string[];
    readonly documentRevisions: readonly string[];
    readonly revisionCompatible: boolean;
  };
  readonly coverage: StructuralAnalysisCoverage;
  readonly counts: StructuralAnalysisCounts;
  readonly findings: readonly StructuralFinding[];
  readonly diagnostics: readonly StructuralAnalysisDiagnostic[];
  readonly limitations: readonly string[];
  readonly completeness: StructuralCompleteness;
  readonly stopReason?: string;
  readonly limits?: StructuralAnalysisInput["limits"];
};

type Indexes = {
  readonly pagesByInternalId: ReadonlyMap<
    string,
    DiagramSnapshot["pages"][number]
  >;
  readonly layersByInternalId: ReadonlyMap<
    string,
    DiagramSnapshot["layers"][number]
  >;
  readonly elementsByInternalId: ReadonlyMap<string, GraphElement>;
  readonly elementsByExternalContext: ReadonlyMap<
    string,
    readonly GraphElement[]
  >;
  readonly childrenByParentId: ReadonlyMap<string, readonly string[]>;
  readonly externalReferenceKeys: ReadonlySet<string>;
};

export function analyzeGraphStructure(
  input: StructuralAnalysisInput,
): StructuralAnalysisResult {
  const coverage = normalizeCoverage(input.coverage, input.graph);
  const completeness = deriveCompleteness(coverage, input.stopReason);
  const indexes = buildAnalysisIndexes(
    input.graph,
    input.externalReferences ?? [],
  );
  const diagnostics = [...(input.diagnostics ?? [])].sort(compareDiagnostics);
  const findings = [
    ...brokenReferenceFindings(
      input.graph,
      coverage,
      completeness,
      indexes,
      input.externalReferences ?? [],
    ),
    ...externalReferenceFindings(
      input.externalReferences ?? [],
      coverage,
      completeness,
      indexes,
      input.graph.source,
    ),
    ...crossLayerFindings(input.graph, coverage, completeness, indexes),
    ...orphanFindings(
      input.graph,
      coverage,
      completeness,
      indexes,
      input.externalReferences ?? [],
    ),
  ].sort(compareFindings);

  const counts = buildCounts(input.graph, findings, completeness);
  return {
    analysisVersion: STRUCTURAL_ANALYSIS_VERSION,
    ...(input.graph.source.documentId
      ? { documentId: input.graph.source.documentId }
      : {}),
    revisionEvidence: {
      documentId:
        input.revisionEvidence?.documentId ?? input.graph.source.documentId,
      contentRevisions: uniqueSorted(
        input.revisionEvidence?.contentRevisions ?? [],
      ),
      documentRevisions: uniqueSorted(
        input.revisionEvidence?.documentRevisions ?? [],
      ),
      revisionCompatible:
        input.revisionEvidence?.revisionCompatible ?? completeness !== "stale",
    },
    coverage,
    counts,
    findings,
    diagnostics,
    limitations: limitationsFor(
      completeness,
      coverage,
      input.externalReferences ?? [],
    ),
    completeness,
    ...(input.stopReason ? { stopReason: input.stopReason } : {}),
    ...(input.limits ? { limits: input.limits } : {}),
  };
}

function brokenReferenceFindings(
  graph: DiagramSnapshot,
  coverage: StructuralAnalysisCoverage,
  completeness: StructuralCompleteness,
  indexes: Indexes,
  externalReferences: readonly StructuralExternalReference[],
): StructuralBrokenReferenceFinding[] {
  const rawFindings = [...graph.findings, ...validateBrokenReferences(graph)];
  const seen = new Set<string>();
  const findings: StructuralBrokenReferenceFinding[] = [];
  for (const raw of rawFindings) {
    const source = raw.elementInternalId
      ? indexes.elementsByInternalId.get(raw.elementInternalId)
      : undefined;
    const key = [
      raw.code,
      raw.referenceType,
      raw.elementInternalId ?? "",
      raw.referencedInternalId ??
        raw.referencedExternalId ??
        raw.referencedDrawioId ??
        "",
    ].join("\u0000");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const pageId = source?.pageId ?? raw.page?.internalId;
    const layerId = source?.layerId;
    const referencedElementId =
      raw.referencedInternalId ??
      raw.referencedExternalId ??
      raw.referencedDrawioId;
    const coverageContext = coverageContextFor(
      coverage,
      completeness,
      pageId,
      layerId,
    );
    const status = statusForBrokenReference(
      raw,
      coverageContext,
      externalReferenceForRawFinding(raw, source, externalReferences),
      coverage,
      completeness,
    );
    findings.push({
      findingId: findingId([
        "broken-reference",
        raw.referenceType,
        stableElementRef(source, raw.elementInternalId),
        referencedElementId ?? "",
        raw.code,
        pageId ?? "",
        layerId ?? "",
      ]),
      findingType: "broken-reference",
      referenceType: raw.referenceType,
      status,
      ...(raw.elementInternalId
        ? { sourceElementId: raw.elementInternalId }
        : {}),
      ...(referencedElementId ? { referencedElementId } : {}),
      ...(pageId ? { pageId } : {}),
      ...(layerId ? { layerId } : {}),
      reasonCode:
        status === "broken" || status === "ambiguous" ? raw.code : status,
      coverage: coverageContext,
      confidence:
        coverageContext.conclusive && coverageContext.pageCovered
          ? "confirmed"
          : "incomplete",
      provenance: minimalProvenance(source?.source ?? graph.source),
    });
  }
  return findings;
}

function externalReferenceFindings(
  references: readonly StructuralExternalReference[],
  coverage: StructuralAnalysisCoverage,
  completeness: StructuralCompleteness,
  indexes: Indexes,
  source: SourceRef,
): StructuralBrokenReferenceFinding[] {
  const findings: StructuralBrokenReferenceFinding[] = [];
  for (const reference of references) {
    if (isLayerParentContextReference(reference)) {
      continue;
    }
    if (!reference.referencedId) {
      continue;
    }
    if (isAlreadyRepresentedByGraphEndpoint(reference, indexes)) {
      continue;
    }
    const pageId = reference.referencedPageId ?? reference.pageId;
    const matches = findExternalMatches(reference, indexes);
    if (matches.length === 1) {
      continue;
    }
    const layerId = reference.referencedLayerId;
    const coverageContext = coverageContextFor(
      coverage,
      completeness,
      pageId,
      layerId,
    );
    const status: BrokenReferenceStatus =
      matches.length > 1
        ? "ambiguous"
        : coverageContext.layerCovered ||
            (coverageContext.pageCovered && !layerId)
          ? "broken"
          : reference.referencedPageId || reference.referencedLayerId
            ? "external-context-not-loaded"
            : "outside-coverage";
    findings.push({
      findingId: findingId([
        "broken-reference",
        reference.referenceType ?? "edge",
        reference.elementId ?? "",
        reference.referencedId,
        status,
        reference.pageId ?? "",
        pageId ?? "",
        layerId ?? "",
      ]),
      findingType: "broken-reference",
      referenceType: reference.referenceType ?? "edge",
      status,
      ...(reference.elementId ? { sourceElementId: reference.elementId } : {}),
      referencedElementId: reference.referencedId,
      ...(reference.pageId ? { pageId: reference.pageId } : {}),
      ...(reference.referencedLayerId
        ? { layerId: reference.referencedLayerId }
        : {}),
      ...(reference.referencedPageId
        ? { referencedPageId: reference.referencedPageId }
        : {}),
      ...(reference.referencedLayerId
        ? { referencedLayerId: reference.referencedLayerId }
        : {}),
      reasonCode:
        matches.length > 1
          ? "external-reference-ambiguous"
          : status === "broken"
            ? "external-reference-not-materialized"
            : status,
      coverage: coverageContext,
      confidence:
        status === "broken" || status === "ambiguous"
          ? "confirmed"
          : "incomplete",
      provenance: minimalProvenance(source),
    });
  }
  return findings;
}

function crossLayerFindings(
  graph: DiagramSnapshot,
  coverage: StructuralAnalysisCoverage,
  completeness: StructuralCompleteness,
  indexes: Indexes,
): StructuralCrossLayerFinding[] {
  const findings: StructuralCrossLayerFinding[] = [];
  for (const edge of graph.elements) {
    if (edge.kind !== "edge") {
      continue;
    }
    const source = edge.sourceId
      ? indexes.elementsByInternalId.get(edge.sourceId)
      : undefined;
    const target = edge.targetId
      ? indexes.elementsByInternalId.get(edge.targetId)
      : undefined;
    if (!source || !target) {
      findings.push(crossLayerCandidate(edge, coverage, completeness));
      continue;
    }
    if (isContextOnly(source) || isContextOnly(target)) {
      findings.push(
        crossLayerContextOnly(edge, source, target, coverage, completeness),
      );
      continue;
    }
    if (!source.layerId || !target.layerId) {
      continue;
    }
    if (source.pageId !== target.pageId) {
      findings.push(
        crossLayerMaterialized(
          edge,
          source,
          target,
          "cross-page-edge",
          coverage,
          completeness,
        ),
      );
      continue;
    }
    if (source.layerId !== target.layerId) {
      findings.push(
        crossLayerMaterialized(
          edge,
          source,
          target,
          "same-page-cross-layer",
          coverage,
          completeness,
        ),
      );
    }
  }
  return findings;
}

function orphanFindings(
  graph: DiagramSnapshot,
  coverage: StructuralAnalysisCoverage,
  completeness: StructuralCompleteness,
  indexes: Indexes,
  externalReferences: readonly StructuralExternalReference[],
): StructuralOrphanFinding[] {
  const pendingExternalElementIds = new Set(
    externalReferences
      .filter(
        (reference) =>
          reference.referenceType === "source" ||
          reference.referenceType === "target",
      )
      .map((reference) => reference.elementId)
      .filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0,
      ),
  );
  const findings: StructuralOrphanFinding[] = [];
  for (const element of graph.elements) {
    if (!orphanEligible(element)) {
      continue;
    }
    const coverageContext = coverageContextFor(
      coverage,
      completeness,
      element.pageId,
      element.layerId,
    );
    if (
      !coverageContext.pageCovered ||
      (element.layerId && !coverageContext.layerCovered)
    ) {
      continue;
    }
    if (pendingExternalElementIds.has(element.drawioId ?? element.internalId)) {
      continue;
    }
    if (hasStructuralRelations(element, graph, indexes)) {
      continue;
    }
    const confirmed =
      coverageContext.conclusive &&
      (completeness === "complete-document" ||
        completeness === "complete-target-scopes");
    const status: OrphanStatus = confirmed
      ? "confirmed-orphan"
      : "possible-orphan";
    findings.push({
      findingId: findingId([
        "orphan-element",
        status,
        stableElementRef(element),
        element.pageId,
        element.layerId ?? "",
      ]),
      findingType: "orphan-element",
      status,
      elementId: element.internalId,
      pageId: element.pageId,
      ...(element.layerId ? { layerId: element.layerId } : {}),
      reasonCode: confirmed
        ? "no-structural-relations"
        : "coverage-not-conclusive",
      coverage: coverageContext,
      confidence: confirmed ? "confirmed" : "incomplete",
      provenance: minimalProvenance(element.source),
    });
  }
  return findings;
}

function isLayerParentContextReference(
  reference: StructuralExternalReference,
): boolean {
  return (
    reference.referenceType === "parent" &&
    reference.referencedId !== undefined &&
    reference.referencedLayerId === reference.referencedId
  );
}

function buildAnalysisIndexes(
  graph: DiagramSnapshot,
  externalReferences: readonly StructuralExternalReference[],
): Indexes {
  const pagesByInternalId = new Map(
    graph.pages.map((page) => [page.internalId, page]),
  );
  const layersByInternalId = new Map(
    graph.layers.map((layer) => [layer.internalId, layer]),
  );
  const elementsByInternalId = new Map(
    graph.elements.map((element) => [element.internalId, element]),
  );
  const elementsByExternalContext = new Map<string, GraphElement[]>();
  const childrenByParentId = new Map<string, string[]>();
  for (const element of graph.elements) {
    const page = pagesByInternalId.get(element.pageId);
    const layer = element.layerId
      ? layersByInternalId.get(element.layerId)
      : undefined;
    if (element.drawioId && page?.drawioId) {
      pushMap(
        elementsByExternalContext,
        externalContextKey(page.drawioId, layer?.drawioId, element.drawioId),
        element,
      );
      pushMap(
        elementsByExternalContext,
        externalContextKey(page.drawioId, undefined, element.drawioId),
        element,
      );
    }
    if (element.parentId) {
      pushMap(childrenByParentId, element.parentId, element.internalId);
    }
  }
  return {
    pagesByInternalId,
    layersByInternalId,
    elementsByInternalId,
    elementsByExternalContext,
    childrenByParentId,
    externalReferenceKeys: new Set(
      externalReferences.map((reference) =>
        [
          reference.pageId ?? "",
          reference.elementId ?? "",
          reference.referenceType ?? "",
          reference.referencedId ?? "",
        ].join("\u0000"),
      ),
    ),
  };
}

function buildCounts(
  graph: DiagramSnapshot,
  findings: readonly StructuralFinding[],
  completeness: StructuralCompleteness,
): StructuralAnalysisCounts {
  const basis = countBasisForCompleteness(completeness);
  const connected = new Set<string>();
  for (const element of graph.elements) {
    if (element.kind !== "edge") {
      continue;
    }
    if (isMaterializedNodeReference(graph, element.sourceId)) {
      connected.add(element.sourceId);
    }
    if (isMaterializedNodeReference(graph, element.targetId)) {
      connected.add(element.targetId);
    }
  }
  return {
    pageCount: { value: graph.pages.length, basis },
    layerCount: { value: graph.layers.length, basis },
    elementCount: { value: graph.elements.length, basis },
    nodeCount: {
      value: graph.elements.filter(
        (element) => element.kind === "node" || element.kind === "group",
      ).length,
      basis,
    },
    edgeCount: {
      value: graph.elements.filter((element) => element.kind === "edge").length,
      basis,
    },
    connectedNodeCount: { value: connected.size, basis },
    orphanElementCount: {
      value: findings.filter(
        (finding) =>
          finding.findingType === "orphan-element" &&
          finding.status === "confirmed-orphan",
      ).length,
      basis,
    },
    brokenReferenceCount: {
      value: findings.filter(
        (finding) =>
          finding.findingType === "broken-reference" &&
          finding.status === "broken",
      ).length,
      basis,
    },
    crossLayerEdgeCount: {
      value: findings.filter(
        (finding) =>
          finding.findingType === "cross-layer-edge" &&
          finding.relationClassification === "same-page-cross-layer",
      ).length,
      basis,
    },
    unresolvedExternalReferenceCount: {
      value: findings.filter(
        (finding) =>
          finding.findingType === "broken-reference" &&
          (finding.status === "unresolved" ||
            finding.status === "outside-coverage" ||
            finding.status === "external-context-not-loaded"),
      ).length,
      basis,
    },
    contextOnlyElementCount: {
      value: graph.elements.filter(isContextOnly).length,
      basis,
    },
  };
}

function isMaterializedNodeReference(
  graph: DiagramSnapshot,
  elementId: string | undefined,
): elementId is string {
  if (!elementId) {
    return false;
  }
  const element = graph.indexes.byInternalId.get(elementId);
  return element?.kind === "node" || element?.kind === "group";
}

function statusForBrokenReference(
  finding: BrokenReferenceFinding,
  coverage: StructuralCoverageContext,
  externalReference: StructuralExternalReference | undefined,
  fullCoverage: StructuralAnalysisCoverage,
  completeness: StructuralCompleteness,
): BrokenReferenceStatus {
  if (
    finding.code === "ambiguous_drawio_reference" ||
    finding.code === "duplicate_drawio_id"
  ) {
    return "ambiguous";
  }
  if (!coverage.pageCovered || !coverage.conclusive) {
    return "outside-coverage";
  }
  if (externalReference) {
    const referencedCoverage = coverageContextFor(
      fullCoverage,
      completeness,
      externalReference.referencedPageId ?? externalReference.pageId,
      externalReference.referencedLayerId,
    );
    if (!referencedCoverage.pageCovered || !referencedCoverage.layerCovered) {
      return externalReference.referencedPageId ||
        externalReference.referencedLayerId
        ? "external-context-not-loaded"
        : "outside-coverage";
    }
  }
  return "broken";
}

function externalReferenceForRawFinding(
  finding: BrokenReferenceFinding,
  source: GraphElement | undefined,
  externalReferences: readonly StructuralExternalReference[],
): StructuralExternalReference | undefined {
  if (
    finding.referenceType !== "source" &&
    finding.referenceType !== "target"
  ) {
    return undefined;
  }
  const referencedId =
    finding.referencedInternalId ??
    finding.referencedExternalId ??
    finding.referencedDrawioId;
  return externalReferences.find(
    (reference) =>
      reference.referenceType === finding.referenceType &&
      reference.referencedId === referencedId &&
      (reference.elementId === source?.drawioId ||
        reference.elementId === source?.internalId),
  );
}

function isAlreadyRepresentedByGraphEndpoint(
  reference: StructuralExternalReference,
  indexes: Indexes,
): boolean {
  if (
    reference.referenceType !== "source" &&
    reference.referenceType !== "target"
  ) {
    return false;
  }
  const sourceMatches =
    reference.pageId && reference.elementId
      ? (indexes.elementsByExternalContext.get(
          externalContextKey(reference.pageId, undefined, reference.elementId),
        ) ?? [])
      : [];
  return sourceMatches.some((element) => {
    if (element.kind !== "edge") {
      return false;
    }
    return reference.referenceType === "source"
      ? element.sourceId === reference.referencedId
      : element.targetId === reference.referencedId;
  });
}

function crossLayerCandidate(
  edge: EdgeElement,
  coverage: StructuralAnalysisCoverage,
  completeness: StructuralCompleteness,
): StructuralCrossLayerFinding {
  const context = coverageContextFor(
    coverage,
    completeness,
    edge.pageId,
    edge.layerId,
  );
  return {
    findingId: findingId([
      "cross-layer-edge",
      "candidate",
      stableElementRef(edge),
      edge.pageId,
    ]),
    findingType: "cross-layer-edge",
    edgeId: edge.internalId,
    sourceElementId: edge.sourceId,
    targetElementId: edge.targetId,
    sourcePageId: edge.pageId,
    sourceLayerId: edge.layerId,
    relationClassification: "unresolved-cross-layer-candidate",
    reasonCode: "endpoint-not-materialized",
    coverage: context,
    confidence: "incomplete",
    provenance: minimalProvenance(edge.source),
  };
}

function crossLayerContextOnly(
  edge: EdgeElement,
  source: GraphElement,
  target: GraphElement,
  coverage: StructuralAnalysisCoverage,
  completeness: StructuralCompleteness,
): StructuralCrossLayerFinding {
  const context = coverageContextFor(
    coverage,
    completeness,
    edge.pageId,
    edge.layerId,
  );
  return {
    findingId: findingId([
      "cross-layer-edge",
      "context-only",
      stableElementRef(edge),
      stableElementRef(source),
      stableElementRef(target),
    ]),
    findingType: "cross-layer-edge",
    edgeId: edge.internalId,
    sourceElementId: source.internalId,
    targetElementId: target.internalId,
    sourcePageId: source.pageId,
    sourceLayerId: source.layerId,
    targetPageId: target.pageId,
    targetLayerId: target.layerId,
    relationClassification: "context-only-endpoint",
    reasonCode: "context-only-endpoint",
    coverage: context,
    confidence: "incomplete",
    provenance: minimalProvenance(edge.source),
  };
}

function crossLayerMaterialized(
  edge: EdgeElement,
  source: GraphElement,
  target: GraphElement,
  classification: CrossLayerRelationClassification,
  coverage: StructuralAnalysisCoverage,
  completeness: StructuralCompleteness,
): StructuralCrossLayerFinding {
  const context = coverageContextFor(
    coverage,
    completeness,
    edge.pageId,
    edge.layerId,
  );
  return {
    findingId: findingId([
      "cross-layer-edge",
      classification,
      stableElementRef(edge),
      stableElementRef(source),
      stableElementRef(target),
      source.layerId ?? "",
      target.layerId ?? "",
    ]),
    findingType: "cross-layer-edge",
    edgeId: edge.internalId,
    sourceElementId: source.internalId,
    targetElementId: target.internalId,
    sourcePageId: source.pageId,
    sourceLayerId: source.layerId,
    targetPageId: target.pageId,
    targetLayerId: target.layerId,
    relationClassification: classification,
    reasonCode: classification,
    coverage: context,
    confidence: context.conclusive ? "confirmed" : "contextual",
    provenance: minimalProvenance(edge.source),
  };
}

function orphanEligible(element: GraphElement): boolean {
  return (
    (element.kind === "node" || element.kind === "group") &&
    !isContextOnly(element) &&
    !isTechnicalContainer(element)
  );
}

function hasStructuralRelations(
  element: GraphElement,
  graph: DiagramSnapshot,
  indexes: Indexes,
): boolean {
  return (
    (graph.indexes.incomingEdges.get(element.internalId)?.length ?? 0) > 0 ||
    (graph.indexes.outgoingEdges.get(element.internalId)?.length ?? 0) > 0 ||
    hasSemanticParent(element, indexes) ||
    hasSemanticChild(element, indexes)
  );
}

function isTechnicalContainer(element: GraphElement): boolean {
  return (
    element.style?.properties.container === "1" &&
    element.drawioId === undefined
  );
}

function hasSemanticParent(element: GraphElement, indexes: Indexes): boolean {
  if (!element.parentId) {
    return false;
  }
  const parent = indexes.elementsByInternalId.get(element.parentId);
  if (!parent) {
    return false;
  }
  return !isContextOnly(parent) && !isTechnicalContainer(parent);
}

function hasSemanticChild(element: GraphElement, indexes: Indexes): boolean {
  const childIds = indexes.childrenByParentId.get(element.internalId) ?? [];
  return childIds.some((childId) => {
    const child = indexes.elementsByInternalId.get(childId);
    return (
      child !== undefined && !isContextOnly(child) && !isTechnicalContainer(child)
    );
  });
}

function isContextOnly(element: GraphElement): boolean {
  return (
    readRawBoolean(element.raw, "runtimeSnapshotContextOnly") ||
    readRawBoolean(element.raw, "contextOnly")
  );
}

function readRawBoolean(value: JsonValue | undefined, key: string): boolean {
  return (
    value !== undefined &&
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Record<string, JsonValue>)[key] === true
  );
}

function findExternalMatches(
  reference: StructuralExternalReference,
  indexes: Indexes,
): readonly GraphElement[] {
  if (!reference.referencedId) {
    return [];
  }
  const pageId = reference.referencedPageId ?? reference.pageId;
  if (!pageId) {
    return [];
  }
  return (
    indexes.elementsByExternalContext.get(
      externalContextKey(
        pageId,
        reference.referencedLayerId,
        reference.referencedId,
      ),
    ) ?? []
  );
}

function normalizeCoverage(
  coverage: StructuralAnalysisCoverage | undefined,
  graph: DiagramSnapshot,
): StructuralAnalysisCoverage {
  const pageIds = new Set(coverage?.pageIds ?? []);
  const layerTargets = new Map<string, Set<string>>();
  const pageByExternalId = new Map<string, string>();
  const layerByPageAndExternalId = new Map<
    string,
    { pageId: string; layerId: string }
  >();
  for (const page of graph.pages) {
    if (page.drawioId) {
      pageByExternalId.set(page.drawioId, page.internalId);
    }
  }
  for (const layer of graph.layers) {
    const page = graph.pages.find(
      (candidate) => candidate.internalId === layer.pageId,
    );
    if (page?.drawioId && layer.drawioId) {
      layerByPageAndExternalId.set(`${page.drawioId}\u0000${layer.drawioId}`, {
        pageId: layer.pageId,
        layerId: layer.internalId,
      });
    }
  }
  for (const pageId of coverage?.pageIds ?? []) {
    const internalPageId = pageByExternalId.get(pageId);
    if (internalPageId) {
      pageIds.add(internalPageId);
    }
  }
  for (const target of coverage?.layerTargets ?? []) {
    addLayerTarget(layerTargets, target.pageId, target.layerIds);
    const internalPageId = pageByExternalId.get(target.pageId);
    if (internalPageId) {
      addLayerTarget(layerTargets, internalPageId, []);
    }
    for (const layerId of target.layerIds) {
      const internal = layerByPageAndExternalId.get(
        `${target.pageId}\u0000${layerId}`,
      );
      if (internal) {
        addLayerTarget(layerTargets, internal.pageId, [internal.layerId]);
      }
    }
  }
  return {
    document: coverage?.document ?? false,
    pageIds: uniqueSorted([...pageIds]),
    layerTargets: [...layerTargets.entries()]
      .map(([pageId, layerIds]) => ({
        pageId,
        layerIds: uniqueSorted([...layerIds]),
      }))
      .sort((left, right) => left.pageId.localeCompare(right.pageId)),
    selection: coverage?.selection ?? false,
    conclusive: coverage?.conclusive ?? false,
    truncated: coverage?.truncated ?? false,
    stale: coverage?.stale ?? false,
    ...(coverage?.completeness ? { completeness: coverage.completeness } : {}),
  };
}

function addLayerTarget(
  targets: Map<string, Set<string>>,
  pageId: string,
  layerIds: readonly string[],
): void {
  const existing = targets.get(pageId) ?? new Set<string>();
  for (const layerId of layerIds) {
    existing.add(layerId);
  }
  targets.set(pageId, existing);
}

function deriveCompleteness(
  coverage: StructuralAnalysisCoverage,
  stopReason: string | undefined,
): StructuralCompleteness {
  if (coverage.completeness) {
    return coverage.completeness;
  }
  if (coverage.stale || stopReason === "stale-snapshot") {
    return "stale";
  }
  if (coverage.truncated || stopReason === "hard-limit-reached") {
    return "truncated";
  }
  if (!coverage.conclusive) {
    return stopReason ? "partial" : "unknown";
  }
  if (coverage.document) {
    return "complete-document";
  }
  if (
    coverage.pageIds.length > 0 ||
    coverage.layerTargets.length > 0 ||
    coverage.selection
  ) {
    return "complete-target-scopes";
  }
  return "unknown";
}

function coverageContextFor(
  coverage: StructuralAnalysisCoverage,
  completeness: StructuralCompleteness,
  pageId: string | undefined,
  layerId: string | undefined,
): StructuralCoverageContext {
  const pageCovered =
    coverage.document ||
    pageId === undefined ||
    coverage.pageIds.includes(pageId) ||
    coverage.layerTargets.some((target) => target.pageId === pageId);
  const layerCovered =
    coverage.document ||
    layerId === undefined ||
    coverage.layerTargets.some(
      (target) => target.pageId === pageId && target.layerIds.includes(layerId),
    ) ||
    (pageId !== undefined && coverage.pageIds.includes(pageId));
  return {
    completeness,
    document: coverage.document,
    pageCovered,
    layerCovered,
    conclusive:
      coverage.conclusive &&
      completeness !== "partial" &&
      completeness !== "truncated" &&
      completeness !== "stale" &&
      completeness !== "unknown",
  };
}

function countBasisForCompleteness(
  completeness: StructuralCompleteness,
): StructuralCountBasis {
  switch (completeness) {
    case "complete-document":
      return "exact";
    case "complete-target-scopes":
      return "observed";
    case "partial":
    case "truncated":
      return "partial";
    case "stale":
    case "unknown":
      return "unknown";
  }
}

function limitationsFor(
  completeness: StructuralCompleteness,
  coverage: StructuralAnalysisCoverage,
  externalReferences: readonly StructuralExternalReference[],
): readonly string[] {
  const limitations: string[] = [];
  if (completeness !== "complete-document") {
    limitations.push("analysis-is-scoped-not-complete-document");
  }
  if (completeness === "partial" || completeness === "truncated") {
    limitations.push("coverage-insufficient-for-global-negative-claims");
  }
  if (completeness === "stale") {
    limitations.push("snapshot-freshness-not-compatible");
  }
  if (externalReferences.length > 0) {
    limitations.push("unresolved-external-references-may-hide-relationships");
  }
  if (coverage.selection) {
    limitations.push("selection-scope-can-only-support-local-findings");
  }
  return uniqueSorted(limitations);
}

function minimalProvenance(
  source: SourceRef | undefined,
): MinimalProvenance | undefined {
  if (!source) {
    return undefined;
  }
  return {
    kind: source.kind,
    ...(source.sourceName ? { sourceName: source.sourceName } : {}),
    ...(source.documentId ? { documentId: source.documentId } : {}),
    ...(source.pageId ? { pageId: source.pageId } : {}),
    ...(source.drawioId ? { drawioId: source.drawioId } : {}),
  };
}

function stableElementRef(
  element: GraphElement | undefined,
  fallback?: string,
): string {
  if (!element) {
    return fallback ?? "";
  }
  return [
    element.source.documentId ?? "",
    element.pageId,
    element.layerId ?? "",
    element.drawioId ?? fallback ?? element.internalId,
    element.kind,
  ].join("\u0000");
}

function compareFindings(
  left: StructuralFinding,
  right: StructuralFinding,
): number {
  return (
    left.findingType.localeCompare(right.findingType) ||
    findingPage(left).localeCompare(findingPage(right)) ||
    findingLayer(left).localeCompare(findingLayer(right)) ||
    findingSource(left).localeCompare(findingSource(right)) ||
    findingTarget(left).localeCompare(findingTarget(right)) ||
    findingReason(left).localeCompare(findingReason(right)) ||
    left.findingId.localeCompare(right.findingId)
  );
}

function compareDiagnostics(
  left: StructuralAnalysisDiagnostic,
  right: StructuralAnalysisDiagnostic,
): number {
  return (
    left.code.localeCompare(right.code) ||
    (left.pageId ?? "").localeCompare(right.pageId ?? "") ||
    (left.layerId ?? "").localeCompare(right.layerId ?? "") ||
    (left.elementId ?? "").localeCompare(right.elementId ?? "")
  );
}

function findingPage(finding: StructuralFinding): string {
  if (finding.findingType === "cross-layer-edge") {
    return finding.sourcePageId ?? "";
  }
  return finding.pageId ?? "";
}

function findingLayer(finding: StructuralFinding): string {
  if (finding.findingType === "cross-layer-edge") {
    return finding.sourceLayerId ?? "";
  }
  return finding.layerId ?? "";
}

function findingSource(finding: StructuralFinding): string {
  if (finding.findingType === "orphan-element") {
    return finding.elementId;
  }
  if (finding.findingType === "cross-layer-edge") {
    return finding.sourceElementId ?? finding.edgeId;
  }
  return finding.sourceElementId ?? "";
}

function findingTarget(finding: StructuralFinding): string {
  if (finding.findingType === "cross-layer-edge") {
    return finding.targetElementId ?? "";
  }
  if (finding.findingType === "broken-reference") {
    return finding.referencedElementId ?? "";
  }
  return "";
}

function findingReason(finding: StructuralFinding): string {
  return finding.findingType === "cross-layer-edge"
    ? finding.reasonCode
    : finding.reasonCode;
}

function findingId(parts: readonly string[]): string {
  return `m9-${fnv1a64(parts.map(framedHashPart).join(""))}`;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, "0");
}

function framedHashPart(value: string): string {
  const bounded =
    value.length > MAX_FINDING_ID_FIELD_LENGTH
      ? value.slice(0, MAX_FINDING_ID_FIELD_LENGTH)
      : value;
  return `${bounded.length}:${bounded};`;
}

function externalContextKey(
  pageId: string,
  layerId: string | undefined,
  elementId: string,
): string {
  return [pageId, layerId ?? "", elementId].join("\u0000");
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function pushMap<T>(map: Map<string, T[]>, key: string, value: T): void {
  const values = map.get(key);
  if (values) {
    values.push(value);
  } else {
    map.set(key, [value]);
  }
}
