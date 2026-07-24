import { describe, expect, it } from "@jest/globals";

import { toolDefinitions } from "./tool-registry.js";

describe("plugin tool registry", () => {
  it("allows internal filename forwarding for import-mermaid without changing the public MCP schema", () => {
    const importMermaid = toolDefinitions.find(
      (tool) => tool.name === "import-mermaid",
    );

    expect(importMermaid).toBeDefined();
    expect(importMermaid?.params.has("filename")).toBe(true);
  });
});
