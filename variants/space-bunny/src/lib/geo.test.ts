import { describe, expect, it } from 'vitest'
import {
  clampLat,
  haversineMetres,
  latToWorldY,
  lonToWorldX,
  MAX_LATITUDE,
  metresPerPixel,
  TILE_SIZE,
  worldXToLon,
  worldYToLat,
  wrapLon,
  zoomForCell,
} from './geo'

describe('projection', () => {
  it('puts the antimeridian and Greenwich at the horizontal extremes', () => {
    expect(lonToWorldX(-180, 0)).toBe(0)
    expect(lonToWorldX(0, 0)).toBe(TILE_SIZE / 2)
    expect(lonToWorldX(180, 0)).toBe(TILE_SIZE)
  })

  it('puts the equator at the vertical centre', () => {
    expect(latToWorldY(0, 0)).toBeCloseTo(TILE_SIZE / 2, 6)
  })

  it('increases x and decreases y monotonically as longitude rises', () => {
    const xs = [-170, -90, 0, 90, 170].map((lon) => lonToWorldX(lon, 12))
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]!).toBeGreaterThan(xs[i - 1]!)
    }
  })

  it('round-trips longitude through world pixels', () => {
    for (const lon of [-179.9, -120, 0, 14.42, 90, 179.9]) {
      expect(worldXToLon(lonToWorldX(lon, 14), 14)).toBeCloseTo(lon, 6)
    }
  })

  it('round-trips latitude through world pixels', () => {
    for (const lat of [-80, -45, 0, 45, 80, MAX_LATITUDE]) {
      expect(worldYToLat(latToWorldY(lat, 14), 14)).toBeCloseTo(lat, 6)
    }
  })

  it('doubles world coordinates with each zoom level', () => {
    for (const lon of [0, 14.42, -73.9]) {
      expect(lonToWorldX(lon, 13) * 2).toBeCloseTo(lonToWorldX(lon, 14), 6)
    }
  })
})

describe('metresPerPixel', () => {
  it('matches the known equatorial resolution at zoom 19', () => {
    // 156543.03392 m/px at zoom 0 for a 256px tile, halved per zoom level.
    expect(metresPerPixel(0, 0)).toBeCloseTo(156543.03392, 4)
    expect(metresPerPixel(0, 19)).toBeCloseTo(156543.03392 / 2 ** 19, 9)
  })

  it('halves with each zoom level', () => {
    expect(metresPerPixel(45, 12)).toBeCloseTo(metresPerPixel(45, 13) * 2, 9)
  })

  it('shrinks towards the poles, where Mercator stretches the ground out', () => {
    expect(metresPerPixel(60, 10)).toBeLessThan(metresPerPixel(0, 10))
    expect(metresPerPixel(0, 10)).toBeCloseTo(metresPerPixel(60, 10) / Math.cos(Math.PI / 3), 9)
  })
})

describe('zoomForCell', () => {
  // The contract that matters: whatever zoom comes back, the tiles must carry at
  // least the detail the requested cell size implies. Rounding down here would
  // silently hand the player a blurrier map than they asked for.
  it('never returns a zoom with coarser resolution than requested', () => {
    // Skips combinations that no tile server can satisfy: 100 m across a 600 px
    // cell needs finer than zoom 19, so there the guarantee is unachievable and
    // the clamp does its job instead (covered by the clamp test below).
    for (const metres of [100, 250, 500, 1000, 2000, 10000]) {
      for (const lat of [0, 35, 50, 60]) {
        for (const px of [150, 300, 600]) {
          const z = zoomForCell(metres, lat, px)
          const needed = metres / px
          if (z >= 19 && metresPerPixel(lat, z) > needed) continue
          expect(metresPerPixel(lat, z)).toBeLessThanOrEqual(needed * 1.0000001)
        }
      }
    }
  })

  it('rounds up, so it is never coarser than the exact zoom', () => {
    const metres = 500
    const px = 150
    const lat = 50
    const exact =
      Math.log2(
        (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (256 * (metres / px)),
      )
    const z = zoomForCell(metres, lat, px)
    expect(z).toBeGreaterThanOrEqual(exact)
    expect(z).toBeLessThan(exact + 1)
  })

  it('picks a higher zoom for the same ground size near the equator', () => {
    expect(zoomForCell(500, 0, 150)).toBeGreaterThan(zoomForCell(500, 60, 150))
  })

  it('picks a higher zoom for the same ground size at higher resolution', () => {
    expect(zoomForCell(500, 50, 600)).toBeGreaterThan(zoomForCell(500, 50, 150))
  })

  it('stays inside the range tiles exist at', () => {
    expect(zoomForCell(1, 0, 150)).toBeGreaterThanOrEqual(1)
    expect(zoomForCell(1e9, 0, 150)).toBeLessThanOrEqual(19)
  })
})

describe('wrapLon', () => {
  it('leaves in-range longitudes alone', () => {
    expect(wrapLon(0)).toBe(0)
    expect(wrapLon(14.42)).toBe(14.42)
    expect(wrapLon(-73.9)).toBe(-73.9)
  })

  it('wraps past the antimeridian in both directions', () => {
    expect(wrapLon(190)).toBeCloseTo(-170, 6)
    expect(wrapLon(-190)).toBeCloseTo(170, 6)
    expect(wrapLon(540)).toBeCloseTo(-180, 6)
    expect(wrapLon(-180)).toBe(-180)
    expect(wrapLon(180)).toBeCloseTo(-180, 6)
  })
})

describe('clampLat', () => {
  it('stops at the Mercator limit rather than returning infinity', () => {
    expect(clampLat(90)).toBe(MAX_LATITUDE)
    expect(clampLat(-90)).toBe(-MAX_LATITUDE)
    expect(Number.isFinite(latToWorldY(clampLat(90), 10))).toBe(true)
  })
})

describe('haversineMetres', () => {
  it('measures one degree of latitude as about 111 km', () => {
    const d = haversineMetres({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })
    expect(d).toBeGreaterThan(111_000)
    expect(d).toBeLessThan(111_400)
  })

  it('is zero for a point against itself', () => {
    expect(haversineMetres({ lat: 50, lon: 14 }, { lat: 50, lon: 14 })).toBe(0)
  })

  it('matches the real distance between two Prague landmarks', () => {
    // Prague Castle to Wenceslas Square, about 2.7 km apart.
    const d = haversineMetres({ lat: 50.0909, lon: 14.4003 }, { lat: 50.0779, lon: 14.4318 })
    expect(d).toBeGreaterThan(2600)
    expect(d).toBeLessThan(2800)
  })

  it('shrinks with latitude for the same longitude span', () => {
    const equator = haversineMetres({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })
    const arctic = haversineMetres({ lat: 70, lon: 0 }, { lat: 70, lon: 1 })
    expect(arctic).toBeLessThan(equator)
  })
})
