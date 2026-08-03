import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import {
  access,
  copyFile,
  mkdtemp,
  mkdir,
  readFile,
  rename,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { constants, existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { homedir, platform, tmpdir } from "node:os";

export const CONTRACT_VERSION = "m22-installation-contract-v1";
export const INSTALL_STATUS = Object.freeze({
  PASS: "PASS",
  WARN: "WARN",
  FAIL: "FAIL",
  NOT_CHECKED: "NOT CHECKED",
});
export const DEFAULTS = Object.freeze({
  packageName: "drawio-mcp-server",
  nodeMinimumMajor: 22,
  profile: "localhost",
  localhostHost: "127.0.0.1",
  lanHost: "0.0.0.0",
  httpPort: 3000,
  websocketPort: 3333,
  codexServerName: "cyberdraw",
});

export class InstallationError extends Error {
  constructor(message, { code = 1, details } = {}) {
    super(message);
    this.name = "InstallationError";
    this.code = code;
    this.details = details;
  }
}

export function defaultInstallDir(env = process.env) {
  if (env.CYBERDRAW_INSTALL_DIR) return resolve(env.CYBERDRAW_INSTALL_DIR);
  if (platform() === "darwin") {
    return join(homedir(), "Library", "Application Support", "CyberDraw MCP");
  }
  return join(homedir(), ".local", "share", "cyberdraw-mcp");
}

export function defaultCodexConfigPath(env = process.env) {
  return resolve(
    env.CODEX_CONFIG_PATH ?? join(homedir(), ".codex", "config.toml"),
  );
}

export function parseArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      result._.push(arg);
      continue;
    }
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (inlineValue !== undefined) {
      result[key] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      result[key] = next;
      index += 1;
    } else {
      result[key] = true;
    }
  }
  return result;
}

export async function sha(filePath, algorithm) {
  const data = await readFile(filePath);
  return createHash(algorithm).update(data).digest("hex");
}

export async function hashTarball(tarballPath) {
  const path = resolve(tarballPath);
  await access(path, constants.R_OK);
  return {
    sha256: await sha(path, "sha256"),
    sha512: await sha(path, "sha512"),
  };
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    ...options,
  });
  if (result.status !== 0) {
    throw new InstallationError(`${command} ${args.join(" ")} failed`, {
      code: result.status ?? 1,
      details: {
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
      },
    });
  }
  return result;
}

export function readTarballPackageJson(tarballPath, runner = run) {
  const result = runner("tar", [
    "-xOf",
    resolve(tarballPath),
    "package/package.json",
  ]);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new InstallationError(
      "tarball package/package.json is not valid JSON",
      {
        details: {
          cause: error instanceof Error ? error.message : String(error),
        },
      },
    );
  }
}

function parseTarVerboseType(line) {
  return line.trimStart()[0];
}

export function inspectTarballLayout(tarballPath, runner = run) {
  const entries = runner("tar", ["-tzf", resolve(tarballPath)])
    .stdout.split("\n")
    .map((entry) => entry.trim().replace(/^\.\//, ""))
    .filter(Boolean);
  const verboseEntries = runner("tar", ["-tvzf", resolve(tarballPath)])
    .stdout.split("\n")
    .filter(Boolean);
  if (!entries.length) {
    throw new InstallationError("tarball is empty");
  }
  for (const entry of entries) {
    if (entry.startsWith("/")) {
      throw new InstallationError(`tarball contains absolute path: ${entry}`);
    }
    if (entry.split("/").includes("..")) {
      throw new InstallationError(`tarball contains path traversal: ${entry}`);
    }
    if (entry !== "." && !entry.startsWith("package/")) {
      throw new InstallationError(
        `tarball contains entry outside package/: ${entry}`,
      );
    }
  }
  for (const line of verboseEntries) {
    const type = parseTarVerboseType(line);
    if (type !== "-" && type !== "d") {
      throw new InstallationError(
        "tarball contains links or non-regular entries",
        {
          details: { entry: line },
        },
      );
    }
  }
  const packageJsonEntries = entries.filter((entry) =>
    entry.endsWith("package.json"),
  );
  if (!entries.includes("package/package.json")) {
    throw new InstallationError("tarball package/package.json is missing");
  }
  if (packageJsonEntries.length !== 1) {
    throw new InstallationError(
      "tarball contains ambiguous package.json entries",
      {
        details: { packageJsonEntries },
      },
    );
  }
  for (const requiredEntry of [
    "package/LICENSE.md",
    "package/THIRD_PARTY_NOTICES.md",
  ]) {
    if (!entries.includes(requiredEntry)) {
      throw new InstallationError(
        `tarball required file is missing: ${requiredEntry}`,
      );
    }
  }
  return {
    entries,
    verboseEntries,
  };
}

function containsWorkspaceRange(value) {
  if (typeof value === "string") return value.startsWith("workspace:");
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some((entry) => containsWorkspaceRange(entry));
}

function runtimeDependencyEntries(pkg) {
  return {
    dependencies: pkg.dependencies ?? {},
    optionalDependencies: pkg.optionalDependencies ?? {},
    peerDependencies: pkg.peerDependencies ?? {},
  };
}

export async function validateTarball(tarballPath, options = {}) {
  const path = resolve(tarballPath);
  const file = await stat(path).catch(() => undefined);
  if (!file?.isFile()) {
    throw new InstallationError(`tarball is not a readable file: ${path}`);
  }

  const hashes = await hashTarball(path);
  if (options.expectedSha256 && hashes.sha256 !== options.expectedSha256) {
    throw new InstallationError("SHA-256 mismatch", {
      details: { expected: options.expectedSha256, actual: hashes.sha256 },
    });
  }
  if (options.expectedSha512 && hashes.sha512 !== options.expectedSha512) {
    throw new InstallationError("SHA-512 mismatch", {
      details: { expected: options.expectedSha512, actual: hashes.sha512 },
    });
  }

  const layout = inspectTarballLayout(path, options.runner ?? run);
  const packageJson = readTarballPackageJson(path, options.runner ?? run);
  if (packageJson.name !== DEFAULTS.packageName) {
    throw new InstallationError(
      `unexpected package name: ${packageJson.name ?? "missing"}`,
    );
  }
  if (!packageJson.version || typeof packageJson.version !== "string") {
    throw new InstallationError("tarball package version is missing");
  }
  if (containsWorkspaceRange(packageJson)) {
    throw new InstallationError("tarball contains workspace:* metadata");
  }

  for (const [section, deps] of Object.entries(
    runtimeDependencyEntries(packageJson),
  )) {
    for (const [name, version] of Object.entries(deps)) {
      if (name.startsWith("cyberdraw-")) {
        throw new InstallationError(
          `private runtime dependency leaked: ${name}`,
          {
            details: { section, version },
          },
        );
      }
    }
  }

  if (packageJson.bin?.[DEFAULTS.packageName] !== "build/index.js") {
    throw new InstallationError("drawio-mcp-server binary entry is missing");
  }

  return {
    path,
    hashes,
    layout,
    packageJson,
  };
}

export function resolveProfile({
  profile = DEFAULTS.profile,
  host,
  lanConfirm = false,
} = {}) {
  if (profile === "localhost") {
    return {
      name: "localhost",
      host: host ?? DEFAULTS.localhostHost,
      lan: false,
    };
  }
  if (profile === "lan") {
    if (!lanConfirm) {
      throw new InstallationError(
        "LAN profile requires --lan-confirm because it exposes unauthenticated HTTP and WebSocket surfaces",
      );
    }
    return {
      name: "lan",
      host: host ?? DEFAULTS.lanHost,
      lan: true,
    };
  }
  throw new InstallationError(`unsupported profile: ${profile}`);
}

export function createManifest({
  installDir,
  tarballPath,
  packageJson,
  hashes,
  profile,
  httpPort = DEFAULTS.httpPort,
  websocketPort = DEFAULTS.websocketPort,
  createdAt = new Date().toISOString(),
}) {
  return {
    contractVersion: CONTRACT_VERSION,
    packageName: packageJson.name,
    packageVersion: packageJson.version,
    installDir: resolve(installDir),
    tarball: {
      path: resolve(tarballPath),
      filename: basename(tarballPath),
      sha256: hashes.sha256,
      sha512: hashes.sha512,
    },
    profile: {
      name: profile.name,
      host: profile.host,
      lan: profile.lan,
      httpPort: Number(httpPort),
      websocketPort: Number(websocketPort),
      transport: "stdio",
      editor: true,
      authenticated: false,
    },
    codex: {
      serverName: DEFAULTS.codexServerName,
    },
    createdAt,
  };
}

export function createCodexCommand(manifest) {
  const binPath = join(
    manifest.installDir,
    "node_modules",
    ".bin",
    DEFAULTS.packageName,
  );
  return {
    command: binPath,
    args: [
      "--editor",
      "--host",
      manifest.profile.host,
      "--http-port",
      String(manifest.profile.httpPort),
      "--extension-port",
      String(manifest.profile.websocketPort),
    ],
  };
}

export function renderCodexBlock(manifest) {
  const command = createCodexCommand(manifest);
  const lines = [
    `[mcp_servers.${DEFAULTS.codexServerName}]`,
    `command = ${JSON.stringify(command.command)}`,
    `args = ${JSON.stringify(command.args)}`,
    "",
  ];
  return lines.join("\n");
}

export function upsertCodexServerBlock(content, manifest) {
  const analysis = analyzeCodexConfig(content);
  if (!analysis.valid) {
    throw new InstallationError(
      "Codex config is invalid; manual repair required",
      {
        details: { errors: analysis.errors },
      },
    );
  }
  if (analysis.cyberdrawSections.length > 1) {
    throw new InstallationError(
      "Codex config has duplicate CyberDraw entries; manual repair required",
      {
        details: { sections: analysis.cyberdrawSections },
      },
    );
  }
  const newBlock = renderCodexBlock(manifest).trimEnd();
  if (analysis.cyberdrawSections.length === 0) {
    const prefix = content.trimEnd();
    return `${prefix}${prefix ? "\n\n" : ""}${newBlock}\n`;
  }

  const lines = content.split(/\r?\n/);
  const output = [];
  const cyberdrawLine = analysis.cyberdrawSections[0].line;
  for (let index = 0; index < lines.length; index += 1) {
    if (index + 1 !== cyberdrawLine) {
      output.push(lines[index]);
      continue;
    }
    output.push(...newBlock.split("\n"));
    index += 1;
    while (
      index < lines.length &&
      !parseTomlTableHeader(stripTomlInlineComment(lines[index]).trim())
    ) {
      index += 1;
    }
    index -= 1;
  }
  return `${output.join("\n").trimEnd()}\n`;
}

function parseTomlQuotedSegment(input, start, quote) {
  let value = "";
  for (let index = start + 1; index < input.length; index += 1) {
    const char = input[index];
    if (quote === '"' && char === "\\") {
      if (index + 1 >= input.length) return undefined;
      value += input[index + 1];
      index += 1;
      continue;
    }
    if (char === quote) {
      return { value, next: index + 1 };
    }
    value += char;
  }
  return undefined;
}

function parseTomlDottedKey(input) {
  const segments = [];
  let index = 0;
  while (index < input.length) {
    while (input[index] === " " || input[index] === "\t") index += 1;
    if (index >= input.length) return undefined;

    const char = input[index];
    if (char === '"' || char === "'") {
      const quoted = parseTomlQuotedSegment(input, index, char);
      if (!quoted) return undefined;
      segments.push(quoted.value);
      index = quoted.next;
    } else {
      const match = input.slice(index).match(/^[A-Za-z0-9_-]+/);
      if (!match) return undefined;
      segments.push(match[0]);
      index += match[0].length;
    }

    while (input[index] === " " || input[index] === "\t") index += 1;
    if (index >= input.length) break;
    if (input[index] !== ".") return undefined;
    index += 1;
  }
  return segments.length ? segments : undefined;
}

function parseTomlTableHeader(line) {
  let inner;
  let tableKind;
  if (line.startsWith("[[") && line.endsWith("]]")) {
    inner = line.slice(2, -2).trim();
    tableKind = "array-table";
  } else if (line.startsWith("[") && line.endsWith("]")) {
    inner = line.slice(1, -1).trim();
    tableKind = "table";
  } else {
    return undefined;
  }
  const segments = parseTomlDottedKey(inner);
  if (!segments) return undefined;
  return {
    tableKind,
    canonicalKey: tomlCanonicalKey(segments),
    name: segments.join("."),
    segments,
  };
}

function findTomlKeyEquals(line) {
  let quote;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quote === '"' && char === "\\" && !escaped) {
      escaped = true;
      continue;
    }
    if ((char === '"' || char === "'") && !escaped) {
      if (quote === char) {
        quote = undefined;
      } else if (!quote) {
        quote = char;
      }
    }
    if (char === "=" && !quote) {
      return index;
    }
    escaped = false;
  }
  return -1;
}

function parseTomlKeyAssignment(line) {
  const equalsIndex = findTomlKeyEquals(line);
  if (equalsIndex <= 0) return undefined;
  const key = line.slice(0, equalsIndex).trim();
  const segments = parseTomlDottedKey(key);
  if (!segments) return undefined;
  return {
    canonicalKey: tomlCanonicalKey(segments),
    name: segments.join("."),
    segments,
  };
}

function stripTomlInlineComment(line) {
  let quote;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quote === '"' && char === "\\" && !escaped) {
      escaped = true;
      continue;
    }
    if ((char === '"' || char === "'") && !escaped) {
      if (quote === char) {
        quote = undefined;
      } else if (!quote) {
        quote = char;
      }
    }
    if (char === "#" && !quote) {
      return line.slice(0, index).trimEnd();
    }
    escaped = false;
  }
  return line;
}

function tomlCanonicalKey(segments) {
  return JSON.stringify(segments);
}

function isManagedCyberDrawSection(segments) {
  return (
    segments.length === 2 &&
    segments[0] === "mcp_servers" &&
    segments[1] === DEFAULTS.codexServerName
  );
}

export function analyzeCodexConfig(content) {
  const lines = content.split(/\r?\n/);
  const errors = [];
  const sections = [];
  const cyberdrawSections = [];
  const seenTables = new Map();
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = stripTomlInlineComment(raw).trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("[")) {
      const header = parseTomlTableHeader(line);
      if (!header) {
        errors.push({
          line: index + 1,
          message: "invalid TOML section header",
        });
        continue;
      }
      sections.push({
        line: index + 1,
        name: header.name,
        canonicalKey: header.canonicalKey,
        segments: header.segments,
        tableKind: header.tableKind,
      });
      if (header.tableKind === "table") {
        const firstSeen = seenTables.get(header.canonicalKey);
        if (firstSeen) {
          errors.push({
            line: index + 1,
            message: "duplicate TOML section header",
            firstSeen,
            name: header.name,
            canonicalKey: header.canonicalKey,
          });
        } else {
          seenTables.set(header.canonicalKey, index + 1);
        }
      }
      if (isManagedCyberDrawSection(header.segments)) {
        cyberdrawSections.push({
          line: index + 1,
          name: header.name,
          canonicalKey: header.canonicalKey,
          segments: header.segments,
        });
      }
      continue;
    }
    if (!parseTomlKeyAssignment(line)) {
      errors.push({
        line: index + 1,
        message: "unsupported TOML content in installer-managed config",
      });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    sections,
    cyberdrawSections,
  };
}

export async function backupFileIfExists(filePath) {
  if (!existsSync(filePath)) return undefined;
  const backupPath = `${filePath}.cyberdraw-backup-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}`;
  await mkdir(dirname(backupPath), { recursive: true });
  await copyFile(filePath, backupPath);
  return backupPath;
}

export async function writeCodexConfig(codexConfigPath, manifest) {
  const path = resolve(codexConfigPath);
  await mkdir(dirname(path), { recursive: true });
  const current = existsSync(path) ? await readFile(path, "utf8") : "";
  const next = upsertCodexServerBlock(current, manifest);
  const validation = analyzeCodexConfig(next);
  if (!validation.valid || validation.cyberdrawSections.length !== 1) {
    throw new InstallationError(
      "generated Codex config failed validation; original was preserved",
      {
        details: validation,
      },
    );
  }
  const backupPath = await backupFileIfExists(path);
  const tempPath = `${path}.cyberdraw-tmp-${process.pid}`;
  await writeFile(tempPath, next, "utf8");
  await rename(tempPath, path);
  return {
    path,
    backupPath,
  };
}

export async function installPackageFromTarball({
  installDir,
  tarballPath,
  runner = run,
}) {
  await mkdir(installDir, { recursive: true });
  const packageJsonPath = join(installDir, "package.json");
  if (!existsSync(packageJsonPath)) {
    await writeFile(
      packageJsonPath,
      `${JSON.stringify({ private: true, name: "cyberdraw-local-install" }, null, 2)}\n`,
    );
  }
  runner("corepack", [
    "pnpm@10.8.1",
    "--dir",
    installDir,
    "add",
    resolve(tarballPath),
  ]);
}

export async function writeManifest(installDir, manifest) {
  await mkdir(installDir, { recursive: true });
  const manifestPath = join(installDir, "cyberdraw-installation.json");
  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  return manifestPath;
}

export async function readManifest(installDir) {
  const manifestPath = join(installDir, "cyberdraw-installation.json");
  return JSON.parse(await readFile(manifestPath, "utf8"));
}

export async function isPortOpen(port, host) {
  return new Promise((resolvePromise) => {
    const socket = createServer();
    socket.once("error", () => resolvePromise(true));
    socket.once("listening", () => {
      socket.close(() => resolvePromise(false));
    });
    socket.listen(Number(port), host);
  });
}

export function findManagedProcesses(installDir, runner = run) {
  const root = resolve(installDir);
  const result = runner("ps", ["-axo", "pid=,command="]);
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(.*)$/);
      return match ? { pid: Number(match[1]), command: match[2] } : undefined;
    })
    .filter(Boolean)
    .filter(
      (processInfo) =>
        processInfo.pid !== process.pid &&
        processInfo.command.includes(root) &&
        processInfo.command.includes(DEFAULTS.packageName),
    );
}

export async function probeMcpServer({
  command,
  args,
  timeoutMs = 45000,
  env = process.env,
}) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const messages = [];
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill("SIGTERM");
      resolvePromise({
        ...result,
        stderr,
      });
    };
    const timer = setTimeout(() => {
      finish({ ok: false, reason: "mcp probe timed out", messages });
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      const lines = stdout.split(/\r?\n/);
      stdout = lines.pop() ?? "";
      for (const line of lines.filter(Boolean)) {
        try {
          const message = JSON.parse(line);
          messages.push(message);
          if (message.id === 2 && message.result?.tools) {
            const tools = message.result.tools;
            const toolNames = tools
              .map((tool) => tool.name)
              .filter(Boolean)
              .sort();
            finish({
              ok: true,
              initialized: messages.some(
                (entry) => entry.id === 1 && entry.result,
              ),
              toolCount: toolNames.length,
              toolNames,
              hasCreateDiagram: toolNames.includes("cyberdraw_create_diagram"),
              hasAnalyzeStructure: toolNames.includes(
                "cyberdraw_analyze_structure",
              ),
            });
          }
        } catch {
          finish({
            ok: false,
            reason: "non-JSON stdout from MCP server",
            messages,
            line,
          });
        }
      }
    });
    child.once("error", (error) => {
      finish({ ok: false, reason: error.message, messages });
    });
    child.once("exit", (code, signal) => {
      if (!settled) {
        finish({
          ok: false,
          reason: "MCP server exited before tools/list",
          code,
          signal,
          messages,
        });
      }
    });
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "cyberdraw-installer-doctor", version: "0.0.0" },
        },
      })}\n`,
    );
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      })}\n`,
    );
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      })}\n`,
    );
  });
}

export async function stopManagedProcesses(installDir, runner = run) {
  const processes = findManagedProcesses(installDir, runner);
  const stopped = [];
  for (const processInfo of processes) {
    try {
      process.kill(processInfo.pid, "SIGTERM");
      stopped.push(processInfo);
    } catch {
      // The process may have exited between discovery and termination.
    }
  }
  return stopped;
}

export async function doctor({ installDir, codexConfigPath } = {}) {
  const checks = [];
  const add = (name, status, message, details) => {
    checks.push({ name, status, message, ...(details ? { details } : {}) });
  };

  const os = platform();
  add(
    "operating-system",
    os === "darwin" ? INSTALL_STATUS.PASS : INSTALL_STATUS.WARN,
    os,
  );

  const nodeMajor = Number(process.versions.node.split(".")[0]);
  add(
    "node-version",
    nodeMajor >= DEFAULTS.nodeMinimumMajor
      ? INSTALL_STATUS.PASS
      : INSTALL_STATUS.FAIL,
    process.versions.node,
  );

  const dir = resolve(installDir ?? defaultInstallDir());
  const manifestPath = join(dir, "cyberdraw-installation.json");
  let manifest;
  if (existsSync(manifestPath)) {
    try {
      manifest = await readManifest(dir);
      add("manifest", INSTALL_STATUS.PASS, manifestPath);
    } catch (error) {
      add("manifest", INSTALL_STATUS.FAIL, "manifest is not readable JSON", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    add("manifest", INSTALL_STATUS.FAIL, "installation manifest missing", {
      manifestPath,
    });
  }

  const binPath = manifest
    ? createCodexCommand(manifest).command
    : join(dir, "node_modules", ".bin", DEFAULTS.packageName);
  let binaryOk = false;
  try {
    await access(binPath, constants.X_OK);
    binaryOk = true;
    add("binary", INSTALL_STATUS.PASS, binPath);
  } catch {
    add(
      "binary",
      INSTALL_STATUS.FAIL,
      "drawio-mcp-server binary is not executable",
      {
        binPath,
      },
    );
  }

  const configPath = resolve(codexConfigPath ?? defaultCodexConfigPath());
  if (existsSync(configPath)) {
    const content = await readFile(configPath, "utf8");
    const matches = content.match(
      new RegExp(`^\\[mcp_servers\\.${DEFAULTS.codexServerName}\\]`, "gm"),
    );
    add(
      "codex-config",
      matches?.length === 1 ? INSTALL_STATUS.PASS : INSTALL_STATUS.WARN,
      matches?.length
        ? `${matches.length} CyberDraw Codex entry/entries found`
        : "CyberDraw Codex entry missing",
      { path: configPath },
    );
  } else {
    add("codex-config", INSTALL_STATUS.WARN, "Codex config file missing", {
      path: configPath,
    });
  }

  if (manifest) {
    add(
      "profile",
      manifest.profile.lan ? INSTALL_STATUS.WARN : INSTALL_STATUS.PASS,
      manifest.profile.name,
      manifest.profile,
    );
    const httpUsed = await isPortOpen(
      manifest.profile.httpPort,
      manifest.profile.host,
    );
    const wsUsed = await isPortOpen(
      manifest.profile.websocketPort,
      manifest.profile.host,
    );
    add(
      "http-port",
      httpUsed ? INSTALL_STATUS.WARN : INSTALL_STATUS.PASS,
      String(manifest.profile.httpPort),
    );
    add(
      "websocket-port",
      wsUsed ? INSTALL_STATUS.WARN : INSTALL_STATUS.PASS,
      String(manifest.profile.websocketPort),
    );
    const residualProcesses = findManagedProcesses(dir);
    add(
      "residual-processes",
      residualProcesses.length ? INSTALL_STATUS.WARN : INSTALL_STATUS.PASS,
      residualProcesses.length
        ? `${residualProcesses.length} managed process(es) detected`
        : "no managed process detected",
      residualProcesses.length ? { processes: residualProcesses } : undefined,
    );
    if (binaryOk) {
      const command = createCodexCommand(manifest);
      const probe = await probeMcpServer({
        command: command.command,
        args: command.args,
      });
      if (probe.ok && probe.initialized) {
        add("mcp-handshake", INSTALL_STATUS.PASS, "MCP initialize succeeded");
      } else {
        add(
          "mcp-handshake",
          INSTALL_STATUS.FAIL,
          probe.reason ?? "MCP initialize failed",
          probe,
        );
      }
      if (
        probe.ok &&
        probe.toolCount > 0 &&
        probe.hasCreateDiagram &&
        probe.hasAnalyzeStructure
      ) {
        add(
          "tools-list",
          INSTALL_STATUS.PASS,
          `${probe.toolCount} tools discovered`,
          {
            toolCount: probe.toolCount,
            requiredTools: [
              "cyberdraw_create_diagram",
              "cyberdraw_analyze_structure",
            ],
          },
        );
      } else if (probe.ok) {
        add(
          "tools-list",
          INSTALL_STATUS.FAIL,
          "required CyberDraw tools missing",
          probe,
        );
      } else {
        add(
          "tools-list",
          INSTALL_STATUS.FAIL,
          probe.reason ?? "tools/list failed",
          probe,
        );
      }
    } else {
      add("mcp-handshake", INSTALL_STATUS.NOT_CHECKED, "binary unavailable");
      add("tools-list", INSTALL_STATUS.NOT_CHECKED, "binary unavailable");
    }
    const residualProcessesAfterProbe = findManagedProcesses(dir);
    add(
      "process-cleanup",
      residualProcessesAfterProbe.length
        ? INSTALL_STATUS.WARN
        : INSTALL_STATUS.PASS,
      residualProcessesAfterProbe.length
        ? `${residualProcessesAfterProbe.length} managed process(es) still running after doctor`
        : "no managed process left by doctor",
      residualProcessesAfterProbe.length
        ? { processes: residualProcessesAfterProbe }
        : undefined,
    );
  } else {
    add("profile", INSTALL_STATUS.NOT_CHECKED, "manifest unavailable");
    add("http-port", INSTALL_STATUS.NOT_CHECKED, "manifest unavailable");
    add("websocket-port", INSTALL_STATUS.NOT_CHECKED, "manifest unavailable");
    add(
      "residual-processes",
      INSTALL_STATUS.NOT_CHECKED,
      "manifest unavailable",
    );
    add("mcp-handshake", INSTALL_STATUS.NOT_CHECKED, "manifest unavailable");
    add("tools-list", INSTALL_STATUS.NOT_CHECKED, "manifest unavailable");
    add("process-cleanup", INSTALL_STATUS.NOT_CHECKED, "manifest unavailable");
  }

  return {
    contractVersion: CONTRACT_VERSION,
    checks,
    ok: checks.every((check) => check.status !== INSTALL_STATUS.FAIL),
  };
}

export async function install(options = {}) {
  const tarballPath = options.tarball;
  if (!tarballPath)
    throw new InstallationError("install requires --tarball <path>");
  const installDir = resolve(options.installDir ?? defaultInstallDir());
  if (
    existsSync(join(installDir, "cyberdraw-installation.json")) &&
    !options.upgrade &&
    !options.yes
  ) {
    throw new InstallationError(
      "installation already exists; use upgrade or --yes to replace",
    );
  }

  const profile = resolveProfile({
    profile: options.profile ?? DEFAULTS.profile,
    host: options.host,
    lanConfirm: Boolean(options.lanConfirm),
  });
  const validation = await validateTarball(tarballPath, {
    expectedSha256: options.expectedSha256,
    expectedSha512: options.expectedSha512,
  });
  const manifest = createManifest({
    installDir,
    tarballPath: validation.path,
    packageJson: validation.packageJson,
    hashes: validation.hashes,
    profile,
    httpPort: options.httpPort ?? DEFAULTS.httpPort,
    websocketPort: options.websocketPort ?? DEFAULTS.websocketPort,
  });

  await installPackageFromTarball({ installDir, tarballPath: validation.path });
  const manifestPath = await writeManifest(installDir, manifest);
  const codex = await writeCodexConfig(
    options.codexConfig ?? defaultCodexConfigPath(),
    manifest,
  );
  const health = await doctor({ installDir, codexConfigPath: codex.path });

  return {
    action: options.upgrade ? "upgrade" : "install",
    manifest,
    manifestPath,
    codex,
    doctor: health,
  };
}

export async function upgrade(options = {}) {
  const installDir = resolve(options.installDir ?? defaultInstallDir());
  const previous = await readManifest(installDir);
  const validation = await validateTarball(options.tarball, {
    expectedSha256: options.expectedSha256,
    expectedSha512: options.expectedSha512,
  });
  const manifestPath = join(installDir, "cyberdraw-installation.json");
  const manifestBackupPath = `${installDir}.manifest-backup-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.json`;
  await copyFile(manifestPath, manifestBackupPath);
  const installBackupDir = `${installDir}.backup-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}`;
  const profile = resolveProfile({
    profile: options.profile ?? previous.profile.name,
    host: options.host ?? previous.profile.host,
    lanConfirm: previous.profile.lan || Boolean(options.lanConfirm),
  });
  const tempInstallDir = await mkdtemp(join(tmpdir(), "cyberdraw-upgrade-"));
  const manifest = createManifest({
    installDir,
    tarballPath: validation.path,
    packageJson: validation.packageJson,
    hashes: validation.hashes,
    profile,
    httpPort: options.httpPort ?? previous.profile.httpPort,
    websocketPort: options.websocketPort ?? previous.profile.websocketPort,
  });
  await installPackageFromTarball({
    installDir: tempInstallDir,
    tarballPath: validation.path,
  });
  await writeManifest(tempInstallDir, manifest);
  await rename(installDir, installBackupDir);
  await rename(tempInstallDir, installDir);
  await writeManifest(installDir, manifest);
  const codex = await writeCodexConfig(
    options.codexConfig ?? defaultCodexConfigPath(),
    manifest,
  );
  const health = await doctor({ installDir, codexConfigPath: codex.path });
  if (!health.ok) {
    const failedDir = `${installDir}.failed-${Date.now()}`;
    await rename(installDir, failedDir);
    await rename(installBackupDir, installDir);
    if (codex.backupPath) {
      await copyFile(codex.backupPath, codex.path);
    }
    throw new InstallationError(
      "upgrade doctor failed; previous installation restored",
      {
        details: {
          failedDir,
          installBackupDir,
          manifestBackupPath,
          doctor: health,
        },
      },
    );
  }
  await rm(installBackupDir, { recursive: true, force: true });
  await writeManifest(installDir, manifest);
  return {
    action: "upgrade",
    manifest,
    manifestPath,
    codex,
    doctor: health,
    installBackupDir,
    previousManifestBackupPath: manifestBackupPath,
  };
}

export async function assertSafeUninstallTarget(installDir) {
  const dir = resolve(installDir);
  const home = resolve(homedir());
  if (dir === process.cwd()) {
    throw new InstallationError(
      "refusing to uninstall the current working directory",
    );
  }
  if (dir === "/" || dir === home || dir === dirname(home)) {
    throw new InstallationError(
      `refusing to uninstall unsafe directory: ${dir}`,
    );
  }
  const manifestPath = join(dir, "cyberdraw-installation.json");
  if (!existsSync(manifestPath)) {
    throw new InstallationError(
      "refusing to uninstall without a valid managed manifest",
    );
  }
  const entries = await readdir(dir, { withFileTypes: true });
  const allowed = new Set([
    "cyberdraw-installation.json",
    "package.json",
    "pnpm-lock.yaml",
    "node_modules",
  ]);
  const unexpected = entries
    .map((entry) => entry.name)
    .filter((name) => !allowed.has(name));
  if (unexpected.length) {
    throw new InstallationError(
      "managed install directory contains unrecognized files; manual cleanup required",
      {
        details: { unexpected },
      },
    );
  }
}

export async function uninstall(options = {}) {
  const installDir = resolve(options.installDir ?? defaultInstallDir());
  await assertSafeUninstallTarget(installDir);
  const manifest = await readManifest(installDir);
  const stoppedProcesses = await stopManagedProcesses(installDir);
  const codexConfigPath = resolve(
    options.codexConfig ?? defaultCodexConfigPath(),
  );
  const backupPath = await backupFileIfExists(codexConfigPath);
  if (existsSync(codexConfigPath)) {
    const content = await readFile(codexConfigPath, "utf8");
    const updated = removeCodexServerBlock(content);
    await writeFile(codexConfigPath, updated, "utf8");
  }
  await rm(installDir, { recursive: true, force: true });
  return {
    action: "uninstall",
    removedInstallDir: installDir,
    codex: {
      path: codexConfigPath,
      backupPath,
    },
    stoppedProcesses,
    preserved: {
      tarball: manifest.tarball.path,
    },
  };
}

export function removeCodexServerBlock(content) {
  const analysis = analyzeCodexConfig(content);
  if (!analysis.valid) {
    throw new InstallationError(
      "Codex config is invalid; manual repair required",
      {
        details: { errors: analysis.errors },
      },
    );
  }
  if (analysis.cyberdrawSections.length > 1) {
    throw new InstallationError(
      "Codex config has duplicate CyberDraw entries; manual repair required",
      {
        details: { sections: analysis.cyberdrawSections },
      },
    );
  }
  const cyberdrawLine = analysis.cyberdrawSections[0]?.line;
  if (!cyberdrawLine) return content;

  const lines = content.split(/\r?\n/);
  const output = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (index + 1 !== cyberdrawLine) {
      output.push(lines[index]);
      continue;
    }
    index += 1;
    while (
      index < lines.length &&
      !parseTomlTableHeader(stripTomlInlineComment(lines[index]).trim())
    ) {
      index += 1;
    }
    index -= 1;
  }
  return `${output
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()}\n`;
}

export async function atomicReplaceDir(sourceDir, targetDir) {
  const backupDir = `${targetDir}.previous-${Date.now()}`;
  if (existsSync(targetDir)) {
    await rename(targetDir, backupDir);
  }
  try {
    await rename(sourceDir, targetDir);
    await rm(backupDir, { recursive: true, force: true });
  } catch (error) {
    if (existsSync(backupDir) && !existsSync(targetDir)) {
      await rename(backupDir, targetDir);
    }
    throw error;
  }
}

export function usage() {
  return `Usage:
  node scripts/installation/macos-installer.mjs install --tarball <path> [options]
  node scripts/installation/macos-installer.mjs check [options]
  node scripts/installation/macos-installer.mjs doctor [options]
  node scripts/installation/macos-installer.mjs upgrade --tarball <path> [options]
  node scripts/installation/macos-installer.mjs uninstall [options]

Options:
  --install-dir <path>
  --codex-config <path>
  --expected-sha256 <hex>
  --expected-sha512 <hex>
  --profile localhost|lan
  --host <host>
  --http-port <number>
  --websocket-port <number>
  --lan-confirm
  --yes
`;
}

export async function dispatch(argv) {
  const parsed = parseArgs(argv);
  const command = parsed._[0];
  if (!command || command === "help" || parsed.help) {
    return { help: usage() };
  }
  if (command === "install") return install(parsed);
  if (command === "upgrade") return upgrade(parsed);
  if (command === "check" || command === "doctor") {
    return doctor({
      installDir: parsed.installDir,
      codexConfigPath: parsed.codexConfig,
    });
  }
  if (command === "uninstall") return uninstall(parsed);
  throw new InstallationError(`unknown command: ${command}`);
}
