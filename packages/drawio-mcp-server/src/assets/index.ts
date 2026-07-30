export {
  DEFAULT_CACHE_NAME,
  getCacheDir,
  getAssetRoot,
  assetsExist,
  getLocalPluginPath,
  isUsingLocalAssets,
  type AssetConfig,
} from "./manager.js";

export {
  getLatestWarUrl,
  downloadFile,
  hashFile,
  verifyDrawioWarChecksum,
  extractWar,
  cleanupExtractedFiles,
  downloadAndExtractAssets,
  ensureAssets,
  DRAWIO_ASSET_PROVENANCE,
} from "./downloader.js";
