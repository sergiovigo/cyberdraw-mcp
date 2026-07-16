import type { NormalizationLimits } from "./types.js";

export const DEFAULT_LIMITS: NormalizationLimits = {
  maxPages: 100,
  maxLayersPerPage: 100,
  maxElementsPerPage: 25_000,
  maxStringLength: 8_192,
  maxArrayItems: 1_000,
  maxRawDepth: 4,
  maxRawKeys: 64,
};

export function applyLimits(
  overrides: Partial<NormalizationLimits> | undefined,
): NormalizationLimits {
  return {
    ...DEFAULT_LIMITS,
    ...overrides,
  };
}
