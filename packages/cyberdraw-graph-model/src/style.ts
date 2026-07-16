import type { NormalizationLimits, Style } from "./types.js";
import { createSafeRecord, isDangerousKey, safeString } from "./safe-json.js";

export function parseStyle(
  rawStyle: unknown,
  limits: NormalizationLimits,
): Style | undefined {
  const raw = safeString(rawStyle, limits.maxStringLength);
  if (raw === undefined || raw.length === 0) {
    return undefined;
  }

  const properties = createSafeRecord<string>();
  const uninterpreted: string[] = [];

  for (const token of raw.split(";")) {
    const trimmed = token.trim();
    if (trimmed.length === 0) {
      continue;
    }

    const equals = trimmed.indexOf("=");
    if (equals === -1) {
      uninterpreted.push(trimmed);
      continue;
    }

    const key = trimmed.slice(0, equals).trim();
    if (key.length === 0 || isDangerousKey(key)) {
      continue;
    }
    properties[key] = trimmed.slice(equals + 1).trim();
  }

  return {
    raw,
    properties,
    ...(uninterpreted.length > 0 ? { uninterpreted } : {}),
  };
}
