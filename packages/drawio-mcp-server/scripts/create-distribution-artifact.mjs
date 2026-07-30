import { spawnSync } from "node:child_process";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
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
  return result;
}

function readCatalogVersion(workspaceYaml, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `^\\s*\"?${escaped}\"?:\\s*\"?([^\"\\n]+)\"?\\s*$`,
    "m",
  );
  const match = workspaceYaml.match(pattern);
  if (!match) {
    throw new Error(`Could not resolve catalog version for ${name}`);
  }
  return match[1].trim();
}

function sanitizeDependencyVersions(dependencies, workspaceYaml) {
  const sanitized = {};
  for (const [name, version] of Object.entries(dependencies ?? {})) {
    if (name === "cyberdraw-graph-model") continue;
    if (name === "cyberdraw-runtime-contract") continue;
    sanitized[name] =
      version === "catalog:"
        ? readCatalogVersion(workspaceYaml, name)
        : version;
  }
  return sanitized;
}

async function copyRuntimeBuild(staging) {
  await cp(resolve(packageRoot, "build"), resolve(staging, "build"), {
    recursive: true,
    filter: (source) => {
      const normalized = source.replaceAll("\\", "/");
      if (normalized.includes("/build/real-environment")) return false;
      if (normalized.endsWith(".test.js")) return false;
      if (normalized.includes("/coverage/")) return false;
      return true;
    },
  });

  const pluginPath = resolve(staging, "build/plugin/mcp-plugin.js");
  if (existsSync(pluginPath)) {
    const plugin = await readFile(pluginPath, "utf8");
    await writeFile(
      pluginPath,
      plugin.replace(
        /^.*cyberdraw-runtime-contract.*$/gm,
        "// bundled first-party runtime contract module",
      ),
    );
  }
}

async function normalizePackagePermissions(root) {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      await chmod(path, 0o755);
      await normalizePackagePermissions(path);
    } else if (entry.isFile()) {
      await chmod(path, 0o644);
    }
  }

  const entrypoint = resolve(root, "build/index.js");
  if (existsSync(entrypoint)) {
    await chmod(entrypoint, 0o755);
  }
}

async function writePackageJson(staging) {
  const pkg = JSON.parse(
    await readFile(resolve(packageRoot, "package.json"), "utf8"),
  );
  const workspaceYaml = await readFile(
    resolve(repoRoot, "pnpm-workspace.yaml"),
    "utf8",
  );
  const published = {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    type: pkg.type,
    main: pkg.main,
    bin: pkg.bin,
    engines: pkg.engines,
    files: [
      "build/**/*.js",
      "README.md",
      "LICENSE.md",
      "THIRD_PARTY_NOTICES.md",
    ],
    keywords: pkg.keywords,
    author: pkg.author,
    license: pkg.license,
    repository: pkg.repository,
    packageManager: pkg.packageManager,
    dependencies: sanitizeDependencyVersions(pkg.dependencies, workspaceYaml),
    scripts: {
      start: "node build/index.js",
      "prefetch-assets": "node build/prefetch-assets.js",
      "download-assets": "node build/prefetch-assets.js",
    },
  };
  await writeFile(
    resolve(staging, "package.json"),
    `${JSON.stringify(published, null, 2)}\n`,
  );
}

async function cleanupTempDir(path, label, primaryError) {
  try {
    await rm(path, { recursive: true, force: true });
    if (existsSync(path)) {
      throw new Error(`${label} directory still exists: ${path}`);
    }
    return primaryError;
  } catch (cleanupError) {
    const message = `Cleanup failed for ${label} directory ${path}: ${
      cleanupError instanceof Error
        ? cleanupError.message
        : String(cleanupError)
    }`;
    if (primaryError instanceof Error) {
      primaryError.message += `\n${message}`;
      return primaryError;
    }
    return new Error(message);
  }
}

const outDir = resolve(
  argValue("--out") ?? (await mkdtemp(join(tmpdir(), "drawio-mcp-artifact-"))),
);
await mkdir(outDir, { recursive: true });

const staging = await mkdtemp(join(tmpdir(), "drawio-mcp-server-package-"));
const packHome = await mkdtemp(join(tmpdir(), "drawio-mcp-pack-home-"));
let primaryError;
try {
  await copyRuntimeBuild(staging);
  await cp(resolve(packageRoot, "README.md"), resolve(staging, "README.md"));
  await cp(resolve(repoRoot, "LICENSE.md"), resolve(staging, "LICENSE.md"));
  await cp(
    resolve(repoRoot, "THIRD_PARTY_NOTICES.md"),
    resolve(staging, "THIRD_PARTY_NOTICES.md"),
  );
  await writePackageJson(staging);
  await normalizePackagePermissions(staging);

  const pack = run("npm", ["pack", "--json", "--pack-destination", outDir], {
    cwd: staging,
    env: {
      ...process.env,
      HOME: packHome,
      npm_config_cache: resolve(packHome, "npm-cache"),
    },
  });
  const data = JSON.parse(pack.stdout);
  const tarball = data[0];
  console.log(
    JSON.stringify(
      {
        staging,
        outDir,
        filename: tarball.filename,
        tarballPath: resolve(outDir, tarball.filename),
        integrity: tarball.integrity,
        shasum: tarball.shasum,
        entryCount: tarball.entryCount,
      },
      null,
      2,
    ),
  );
} catch (error) {
  primaryError = error;
  throw error;
} finally {
  let cleanupError = primaryError;
  cleanupError = await cleanupTempDir(staging, "staging", cleanupError);
  cleanupError = await cleanupTempDir(packHome, "pack HOME", cleanupError);
  if (!(primaryError instanceof Error) && cleanupError instanceof Error) {
    throw cleanupError;
  }
}
