import type { JsonValue, NormalizationLimits } from "./types.js";

const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export function isDangerousKey(key: string): boolean {
  return DANGEROUS_KEYS.has(key);
}

export function safeString(
  value: unknown,
  maxLength: number,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const text = String(value);
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

export function safeNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return value;
}

export function createSafeRecord<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

export function sanitizeJson(
  value: unknown,
  limits: NormalizationLimits,
  depth = 0,
): JsonValue | undefined {
  if (value === null) {
    return null;
  }

  if (
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }

  if (typeof value === "string") {
    return safeString(value, limits.maxStringLength) ?? "";
  }

  if (depth >= limits.maxRawDepth) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const result: JsonValue[] = [];
    for (const item of value.slice(0, limits.maxArrayItems)) {
      const sanitized = sanitizeJson(item, limits, depth + 1);
      if (sanitized !== undefined) {
        result.push(sanitized);
      }
    }
    return result;
  }

  if (typeof value !== "object") {
    return undefined;
  }

  const result = createSafeRecord<JsonValue>();
  let count = 0;
  for (const [key, entry] of Object.entries(value)) {
    if (isDangerousKey(key)) {
      continue;
    }
    if (count >= limits.maxRawKeys) {
      break;
    }
    const sanitized = sanitizeJson(entry, limits, depth + 1);
    if (sanitized !== undefined) {
      result[safeString(key, limits.maxStringLength) ?? key] = sanitized;
      count++;
    }
  }

  return result;
}

export function sanitizeAttributes(
  value: unknown,
  limits: NormalizationLimits,
): Record<string, JsonValue> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const result = createSafeRecord<JsonValue>();
  for (const [key, entry] of Object.entries(value)) {
    if (isDangerousKey(key)) {
      continue;
    }
    const sanitized = sanitizeJson(entry, limits, 0);
    if (sanitized !== undefined) {
      result[safeString(key, limits.maxStringLength) ?? key] = sanitized;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
