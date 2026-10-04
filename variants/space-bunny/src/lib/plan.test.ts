import { describe, expect, it } from 'vitest'
import { planPuzzle, planTiles } from './plan'
import { haversineMetres, lonToWorldX, latToWorldY, metresPerPixel, TILE_SIZE } from './geo'

const PRAGUE = { lat: 50.0875, lon: 14.4213 }

describe('planPuzzle', () => {
  it('produces exactly nine cells for the default 3x3 board', () => {
    const plan = planPuzzle({ centre: PRAGUE, metresPerCell: 500, cellDevicePx: 150 })
    expect(plan.cells).toHaveLength(9)
    expect(plan.gridSize).toBe(3)
  })

  it('honours a different grid size', () => {
    const plan = planPuzzle({
      centre: PRAGUE,
      metresPerCell: 500,
      cellDevicePx: 150,
      gridSize: 4,
    })
    expect(plan.cells).toHaveLength(16)
  })

  it('numbers cells row by row, top-left first', () => {
    const plan = planPuzzle({ centre: PRAGUE, metresPerCell: 500, cellDevicePx: 150 })
    expect(plan.cells.map((c) => [c.col, c.row])).toEqual([
      [0, 0], [1, 0], [2, 0],
      [0, 1], [1, 1], [2, 1],
      [0, 2], [1, 2], [2, 2],
    ])
  })

  it('gives every cell a distinct, non-overlapping source rect inside the canvas', () => {
    const plan = planPuzzle({ centre: PRAGUE, metresPerCell: 500, cellDevicePx: 150 })
    const seen = new Set<string>()
    for (const c of plan.cells) {
      expect(c.sx).toBeGreaterThanOrEqual(0)
      expect(c.sy).toBeGreaterThanOrEqual(0)
      expect(c.sx + c.s).toBeLessThanOrEqual(plan.canvasPx + 0.001)
      expect(c.sy + c.s).toBeLessThanOrEqual(plan.canvasPx + 0.001)
      seen.add(`${c.sx},${c.sy}`)
    }
    expect(seen.size).toBe(9)
  })

  it('places the requested point in the middle of the grid', () => {
    const plan = planPuzzle({ centre: PRAGUE, metresPerCell: 500, cellDevicePx: 150 })
    // The centre of the whole board is the middle of the centre cell.
    const centreCell = plan.cells.find((c) => c.col === 1 && c.row === 1)!
    expect(haversineMetres(centreCell.centre, plan.centre)).toBeLessThan(1)
  })

  it('spaces cells exactly metresPerCell apart on the ground', () => {
    // This is the promise the UI makes: "500 m" really is 500 m per square.
    for (const metres of [100, 500, 2000, 10000]) {
      const plan = planPuzzle({ centre: PRAGUE, metresPerCell: metres, cellDevicePx: 150 })
      const a = plan.cells.find((c) => c.col === 0 && c.row === 1)!
      const b = plan.cells.find((c) => c.col === 1 && c.row === 1)!
      const d = haversineMetres(a.centre, b.centre)
      // Mercator makes horizontal spacing latitude-dependent, so allow 2%.
      expect(d).toBeGreaterThan(metres * 0.98)
      expect(d).toBeLessThan(metres * 1.02)
    }
  })

  it('requests enough tiles to cover the whole grid', () => {
    // A 3x3 of 2 km squares is wider than one 256px tile at any sane zoom, so
    // this must pull more than a single tile or the map comes back gappy.
    const plan = planPuzzle({ centre: PRAGUE, metresPerCell: 2000, cellDevicePx: 150 })
    expect(plan.tiles.length).toBeGreaterThan(1)
  })

  it('pulls a single tile when the cells are tiny', () => {
    const plan = planPuzzle({ centre: PRAGUE, metresPerCell: 1, cellDevicePx: 150 })
    expect(plan.tiles.length).toBe(1)
  })

  it('never requests a tile outside the zoom level', () => {
    const plan = planPuzzle({ centre: PRAGUE, metresPerCell: 500, cellDevicePx: 150 })
    const max = 2 ** plan.zoom
    for (const t of plan.tiles) {
      expect(t.x).toBeGreaterThanOrEqual(0)
      expect(t.x).toBeLessThan(max)
      expect(t.y).toBeGreaterThanOrEqual(0)
      expect(t.y).toBeLessThan(max)
      expect(t.z).toBe(plan.zoom)
    }
  })

  it('gives every tile a unique key', () => {
    const plan = planPuzzle({ centre: PRAGUE, metresPerCell: 2000, cellDevicePx: 150 })
    expect(new Set(plan.tiles.map((t) => t.key)).size).toBe(plan.tiles.length)
  })

  it('covers the grid exactly: tile extents span the canvas', () => {
    const plan = planPuzzle({ centre: PRAGUE, metresPerCell: 1000, cellDevicePx: 150 })
    const left = Math.min(...plan.tiles.map((t) => t.dx))
    const top = Math.min(...plan.tiles.map((t) => t.dy))
    const right = Math.max(...plan.tiles.map((t) => t.dx + t.dw))
    const bottom = Math.max(...plan.tiles.map((t) => t.dy + t.dh))
    // Tiles start at or before the grid and reach at or past its far edge.
    expect(left).toBeLessThanOrEqual(0.001)
    expect(top).toBeLessThanOrEqual(0.001)
    expect(right).toBeGreaterThanOrEqual(plan.canvasPx - 0.001)
    expect(bottom).toBeGreaterThanOrEqual(plan.canvasPx - 0.001)
  })

  it('never upscales: the crop always covers at least the pixels it displays', () => {
    // Rounding the zoom up is what guarantees the puzzle never has to invent
    // detail. scale > 1 would mean magnifying a tile beyond its own resolution.
    for (const metres of [100, 500, 2000, 10000]) {
      for (const lat of [0, 50, 60]) {
        const plan = planPuzzle({ centre: { lat, lon: 0 }, metresPerCell: metres, cellDevicePx: 150 })
        expect(plan.scale).toBeLessThanOrEqual(1 + 1e-9)
      }
    }
  })

  it('clamps the zoom to a tile source that stops short', () => {
    const plan = planPuzzle({
      centre: PRAGUE,
      metresPerCell: 100,
      cellDevicePx: 150,
      maxZoom: 12,
    })
    expect(plan.zoom).toBeLessThanOrEqual(12)
  })

  it('normalises a centre given out of range', () => {
    const plan = planPuzzle({ centre: { lat: 95, lon: 200 }, metresPerCell: 500, cellDevicePx: 150 })
    expect(Math.abs(plan.centre.lat)).toBeLessThanOrEqual(85.051129)
    expect(plan.centre.lon).toBeLessThanOrEqual(180)
    expect(Number.isFinite(plan.originY)).toBe(true)
  })

  it('works at the equator and at high latitude', () => {
    for (const centre of [{ lat: 0, lon: 0 }, { lat: 78.9, lon: 15.6 }, { lat: -33.9, lon: 151.2 }]) {
      const plan = planPuzzle({ centre, metresPerCell: 500, cellDevicePx: 150 })
      expect(plan.cells).toHaveLength(9)
      expect(plan.tiles.length).toBeGreaterThan(0)
      expect(plan.tiles.every((t) => Number.isFinite(t.dx) && Number.isFinite(t.dy))).toBe(true)
    }
  })

  it('works across the antimeridian', () => {
    const plan = planPuzzle({ centre: { lat: 0, lon: 179.99 }, metresPerCell: 2000, cellDevicePx: 150 })
    expect(plan.tiles.length).toBeGreaterThan(0)
    // Column 0 sits immediately to the right of the last column.
    const max = 2 ** plan.zoom
    expect(plan.tiles.some((t) => t.x === 0 || t.x === max - 1)).toBe(true)
  })
})

describe('planTiles', () => {
  it('wraps tile columns around the antimeridian', () => {
    const zoom = 4
    const max = 2 ** zoom
    // A grid hanging off the right edge of the world.
    const tiles = planTiles({
      zoom,
      originX: TILE_SIZE * max - 100,
      originY: 0,
      worldPxPerCell: 40,
      gridSize: 3,
      scale: 1,
    })
    expect(tiles.length).toBeGreaterThan(1)
    expect(tiles.every((t) => t.x >= 0 && t.x < max)).toBe(true)
    // The grid straddles the seam: a column past the end of the world is drawn
    // at the far right, and its wrapped column 0 lands just after it.
    const wrapped = tiles.find((t) => t.x === 0)!
    const lastColumn = tiles.find((t) => t.x === max - 1)!
    expect(lastColumn.dx).toBeLessThan(0)
    expect(wrapped.dx).toBeGreaterThan(0)
  })

  it('clamps rows to the top of the world instead of going negative', () => {
    const tiles = planTiles({
      zoom: 4,
      originX: 0,
      originY: -500,
      worldPxPerCell: 100,
      gridSize: 3,
      scale: 1,
    })
    expect(tiles.every((t) => t.y >= 0)).toBe(true)
  })

  it('scales tile destinations to the composited canvas', () => {
    const tiles = planTiles({
      zoom: 2,
      originX: TILE_SIZE * 1.5,
      originY: TILE_SIZE * 1.5,
      worldPxPerCell: 100,
      gridSize: 3,
      scale: 2,
    })
    // Tile column 1 starts half a tile before the grid origin, so at scale 2
    // that is -256 px on the canvas.
    expect(tiles[0]!.dx).toBeCloseTo(-(TILE_SIZE / 2) * 2, 6)
    expect(tiles[0]!.dw).toBeCloseTo(TILE_SIZE * 2, 6)
  })
})

describe('the solved map really is the requested area', () => {
  it('spans 3 x metresPerCell across the finished board', () => {
    for (const metres of [100, 500, 2000]) {
      const plan = planPuzzle({ centre: PRAGUE, metresPerCell: metres, cellDevicePx: 150 })
      const a = plan.cells[0]!.centre // top-left
      const b = plan.cells[2]!.centre // top-right, two cells along the top row
      // Mercator measures along the parallel; the great-circle distance between
      // two points on a parallel is slightly shorter, by ~0.1% at this latitude.
      expect(haversineMetres(a, b)).toBeGreaterThan(2 * metres * 0.995)
      expect(haversineMetres(a, b)).toBeLessThan(2 * metres * 1.005)
    }
  })

  it('keeps the grid centred on the requested point at any cell size', () => {
    for (const metres of [100, 1000, 10000]) {
      const plan = planPuzzle({ centre: PRAGUE, metresPerCell: metres, cellDevicePx: 150 })
      const topLeft = plan.cells[0]!.centre
      const bottomRight = plan.cells[8]!.centre
      const midLat = (topLeft.lat + bottomRight.lat) / 2
      const midLon = (topLeft.lon + bottomRight.lon) / 2
      // Comparing corner midpoints is only approximate under Mercator, so the
      // bound scales with the board rather than being an absolute metre figure.
      expect(haversineMetres({ lat: midLat, lon: midLon }, plan.centre)).toBeLessThan(
        metres * 0.01,
      )
    }
  })

  it('puts the requested point inside the middle square, not merely near it', () => {
    // The middle cell's own centre is the direct statement of intent, and it
    // must hold exactly rather than approximately.
    for (const metres of [100, 500, 10000]) {
      const plan = planPuzzle({ centre: PRAGUE, metresPerCell: metres, cellDevicePx: 150 })
      const middle = plan.cells.find((c) => c.col === 1 && c.row === 1)!
      expect(middle.centre.lat).toBeCloseTo(PRAGUE.lat, 9)
      expect(middle.centre.lon).toBeCloseTo(PRAGUE.lon, 9)
    }
  })

  it('slices the grid out of the world at the planned zoom', () => {
    // The origin is the grid's own top-left corner in world pixels; this checks
    // it against the projection directly rather than against itself.
    const plan = planPuzzle({ centre: PRAGUE, metresPerCell: 500, cellDevicePx: 150 })
    const expectX = lonToWorldX(plan.centre.lon, plan.zoom) - 1.5 * (plan.metresPerCell / metresPerPixel(plan.centre.lat, plan.zoom))
    const expectY = latToWorldY(plan.centre.lat, plan.zoom) - 1.5 * (plan.metresPerCell / metresPerPixel(plan.centre.lat, plan.zoom))
    expect(plan.originX).toBeCloseTo(expectX, 6)
    expect(plan.originY).toBeCloseTo(expectY, 6)
  })
})
