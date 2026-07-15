import { describe, expect, it, afterEach } from "@jest/globals";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { validateOutputPath, writeExportOutputFile } from "./export-diagram.js";

describe("export-diagram output_path validation", () => {
  const tempDirs: string[] = [];
  const hasMkfifo =
    process.platform !== "win32" &&
    spawnSync("sh", ["-c", "command -v mkfifo"], {
      stdio: "ignore",
    }).status === 0;

  function makeTempDir() {
    const dir = mkdtempSync(join(tmpdir(), "drawio-output-path-"));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      try {
        chmodSync(dir, 0o700);
      } catch {
        // ignore cleanup best effort
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects a relative path", () => {
    expect(() => validateOutputPath("relative/out.xml")).toThrow(
      "output_path must be an absolute path",
    );
  });

  it("rejects a missing parent directory", () => {
    const dir = makeTempDir();
    const outputPath = join(dir, "missing", "out.xml");

    expect(() => validateOutputPath(outputPath)).toThrow(
      "output_path parent directory does not exist:",
    );
  });

  it("rejects a parent path that is not a directory", () => {
    const dir = makeTempDir();
    const parentFile = join(dir, "not-a-directory");
    writeFileSync(parentFile, "file");

    expect(() => validateOutputPath(join(parentFile, "out.xml"))).toThrow(
      "output_path parent is not a directory:",
    );
  });

  it("rejects an existing destination directory", () => {
    const dir = makeTempDir();
    const outputPath = join(dir, "destination-dir");
    mkdirSync(outputPath);

    expect(() => validateOutputPath(outputPath)).toThrow(
      "output_path must not be a directory:",
    );
  });

  it("rejects an existing destination symbolic link", () => {
    const dir = makeTempDir();
    const target = join(dir, "target.xml");
    const outputPath = join(dir, "link.xml");
    writeFileSync(target, "target");
    symlinkSync(target, outputPath);

    expect(() => validateOutputPath(outputPath)).toThrow(
      "output_path must not be a symbolic link:",
    );
  });

  const fifoIt = hasMkfifo ? it : it.skip;

  fifoIt("rejects an existing FIFO destination", () => {
    const dir = makeTempDir();
    const outputPath = join(dir, "destination-fifo");
    const result = spawnSync("mkfifo", [outputPath]);
    expect(result.status).toBe(0);

    expect(() => validateOutputPath(outputPath)).toThrow(
      "output_path must be a regular file when it already exists:",
    );
  });

  it("writes a new regular file", () => {
    const dir = makeTempDir();
    const outputPath = join(dir, "new.xml");

    writeExportOutputFile(outputPath, "<xml />");

    expect(readFileSync(outputPath, "utf-8")).toBe("<xml />");
  });

  it("overwrites an existing regular file", () => {
    const dir = makeTempDir();
    const outputPath = join(dir, "existing.xml");
    writeFileSync(outputPath, "old");

    writeExportOutputFile(outputPath, "new");

    expect(readFileSync(outputPath, "utf-8")).toBe("new");
  });

  const permissionIt =
    process.platform === "win32" || process.getuid?.() === 0 ? it.skip : it;

  permissionIt("propagates permission errors from the filesystem", () => {
    const dir = makeTempDir();
    chmodSync(dir, 0o500);

    expect(() =>
      writeExportOutputFile(join(dir, "denied.xml"), "data"),
    ).toThrow();
  });
});
