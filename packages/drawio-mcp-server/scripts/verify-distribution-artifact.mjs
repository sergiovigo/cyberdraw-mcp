import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync, lstatSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const tarball = process.argv.slice(2).find((arg) => arg !== "--");
if (!tarball) {
  throw new Error(
    "Usage: node scripts/verify-distribution-artifact.mjs <tarball>",
  );
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit ${result.status}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
  return result.stdout;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function listFiles(root, output = []) {
  for (const entry of run("find", [root, "-type", "f", "-o", "-type", "l"])
    .split("\n")
    .filter(Boolean)) {
    output.push(entry);
  }
  return output;
}

const entries = run("tar", ["-tzf", tarball]).split("\n").filter(Boolean);
const verboseEntries = run("tar", ["-tvzf", tarball])
  .split("\n")
  .filter(Boolean);
const packageJson = JSON.parse(
  run("tar", ["-xOf", tarball, "package/package.json"]),
);

assert(packageJson.name === "drawio-mcp-server", "unexpected package name");
assert(packageJson.version, "missing package version");
assert(
  packageJson.bin?.["drawio-mcp-server"] === "build/index.js",
  "missing bin",
);
assert(packageJson.engines?.node === ">=22.0.0", "unexpected node engine");
assert(packageJson.private !== true, "distributed package must not be private");
assert(
  !JSON.stringify(packageJson).includes("workspace:"),
  "workspace range leaked",
);
assert(
  !packageJson.dependencies?.["cyberdraw-graph-model"],
  "private graph-model dependency leaked",
);
assert(
  !packageJson.dependencies?.["cyberdraw-runtime-contract"],
  "private runtime-contract dependency leaked",
);
for (const script of ["preinstall", "install", "postinstall", "prepare"]) {
  assert(
    !packageJson.scripts?.[script],
    `${script} script must not be present`,
  );
}

assert(
  entries.includes("package/build/plugin/mcp-plugin.js"),
  "plugin missing",
);
assert(entries.includes("package/LICENSE.md"), "license missing");
assert(entries.includes("package/THIRD_PARTY_NOTICES.md"), "notices missing");
assert(
  !entries.some((entry) => entry.endsWith(".test.js")),
  "test file leaked",
);
assert(
  !entries.some((entry) => entry.includes("real-environment")),
  "real-environment file leaked",
);
assert(!entries.some((entry) => entry.includes("coverage")), "coverage leaked");
assert(
  !verboseEntries.some((entry) => entry.startsWith("l")),
  "symlink leaked",
);

const extractRoot = await mkdtemp(join(tmpdir(), "drawio-mcp-verify-"));
try {
  run("tar", ["-xzf", resolve(tarball), "-C", extractRoot]);
  for (const file of listFiles(extractRoot)) {
    assert(!lstatSync(file).isSymbolicLink(), `symlink leaked: ${file}`);
    if (!file.endsWith(".js")) continue;
    const source = await readFile(file, "utf8");
    assert(
      !source.includes('from "cyberdraw-graph-model"') &&
        !source.includes("from 'cyberdraw-graph-model'") &&
        !source.includes('import("cyberdraw-graph-model")') &&
        !source.includes("import('cyberdraw-graph-model')"),
      `unresolved graph-model import leaked: ${file}`,
    );
    assert(
      !source.includes('from "cyberdraw-runtime-contract"') &&
        !source.includes("from 'cyberdraw-runtime-contract'") &&
        !source.includes('import("cyberdraw-runtime-contract")') &&
        !source.includes("import('cyberdraw-runtime-contract')"),
      `unresolved runtime-contract import leaked: ${file}`,
    );
    assert(!source.includes("workspace:"), `workspace string leaked: ${file}`);
  }
  assert(
    existsSync(join(extractRoot, "package/build/index.js")),
    "entrypoint missing after extraction",
  );
} finally {
  await rm(extractRoot, { recursive: true, force: true });
}

console.log(
  JSON.stringify(
    {
      ok: true,
      entryCount: entries.length,
      packageName: packageJson.name,
      packageVersion: packageJson.version,
    },
    null,
    2,
  ),
);
