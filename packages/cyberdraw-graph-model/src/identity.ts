export type ProvisionalIdentityInput = {
  readonly pageIndex: number;
  readonly pageExternalId?: string;
  readonly layerExternalId?: string;
  readonly elementExternalId?: string;
  readonly appearanceIndex?: number;
};

export type StableIdentityEntityType =
  | "document"
  | "page"
  | "layer"
  | "element"
  | "edge"
  | "external-reference";

export type IdentityMatchOutcome =
  | "EXACT"
  | "PROBABLE"
  | "AMBIGUOUS"
  | "NO_MATCH";

export type IdentityConflictCode =
  | "content-conflict"
  | "duplicate-raw-anchor"
  | "missing-raw-anchor"
  | "rewritten-raw-anchor"
  | "stale-evidence"
  | "signature-collision"
  | "context-conflict";

export type IdentityMatchReasonCode =
  | "exact-raw-anchor"
  | "probable-private-signature"
  | "ambiguous-raw-anchor"
  | "ambiguous-private-signature"
  | "conflicting-evidence"
  | "document-context-missing"
  | "document-context-changed"
  | "entity-type-mismatch"
  | "raw-anchor-missing"
  | "raw-anchor-changed"
  | "page-context-changed"
  | "layer-context-changed"
  | "private-signature-missing"
  | "private-signature-changed"
  | "no-compatible-candidate";

export type PrivateIdentitySignature = {
  readonly algorithm: "cyberdraw-private-signature-fnv1a64-v1";
  readonly value: string;
  readonly materialBytes: number;
  readonly truncated: boolean;
};

export type PrivateIdentitySignatureInput = {
  readonly parts: readonly string[];
};

export type PrivateIdentitySignatureOptions = {
  readonly maxParts?: number;
  readonly maxPartBytes?: number;
  readonly maxMaterialBytes?: number;
};

export type StableIdentityEvidence = {
  readonly identityId: string;
  readonly entityType: StableIdentityEntityType;
  readonly documentId?: string;
  readonly pageId?: string;
  readonly layerId?: string;
  readonly rawAnchor?: string;
  readonly privateSignature?: PrivateIdentitySignature;
  readonly conflictCodes?: readonly IdentityConflictCode[];
};

export type IdentityCandidateMatch = {
  readonly identityId: string;
  readonly outcome: Exclude<IdentityMatchOutcome, "NO_MATCH">;
  readonly reasonCodes: readonly IdentityMatchReasonCode[];
};

export type IdentityMatchResult = {
  readonly outcome: IdentityMatchOutcome;
  readonly reasonCodes: readonly IdentityMatchReasonCode[];
  readonly matches: readonly IdentityCandidateMatch[];
};

const DEFAULT_MAX_SIGNATURE_PARTS = 32;
const DEFAULT_MAX_SIGNATURE_PART_BYTES = 256;
const DEFAULT_MAX_SIGNATURE_MATERIAL_BYTES = 4096;
const FNV1A_64_OFFSET = 0xcbf29ce484222325n;
const FNV1A_64_PRIME = 0x100000001b3n;
const FNV1A_64_MASK = 0xffffffffffffffffn;

export function provisionalDiagramId(documentId?: string): string {
  return documentId
    ? `diagram:drawio:${documentId}`
    : "diagram:synthetic:readonly-spike";
}

export function provisionalPageId(input: ProvisionalIdentityInput): string {
  return input.pageExternalId
    ? `page:${input.pageIndex}:drawio:${input.pageExternalId}`
    : `page:${input.pageIndex}:synthetic`;
}

export function provisionalLayerId(input: ProvisionalIdentityInput): string {
  const suffix = input.layerExternalId
    ? `drawio:${input.layerExternalId}`
    : "synthetic";
  return `layer:${provisionalPageId(input)}:${suffix}:${input.appearanceIndex ?? 0}`;
}

export function provisionalElementId(input: ProvisionalIdentityInput): string {
  const pageId = provisionalPageId(input);
  return input.elementExternalId
    ? `element:${pageId}:drawio:${input.elementExternalId}:${input.appearanceIndex ?? 0}`
    : `element:${pageId}:synthetic:${input.appearanceIndex ?? 0}`;
}

export function createPrivateIdentitySignature(
  input: PrivateIdentitySignatureInput,
  options: PrivateIdentitySignatureOptions = {},
): PrivateIdentitySignature {
  const maxParts = positiveIntegerOrDefault(
    options.maxParts,
    DEFAULT_MAX_SIGNATURE_PARTS,
  );
  const maxPartBytes = positiveIntegerOrDefault(
    options.maxPartBytes,
    DEFAULT_MAX_SIGNATURE_PART_BYTES,
  );
  const maxMaterialBytes = positiveIntegerOrDefault(
    options.maxMaterialBytes,
    DEFAULT_MAX_SIGNATURE_MATERIAL_BYTES,
  );
  const normalizedParts: string[] = [];
  let materialBytes = 0;
  let truncated = input.parts.length > maxParts;

  for (const part of input.parts.slice(0, maxParts)) {
    const bounded = boundUtf8String(part, maxPartBytes);
    truncated = truncated || bounded.truncated;
    const encoded = JSON.stringify(bounded.value);
    const encodedBytes = utf8ByteLength(encoded);
    if (materialBytes + encodedBytes > maxMaterialBytes) {
      truncated = true;
      break;
    }
    normalizedParts.push(encoded);
    materialBytes += encodedBytes;
  }

  const material = `[${normalizedParts.join(",")}]`;
  return {
    algorithm: "cyberdraw-private-signature-fnv1a64-v1",
    value: fnv1a64Hex(material),
    materialBytes,
    truncated,
  };
}

export function matchStableIdentity(
  reference: StableIdentityEvidence,
  candidates: readonly StableIdentityEvidence[],
): IdentityMatchResult {
  const comparable = candidates
    .filter((candidate) => candidate.entityType === reference.entityType)
    .sort(compareEvidenceByIdentityId);
  if (comparable.length !== candidates.length) {
    const withoutTypeMismatches = matchStableIdentity(reference, comparable);
    return {
      ...withoutTypeMismatches,
      reasonCodes: uniqueSortedReasons([
        ...withoutTypeMismatches.reasonCodes,
        "entity-type-mismatch",
      ]),
    };
  }

  const exact = exactRawAnchorMatches(reference, comparable);
  if (exact.result) {
    return exact.result;
  }

  const probable = probableSignatureMatches(reference, comparable);
  if (probable.result) {
    return {
      ...probable.result,
      reasonCodes: uniqueSortedReasons([
        ...exact.reasonCodes,
        ...probable.result.reasonCodes,
      ]),
    };
  }

  return {
    outcome: "NO_MATCH",
    reasonCodes: uniqueSortedReasons([
      ...exact.reasonCodes,
      ...probable.reasonCodes,
      "no-compatible-candidate",
    ]),
    matches: [],
  };
}

function exactRawAnchorMatches(
  reference: StableIdentityEvidence,
  candidates: readonly StableIdentityEvidence[],
): {
  readonly result?: IdentityMatchResult;
  readonly reasonCodes: readonly IdentityMatchReasonCode[];
} {
  if (!reference.rawAnchor) {
    return { reasonCodes: ["raw-anchor-missing"] };
  }
  const sameRaw = candidates
    .filter((candidate) => candidate.rawAnchor === reference.rawAnchor)
    .sort(compareEvidenceByIdentityId);
  if (sameRaw.length === 0) {
    return { reasonCodes: ["raw-anchor-changed"] };
  }

  const documentCompatible = sameRaw.filter((candidate) =>
    exactDocumentCompatible(reference, candidate),
  );
  if (documentCompatible.length === 0) {
    return { reasonCodes: [documentContextReason(reference, sameRaw)] };
  }

  const pageCompatible = documentCompatible.filter((candidate) =>
    exactPageCompatible(reference, candidate),
  );
  if (pageCompatible.length === 0) {
    return { reasonCodes: ["page-context-changed"] };
  }

  const conflictFree = pageCompatible.filter(
    (candidate) => !hasExplicitConflict(reference, candidate),
  );
  if (conflictFree.length === 0) {
    return {
      result: {
        outcome: "AMBIGUOUS",
        reasonCodes: ["conflicting-evidence"],
        matches: pageCompatible.map((candidate) => ({
          identityId: candidate.identityId,
          outcome: "AMBIGUOUS",
          reasonCodes: ["conflicting-evidence"],
        })),
      },
      reasonCodes: [],
    };
  }

  if (conflictFree.length > 1) {
    return {
      result: {
        outcome: "AMBIGUOUS",
        reasonCodes: ["ambiguous-raw-anchor"],
        matches: conflictFree.map((candidate) => ({
          identityId: candidate.identityId,
          outcome: "AMBIGUOUS",
          reasonCodes: ["ambiguous-raw-anchor"],
        })),
      },
      reasonCodes: [],
    };
  }

  const candidate = conflictFree[0]!;
  const reasonCodes: IdentityMatchReasonCode[] = ["exact-raw-anchor"];
  if (layerChanged(reference, candidate)) {
    reasonCodes.push("layer-context-changed");
  }
  return {
    result: {
      outcome: "EXACT",
      reasonCodes: uniqueSortedReasons(reasonCodes),
      matches: [
        {
          identityId: candidate.identityId,
          outcome: "EXACT",
          reasonCodes: uniqueSortedReasons(reasonCodes),
        },
      ],
    },
    reasonCodes: [],
  };
}

function probableSignatureMatches(
  reference: StableIdentityEvidence,
  candidates: readonly StableIdentityEvidence[],
): {
  readonly result?: IdentityMatchResult;
  readonly reasonCodes: readonly IdentityMatchReasonCode[];
} {
  if (!reference.privateSignature) {
    return { reasonCodes: ["private-signature-missing"] };
  }
  const referenceSignature = reference.privateSignature;
  const sameSignature = candidates
    .filter(
      (candidate) =>
        candidate.privateSignature?.algorithm ===
          referenceSignature.algorithm &&
        candidate.privateSignature?.value === referenceSignature.value,
    )
    .filter((candidate) => signatureMatchingAllowed(reference, candidate))
    .filter((candidate) => probableDocumentCompatible(reference, candidate))
    .filter((candidate) => !hasExplicitConflict(reference, candidate))
    .sort(compareEvidenceByIdentityId);

  if (sameSignature.length === 0) {
    return { reasonCodes: ["private-signature-changed"] };
  }
  if (sameSignature.length > 1) {
    return {
      result: {
        outcome: "AMBIGUOUS",
        reasonCodes: ["ambiguous-private-signature"],
        matches: sameSignature.map((candidate) => ({
          identityId: candidate.identityId,
          outcome: "AMBIGUOUS",
          reasonCodes: ["ambiguous-private-signature"],
        })),
      },
      reasonCodes: [],
    };
  }

  const candidate = sameSignature[0]!;
  const reasonCodes: IdentityMatchReasonCode[] = ["probable-private-signature"];
  if (
    pageChanged(reference, candidate) &&
    (reference.entityType === "element" || reference.entityType === "edge")
  ) {
    reasonCodes.push("page-context-changed");
  }
  if (layerChanged(reference, candidate)) {
    reasonCodes.push("layer-context-changed");
  }
  return {
    result: {
      outcome: "PROBABLE",
      reasonCodes: uniqueSortedReasons(reasonCodes),
      matches: [
        {
          identityId: candidate.identityId,
          outcome: "PROBABLE",
          reasonCodes: uniqueSortedReasons(reasonCodes),
        },
      ],
    },
    reasonCodes: [],
  };
}

function exactDocumentCompatible(
  reference: StableIdentityEvidence,
  candidate: StableIdentityEvidence,
): boolean {
  return (
    reference.documentId !== undefined &&
    candidate.documentId !== undefined &&
    reference.documentId === candidate.documentId
  );
}

function documentContextReason(
  reference: StableIdentityEvidence,
  candidates: readonly StableIdentityEvidence[],
): IdentityMatchReasonCode {
  if (
    reference.documentId === undefined ||
    candidates.some((candidate) => candidate.documentId === undefined)
  ) {
    return "document-context-missing";
  }
  return "document-context-changed";
}

function probableDocumentCompatible(
  reference: StableIdentityEvidence,
  candidate: StableIdentityEvidence,
): boolean {
  if (reference.documentId === undefined || candidate.documentId === undefined) {
    return false;
  }
  return reference.documentId === candidate.documentId;
}

function exactPageCompatible(
  reference: StableIdentityEvidence,
  candidate: StableIdentityEvidence,
): boolean {
  if (reference.entityType === "document" || reference.entityType === "page") {
    return true;
  }
  return (
    reference.pageId !== undefined &&
    candidate.pageId !== undefined &&
    reference.pageId === candidate.pageId
  );
}

function hasExplicitConflict(
  reference: StableIdentityEvidence,
  candidate: StableIdentityEvidence,
): boolean {
  return (
    hasConflict(reference, "content-conflict") ||
    hasConflict(reference, "duplicate-raw-anchor") ||
    hasConflict(reference, "stale-evidence") ||
    hasConflict(reference, "context-conflict") ||
    hasConflict(candidate, "content-conflict") ||
    hasConflict(candidate, "duplicate-raw-anchor") ||
    hasConflict(candidate, "stale-evidence") ||
    hasConflict(candidate, "context-conflict")
  );
}

function hasConflict(
  evidence: StableIdentityEvidence,
  conflict: IdentityConflictCode,
): boolean {
  return evidence.conflictCodes?.includes(conflict) === true;
}

function signatureMatchingAllowed(
  reference: StableIdentityEvidence,
  candidate: StableIdentityEvidence,
): boolean {
  if (!reference.rawAnchor) {
    return true;
  }
  if (candidate.rawAnchor === reference.rawAnchor) {
    return true;
  }
  return (
    hasConflict(reference, "missing-raw-anchor") ||
    hasConflict(reference, "rewritten-raw-anchor")
  );
}

function pageChanged(
  reference: StableIdentityEvidence,
  candidate: StableIdentityEvidence,
): boolean {
  return (
    reference.pageId !== undefined &&
    candidate.pageId !== undefined &&
    reference.pageId !== candidate.pageId
  );
}

function layerChanged(
  reference: StableIdentityEvidence,
  candidate: StableIdentityEvidence,
): boolean {
  return (
    reference.layerId !== undefined &&
    candidate.layerId !== undefined &&
    reference.layerId !== candidate.layerId
  );
}

function compareEvidenceByIdentityId(
  left: StableIdentityEvidence,
  right: StableIdentityEvidence,
): number {
  return left.identityId.localeCompare(right.identityId);
}

function uniqueSortedReasons(
  reasons: readonly IdentityMatchReasonCode[],
): readonly IdentityMatchReasonCode[] {
  return [...new Set(reasons)].sort();
}

function positiveIntegerOrDefault(
  value: number | undefined,
  fallback: number,
): number {
  return Number.isInteger(value) && value !== undefined && value > 0
    ? value
    : fallback;
}

function boundUtf8String(
  value: string,
  maxBytes: number,
): { readonly value: string; readonly truncated: boolean } {
  let bytes = 0;
  let output = "";
  for (const char of value) {
    const charBytes = utf8ByteLength(char);
    if (bytes + charBytes > maxBytes) {
      return { value: output, truncated: true };
    }
    bytes += charBytes;
    output += char;
  }
  return { value: output, truncated: false };
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function fnv1a64Hex(value: string): string {
  let hash = FNV1A_64_OFFSET;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV1A_64_PRIME) & FNV1A_64_MASK;
  }
  return hash.toString(16).padStart(16, "0");
}
