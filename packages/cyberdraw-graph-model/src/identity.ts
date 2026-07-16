export type ProvisionalIdentityInput = {
  readonly pageIndex: number;
  readonly pageExternalId?: string;
  readonly layerExternalId?: string;
  readonly elementExternalId?: string;
  readonly appearanceIndex?: number;
};

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
