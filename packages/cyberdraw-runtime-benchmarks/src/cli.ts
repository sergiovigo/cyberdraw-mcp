#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { formatHuman, formatMarkdown } from "./format.js";
import { runBenchmarkSuite } from "./runner.js";
import { defaultBenchmarkConfig } from "./synthetic-fixtures.js";
import type {
  BenchmarkConfig,
  BenchmarkFixtureName,
  BenchmarkFormat,
} from "./types.js";

const args = parseArgs(process.argv.slice(2));
const result = await runBenchmarkSuite(args.config);
const output =
  args.config.format === "json"
    ? `${JSON.stringify(result, null, 2)}\n`
    : args.config.format === "markdown"
      ? formatMarkdown(result)
      : formatHuman(result);

if (args.output) {
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, output, "utf8");
} else {
  process.stdout.write(output);
}

function parseArgs(argv: readonly string[]): {
  readonly config: BenchmarkConfig;
  readonly output?: string;
} {
  const config: {
    fixtures: BenchmarkConfig["fixtures"];
    scenarioNames?: BenchmarkConfig["scenarioNames"];
    iterations: number;
    warmup: number;
    seed: number;
    includeRaw: boolean;
    format: BenchmarkFormat;
  } = { ...defaultBenchmarkConfig };
  let output: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--":
        break;
      case "--fixture":
      case "--fixtures":
        config.fixtures = parseFixtures(requireValue(argv, ++index, arg));
        break;
      case "--scenario":
      case "--scenarios":
        config.scenarioNames = requireValue(argv, ++index, arg)
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        break;
      case "--iterations":
        config.iterations = positiveInteger(requireValue(argv, ++index, arg), arg);
        break;
      case "--warmup":
        config.warmup = nonNegativeInteger(requireValue(argv, ++index, arg), arg);
        break;
      case "--seed":
        config.seed = nonNegativeInteger(requireValue(argv, ++index, arg), arg);
        break;
      case "--no-raw":
        config.includeRaw = false;
        break;
      case "--format":
        config.format = parseFormat(requireValue(argv, ++index, arg));
        break;
      case "--json":
        config.format = "json";
        break;
      case "--markdown":
        config.format = "markdown";
        break;
      case "--output":
        output = requireValue(argv, ++index, arg);
        break;
      case "--help":
        process.stdout.write(helpText());
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown benchmark argument: ${arg}`);
    }
  }
  return { config, ...(output ? { output } : {}) };
}

function parseFixtures(value: string): readonly BenchmarkFixtureName[] {
  const fixtures = value.split(",").map((item) => item.trim());
  for (const fixture of fixtures) {
    if (!["small", "medium", "large", "hard-limit"].includes(fixture)) {
      throw new Error(`Unknown benchmark fixture: ${fixture}`);
    }
  }
  return fixtures as BenchmarkFixtureName[];
}

function parseFormat(value: string): BenchmarkFormat {
  if (value === "human" || value === "json" || value === "markdown") {
    return value;
  }
  throw new Error(`Unknown benchmark format: ${value}`);
}

function positiveInteger(value: string, flag: string): number {
  const parsed = nonNegativeInteger(value, flag);
  if (parsed < 1) {
    throw new Error(`${flag} must be greater than zero`);
  }
  return parsed;
}

function nonNegativeInteger(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative integer`);
  }
  return parsed;
}

function requireValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function helpText(): string {
  return `CyberDraw M6 runtime snapshot benchmark

Options:
  --fixture small,medium,large,hard-limit
  --scenario document,pages-visible,layers-small,selection-one
  --iterations 15
  --warmup 3
  --seed 424242
  --no-raw
  --format human|json|markdown
  --json
  --markdown
  --output path
`;
}
