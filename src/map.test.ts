import { expect, it } from "vitest";
import { withoutLabels } from "./map";
it("removes every symbol layer, preserving map geometry and the original style", () => {
  const style = {
    version: 8 as const,
    sources: {},
    layers: [
      { id: "roads", type: "line" as const, source: "map" },
      {
        id: "road-names",
        type: "symbol" as const,
        source: "map",
        layout: { "text-field": "Main Street" },
      },
      { id: "shields", type: "symbol" as const, source: "map" },
      { id: "water", type: "fill" as const, source: "map" },
    ],
  };
  expect(withoutLabels(style).layers.map((layer) => layer.id)).toEqual([
    "roads",
    "water",
  ]);
  expect(style.layers).toHaveLength(4);
});
