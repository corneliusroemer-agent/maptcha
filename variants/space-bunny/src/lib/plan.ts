/**
 * Turning "a 3x3 puzzle of 100 m squares centred on X" into a concrete list of
 * tiles to download and a list of crops to take out of them.
 *
 * This module is deliberately pure: no canvas, no network, no DOM. Everything
 * here is arithmetic that can be checked in a unit test, which matters because
 * this is the part that silently produces a wrong-looking puzzle.
 */

import {
  clampLat,
  latToWorldY,
  lonToWorldX,
  metresPerPixel,
  TILE_SIZE,
  wrapLon,
  zoomForCell,
  type LatLon,
} from './geo'

export interface TileRef {
  key: string
  z: number
  x: number
  y: number
  /** Where this tile's top-left corner lands on the composited canvas, in px. */
  dx: number
  dy: number
  /** Size on the composited canvas, in px. */
  dw: number
  dh: number
}

export interface CellPlan {
  index: number
  col: number
  row: number
  /** Source rect on the composited canvas: where this cell's unrotated map is. */
  sx: number
  sy: number
  s: number
  /** Geographic centre of the cell, for the "you solved this area" readout. */
  centre: LatLon
}

export interface PuzzlePlan {
  zoom: number
  gridSize: number
  cellDevicePx: number
  metresPerCell: number
  /** Side length of the composited canvas holding the whole solved map, in px. */
  canvasPx: number
  /** Zoom-independent scale from source tile pixels to composited canvas px. */
  scale: number
  centre: LatLon
  /** The solved map's own bounding box in world pixels at `zoom`. */
  originX: number
  originY: number
  tiles: TileRef[]
  cells: CellPlan[]
}

export interface PlanOptions {
  centre: LatLon
  metresPerCell: number
  gridSize?: number
  cellDevicePx: number
  /** Cap on the raster zoom, for tile sources that stop short of zoom 19. */
  maxZoom?: number
}

export function planPuzzle({
  centre,
  metresPerCell,
  gridSize = 3,
  cellDevicePx,
  maxZoom = 19,
}: PlanOptions): PuzzlePlan {
  const lat = clampLat(centre.lat)
  const lon = wrapLon(centre.lon)

  const zoom = Math.min(zoomForCell(metresPerCell, lat, cellDevicePx), maxZoom)

  // Size of one cell in world pixels (which are canvas pixels: 256 per tile).
  // Because the zoom was rounded *up*, this is never smaller than cellDevicePx,
  // so the crop always takes in at least as much detail as it displays.
  const worldPxPerCell = metresPerCell / metresPerPixel(lat, zoom)
  const scale = cellDevicePx / worldPxPerCell
  const canvasPx = gridSize * cellDevicePx

  const centreWorldX = lonToWorldX(lon, zoom)
  const centreWorldY = latToWorldY(lat, zoom)

  // The grid is centred on the requested point, so it hangs half a grid width
  // off the centre in every direction.
  const originX = centreWorldX - (gridSize / 2) * worldPxPerCell
  const originY = centreWorldY - (gridSize / 2) * worldPxPerCell

  const tiles = planTiles({
    zoom,
    originX,
    originY,
    worldPxPerCell,
    gridSize,
    scale,
  })

  const cells: CellPlan[] = []
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const index = row * gridSize + col
      cells.push({
        index,
        col,
        row,
        sx: col * cellDevicePx,
        sy: row * cellDevicePx,
        s: cellDevicePx,
        centre: cellCentre({
          originX,
          originY,
          worldPxPerCell,
          zoom,
          col,
          row,
        }),
      })
    }
  }

  return {
    zoom,
    gridSize,
    cellDevicePx,
    metresPerCell,
    canvasPx,
    scale,
    centre: { lat, lon },
    originX,
    originY,
    tiles,
    cells,
  }
}

interface TilePlanArgs {
  zoom: number
  originX: number
  originY: number
  worldPxPerCell: number
  gridSize: number
  scale: number
}

/**
 * Which raster tiles cover the grid, and where each one is pasted.
 *
 * X wraps around the antimeridian (tile column 2^z-1 is adjacent to column 0);
 * Y does not, and is clamped instead, since there is no map above the pole.
 */
export function planTiles({
  zoom,
  originX,
  originY,
  worldPxPerCell,
  gridSize,
  scale,
}: TilePlanArgs): TileRef[] {
  const span = gridSize * worldPxPerCell
  const maxIndex = 2 ** zoom

  const firstX = Math.floor(originX / TILE_SIZE)
  const lastX = Math.floor((originX + span) / TILE_SIZE)
  const firstY = Math.max(0, Math.floor(originY / TILE_SIZE))
  const lastY = Math.min(maxIndex - 1, Math.floor((originY + span) / TILE_SIZE))

  const tilePx = TILE_SIZE * scale
  const tiles: TileRef[] = []

  for (let ty = firstY; ty <= lastY; ty++) {
    for (let tx = firstX; tx <= lastX; tx++) {
      const wrappedX = ((tx % maxIndex) + maxIndex) % maxIndex
      tiles.push({
        key: `${zoom}/${wrappedX}/${ty}`,
        z: zoom,
        x: wrappedX,
        y: ty,
        dx: (tx * TILE_SIZE - originX) * scale,
        dy: (ty * TILE_SIZE - originY) * scale,
        dw: tilePx,
        dh: tilePx,
      })
    }
  }

  return tiles
}

/** Geographic centre of one cell, for the post-solve readout. */
function cellCentre(args: {
  originX: number
  originY: number
  worldPxPerCell: number
  zoom: number
  col: number
  row: number
}): LatLon {
  const { originX, originY, worldPxPerCell, zoom, col, row } = args
  const cx = originX + (col + 0.5) * worldPxPerCell
  const cy = originY + (row + 0.5) * worldPxPerCell
  const latRad = Math.PI * (1 - (2 * cy) / (TILE_SIZE * 2 ** zoom))
  return {
    lat: (180 / Math.PI) * Math.atan(Math.sinh(latRad)),
    lon: (cx / (TILE_SIZE * 2 ** zoom)) * 360 - 180,
  }
}
