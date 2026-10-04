/**
 * Fetching tiles and turning them into the nine rotated squares of the puzzle.
 *
 * The compositing step is what makes the puzzle honest: the full solved map is
 * drawn once into a single canvas at the exact pixel size of the board, and
 * every cell is then cut out of *that* canvas. So the nine pieces are guaranteed
 * to be nine pieces of one continuous map — they cannot disagree at the seams,
 * which is the whole premise of the game.
 */

import { planPuzzle, type CellPlan, type PuzzlePlan, type TileRef } from './plan'

export interface TileSource {
  name: string
  url: (z: number, x: number, y: number) => string
  attribution: string
  /** Human-readable max zoom; we clamp requests to it. */
  maxZoom: number
}

/**
 * OpenStreetMap's standard raster tiles. Free, no API key, and it sends
 * `access-control-allow-origin: *`, which is what lets this run as a static
 * page with no backend of its own.
 *
 * The OSM tile usage policy covers bulk downloading and heavy use; a player
 * pulling a handful of tiles per puzzle is well inside what it allows, but a
 * hosted deployment that grows traffic should move to its own tile source.
 */
export const OSM: TileSource = {
  name: 'OpenStreetMap',
  url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19,
}

export interface LoadedPuzzle {
  plan: PuzzlePlan
  /** One canvas per cell, already drawn in its unrotated state. */
  cellCanvases: HTMLCanvasElement[]
}

export interface LoadProgress {
  loaded: number
  total: number
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Tile failed to load: ${url}`))
    img.src = url
  })
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++
      const item = items[i]
      if (item === undefined || i >= items.length) return
      results[i] = await fn(item, i)
    }
  })
  await Promise.all(workers)
  return results
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  tile: TileRef,
  img: HTMLImageElement,
): void {
  ctx.drawImage(img, tile.dx, tile.dy, tile.dw, tile.dh)
}

function sliceCell(source: HTMLCanvasElement, cell: CellPlan): HTMLCanvasElement {
  const out = document.createElement('canvas')
  const px = Math.round(cell.s)
  out.width = px
  out.height = px
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  ctx.drawImage(
    source,
    cell.sx,
    cell.sy,
    cell.s,
    cell.s,
    0,
    0,
    cell.s,
    cell.s,
  )
  return out
}

/**
 * Build every cell canvas for a puzzle.
 *
 * `onProgress` reports tile downloads, so the UI can show real progress rather
 * than an indeterminate spinner — the last tile is usually the one that makes
 * the puzzle readable.
 */
export async function loadPuzzle(options: {
  centre: { lat: number; lon: number }
  metresPerCell: number
  gridSize?: number
  cellDevicePx: number
  source?: TileSource
  onProgress?: (p: LoadProgress) => void
  signal?: AbortSignal
}): Promise<LoadedPuzzle> {
  const {
    centre,
    metresPerCell,
    gridSize = 3,
    cellDevicePx,
    source = OSM,
    onProgress,
    signal,
  } = options

  const plan = planPuzzle({
    centre,
    metresPerCell,
    gridSize,
    cellDevicePx,
    maxZoom: source.maxZoom,
  })

  let loadedCount = 0
  const images = await mapWithConcurrency(plan.tiles, 6, async (tile) => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const img = await loadImage(source.url(tile.z, tile.x, tile.y))
    onProgress?.({ loaded: ++loadedCount, total: plan.tiles.length })
    return img
  })

  const composed = document.createElement('canvas')
  composed.width = Math.round(plan.canvasPx)
  composed.height = Math.round(plan.canvasPx)
  const ctx = composed.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')

  plan.tiles.forEach((tile, i) => {
    const img = images[i]
    if (img) drawTile(ctx, tile, img)
  })

  return { plan, cellCanvases: plan.cells.map((c) => sliceCell(composed, c)) }
}
