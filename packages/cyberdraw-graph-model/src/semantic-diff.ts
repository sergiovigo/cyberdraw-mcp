import {
  createPrivateIdentitySignature,
  matchStableIdentity,
  type IdentityMatchOutcome,
  type IdentityMatchReasonCode,
  type StableIdentityEntityType,
  type StableIdentityEvidence,
} from "./identity.js";
import type {
  StructuralAnalysisCoverage,
  StructuralCompleteness,
} from "./structural-analysis.js";
import type {
  DiagramSnapshot,
  EdgeElement,
  Geometry,
  GraphElement,
  JsonValue,
  Label,
  LayerSnapshot,
  PageSnapshot,
  Style,
} from "./types.js";

export const SEMANTIC_DIFF_VERSION = "cyberdraw.semantic-diff.v1";

export type SemanticDiffOutcome =
  | "ok"
  | "ok-with-limitations"
  | "partial"
  | "incomparable"
  | "stale";

export type SemanticDiffClassification =
  | "UNCHANGED"
  | "ADDED"
  | "REMOVED"
  | "MODIFIED"
  | "MOVED"
  | "REWIRED"
  | "AMBIGUOUS";

export type SemanticDiffDimension =
  | "existence"
  | "content"
  | "geometry"
  | "container"
  | "connectivity"
  | "metadata"
  | "coverage";

export type SemanticDiffDimensionStatus =
  | "unchanged"
  | "changed"
  | "unknown"
  | "not-applicable"
  | "not-compared";

export type SemanticDiffCompleteness =
  | "complete-document"
  | "complete-target-scopes"
  | "partial"
  | "truncated"
  | "stale"
  | "incomparable"
  | "unknown";

export type SemanticDiffReasonCode =
  | "exact-identity"
  | "probable-identity-review-required"
  | "ambiguous-identity"
  | "no-match"
  | "added-absence-proven"
  | "removed-absence-proven"
  | "absence-not-proven"
  | "unresolved-probable-candidate"
  | "unresolved-ambiguous-candidate"
  | "content-changed"
  | "geometry-changed"
  | "container-changed"
  | "connectivity-changed"
  | "metadata-changed"
  | "coverage-comparable"
  | "coverage-partial"
  | "coverage-incomparable"
  | "document-mismatch"
  | "revision-compatible"
  | "revision-unknown"
  | "revision-mismatch"
  | "stale-base"
  | "stale-target"
  | IdentityMatchReasonCode;

export type SemanticDiffScopeEvidence = {
  readonly document: boolean;
  readonly pageIds: readonly string[];
  readonly layerTargets: readonly {
    readonly pageId: string;
    readonly layerIds: readonly string[];
  }[];
  readonly selection?: boolean;
};

export type SemanticDiffRevisionEvidence = {
  readonly documentId?: string;
  readonly contentRevisions?: readonly string[];
  readonly documentRevisions?: readonly string[];
  readonly revisionCompatible?: boolean;
};

export type SemanticDiffSnapshotInput = {
  readonly graph: DiagramSnapshot;
  readonly coverage?: StructuralAnalysisCoverage;
  readonly completeness?: StructuralCompleteness;
  readonly revisionEvidence?: SemanticDiffRevisionEvidence;
  readonly externalReferences?: readonly SemanticDiffExternalReferenceEvidence[];
  readonly identityEvidence?: readonly StableIdentityEvidence[];
};

export type SemanticDiffInput = {
  readonly base: SemanticDiffSnapshotInput;
  readonly target: SemanticDiffSnapshotInput;
};

export type SemanticDiffExternalReferenceEvidence = {
  readonly pageId?: string;
  readonly elementId?: string;
  readonly referenceType?: "parent" | "source" | "target" | "edge" | "layer";
  readonly referencedId?: string;
  readonly referencedPageId?: string;
  readonly referencedLayerId?: string;
};

export type SemanticDiffEntityRef = {
  readonly snapshot: "base" | "target";
  readonly entityType: SemanticDiffEntityType;
  readonly snapshotScopedId: string;
  readonly pageId?: string;
  readonly layerId?: string;
};

export type SemanticDiffEntityType =
  | "page"
  | "layer"
  | "element"
  | "edge"
  | "external-reference";

export type SemanticDiffDimensionChanges = Record<
  SemanticDiffDimension,
  SemanticDiffDimensionStatus
>;

export type SemanticDiffEntityResult = {
  readonly entityType: SemanticDiffEntityType;
  readonly identityStatus: IdentityMatchOutcome;
  readonly classifications: readonly SemanticDiffClassification[];
  readonly dimensions: SemanticDiffDimensionChanges;
  readonly baseEntityRef?: SemanticDiffEntityRef;
  readonly targetEntityRef?: SemanticDiffEntityRef;
  readonly reasonCodes: readonly SemanticDiffReasonCode[];
};

export type SemanticDiffResult = {
  readonly diffVersion: typeof SEMANTIC_DIFF_VERSION;
  readonly outcome: SemanticDiffOutcome;
  readonly baseScope: SemanticDiffScopeEvidence;
  readonly targetScope: SemanticDiffScopeEvidence;
  readonly comparableScope: SemanticDiffScopeEvidence;
  readonly baseCompleteness: SemanticDiffCompleteness;
  readonly targetCompleteness: SemanticDiffCompleteness;
  readonly diffCompleteness: SemanticDiffCompleteness;
  readonly revisionStatus:
    | "compatible"
    | "unknown"
    | "stale-base"
    | "stale-target"
    | "document-mismatch"
    | "revision-mismatch";
  readonly reasonCodes: readonly SemanticDiffReasonCode[];
  readonly entityResults: readonly SemanticDiffEntityResult[];
  readonly summary: {
    readonly entitiesCompared: number;
    readonly unchanged: number;
    readonly added: number;
    readonly removed: number;
    readonly modified: number;
    readonly moved: number;
    readonly rewired: number;
    readonly ambiguous: number;
    readonly unclassified: number;
  };
};

type SemanticEntity = {
  readonly entityType: SemanticDiffEntityType;
  readonly ref: SemanticDiffEntityRef;
  readonly stableType: StableIdentityEntityType;
  readonly evidence: StableIdentityEvidence;
  readonly comparable: JsonValue;
};

type SemanticDocument = {
  readonly graph: DiagramSnapshot;
  readonly coverage: StructuralAnalysisCoverage;
  readonly completeness: SemanticDiffCompleteness;
  readonly revisionEvidence: SemanticDiffRevisionEvidence;
  readonly entities: readonly SemanticEntity[];
};

export function diffSemanticSnapshots(
  input: SemanticDiffInput,
): SemanticDiffResult {
  const base = semanticDocument(input.base, "base");
  const target = semanticDocument(input.target, "target");
  const baseScope = scopeFromCoverage(base.coverage);
  const targetScope = scopeFromCoverage(target.coverage);
  const revision = revisionStatus(base, target);
  const comparableScope = comparableScopeFor(base.coverage, target.coverage);
  const diffCompleteness = diffCompletenessFor(
    base,
    target,
    revision,
    comparableScope,
  );
  const outcome = outcomeFor(base, target, revision, diffCompleteness);
  const globalReasons = globalReasonCodes(revision, diffCompleteness);
  const entityResults =
    outcome === "incomparable" || outcome === "stale"
      ? []
      : compareEntities(base, target, diffCompleteness);

  return {
    diffVersion: SEMANTIC_DIFF_VERSION,
    outcome,
    baseScope,
    targetScope,
    comparableScope,
    baseCompleteness: base.completeness,
    targetCompleteness: target.completeness,
    diffCompleteness,
    revisionStatus: revision,
    reasonCodes: uniqueSortedReasons([
      ...globalReasons,
      ...entityResults.flatMap((result) => result.reasonCodes),
    ]),
    entityResults,
    summary: summarize(entityResults),
  };
}

function semanticDocument(
  input: SemanticDiffSnapshotInput,
  snapshot: "base" | "target",
): SemanticDocument {
  const coverage = normalizeCoverage(input.coverage, input.graph);
  const completeness = normalizeCompleteness(
    input.completeness ?? coverage.completeness,
    coverage,
  );
  const revisionEvidence = {
    documentId: input.revisionEvidence?.documentId ?? input.graph.source.documentId,
    contentRevisions: uniqueSorted(input.revisionEvidence?.contentRevisions ?? []),
    documentRevisions: uniqueSorted(input.revisionEvidence?.documentRevisions ?? []),
    revisionCompatible: input.revisionEvidence?.revisionCompatible,
  };
  const overrides = new Map(
    (input.identityEvidence ?? []).map((evidence) => [
      evidence.identityId,
      evidence,
    ]),
  );
  const entities = [
    ...input.graph.pages.map((page) =>
      pageEntity(input.graph, page, snapshot, overrides),
    ),
    ...input.graph.layers.map((layer) =>
      layerEntity(input.graph, layer, snapshot, overrides),
    ),
    ...input.graph.elements.map((element) =>
      elementEntity(input.graph, element, snapshot, overrides),
    ),
    ...(input.externalReferences ?? []).map((reference, index) =>
      externalReferenceEntity(input.graph, reference, index, snapshot, overrides),
    ),
  ].sort(compareSemanticEntities);
  return { graph: input.graph, coverage, completeness, revisionEvidence, entities };
}

function pageEntity(
  graph: DiagramSnapshot,
  page: PageSnapshot,
  snapshot: "base" | "target",
  overrides: ReadonlyMap<string, StableIdentityEvidence>,
): SemanticEntity {
  const evidence = evidenceWithOverride(
    {
      identityId: page.internalId,
      entityType: "page",
      documentId: graph.source.documentId,
      rawAnchor: page.drawioId,
      privateSignature: createPrivateIdentitySignature({
        parts: ["page", page.name, String(page.index)],
      }),
    },
    overrides,
  );
  return {
    entityType: "page",
    stableType: "page",
    ref: entityRef(snapshot, "page", page.internalId),
    evidence,
    comparable: {
      content: { name: page.name },
      geometry: null,
      container: null,
      connectivity: { layers: [...page.layerIds].sort() },
      metadata: { index: page.index },
    },
  };
}

function layerEntity(
  graph: DiagramSnapshot,
  layer: LayerSnapshot,
  snapshot: "base" | "target",
  overrides: ReadonlyMap<string, StableIdentityEvidence>,
): SemanticEntity {
  const evidence = evidenceWithOverride(
    {
      identityId: layer.internalId,
      entityType: "layer",
      documentId: graph.source.documentId,
      pageId: layer.pageId,
      rawAnchor: layer.drawioId,
      privateSignature: createPrivateIdentitySignature({
        parts: [
          "layer",
          layer.name,
          layer.pageId,
          String(layer.visible ?? ""),
          String(layer.locked ?? ""),
        ],
      }),
    },
    overrides,
  );
  return {
    entityType: "layer",
    stableType: "layer",
    ref: entityRef(snapshot, "layer", layer.internalId, layer.pageId),
    evidence,
    comparable: {
      content: { name: layer.name },
      geometry: null,
      container: { pageId: layer.pageId },
      connectivity: null,
      metadata: { visible: layer.visible ?? null, locked: layer.locked ?? null },
    },
  };
}

function elementEntity(
  graph: DiagramSnapshot,
  element: GraphElement,
  snapshot: "base" | "target",
  overrides: ReadonlyMap<string, StableIdentityEvidence>,
): SemanticEntity {
  const stableType = element.kind === "edge" ? "edge" : "element";
  const entityType = element.kind === "edge" ? "edge" : "element";
  const signature = createPrivateIdentitySignature({
    parts: [
      entityType,
      element.kind,
      stableJson(labelComparable(element.label)),
      stableJson(geometryComparable("geometry" in element ? element.geometry : undefined)),
      stableJson(styleComparable(element.style)),
      stableJson(element.metadata ?? {}),
      stableJson(edgeConnectivity(element)),
    ],
  });
  const evidence = evidenceWithOverride(
    {
      identityId: element.internalId,
      entityType: stableType,
      documentId: graph.source.documentId,
      pageId: element.pageId,
      layerId: element.layerId,
      rawAnchor: element.drawioId,
      privateSignature: signature,
    },
    overrides,
  );
  return {
    entityType,
    stableType,
    ref: entityRef(
      snapshot,
      entityType,
      element.internalId,
      element.pageId,
      element.layerId,
    ),
    evidence,
    comparable: {
      content: { label: labelComparable(element.label) },
      geometry: "geometry" in element ? geometryComparable(element.geometry) : null,
      container: {
        pageId: element.pageId,
        layerId: element.layerId ?? null,
        parentId: element.parentId ?? null,
      },
      connectivity: edgeConnectivity(element),
      metadata: {
        kind: element.kind,
        style: styleComparable(element.style),
        metadata: element.metadata ?? {},
      },
    },
  };
}

function externalReferenceEntity(
  graph: DiagramSnapshot,
  reference: SemanticDiffExternalReferenceEvidence,
  index: number,
  snapshot: "base" | "target",
  overrides: ReadonlyMap<string, StableIdentityEvidence>,
): SemanticEntity {
  const anchor = [
    reference.pageId ?? "",
    reference.elementId ?? "",
    reference.referenceType ?? "",
  ].join("\u0000");
  const scopedId = `external-reference:${anchor || index}`;
  const evidence = evidenceWithOverride(
    {
      identityId: scopedId,
      entityType: "external-reference",
      documentId: graph.source.documentId,
      pageId: reference.pageId,
      rawAnchor: anchor,
      privateSignature: createPrivateIdentitySignature({
        parts: ["external-reference", stableJson(reference as unknown as JsonValue)],
      }),
    },
    overrides,
  );
  return {
    entityType: "external-reference",
    stableType: "external-reference",
    ref: entityRef(snapshot, "external-reference", scopedId, reference.pageId),
    evidence,
    comparable: {
      content: null,
      geometry: null,
      container: { pageId: reference.pageId ?? null },
      connectivity: reference as unknown as JsonValue,
      metadata: null,
    },
  };
}

function evidenceWithOverride(
  derived: StableIdentityEvidence,
  overrides: ReadonlyMap<string, StableIdentityEvidence>,
): StableIdentityEvidence {
  return overrides.get(derived.identityId) ?? derived;
}

function compareEntities(
  base: SemanticDocument,
  target: SemanticDocument,
  diffCompleteness: SemanticDiffCompleteness,
): readonly SemanticDiffEntityResult[] {
  const targetUsed = new Set<string>();
  const results: SemanticDiffEntityResult[] = [];
  for (const entity of base.entities) {
    const baseObserved = entityObservedByCoverage(entity, base.coverage);
    const candidates = target.entities
      .filter((candidate) => candidate.stableType === entity.stableType)
      .map((candidate) => candidate.evidence);
    const match = matchStableIdentity(entity.evidence, candidates);
    const matchedEntities = match.matches
      .map((candidate) =>
        target.entities.find((entity) => entity.evidence.identityId === candidate.identityId),
      )
      .filter((candidate): candidate is SemanticEntity => candidate !== undefined);
    const matchReasons = match.reasonCodes as readonly SemanticDiffReasonCode[];

    if (match.outcome === "EXACT" && matchedEntities.length === 1) {
      const targetEntity = matchedEntities[0]!;
      targetUsed.add(targetEntity.evidence.identityId);
      const targetObserved = entityObservedByCoverage(targetEntity, target.coverage);
      if (baseObserved && targetObserved) {
        results.push(exactEntityResult(entity, targetEntity, matchReasons));
      } else {
        results.push(
          notComparedEntityResult(entity, targetEntity, "EXACT", matchReasons),
        );
      }
      continue;
    }

    if (match.outcome === "PROBABLE" && matchedEntities.length === 1) {
      const targetEntity = matchedEntities[0]!;
      targetUsed.add(targetEntity.evidence.identityId);
      const targetObserved = entityObservedByCoverage(targetEntity, target.coverage);
      results.push(
        baseObserved && targetObserved
          ? probableEntityResult(entity, targetEntity, matchReasons)
          : notComparedEntityResult(
              entity,
              targetEntity,
              "PROBABLE",
              matchReasons,
            ),
      );
      continue;
    }

    if (match.outcome === "AMBIGUOUS") {
      for (const targetEntity of matchedEntities) {
        targetUsed.add(targetEntity.evidence.identityId);
      }
      results.push(
        baseObserved
          ? ambiguousEntityResult(entity, matchedEntities, matchReasons)
          : notComparedEntityResult(
              entity,
              matchedEntities[0],
              "AMBIGUOUS",
              matchReasons,
            ),
      );
      continue;
    }

    results.push(
      removedOrUnclassifiedResult(
        entity,
        base.coverage,
        target.coverage,
        target.entities,
        diffCompleteness,
        matchReasons,
      ),
    );
  }

  for (const entity of target.entities) {
    if (targetUsed.has(entity.evidence.identityId)) {
      continue;
    }
    const targetObserved = entityObservedByCoverage(entity, target.coverage);
    const candidates = base.entities
      .filter((candidate) => candidate.stableType === entity.stableType)
      .map((candidate) => candidate.evidence);
    const match = matchStableIdentity(entity.evidence, candidates);
    if (match.outcome === "PROBABLE" || match.outcome === "AMBIGUOUS") {
      const matchedBase = match.matches
        .map((candidate) =>
          base.entities.find(
            (entity) => entity.evidence.identityId === candidate.identityId,
          ),
        )
        .filter((candidate): candidate is SemanticEntity => candidate !== undefined);
      results.push(
        targetObserved
          ? targetAmbiguousAdditionResult(
              entity,
              match.reasonCodes as readonly SemanticDiffReasonCode[],
              match.outcome,
            )
          : notComparedEntityResult(
              matchedBase[0] ?? entity,
              entity,
              match.outcome,
              match.reasonCodes as readonly SemanticDiffReasonCode[],
            ),
      );
      continue;
    }
    results.push(
      addedOrUnclassifiedResult(
        entity,
        base.coverage,
        target.coverage,
        base.entities,
        diffCompleteness,
        match.reasonCodes as readonly SemanticDiffReasonCode[],
      ),
    );
  }

  return results.sort(compareEntityResults);
}

function notComparedEntityResult(
  base: SemanticEntity,
  target: SemanticEntity | undefined,
  identityStatus: IdentityMatchOutcome,
  identityReasons: readonly SemanticDiffReasonCode[],
): SemanticDiffEntityResult {
  return {
    entityType: base.entityType,
    identityStatus,
    classifications: [],
    dimensions: notComparedDimensions(),
    baseEntityRef: base.ref,
    ...(target ? { targetEntityRef: target.ref } : {}),
    reasonCodes: uniqueSortedReasons([
      "coverage-partial",
      ...identityReasons,
    ]),
  };
}

function exactEntityResult(
  base: SemanticEntity,
  target: SemanticEntity,
  identityReasons: readonly SemanticDiffReasonCode[],
): SemanticDiffEntityResult {
  const dimensions = compareDimensions(base, target, "EXACT");
  const classifications = classificationsForExact(base, dimensions);
  return {
    entityType: base.entityType,
    identityStatus: "EXACT",
    classifications,
    dimensions,
    baseEntityRef: base.ref,
    targetEntityRef: target.ref,
    reasonCodes: uniqueSortedReasons([
      "exact-identity",
      "coverage-comparable",
      ...identityReasons,
      ...dimensionReasons(dimensions),
    ]),
  };
}

function probableEntityResult(
  base: SemanticEntity,
  target: SemanticEntity,
  identityReasons: readonly SemanticDiffReasonCode[],
): SemanticDiffEntityResult {
  const dimensions = compareDimensions(base, target, "PROBABLE");
  return {
    entityType: base.entityType,
    identityStatus: "PROBABLE",
    classifications: [],
    dimensions,
    baseEntityRef: base.ref,
    targetEntityRef: target.ref,
    reasonCodes: uniqueSortedReasons([
      "probable-identity-review-required",
      "unresolved-probable-candidate",
      ...identityReasons,
      ...dimensionReasons(dimensions),
    ]),
  };
}

function ambiguousEntityResult(
  base: SemanticEntity,
  targets: readonly SemanticEntity[],
  identityReasons: readonly SemanticDiffReasonCode[],
): SemanticDiffEntityResult {
  return {
    entityType: base.entityType,
    identityStatus: "AMBIGUOUS",
    classifications: ["AMBIGUOUS"],
    dimensions: unknownDimensions(),
    baseEntityRef: base.ref,
    ...(targets.length === 1 ? { targetEntityRef: targets[0]!.ref } : {}),
    reasonCodes: uniqueSortedReasons([
      "ambiguous-identity",
      "unresolved-ambiguous-candidate",
      ...identityReasons,
    ]),
  };
}

function removedOrUnclassifiedResult(
  entity: SemanticEntity,
  baseCoverage: StructuralAnalysisCoverage,
  targetCoverage: StructuralAnalysisCoverage,
  targetEntities: readonly SemanticEntity[],
  diffCompleteness: SemanticDiffCompleteness,
  identityReasons: readonly SemanticDiffReasonCode[],
): SemanticDiffEntityResult {
  const absenceProven = absenceCanBeProvenForEntity({
    entity,
    observedCoverage: baseCoverage,
    absenceCoverage: targetCoverage,
    oppositeEntities: targetEntities,
    diffCompleteness,
  });
  return {
    entityType: entity.entityType,
    identityStatus: "NO_MATCH",
    classifications: absenceProven ? ["REMOVED"] : [],
    dimensions: existenceDimensions(absenceProven ? "changed" : "unknown"),
    baseEntityRef: entity.ref,
    reasonCodes: uniqueSortedReasons([
      "no-match",
      ...(absenceProven ? ["removed-absence-proven" as const] : ["absence-not-proven" as const]),
      ...identityReasons,
    ]),
  };
}

function targetAmbiguousAdditionResult(
  entity: SemanticEntity,
  identityReasons: readonly SemanticDiffReasonCode[],
  identityStatus: "PROBABLE" | "AMBIGUOUS",
): SemanticDiffEntityResult {
  return {
    entityType: entity.entityType,
    identityStatus,
    classifications: identityStatus === "AMBIGUOUS" ? ["AMBIGUOUS"] : [],
    dimensions: existenceDimensions("unknown"),
    targetEntityRef: entity.ref,
    reasonCodes: uniqueSortedReasons([
      identityStatus === "PROBABLE"
        ? "unresolved-probable-candidate"
        : "unresolved-ambiguous-candidate",
      ...(identityStatus === "PROBABLE"
        ? ["probable-identity-review-required" as const]
        : ["ambiguous-identity" as const]),
      ...identityReasons,
    ]),
  };
}

function addedOrUnclassifiedResult(
  entity: SemanticEntity,
  baseCoverage: StructuralAnalysisCoverage,
  targetCoverage: StructuralAnalysisCoverage,
  baseEntities: readonly SemanticEntity[],
  diffCompleteness: SemanticDiffCompleteness,
  identityReasons: readonly SemanticDiffReasonCode[],
): SemanticDiffEntityResult {
  const absenceProven = absenceCanBeProvenForEntity({
    entity,
    observedCoverage: targetCoverage,
    absenceCoverage: baseCoverage,
    oppositeEntities: baseEntities,
    diffCompleteness,
  });
  return {
    entityType: entity.entityType,
    identityStatus: "NO_MATCH",
    classifications: absenceProven ? ["ADDED"] : [],
    dimensions: existenceDimensions(absenceProven ? "changed" : "unknown"),
    targetEntityRef: entity.ref,
    reasonCodes: uniqueSortedReasons([
      "no-match",
      ...(absenceProven ? ["added-absence-proven" as const] : ["absence-not-proven" as const]),
      ...identityReasons,
    ]),
  };
}

function compareDimensions(
  base: SemanticEntity,
  target: SemanticEntity,
  identityStatus: "EXACT" | "PROBABLE",
): SemanticDiffDimensionChanges {
  const status = (key: string): SemanticDiffDimensionStatus =>
    stableJson(readComparable(base, key)) === stableJson(readComparable(target, key))
      ? "unchanged"
      : "changed";
  return {
    existence: "unchanged",
    content: status("content"),
    geometry: dimensionApplicable(base, target, "geometry")
      ? status("geometry")
      : "not-applicable",
    container: dimensionApplicable(base, target, "container")
      ? status("container")
      : "not-applicable",
    connectivity: dimensionApplicable(base, target, "connectivity")
      ? status("connectivity")
      : "not-applicable",
    metadata: status("metadata"),
    coverage: identityStatus === "EXACT" ? "unchanged" : "unknown",
  };
}

function classificationsForExact(
  entity: SemanticEntity,
  dimensions: SemanticDiffDimensionChanges,
): readonly SemanticDiffClassification[] {
  const classifications: SemanticDiffClassification[] = [];
  const changed = (dimension: SemanticDiffDimension) =>
    dimensions[dimension] === "changed";
  if (
    !changed("content") &&
    !changed("geometry") &&
    !changed("container") &&
    !changed("connectivity") &&
    !changed("metadata")
  ) {
    return ["UNCHANGED"];
  }
  if (
    changed("connectivity") &&
    (entity.entityType === "edge" || entity.entityType === "external-reference")
  ) {
    classifications.push("REWIRED");
  }
  if (changed("geometry") || changed("container")) {
    classifications.push("MOVED");
  }
  if (changed("content") || changed("metadata")) {
    classifications.push("MODIFIED");
  }
  return uniqueSortedClassifications(classifications);
}

function readComparable(entity: SemanticEntity, key: string): JsonValue {
  const value = (entity.comparable as Record<string, JsonValue>)[key];
  return value ?? null;
}

function dimensionApplicable(
  base: SemanticEntity,
  target: SemanticEntity,
  key: string,
): boolean {
  return readComparable(base, key) !== null || readComparable(target, key) !== null;
}

function dimensionReasons(
  dimensions: SemanticDiffDimensionChanges,
): readonly SemanticDiffReasonCode[] {
  const reasons: SemanticDiffReasonCode[] = [];
  if (dimensions.content === "changed") {
    reasons.push("content-changed");
  }
  if (dimensions.geometry === "changed") {
    reasons.push("geometry-changed");
  }
  if (dimensions.container === "changed") {
    reasons.push("container-changed");
  }
  if (dimensions.connectivity === "changed") {
    reasons.push("connectivity-changed");
  }
  if (dimensions.metadata === "changed") {
    reasons.push("metadata-changed");
  }
  return reasons;
}

function unknownDimensions(): SemanticDiffDimensionChanges {
  return {
    existence: "unknown",
    content: "unknown",
    geometry: "unknown",
    container: "unknown",
    connectivity: "unknown",
    metadata: "unknown",
    coverage: "unknown",
  };
}

function existenceDimensions(
  existence: SemanticDiffDimensionStatus,
): SemanticDiffDimensionChanges {
  return {
    existence,
    content: "not-compared",
    geometry: "not-compared",
    container: "not-compared",
    connectivity: "not-compared",
    metadata: "not-compared",
    coverage: existence === "changed" ? "unchanged" : "unknown",
  };
}

function notComparedDimensions(): SemanticDiffDimensionChanges {
  return {
    existence: "not-compared",
    content: "not-compared",
    geometry: "not-compared",
    container: "not-compared",
    connectivity: "not-compared",
    metadata: "not-compared",
    coverage: "not-compared",
  };
}

function absenceCanBeProvenForEntity(input: {
  readonly entity: SemanticEntity;
  readonly observedCoverage: StructuralAnalysisCoverage;
  readonly absenceCoverage: StructuralAnalysisCoverage;
  readonly oppositeEntities: readonly SemanticEntity[];
  readonly diffCompleteness: SemanticDiffCompleteness;
}): boolean {
  if (
    input.diffCompleteness !== "complete-document" &&
    input.diffCompleteness !== "complete-target-scopes"
  ) {
    return false;
  }
  if (!entityObservedByCoverage(input.entity, input.observedCoverage)) {
    return false;
  }
  if (!entityObservedByCoverage(input.entity, input.absenceCoverage)) {
    return false;
  }
  return !hasUnresolvedReverseCandidate(input.entity, input.oppositeEntities);
}

function hasUnresolvedReverseCandidate(
  entity: SemanticEntity,
  oppositeEntities: readonly SemanticEntity[],
): boolean {
  return oppositeEntities
    .filter((candidate) => candidate.stableType === entity.stableType)
    .some((candidate) => {
      const match = matchStableIdentity(candidate.evidence, [entity.evidence]);
      return match.outcome === "PROBABLE" || match.outcome === "AMBIGUOUS";
    });
}

function entityObservedByCoverage(
  entity: SemanticEntity,
  coverage: StructuralAnalysisCoverage,
): boolean {
  if (coverage.document) {
    return true;
  }
  if (entity.entityType === "page") {
    return entity.ref.pageId
      ? coverage.pageIds.includes(entity.ref.pageId)
      : coverage.pageIds.includes(entity.ref.snapshotScopedId);
  }
  if (entity.ref.pageId && coverage.pageIds.includes(entity.ref.pageId)) {
    return true;
  }
  if (!entity.ref.pageId) {
    return false;
  }
  if (entity.entityType === "layer") {
    return coverage.layerTargets.some(
      (target) =>
        target.pageId === entity.ref.pageId &&
        target.layerIds.includes(entity.ref.snapshotScopedId),
    );
  }
  if (entity.ref.layerId) {
    return coverage.layerTargets.some(
      (target) =>
        target.pageId === entity.ref.pageId &&
        target.layerIds.includes(entity.ref.layerId!),
    );
  }
  return false;
}

function normalizeCoverage(
  coverage: StructuralAnalysisCoverage | undefined,
  graph: DiagramSnapshot,
): StructuralAnalysisCoverage {
  if (coverage) {
    return {
      document: coverage.document,
      pageIds: uniqueSorted(coverage.pageIds),
      layerTargets: normalizeLayerTargets(coverage.layerTargets),
      ...(coverage.selection !== undefined ? { selection: coverage.selection } : {}),
      conclusive: coverage.conclusive,
      ...(coverage.truncated !== undefined ? { truncated: coverage.truncated } : {}),
      ...(coverage.stale !== undefined ? { stale: coverage.stale } : {}),
      ...(coverage.completeness ? { completeness: coverage.completeness } : {}),
    };
  }
  return {
    document: true,
    pageIds: graph.pages.map((page) => page.internalId).sort(),
    layerTargets: [],
    conclusive: true,
    completeness: "complete-document",
  };
}

function normalizeCompleteness(
  completeness: StructuralCompleteness | undefined,
  coverage: StructuralAnalysisCoverage,
): SemanticDiffCompleteness {
  if (coverage.stale || completeness === "stale") {
    return "stale";
  }
  if (coverage.truncated || completeness === "truncated") {
    return "truncated";
  }
  if (completeness) {
    return completeness;
  }
  if (coverage.document) {
    return "complete-document";
  }
  if (coverage.conclusive) {
    return "complete-target-scopes";
  }
  return "partial";
}

function scopeFromCoverage(
  coverage: StructuralAnalysisCoverage,
): SemanticDiffScopeEvidence {
  return {
    document: coverage.document,
    pageIds: uniqueSorted(coverage.pageIds),
    layerTargets: normalizeLayerTargets(coverage.layerTargets),
    ...(coverage.selection !== undefined ? { selection: coverage.selection } : {}),
  };
}

function comparableScopeFor(
  base: StructuralAnalysisCoverage,
  target: StructuralAnalysisCoverage,
): SemanticDiffScopeEvidence {
  if (base.document && target.document) {
    return {
      document: true,
      pageIds: uniqueSorted([...base.pageIds, ...target.pageIds]),
      layerTargets: [],
    };
  }
  if (scopeKey(base) === scopeKey(target)) {
    return scopeFromCoverage(base);
  }
  if (base.document) {
    return scopeFromCoverage(target);
  }
  if (target.document) {
    return scopeFromCoverage(base);
  }
  const pageIds = base.pageIds.filter((pageId) => target.pageIds.includes(pageId));
  const layerTargets = intersectLayerTargets(base.layerTargets, target.layerTargets);
  return {
    document: false,
    pageIds: uniqueSorted(pageIds),
    layerTargets,
  };
}

function diffCompletenessFor(
  base: SemanticDocument,
  target: SemanticDocument,
  revision: SemanticDiffResult["revisionStatus"],
  comparableScope: SemanticDiffScopeEvidence,
): SemanticDiffCompleteness {
  if (revision === "stale-base" || revision === "stale-target") {
    return "stale";
  }
  if (revision === "document-mismatch" || revision === "revision-mismatch") {
    return "incomparable";
  }
  if (base.completeness === "stale" || target.completeness === "stale") {
    return "stale";
  }
  if (base.completeness === "truncated" || target.completeness === "truncated") {
    return "truncated";
  }
  if (
    base.completeness === "complete-document" &&
    target.completeness === "complete-document" &&
    base.coverage.document &&
    target.coverage.document
  ) {
    return "complete-document";
  }
  if (
    base.completeness === "complete-target-scopes" &&
    target.completeness === "complete-target-scopes" &&
    scopeKey(base.coverage) === scopeKey(target.coverage)
  ) {
    return "complete-target-scopes";
  }
  if (
    !base.coverage.document &&
    !target.coverage.document &&
    comparableScope.pageIds.length === 0 &&
    comparableScope.layerTargets.length === 0
  ) {
    return "incomparable";
  }
  if (revision === "unknown") {
    return "unknown";
  }
  return "partial";
}

function outcomeFor(
  base: SemanticDocument,
  target: SemanticDocument,
  revision: SemanticDiffResult["revisionStatus"],
  diffCompleteness: SemanticDiffCompleteness,
): SemanticDiffOutcome {
  if (revision === "stale-base" || revision === "stale-target") {
    return "stale";
  }
  if (diffCompleteness === "stale") {
    return "stale";
  }
  if (
    revision === "document-mismatch" ||
    revision === "revision-mismatch" ||
    diffCompleteness === "incomparable"
  ) {
    return "incomparable";
  }
  if (diffCompleteness === "complete-document" || diffCompleteness === "complete-target-scopes") {
    return revision === "unknown" ? "ok-with-limitations" : "ok";
  }
  if (diffCompleteness === "unknown") {
    return "ok-with-limitations";
  }
  return "partial";
}

function revisionStatus(
  base: SemanticDocument,
  target: SemanticDocument,
): SemanticDiffResult["revisionStatus"] {
  const baseDoc =
    base.revisionEvidence.documentId ?? base.graph.source.documentId;
  const targetDoc =
    target.revisionEvidence.documentId ?? target.graph.source.documentId;
  if (baseDoc !== undefined && targetDoc !== undefined && baseDoc !== targetDoc) {
    return "document-mismatch";
  }
  if (base.revisionEvidence.revisionCompatible === false) {
    return "stale-base";
  }
  if (target.revisionEvidence.revisionCompatible === false) {
    return "stale-target";
  }
  if (base.completeness === "stale" || base.coverage.stale) {
    return "stale-base";
  }
  if (target.completeness === "stale" || target.coverage.stale) {
    return "stale-target";
  }
  const baseDocumentRevisions = base.revisionEvidence.documentRevisions ?? [];
  const targetDocumentRevisions = target.revisionEvidence.documentRevisions ?? [];
  if (baseDocumentRevisions.length > 0 && targetDocumentRevisions.length > 0) {
    return stableJson(baseDocumentRevisions) === stableJson(targetDocumentRevisions)
      ? "compatible"
      : "revision-mismatch";
  }
  const baseContentRevisions = base.revisionEvidence.contentRevisions ?? [];
  const targetContentRevisions = target.revisionEvidence.contentRevisions ?? [];
  if (baseContentRevisions.length > 0 && targetContentRevisions.length > 0) {
    return "compatible";
  }
  return "unknown";
}

function globalReasonCodes(
  revision: SemanticDiffResult["revisionStatus"],
  completeness: SemanticDiffCompleteness,
): readonly SemanticDiffReasonCode[] {
  const reasons: SemanticDiffReasonCode[] = [];
  if (revision === "compatible") {
    reasons.push("revision-compatible");
  } else if (revision === "unknown") {
    reasons.push("revision-unknown");
  } else if (revision === "document-mismatch") {
    reasons.push("document-mismatch");
  } else if (revision === "revision-mismatch") {
    reasons.push("revision-mismatch");
  } else {
    reasons.push(revision);
  }
  if (completeness === "incomparable") {
    reasons.push("coverage-incomparable");
  } else if (completeness === "partial" || completeness === "unknown") {
    reasons.push("coverage-partial");
  } else {
    reasons.push("coverage-comparable");
  }
  return reasons;
}

function summarize(
  entityResults: readonly SemanticDiffEntityResult[],
): SemanticDiffResult["summary"] {
  const has = (result: SemanticDiffEntityResult, c: SemanticDiffClassification) =>
    result.classifications.includes(c);
  return {
    entitiesCompared: entityResults.length,
    unchanged: entityResults.filter((result) => has(result, "UNCHANGED")).length,
    added: entityResults.filter((result) => has(result, "ADDED")).length,
    removed: entityResults.filter((result) => has(result, "REMOVED")).length,
    modified: entityResults.filter((result) => has(result, "MODIFIED")).length,
    moved: entityResults.filter((result) => has(result, "MOVED")).length,
    rewired: entityResults.filter((result) => has(result, "REWIRED")).length,
    ambiguous: entityResults.filter((result) => has(result, "AMBIGUOUS")).length,
    unclassified: entityResults.filter(
      (result) => result.classifications.length === 0,
    ).length,
  };
}

function labelComparable(label: Label | undefined): JsonValue {
  if (!label) {
    return null;
  }
  return {
    format: label.format,
    text: label.text ?? null,
    html: label.html ?? null,
  };
}

function styleComparable(style: Style | undefined): JsonValue {
  if (!style) {
    return null;
  }
  return {
    raw: style.raw ?? null,
    properties: sortRecord(style.properties),
    uninterpreted: [...(style.uninterpreted ?? [])].sort(),
  };
}

function geometryComparable(geometry: Geometry | undefined): JsonValue {
  if (!geometry) {
    return null;
  }
  return {
    x: geometry.x ?? null,
    y: geometry.y ?? null,
    width: geometry.width ?? null,
    height: geometry.height ?? null,
    relative: geometry.relative ?? null,
    points: geometry.points
      ? geometry.points.map((point) => ({ x: point.x, y: point.y }))
      : null,
  };
}

function edgeConnectivity(element: GraphElement): JsonValue {
  if (element.kind !== "edge") {
    return null;
  }
  const edge = element as EdgeElement;
  return {
    sourceId: edge.sourceId ?? null,
    targetId: edge.targetId ?? null,
  };
}

function entityRef(
  snapshot: "base" | "target",
  entityType: SemanticDiffEntityType,
  snapshotScopedId: string,
  pageId?: string,
  layerId?: string,
): SemanticDiffEntityRef {
  return {
    snapshot,
    entityType,
    snapshotScopedId,
    ...(pageId ? { pageId } : {}),
    ...(layerId ? { layerId } : {}),
  };
}

function compareSemanticEntities(a: SemanticEntity, b: SemanticEntity): number {
  return (
    a.entityType.localeCompare(b.entityType) ||
    a.ref.pageId?.localeCompare(b.ref.pageId ?? "") ||
    b.ref.pageId?.localeCompare(a.ref.pageId ?? "") ||
    a.ref.layerId?.localeCompare(b.ref.layerId ?? "") ||
    b.ref.layerId?.localeCompare(a.ref.layerId ?? "") ||
    a.ref.snapshotScopedId.localeCompare(b.ref.snapshotScopedId)
  );
}

function compareEntityResults(
  a: SemanticDiffEntityResult,
  b: SemanticDiffEntityResult,
): number {
  return (
    a.entityType.localeCompare(b.entityType) ||
    (a.baseEntityRef?.snapshotScopedId ?? "").localeCompare(
      b.baseEntityRef?.snapshotScopedId ?? "",
    ) ||
    (a.targetEntityRef?.snapshotScopedId ?? "").localeCompare(
      b.targetEntityRef?.snapshotScopedId ?? "",
    ) ||
    a.identityStatus.localeCompare(b.identityStatus)
  );
}

function normalizeLayerTargets(
  targets: StructuralAnalysisCoverage["layerTargets"],
) {
  return [...targets]
    .map((target) => ({
      pageId: target.pageId,
      layerIds: uniqueSorted(target.layerIds),
    }))
    .sort((a, b) => a.pageId.localeCompare(b.pageId));
}

function intersectLayerTargets(
  base: StructuralAnalysisCoverage["layerTargets"],
  target: StructuralAnalysisCoverage["layerTargets"],
) {
  const targetByPage = new Map(
    target.map((entry) => [entry.pageId, new Set(entry.layerIds)]),
  );
  return normalizeLayerTargets(
    base
      .map((entry) => ({
        pageId: entry.pageId,
        layerIds: entry.layerIds.filter((layerId) =>
          targetByPage.get(entry.pageId)?.has(layerId),
        ),
      }))
      .filter((entry) => entry.layerIds.length > 0),
  );
}

function scopeKey(coverage: StructuralAnalysisCoverage): string {
  return stableJson(scopeFromCoverage(coverage));
}

function uniqueSorted<T extends string>(values: readonly T[]): readonly T[] {
  return [...new Set(values)].sort();
}

function uniqueSortedReasons(
  reasons: readonly SemanticDiffReasonCode[],
): readonly SemanticDiffReasonCode[] {
  return uniqueSorted(reasons);
}

function uniqueSortedClassifications(
  classifications: readonly SemanticDiffClassification[],
): readonly SemanticDiffClassification[] {
  const order: Record<SemanticDiffClassification, number> = {
    UNCHANGED: 0,
    ADDED: 1,
    REMOVED: 2,
    MODIFIED: 3,
    MOVED: 4,
    REWIRED: 5,
    AMBIGUOUS: 6,
  };
  return [...new Set(classifications)].sort((a, b) => order[a] - order[b]);
}

function sortRecord(
  value: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a.localeCompare(b)),
  );
}

function stableJson(value: unknown): string {
  return JSON.stringify(canonical(value));
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}
