#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatRealHuman, formatRealMarkdown } from "./real-format.js";
import { runRealBenchmarkSuite } from "./real-runner.js";
import {
  defaultRealBenchmarkConfig,
  parseRealScenarioNames,
} from "./real-scenarios.js";
import type {
  RealBenchmarkConfig,
  RealBenchmarkFixtureName,
} from "./real-types.js";

type CliOptions = Partial<RealBenchmarkConfig> & {
  readonly format: "human" | "json" | "markdown";
  readonly writeDocs: boolean;
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await runRealBenchmarkSuite(options);
  if (options.writeDocs) {
    writeDocsArtifacts(result);
  }
  if (options.format === "json") {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (options.format === "markdown") {
    process.stdout.write(formatRealMarkdown(result));
    return;
  }
  process.stdout.write(formatRealHuman(result));
}

function parseArgs(args: readonly string[]): CliOptions {
  const fixture = argValue(args, "--fixture");
  const scenario = argValue(args, "--scenario");
  const iterations = numberArg(args, "--iterations");
  const warmup = numberArg(args, "--warmup");
  const seed = numberArg(args, "--seed");
  const json = args.includes("--json");
  const markdown = args.includes("--markdown");
  return {
    fixtures: fixture
      ? (fixture.split(",").map((entry) => entry.trim()) as RealBenchmarkFixtureName[])
      : defaultRealBenchmarkConfig.fixtures,
    scenarioNames: parseRealScenarioNames(scenario),
    iterations: iterations ?? defaultRealBenchmarkConfig.iterations,
    warmup: warmup ?? defaultRealBenchmarkConfig.warmup,
    seed: seed ?? defaultRealBenchmarkConfig.seed,
    includeRaw: !args.includes("--no-raw"),
    format: json ? "json" : markdown ? "markdown" : "human",
    writeDocs: args.includes("--write-docs"),
  };
}

function argValue(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function numberArg(args: readonly string[], name: string): number | undefined {
  const value = argValue(args, name);
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

function writeDocsArtifacts(result: Awaited<ReturnType<typeof runRealBenchmarkSuite>>) {
  const base = resolve(dirname(fileURLToPath(import.meta.url)), "../../../docs/cyberdraw/benchmarks");
  mkdirSync(base, { recursive: true });
  const fixtures = new Set(result.results.map((run) => run.fixture));
  for (const fixture of fixtures) {
    const fixtureResult = {
      ...result,
      results: result.results.filter((run) => run.fixture === fixture),
    };
    writeFileSync(
      resolve(base, `m7-real-${fixture}-summary.json`),
      `${JSON.stringify(fixtureResult, null, 2)}\n`,
    );
  }
  writeFileSync(resolve(base, "m7-real-summary.md"), formatRealMarkdown(result));
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
