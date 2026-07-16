import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CORE_FILES = [
  "normalize.ts",
  "queries.ts",
  "validation.ts",
  "serialize.ts",
  "types.ts",
];

describe("core architecture boundary", () => {
  it("keeps core modules independent from the legacy adapter", () => {
    for (const file of CORE_FILES) {
      const source = readFileSync(join(process.cwd(), "src", file), "utf8");
      expect(source).not.toContain("legacy-adapter");
      expect(source).not.toContain("LegacyPagedModel");
      expect(source).not.toContain("legacy-paged-model");
    }
  });
});
