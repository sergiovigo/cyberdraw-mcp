import { describe, expect, it } from "@jest/globals";

import {
  provisionalDiagramId,
  provisionalElementId,
  provisionalLayerId,
  provisionalPageId,
} from "./identity.js";

describe("provisional identity policy", () => {
  it("generates deterministic page, layer and element IDs", () => {
    const input = { pageIndex: 0, pageExternalId: "page-a" };
    expect(provisionalDiagramId("doc")).toBe("diagram:drawio:doc");
    expect(provisionalPageId(input)).toBe("page:0:drawio:page-a");
    expect(
      provisionalLayerId({
        ...input,
        layerExternalId: "layer-a",
        appearanceIndex: 1,
      }),
    ).toBe("layer:page:0:drawio:page-a:drawio:layer-a:1");
    expect(
      provisionalElementId({
        ...input,
        elementExternalId: "node-a",
        appearanceIndex: 2,
      }),
    ).toBe("element:page:0:drawio:page-a:drawio:node-a:2");
  });

  it("uses synthetic IDs for missing external IDs", () => {
    expect(provisionalPageId({ pageIndex: 1 })).toBe("page:1:synthetic");
    expect(provisionalElementId({ pageIndex: 1, appearanceIndex: 3 })).toBe(
      "element:page:1:synthetic:synthetic:3",
    );
  });
});
