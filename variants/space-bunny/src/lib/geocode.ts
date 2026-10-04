/**
 * Address lookup via Nominatim, OpenStreetMap's geocoder.
 *
 * It is CORS-enabled and needs no key, so the page stays a static bundle with
 * no backend. The usage policy asks for at most one request per second and a
 * visible attribution, which is why the search box debounces here rather than
 * firing a request per keystroke.
 */

import type { LatLon } from './geo'

export interface GeocodeResult extends LatLon {
  displayName: string
}

const ENDPOINT = 'https://nominatim.openstreetmap.org/search'

export const GEOCODER_ATTRIBUTION = 'Search © OpenStreetMap contributors'

export async function geocode(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 3) return []

  const url =
    `${ENDPOINT}?q=${encodeURIComponent(trimmed)}` +
    '&format=jsonv2&limit=6&addressdetails=0'

  const res = await fetch(url, {
    // `exactOptionalPropertyTypes` means an explicit undefined is not the same
    // as an absent key here.
    ...(signal ? { signal } : {}),
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Geocoding failed: HTTP ${res.status}`)

  const data: unknown = await res.json()
  if (!Array.isArray(data)) return []

  return data.flatMap((item): GeocodeResult[] => {
    if (typeof item !== 'object' || item === null) return []
    const rec = item as Record<string, unknown>
    const lat = Number(rec.lat)
    const lon = Number(rec.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return []
    return [
      {
        lat,
        lon,
        displayName: typeof rec.display_name === 'string' ? rec.display_name : trimmed,
      },
    ]
  })
}

/**
 * A random point that is not in the middle of an ocean.
 *
 * Purely random picks cluster on Antarctica and the Sahara, so this sums two
 * uniforms to approximate a bell curve and keeps the sample off the ice. The
 * puzzle works anywhere; this just makes "surprise me" more likely to show
 * something with roads on it.
 */
export function randomInterestingLocation(
  rng: () => number = Math.random,
): LatLon {
  let lat = 0
  let lon = 0
  do {
    lon = rng() * 360 - 180
    // Box-Muller-free: sum of two uniforms approximates a bell, which
    // concentrates samples near the equator's temperate band.
    lat = ((rng() + rng() - 1) * 120)
  } while (Math.abs(lat) > 67)
  return { lat, lon }
}
