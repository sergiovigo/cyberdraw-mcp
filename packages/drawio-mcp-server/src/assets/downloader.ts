import {
  createWriteStream,
  existsSync,
  mkdirSync,
  createReadStream,
  rmSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Extract } from "unzipper";

import type { Logger } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DRAWIO_ASSET_PROVENANCE = {
  version: "31.1.5",
  releaseTag: "v31.1.5",
  releaseUrl: "https://github.com/jgraph/drawio/releases/tag/v31.1.5",
  warAssetName: "draw.war",
  warUrl: "https://github.com/jgraph/drawio/releases/download/v31.1.5/draw.war",
  warSizeBytes: 52730014,
  warSha256: "43b0437762cf25375e233726d6539792584c4bd38176e4eceae5ea4359090278",
  warSha512:
    "56ea7da0efd96f70aca9d0190a87adc5290660c0941291f704bb94c407f7a07f380251a61dcbed77fff25661cd990668724acd7cd21ed0b1a3c16338e3018b38",
} as const;

export async function getLatestWarUrl(): Promise<string> {
  return DRAWIO_ASSET_PROVENANCE.warUrl;
}

export async function downloadFile(
  url: string,
  destPath: string,
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download: ${response.status} ${response.statusText}`,
    );
  }

  if (!response.body) {
    throw new Error("No response body");
  }

  const destDir = dirname(destPath);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  await pipeline(response.body, createWriteStream(destPath));
}

export async function hashFile(
  path: string,
  algorithm: "sha256" | "sha512",
): Promise<string> {
  const hash = createHash(algorithm);
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

export async function verifyDrawioWarChecksum(warPath: string): Promise<void> {
  const [sha256, sha512] = await Promise.all([
    hashFile(warPath, "sha256"),
    hashFile(warPath, "sha512"),
  ]);
  if (sha256 !== DRAWIO_ASSET_PROVENANCE.warSha256) {
    throw new Error(
      `draw.io ${DRAWIO_ASSET_PROVENANCE.releaseTag} draw.war sha256 mismatch: expected ${DRAWIO_ASSET_PROVENANCE.warSha256}, got ${sha256}`,
    );
  }
  if (sha512 !== DRAWIO_ASSET_PROVENANCE.warSha512) {
    throw new Error(
      `draw.io ${DRAWIO_ASSET_PROVENANCE.releaseTag} draw.war sha512 mismatch: expected ${DRAWIO_ASSET_PROVENANCE.warSha512}, got ${sha512}`,
    );
  }
}

export async function extractWar(
  warPath: string,
  extractDir: string,
): Promise<void> {
  if (!existsSync(extractDir)) {
    mkdirSync(extractDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const extract = Extract({ path: extractDir });
    const stream = createReadStream(warPath);

    stream.pipe(extract);

    extract.on("close", resolve);
    extract.on("error", reject);
  });
}

export function cleanupExtractedFiles(extractDir: string, log: Logger): void {
  const webappDir = join(extractDir, "webapp");
  const pathsToRemove = [
    join(webappDir, "WEB-INF"),
    join(webappDir, "META-INF"),
  ];

  for (const path of pathsToRemove) {
    if (existsSync(path)) {
      try {
        rmSync(path, { recursive: true, force: true });
        log.log("info", `Removed: ${path}`);
      } catch (err) {
        log.log("warning", `Failed to remove ${path}:`, err);
      }
    }
  }
}

export async function downloadAndExtractAssets(
  targetDir: string,
  log: Logger,
): Promise<void> {
  const warUrl = await getLatestWarUrl();
  const warPath = join(targetDir, "draw.war");

  log.log(
    "info",
    `Downloading draw.io ${DRAWIO_ASSET_PROVENANCE.releaseTag} draw.war from ${warUrl}...`,
  );
  try {
    await downloadFile(warUrl, warPath);
    log.log("info", "Download complete.");

    log.log("info", "Verifying draw.io asset checksum...");
    await verifyDrawioWarChecksum(warPath);
    log.log("info", "Checksum verified.");
  } catch (error) {
    try {
      rmSync(warPath, { force: true });
    } catch (cleanupError) {
      log.log("warning", "Failed to remove invalid WAR file:", cleanupError);
    }
    throw error;
  }

  const webappDir = join(targetDir, "webapp");

  log.log("info", "Extracting archive...");
  await extractWar(warPath, webappDir);
  log.log("info", "Extraction complete.");

  log.log("info", "Cleaning up unnecessary files...");
  cleanupExtractedFiles(targetDir, log);

  // Remove the WAR file
  try {
    rmSync(warPath, { force: true });
  } catch (err) {
    log.log("warning", "Failed to remove WAR file:", err);
  }

  log.log("info", "Assets ready!");
}

export async function ensureAssets(
  config: {
    readonly assetPath?: string;
  },
  log: Logger,
): Promise<{ readonly assetRoot: string; readonly isLocal: boolean }> {
  const { getCacheDir, getAssetRoot, assetsExist } =
    await import("./manager.js");
  const { ensureSupportedAssets, SERVER_COMPAT_MATRIX } =
    await import("./auto-refresh.js");

  const cacheDir = getCacheDir(config.assetPath);
  const assetRoot = getAssetRoot(config);

  if (!assetsExist(config)) {
    log.log("info", `Assets not found in ${assetRoot}. Downloading...`);
    await downloadAndExtractAssets(cacheDir, log);
  }

  await ensureSupportedAssets(config, SERVER_COMPAT_MATRIX, log, {
    downloadAndExtract: (targetDir) => downloadAndExtractAssets(targetDir, log),
  });

  return { assetRoot, isLocal: true };
}
