import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DRAWIO_ASSET_PROVENANCE,
  downloadAndExtractAssets,
  getLatestWarUrl,
  hashFile,
  verifyDrawioWarChecksum,
} from "./downloader.js";

function makeFixture(contents: string): string {
  const root = mkdtempSync(join(tmpdir(), "drawio-war-checksum-"));
  const path = join(root, "draw.war");
  writeFileSync(path, contents);
  return path;
}

const originalFetch = globalThis.fetch;
const logger = {
  log: jest.fn(),
  debug: jest.fn(),
};

function responseBody(contents: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(contents));
      controller.close();
    },
  });
}

describe("draw.io asset downloader provenance", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    logger.log.mockClear();
  });

  it("uses the pinned release URL instead of GitHub latest", async () => {
    await expect(getLatestWarUrl()).resolves.toBe(
      DRAWIO_ASSET_PROVENANCE.warUrl,
    );
    expect(DRAWIO_ASSET_PROVENANCE.warUrl).toContain(
      `/releases/download/${DRAWIO_ASSET_PROVENANCE.releaseTag}/draw.war`,
    );
  });

  it("computes deterministic file hashes", async () => {
    const path = makeFixture("drawio-fixture");
    await expect(hashFile(path, "sha256")).resolves.toBe(
      "f625d2312c7cc52755eb671d748df96f96d222a02330ddee1f3dc96376170eca",
    );
    await expect(hashFile(path, "sha512")).resolves.toBe(
      "79d8f240b958509288e3a16dd0e197f8e5f03953326c3a58a6843cf495a34fc63d302646fd8ffebc3d45ca8802c919197c1f41c979d554d0a0717f3644529e85",
    );
  });

  it("fails closed when the downloaded WAR does not match the pinned checksum", async () => {
    const path = makeFixture("not-the-pinned-war");
    await expect(verifyDrawioWarChecksum(path)).rejects.toThrow(
      /sha256 mismatch/,
    );
  });

  it("removes an invalid downloaded WAR and does not extract before checksum verification", async () => {
    const root = mkdtempSync(join(tmpdir(), "drawio-invalid-download-"));
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      body: responseBody("not-the-pinned-war"),
    })) as unknown as typeof fetch;

    await expect(downloadAndExtractAssets(root, logger)).rejects.toThrow(
      /sha256 mismatch/,
    );

    expect(existsSync(join(root, "draw.war"))).toBe(false);
    expect(existsSync(join(root, "webapp"))).toBe(false);
  });
});
