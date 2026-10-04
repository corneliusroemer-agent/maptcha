import { describe, expect, it } from "vitest";
import { coordinate, projection, scramble } from "./puzzle";
describe("coordinates", () => {
  it("accepts signed decimal coordinates", () => {
    expect(coordinate(" -33.86, +151.2 ")).toEqual({
      name: "-33.8600, 151.2000",
      lat: -33.86,
      lon: 151.2,
    });
  });
  it("leaves addresses to the geocoder", () => {
    expect(coordinate("Prague")).toBeNull();
    expect(coordinate("")).toBeNull();
  });
  it("rejects unsupported latitude and longitude", () => {
    expect(() => coordinate("86, 10")).toThrow();
    expect(() => coordinate("50, 181")).toThrow();
  });
});
describe("puzzle", () => {
  it("never starts solved, even if random returns zero", () => {
    expect(scramble(() => 0)).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0]);
  });
  it("has nine quarter turns", () => {
    for (let n = 0; n < 100; n++) {
      const t = scramble();
      expect(t).toHaveLength(9);
      expect(t.every((v) => [0, 1, 2, 3].includes(v))).toBe(true);
      expect(t.some((v) => v !== 0)).toBe(true);
    }
  });
});
describe("metre-based crop", () => {
  it("centres on Greenwich at the equator", () => {
    const p = projection(0, 0, 250);
    expect(p.x).toBe(p.world / 2);
    expect(p.y).toBe(p.world / 2);
  });
  it("covers exactly three squares at varying latitudes and scales", () => {
    for (const lat of [-85, -33, 0, 50, 85])
      for (const m of [100, 250, 500, 1000, 2500]) {
        const p = projection(lat, 179.99, m);
        const resolution =
          (156543.033928 * Math.cos((lat * Math.PI) / 180)) / 2 ** p.zoom;
        expect(p.span * resolution).toBeCloseTo(m * 3, 6);
        expect(p.span).toBeLessThanOrEqual(1200);
        expect(p.zoom).toBeGreaterThanOrEqual(0);
        expect(p.zoom).toBeLessThanOrEqual(19);
      }
  });
});
