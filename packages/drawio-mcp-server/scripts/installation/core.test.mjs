import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import {
  CONTRACT_VERSION,
  DEFAULTS,
  INSTALL_STATUS,
  analyzeCodexConfig,
  createManifest,
  doctor,
  findManagedProcesses,
  hashTarball,
  readManifest,
  removeCodexServerBlock,
  resolveProfile,
  install,
  upgrade,
  uninstall,
  upsertCodexServerBlock,
  validateTarball,
  writeCodexConfig,
  writeManifest,
} from "./core.mjs";

async function withTempDir(fn) {
  const root = await mkdtemp(join(tmpdir(), "cyberdraw-installer-test-"));
  try {
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
    ...options,
  });
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`,
  );
  return result;
}

async function makeTarball(root, packageJson, options = {}) {
  const packageDir = join(root, "package");
  await mkdir(join(packageDir, "build"), { recursive: true });
  await writeFile(
    join(packageDir, "package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`,
  );
  await writeFile(join(packageDir, "LICENSE.md"), "fixture license\n");
  await writeFile(
    join(packageDir, "THIRD_PARTY_NOTICES.md"),
    "fixture notices\n",
  );
  const executable = join(packageDir, "build", "index.js");
  await writeFile(executable, fakeMcpServerSource(options));
  await chmod(executable, 0o755);
  const tarball = join(
    root,
    `${packageJson.name ?? "package"}-${packageJson.version ?? "0.0.0"}.tgz`,
  );
  run("tar", ["-czf", tarball, "-C", root, "package"]);
  return tarball;
}

function fakeMcpServerSource({ includeRequiredTools = true } = {}) {
  const tools = includeRequiredTools
    ? [
        { name: "cyberdraw_create_diagram" },
        { name: "cyberdraw_analyze_structure" },
        { name: "list-pages" },
      ]
    : [{ name: "list-pages" }];
  return `#!/usr/bin/env node
import readline from "node:readline";
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const msg = JSON.parse(line);
  if (msg.method === "initialize") {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "fake", version: "0.0.0" } } }) + "\\n");
  }
  if (msg.method === "tools/list") {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { tools: ${JSON.stringify(tools)} } }) + "\\n");
  }
});
`;
}

async function makeTarballWithEntries(root, setup) {
  const content = join(root, "content");
  await mkdir(content, { recursive: true });
  await setup(content);
  const tarball = join(root, "malicious.tgz");
  run("tar", ["-czf", tarball, "-C", content, "."]);
  return tarball;
}

function validPackageJson(overrides = {}) {
  return {
    name: "drawio-mcp-server",
    version: "2.2.0",
    type: "module",
    bin: {
      "drawio-mcp-server": "build/index.js",
    },
    engines: {
      node: ">=22.0.0",
    },
    dependencies: {
      hono: "4.12.31",
    },
    ...overrides,
  };
}

describe("M22 installation contract", () => {
  it("validates a correct self-contained tarball", async () =>
    withTempDir(async (root) => {
      const tarball = await makeTarball(root, validPackageJson());
      const hashes = await hashTarball(tarball);
      const result = await validateTarball(tarball, {
        expectedSha256: hashes.sha256,
        expectedSha512: hashes.sha512,
      });

      assert.equal(result.packageJson.name, "drawio-mcp-server");
      assert.equal(result.packageJson.version, "2.2.0");
      assert.equal(result.hashes.sha256, hashes.sha256);
      assert.equal(result.hashes.sha512, hashes.sha512);
    }));

  it("rejects workspace ranges", async () =>
    withTempDir(async (root) => {
      const tarball = await makeTarball(
        root,
        validPackageJson({
          dependencies: {
            hono: "workspace:*",
          },
        }),
      );

      await assert.rejects(validateTarball(tarball), /workspace:\*/);
    }));

  it("rejects private cyberdraw runtime dependencies", async () =>
    withTempDir(async (root) => {
      const tarball = await makeTarball(
        root,
        validPackageJson({
          dependencies: {
            "cyberdraw-runtime-contract": "0.0.0",
          },
        }),
      );

      await assert.rejects(
        validateTarball(tarball),
        /private runtime dependency leaked/,
      );
    }));

  it("rejects the known cyberdraw-graph-model@0.0.0 failure mode", async () =>
    withTempDir(async (root) => {
      const tarball = await makeTarball(
        root,
        validPackageJson({
          dependencies: {
            "cyberdraw-graph-model": "0.0.0",
          },
        }),
      );

      await assert.rejects(validateTarball(tarball), /cyberdraw-graph-model/);
    }));

  it("rejects an unexpected package name", async () =>
    withTempDir(async (root) => {
      const tarball = await makeTarball(
        root,
        validPackageJson({ name: "not-cyberdraw" }),
      );

      await assert.rejects(validateTarball(tarball), /unexpected package name/);
    }));

  it("rejects checksum mismatches", async () =>
    withTempDir(async (root) => {
      const tarball = await makeTarball(root, validPackageJson());

      await assert.rejects(
        validateTarball(tarball, { expectedSha256: "0".repeat(64) }),
        /SHA-256 mismatch/,
      );
      await assert.rejects(
        validateTarball(tarball, { expectedSha512: "0".repeat(128) }),
        /SHA-512 mismatch/,
      );
    }));

  it("rejects path traversal entries before package metadata inspection", async () =>
    withTempDir(async (root) => {
      const source = join(root, "source");
      await mkdir(source, { recursive: true });
      await writeFile(join(source, "escape"), "x");
      const tarball = join(root, "traversal.tgz");
      run("tar", [
        "-czf",
        tarball,
        "-C",
        source,
        "--transform",
        "s#escape#../escape#",
        "escape",
      ]);

      await assert.rejects(
        validateTarball(tarball),
        /path traversal|outside package/,
      );
    }));

  it("rejects absolute tarball entries", async () =>
    withTempDir(async (root) => {
      const source = join(root, "absolute");
      await writeFile(source, "x");
      const tarball = join(root, "absolute.tgz");
      run("tar", [
        "-P",
        "-czf",
        tarball,
        "--transform",
        `s#${source}#/tmp/cyberdraw-escape#`,
        source,
      ]);

      await assert.rejects(
        validateTarball(tarball),
        /absolute path|outside package/,
      );
    }));

  it("rejects symlink entries", async () =>
    withTempDir(async (root) => {
      const tarball = await makeTarballWithEntries(root, async (content) => {
        await mkdir(join(content, "package"), { recursive: true });
        await writeFile(
          join(content, "package", "package.json"),
          JSON.stringify(validPackageJson()),
        );
        await symlink("/tmp", join(content, "package", "escape"));
      });

      await assert.rejects(validateTarball(tarball), /links or non-regular/);
    }));

  it("rejects missing package.json", async () =>
    withTempDir(async (root) => {
      const tarball = await makeTarballWithEntries(root, async (content) => {
        await mkdir(join(content, "package", "build"), { recursive: true });
        await writeFile(join(content, "package", "build", "index.js"), "");
      });

      await assert.rejects(
        validateTarball(tarball),
        /package\.json is missing/,
      );
    }));

  it("rejects duplicate package.json entries", async () =>
    withTempDir(async (root) => {
      const source = join(root, "source");
      const extra = join(root, "extra");
      await mkdir(join(source, "package"), { recursive: true });
      await mkdir(join(extra, "package", "nested"), { recursive: true });
      await writeFile(
        join(source, "package", "package.json"),
        JSON.stringify(validPackageJson()),
      );
      await writeFile(join(extra, "package", "nested", "package.json"), "{}");
      const tarball = join(root, "duplicate.tgz");
      run("tar", ["-cf", join(root, "duplicate.tar"), "-C", source, "package"]);
      run("tar", [
        "-rf",
        join(root, "duplicate.tar"),
        "-C",
        extra,
        "package/nested/package.json",
      ]);
      const gzip = spawnSync("gzip", ["-c", join(root, "duplicate.tar")], {
        encoding: "buffer",
      });
      assert.equal(gzip.status, 0);
      await writeFile(tarball, gzip.stdout);

      await assert.rejects(validateTarball(tarball), /ambiguous package\.json/);
    }));

  it("rejects entries outside package layout", async () =>
    withTempDir(async (root) => {
      const tarball = await makeTarballWithEntries(root, async (content) => {
        await writeFile(join(content, "outside.txt"), "x");
      });

      await assert.rejects(validateTarball(tarball), /outside package/);
    }));

  it("generates a versioned installation manifest", async () =>
    withTempDir(async (root) => {
      const tarball = await makeTarball(root, validPackageJson());
      const validation = await validateTarball(tarball);
      const profile = resolveProfile();
      const manifest = createManifest({
        installDir: join(root, "install"),
        tarballPath: tarball,
        packageJson: validation.packageJson,
        hashes: validation.hashes,
        profile,
        createdAt: "2026-07-31T00:00:00.000Z",
      });

      assert.equal(manifest.contractVersion, CONTRACT_VERSION);
      assert.equal(manifest.packageName, "drawio-mcp-server");
      assert.equal(manifest.profile.name, "localhost");
      assert.equal(manifest.profile.host, "127.0.0.1");
      assert.equal(manifest.profile.httpPort, DEFAULTS.httpPort);
      assert.equal(manifest.profile.websocketPort, DEFAULTS.websocketPort);
    }));

  it("preserves existing Codex config while adding CyberDraw", async () =>
    withTempDir(async (root) => {
      const config = join(root, "config.toml");
      await writeFile(
        config,
        '[mcp_servers.other]\ncommand = "other"\nargs = ["--ok"]\n',
      );
      const manifest = createManifest({
        installDir: join(root, "install"),
        tarballPath: join(root, "drawio-mcp-server-2.2.0.tgz"),
        packageJson: validPackageJson(),
        hashes: { sha256: "a".repeat(64), sha512: "b".repeat(128) },
        profile: resolveProfile(),
        createdAt: "2026-07-31T00:00:00.000Z",
      });

      const result = await writeCodexConfig(config, manifest);
      const content = await readFile(config, "utf8");

      assert.ok(result.backupPath);
      assert.match(content, /\[mcp_servers\.other\]/);
      assert.match(content, /\[mcp_servers\.cyberdraw\]/);
      assert.match(content, /drawio-mcp-server/);
    }));

  it("handles empty and missing Codex config safely", async () =>
    withTempDir(async (root) => {
      const manifest = createManifest({
        installDir: join(root, "install"),
        tarballPath: join(root, "drawio-mcp-server-2.2.0.tgz"),
        packageJson: validPackageJson(),
        hashes: { sha256: "a".repeat(64), sha512: "b".repeat(128) },
        profile: resolveProfile(),
        createdAt: "2026-07-31T00:00:00.000Z",
      });
      const emptyConfig = join(root, "empty.toml");
      await writeFile(emptyConfig, "");
      await writeCodexConfig(emptyConfig, manifest);
      assert.match(
        await readFile(emptyConfig, "utf8"),
        /\[mcp_servers\.cyberdraw\]/,
      );

      const missingConfig = join(root, "missing", "config.toml");
      await writeCodexConfig(missingConfig, manifest);
      assert.match(
        await readFile(missingConfig, "utf8"),
        /\[mcp_servers\.cyberdraw\]/,
      );
    }));

  it("preserves comments, special strings and similar sections", () => {
    const manifest = createManifest({
      installDir: "/tmp/cyber draw",
      tarballPath: "/tmp/drawio-mcp-server-2.2.0.tgz",
      packageJson: validPackageJson(),
      hashes: { sha256: "a".repeat(64), sha512: "b".repeat(128) },
      profile: resolveProfile(),
      createdAt: "2026-07-31T00:00:00.000Z",
    });
    const next = upsertCodexServerBlock(
      '# keep me\n[mcp_servers.cyberdraw_local]\ncommand = "quoted value"\n',
      manifest,
    );

    assert.match(next, /# keep me/);
    assert.match(next, /\[mcp_servers\.cyberdraw_local\]/);
    assert.match(next, /\[mcp_servers\.cyberdraw\]/);
    assert.match(next, /cyber draw/);
  });

  it("rejects invalid or ambiguous Codex config without changing the original", async () =>
    withTempDir(async (root) => {
      assert.equal(analyzeCodexConfig("[broken\n").valid, false);
      const config = join(root, "config.toml");
      const original =
        '[mcp_servers.cyberdraw]\ncommand = "a"\n\n[mcp_servers.cyberdraw]\ncommand = "b"\n';
      await writeFile(config, original);
      const manifest = createManifest({
        installDir: join(root, "install"),
        tarballPath: join(root, "drawio-mcp-server-2.2.0.tgz"),
        packageJson: validPackageJson(),
        hashes: { sha256: "a".repeat(64), sha512: "b".repeat(128) },
        profile: resolveProfile(),
        createdAt: "2026-07-31T00:00:00.000Z",
      });

      await assert.rejects(
        writeCodexConfig(config, manifest),
        /duplicate CyberDraw/,
      );
      assert.equal(await readFile(config, "utf8"), original);
    }));

  it("updates only the CyberDraw Codex entry", () => {
    const manifest = createManifest({
      installDir: "/tmp/cyberdraw",
      tarballPath: "/tmp/drawio-mcp-server-2.2.0.tgz",
      packageJson: validPackageJson(),
      hashes: { sha256: "a".repeat(64), sha512: "b".repeat(128) },
      profile: resolveProfile(),
      createdAt: "2026-07-31T00:00:00.000Z",
    });
    const content = [
      "[mcp_servers.other]",
      'command = "other"',
      "",
      "[mcp_servers.cyberdraw]",
      'command = "old"',
      'args = ["old"]',
      "",
      "[profiles.default]",
      'model = "test"',
      "",
    ].join("\n");

    const next = upsertCodexServerBlock(content, manifest);

    assert.match(next, /\[mcp_servers\.other\]/);
    assert.match(next, /\[profiles\.default\]/);
    assert.doesNotMatch(next, /command = "old"/);
    assert.match(next, /--host","127\.0\.0\.1/);
  });

  it("uses localhost by default and requires explicit opt-in for LAN", () => {
    assert.equal(resolveProfile().host, "127.0.0.1");
    assert.throws(
      () => resolveProfile({ profile: "lan" }),
      /LAN profile requires/,
    );

    const lan = resolveProfile({ profile: "lan", lanConfirm: true });
    assert.equal(lan.host, "0.0.0.0");
    assert.equal(lan.lan, true);
  });

  it("uninstall removes only the managed installation and CyberDraw Codex entry", async () =>
    withTempDir(async (root) => {
      const installDir = join(root, "install");
      const outside = join(root, "outside.txt");
      const codexConfig = join(root, "config.toml");
      await mkdir(installDir, { recursive: true });
      await writeFile(outside, "do not delete");
      const manifest = createManifest({
        installDir,
        tarballPath: join(root, "drawio-mcp-server-2.2.0.tgz"),
        packageJson: validPackageJson(),
        hashes: { sha256: "a".repeat(64), sha512: "b".repeat(128) },
        profile: resolveProfile(),
        createdAt: "2026-07-31T00:00:00.000Z",
      });
      await writeManifest(installDir, manifest);
      await writeFile(
        codexConfig,
        '[mcp_servers.other]\ncommand = "other"\n\n[mcp_servers.cyberdraw]\ncommand = "old"\n',
      );

      await uninstall({ installDir, codexConfig });

      assert.equal(existsSync(installDir), false);
      assert.equal(existsSync(outside), true);
      const config = await readFile(codexConfig, "utf8");
      assert.match(config, /\[mcp_servers\.other\]/);
      assert.doesNotMatch(config, /\[mcp_servers\.cyberdraw\]/);
    }));

  it("doctor reports structured statuses and does not start server processes", async () =>
    withTempDir(async (root) => {
      const installDir = join(root, "install");
      await mkdir(join(installDir, "node_modules", ".bin"), {
        recursive: true,
      });
      const manifest = createManifest({
        installDir,
        tarballPath: join(root, "drawio-mcp-server-2.2.0.tgz"),
        packageJson: validPackageJson(),
        hashes: { sha256: "a".repeat(64), sha512: "b".repeat(128) },
        profile: resolveProfile(),
        createdAt: "2026-07-31T00:00:00.000Z",
      });
      await writeManifest(installDir, manifest);

      const result = await doctor({
        installDir,
        codexConfigPath: join(root, "missing-config.toml"),
      });

      const cleanup = result.checks.find(
        (check) => check.name === "process-cleanup",
      );
      const residual = result.checks.find(
        (check) => check.name === "residual-processes",
      );
      const handshake = result.checks.find(
        (check) => check.name === "mcp-handshake",
      );
      const toolsList = result.checks.find(
        (check) => check.name === "tools-list",
      );
      assert.equal(cleanup.status, INSTALL_STATUS.PASS);
      assert.equal(residual.status, INSTALL_STATUS.PASS);
      assert.equal(handshake.status, INSTALL_STATUS.NOT_CHECKED);
      assert.equal(toolsList.status, INSTALL_STATUS.NOT_CHECKED);
    }));

  it("detects only managed residual processes for the install directory", () => {
    const fakeRunner = () => ({
      stdout: [
        "100 /tmp/cyberdraw/install/node_modules/.bin/drawio-mcp-server --editor",
        "101 /usr/bin/drawio-mcp-server --editor",
        "102 /tmp/cyberdraw/install/node_modules/.bin/other",
      ].join("\n"),
    });

    const processes = findManagedProcesses(
      "/tmp/cyberdraw/install",
      fakeRunner,
    );

    assert.equal(processes.length, 1);
    assert.equal(processes[0].pid, 100);
  });

  it("installs a local fixture tarball without touching the real Codex config", async () =>
    withTempDir(async (root) => {
      const tarball = await makeTarball(
        root,
        validPackageJson({
          dependencies: {},
        }),
      );
      const installDir = join(root, "install");
      const codexConfig = join(root, "codex", "config.toml");

      const result = await install({
        tarball,
        installDir,
        codexConfig,
        yes: true,
      });

      assert.equal(result.manifest.packageName, "drawio-mcp-server");
      assert.equal(
        existsSync(join(installDir, "cyberdraw-installation.json")),
        true,
      );
      assert.equal(
        existsSync(
          join(installDir, "node_modules", ".bin", "drawio-mcp-server"),
        ),
        true,
      );
      const config = await readFile(codexConfig, "utf8");
      assert.match(config, /\[mcp_servers\.cyberdraw\]/);
      assert.doesNotMatch(config, new RegExp(`${process.env.HOME}/\\\\.codex`));
      const handshake = result.doctor.checks.find(
        (check) => check.name === "mcp-handshake",
      );
      const toolsList = result.doctor.checks.find(
        (check) => check.name === "tools-list",
      );
      assert.equal(handshake.status, INSTALL_STATUS.PASS);
      assert.equal(toolsList.status, INSTALL_STATUS.PASS);
      assert.match(toolsList.message, /^3 tools discovered$/);
    }));

  it("upgrade preserves profile and writes a manifest backup", async () =>
    withTempDir(async (root) => {
      const tarball = await makeTarball(
        root,
        validPackageJson({
          dependencies: {},
          version: "2.2.1",
        }),
      );
      const installDir = join(root, "install");
      await mkdir(installDir, { recursive: true });
      const previous = createManifest({
        installDir,
        tarballPath: join(root, "old.tgz"),
        packageJson: validPackageJson({ version: "2.2.0" }),
        hashes: { sha256: "a".repeat(64), sha512: "b".repeat(128) },
        profile: resolveProfile({ profile: "lan", lanConfirm: true }),
        httpPort: 4000,
        websocketPort: 4444,
        createdAt: "2026-07-31T00:00:00.000Z",
      });
      await writeManifest(installDir, previous);

      const result = await upgrade({
        tarball,
        installDir,
        codexConfig: join(root, "codex", "config.toml"),
      });

      assert.equal(result.manifest.profile.name, "lan");
      assert.equal(result.manifest.profile.httpPort, 4000);
      assert.equal(result.manifest.profile.websocketPort, 4444);
      assert.equal(existsSync(result.previousManifestBackupPath), true);
    }));

  it("does not alter installation or config when upgrade validation fails", async () =>
    withTempDir(async (root) => {
      const installDir = join(root, "install");
      const config = join(root, "config.toml");
      await mkdir(installDir, { recursive: true });
      const previous = createManifest({
        installDir,
        tarballPath: join(root, "old.tgz"),
        packageJson: validPackageJson({ version: "2.2.0" }),
        hashes: { sha256: "a".repeat(64), sha512: "b".repeat(128) },
        profile: resolveProfile(),
        createdAt: "2026-07-31T00:00:00.000Z",
      });
      await writeManifest(installDir, previous);
      await writeFile(config, '[mcp_servers.other]\ncommand = "other"\n');
      const badTarball = await makeTarball(
        root,
        validPackageJson({ name: "bad" }),
      );

      await assert.rejects(
        upgrade({ tarball: badTarball, installDir, codexConfig: config }),
        /unexpected package name/,
      );
      assert.equal((await readManifest(installDir)).packageVersion, "2.2.0");
      assert.equal(
        await readFile(config, "utf8"),
        '[mcp_servers.other]\ncommand = "other"\n',
      );
    }));

  it("restores previous installation when post-upgrade doctor fails", async () =>
    withTempDir(async (root) => {
      const tarball = await makeTarball(
        root,
        validPackageJson({
          dependencies: {},
          version: "2.2.1",
        }),
        { includeRequiredTools: false },
      );
      const installDir = join(root, "install");
      await mkdir(installDir, { recursive: true });
      const previous = createManifest({
        installDir,
        tarballPath: join(root, "old.tgz"),
        packageJson: validPackageJson({ version: "2.2.0" }),
        hashes: { sha256: "a".repeat(64), sha512: "b".repeat(128) },
        profile: resolveProfile(),
        createdAt: "2026-07-31T00:00:00.000Z",
      });
      await writeManifest(installDir, previous);
      await writeFile(join(installDir, "package.json"), "{}");
      const config = join(root, "config.toml");

      await assert.rejects(
        upgrade({ tarball, installDir, codexConfig: config }),
        /upgrade doctor failed/,
      );
      assert.equal((await readManifest(installDir)).packageVersion, "2.2.0");
    }));

  it("refuses unsafe uninstall targets and unrecognized managed content", async () =>
    withTempDir(async (root) => {
      await assert.rejects(
        uninstall({ installDir: process.cwd() }),
        /current working directory/,
      );
      await assert.rejects(
        uninstall({ installDir: root }),
        /without a valid managed manifest/,
      );
      const installDir = join(root, "install");
      await mkdir(installDir, { recursive: true });
      const manifest = createManifest({
        installDir,
        tarballPath: join(root, "drawio-mcp-server-2.2.0.tgz"),
        packageJson: validPackageJson(),
        hashes: { sha256: "a".repeat(64), sha512: "b".repeat(128) },
        profile: resolveProfile(),
        createdAt: "2026-07-31T00:00:00.000Z",
      });
      await writeManifest(installDir, manifest);
      await writeFile(join(installDir, "user-file.txt"), "do not delete");

      await assert.rejects(uninstall({ installDir }), /unrecognized files/);
      assert.equal(existsSync(join(installDir, "user-file.txt")), true);
    }));

  it("removes only the CyberDraw Codex block", () => {
    const result = removeCodexServerBlock(
      '[mcp_servers.first]\ncommand = "first"\n\n[mcp_servers.cyberdraw]\ncommand = "old"\n\n[mcp_servers.last]\ncommand = "last"\n',
    );

    assert.match(result, /\[mcp_servers\.first\]/);
    assert.match(result, /\[mcp_servers\.last\]/);
    assert.doesNotMatch(result, /\[mcp_servers\.cyberdraw\]/);
  });
});
