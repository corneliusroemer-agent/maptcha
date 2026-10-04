export type Place = { name: string; lat: number; lon: number };
export const places: Place[] = [
  { name: "Prague · Old Town", lat: 50.0875, lon: 14.4213 },
  { name: "Bern · River bend", lat: 46.9478, lon: 7.4474 },
  { name: "Venice · Canals", lat: 45.4342, lon: 12.3388 },
  { name: "Kyoto · Higashiyama", lat: 35.0032, lon: 135.7785 },
  { name: "New York · Central Park", lat: 40.7712, lon: -73.9742 },
  { name: "Oslo · Islands", lat: 59.8915, lon: 10.7292 },
];
export function coordinate(text: string): Place | null {
  const match = text
    .trim()
    .match(/^([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]),
    lon = Number(match[2]);
  if (Math.abs(lat) > 85 || Math.abs(lon) > 180)
    throw new Error(
      "Use latitude between −85 and 85, and longitude between −180 and 180.",
    );
  return { name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon };
}
export function scramble(random = Math.random): number[] {
  const turns = Array.from({ length: 9 }, () => Math.floor(random() * 4) % 4);
  if (turns.every((t) => t === 0)) return [1, ...turns.slice(1)];
  return turns;
}
export function projection(lat: number, lon: number, metres: number) {
  const cos = Math.cos((lat * Math.PI) / 180);
  const zoom = Math.max(
    0,
    Math.min(19, Math.floor(Math.log2((156543.033928 * cos * 200) / metres))),
  );
  const world = 256 * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    zoom,
    world,
    x: ((lon + 180) / 360) * world,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world,
    span: (metres * 3) / ((156543.033928 * cos) / 2 ** zoom),
  };
}
export function readLocation(): { place: Place; metres: number } {
  const p = new URLSearchParams(location.hash.slice(1));
  try {
    const place = coordinate(`${p.get("lat")},${p.get("lon")}`);
    const metres = Number(p.get("m"));
    if (place && [100, 250, 500, 1000, 2500].includes(metres))
      return { place, metres };
  } catch {
    /* Invalid links open the default puzzle. */
  }
  return { place: places[0], metres: 250 };
}
