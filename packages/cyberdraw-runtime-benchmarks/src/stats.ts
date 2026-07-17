import type { SampleSummary } from "./types.js";

export function percentile(values: readonly number[], percentileValue: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, index))] ?? 0;
}

export function summarizeSamples(values: readonly number[]): SampleSummary {
  if (values.length === 0) {
    return { median: 0, p95: 0, min: 0, max: 0, mean: 0, stdev: 0 };
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return {
    median: percentile(values, 50),
    p95: percentile(values, 95),
    min: Math.min(...values),
    max: Math.max(...values),
    mean,
    stdev: Math.sqrt(variance),
  };
}
