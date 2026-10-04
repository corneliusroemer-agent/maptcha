/**
 * Web Mercator projection helpers.
 *
 * Everything here works in "world pixels": at zoom z the whole world is
 * 256 * 2^z pixels square, which is the coordinate system raster tiles live in.
 */

export const TILE_SIZE = 256

/** Earth circumference at the equator, in metres (WGS84). */
export const EQUATOR_METRES = 40075016.686

/** Web Mercator is undefined at the poles; this is the usual cut-off. */
export const MAX_LATITUDE = 85.05112878

export interface LatLon {
  lat: number
  lon: number
}

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v))

export function lonToWorldX(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * TILE_SIZE * 2 ** zoom
}

export function latToWorldY(lat: number, zoom: number): number {
  const s = Math.sin((lat * Math.PI) / 180)
  return (
    (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE_SIZE * 2 ** zoom
  )
}

export function worldXToLon(x: number, zoom: number): number {
  return (x / (TILE_SIZE * 2 ** zoom)) * 360 - 180
}

export function worldYToLat(y: number, zoom: number): number {
  const n = Math.PI * (1 - (2 * y) / (TILE_SIZE * 2 ** zoom))
  return (180 / Math.PI) * Math.atan(Math.sinh(n))
}

/**
 * Ground resolution in metres per world pixel, where a world pixel is one canvas
 * pixel — a 256px raster tile is 256 of them, which is the unit the
 * `lonToWorldX` / `latToWorldY` functions above return.
 *
 * Mercator stretches away from the equator, so this is latitude-dependent: the
 * same zoom covers less ground per pixel at Oslo than at Nairobi.
 */
export function metresPerPixel(lat: number, zoom: number): number {
  return (EQUATOR_METRES * Math.cos((lat * Math.PI) / 180)) / (2 ** zoom * TILE_SIZE)
}

/** Great-circle distance in metres, for labelling the puzzle at a human scale. */
export function haversineMetres(a: LatLon, b: LatLon): number {
  const R = 6371008.8
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Pick the raster zoom to fetch for a requested ground size per cell.
 *
 * A requested distance is a real number but tiles only exist at integer zooms,
 * so we round *up*. That means the tiles carry at least as much detail as the
 * puzzle needs and the crop trims the surplus: the player always gets exactly
 * the metres they asked for, never a blurrier map than that.
 */
export function zoomForCell(
  metresPerCell: number,
  lat: number,
  cellDevicePx: number,
): number {
  const wantRes = metresPerCell / cellDevicePx // screen metres per pixel we need
  const exact = Math.log2(
    (EQUATOR_METRES * Math.cos((lat * Math.PI) / 180)) / (TILE_SIZE * wantRes),
  )
  return clamp(Math.ceil(exact), 1, 19)
}

/** Normalise a longitude into [-180, 180). */
export function wrapLon(lon: number): number {
  // Return an in-range value untouched rather than round-tripping it through the
  // arithmetic, so 14.42 stays 14.42 instead of drifting to 14.41999... — the
  // kind of error that makes a puzzle not line up on a seam.
  if (lon >= -180 && lon < 180) return lon
  return ((((lon + 180) % 360) + 360) % 360) - 180
}

/** Clamp a latitude to the range Web Mercator can actually draw. */
export function clampLat(lat: number): number {
  return clamp(lat, -MAX_LATITUDE, MAX_LATITUDE)
}
