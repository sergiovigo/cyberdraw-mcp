import { build } from "esbuild";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");
const buildRoot = resolve(packageRoot, "build");

const vendoredPackages = [
  {
    name: "cyberdraw-graph-model",
    entry: resolve(repoRoot, "packages/cyberdraw-graph-model/build/index.js"),
    outfile: resolve(buildRoot, "vendored/graph-model/index.js"),
  },
  {
    name: "cyberdraw-runtime-contract",
    entry: resolve(
      repoRoot,
      "packages/cyberdraw-runtime-contract/build/index.js",
    ),
    outfile: resolve(buildRoot, "vendored/runtime-contract/index.js"),
  },
];

async function listJavaScriptFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listJavaScriptFiles(path)));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(path);
    }
  }
  return files;
}

function localSpecifier(fromFile, toFile) {
  let specifier = relative(dirname(fromFile), toFile).replaceAll("\\", "/");
  if (!specifier.startsWith(".")) {
    specifier = `./${specifier}`;
  }
  return specifier;
}

async function rewritePackageImports(file) {
  let source = await readFile(file, "utf8");
  let changed = false;

  for (const pkg of vendoredPackages) {
    const replacement = localSpecifier(file, pkg.outfile);
    const before = source;
    source = source
      .replaceAll(`from "${pkg.name}"`, `from "${replacement}"`)
      .replaceAll(`from '${pkg.name}'`, `from '${replacement}'`)
      .replaceAll(`import("${pkg.name}")`, `import("${replacement}")`)
      .replaceAll(`import('${pkg.name}')`, `import('${replacement}')`);
    changed ||= source !== before;
  }

  if (changed) {
    await writeFile(file, source);
  }
}

async function sanitizeVendoredSourceComments(file) {
  const source = await readFile(file, "utf8");
  await writeFile(
    file,
    source
      .replaceAll("cyberdraw-graph-model", "graph-model")
      .replaceAll("cyberdraw-runtime-contract", "runtime-contract"),
  );
}

for (const pkg of vendoredPackages) {
  await mkdir(dirname(pkg.outfile), { recursive: true });
  await build({
    entryPoints: [pkg.entry],
    outfile: pkg.outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    sourcemap: false,
    logLevel: "silent",
  });
  await sanitizeVendoredSourceComments(pkg.outfile);
}

for (const file of await listJavaScriptFiles(buildRoot)) {
  if (file.includes("/build/plugin/")) {
    continue;
  }
  await rewritePackageImports(file);
}
