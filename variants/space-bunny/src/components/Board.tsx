import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isSolved, scramble, solvedCount, turnBy, type RotationState } from '../lib/puzzle'
import { loadPuzzle, OSM, type TileSource } from '../lib/tiles'
import { randomInterestingLocation } from '../lib/geocode'
import type { LatLon } from '../lib/geo'
import { Tile } from './Tile'
import { ScaleBar } from './ScaleBar'
import { LocationBar } from './LocationBar'

const GRID_SIZE = 3
const CELL_CSS_PX = 150
const DEFAULT_CENTRE: LatLon = { lat: 50.0875, lon: 14.4213 } // Prague

type Status = 'loading' | 'ready' | 'error'

export function Board({ source = OSM }: { source?: TileSource }) {
  const [centre, setCentre] = useState<LatLon>(DEFAULT_CENTRE)
  const [metresPerCell, setMetresPerCell] = useState(500)
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ loaded: 0, total: 0 })

  const [cellCanvases, setCellCanvases] = useState<(HTMLCanvasElement | null)[]>([])
  const [rotation, setRotation] = useState<RotationState>([])
  const [moves, setMoves] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [finishedMs, setFinishedMs] = useState<number | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  // Canvas resolution follows the display, so a retina screen gets crisp tiles
  // instead of an upscaled blur, and a 1x screen does not fetch twice the pixels.
  const cellDevicePx = Math.max(1, Math.round(CELL_CSS_PX * (globalThis.devicePixelRatio || 1)))

  const load = useCallback(
    (nextCentre: LatLon, metres: number) => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac

      setStatus('loading')
      setError(null)
      setFinishedMs(null)
      setStartedAt(null)
      setMoves(0)
      setProgress({ loaded: 0, total: 0 })

      loadPuzzle({
        centre: nextCentre,
        metresPerCell: metres,
        gridSize: GRID_SIZE,
        cellDevicePx,
        source,
        signal: ac.signal,
        onProgress: setProgress,
      })
        .then((puzzle) => {
          if (ac.signal.aborted) return
          setCellCanvases(puzzle.cellCanvases)
          setRotation(scramble(GRID_SIZE * GRID_SIZE))
          setStatus('ready')
        })
        .catch((e: unknown) => {
          if (ac.signal.aborted || (e as { name?: string })?.name === 'AbortError') return
          setError(e instanceof Error ? e.message : 'Could not load the map')
          setStatus('error')
        })
    },
    [cellDevicePx, source],
  )

  useEffect(() => {
    load(DEFAULT_CENTRE, 500)
    return () => abortRef.current?.abort()
  }, [load])

  const solved = rotation.length > 0 && isSolved(rotation)
  const remaining = GRID_SIZE * GRID_SIZE - solvedCount(rotation)

  // The clock starts on the first move, not on load: time spent reading the map
  // before touching it is thinking the player would not want charged to them.
  useEffect(() => {
    if (moves === 1 && startedAt === null) setStartedAt(Date.now())
  }, [moves, startedAt])

  useEffect(() => {
    if (solved && startedAt !== null && finishedMs === null) {
      setFinishedMs(Date.now() - startedAt)
    }
  }, [solved, startedAt, finishedMs])

  const rotate = useCallback((index: number, amount: number) => {
    setRotation((r) => turnBy(r, index, amount))
    setMoves((m) => m + 1)
  }, [])

  const pickCentre = useCallback(
    (c: LatLon) => {
      setCentre(c)
      load(c, metresPerCell)
    },
    [load, metresPerCell],
  )

  const pickScale = useCallback(
    (m: number) => {
      setMetresPerCell(m)
      load(centre, m)
    },
    [load, centre],
  )

  const tiles = useMemo(
    () =>
      Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => (
        <Tile
          key={i}
          index={i}
          canvas={cellCanvases[i] ?? null}
          rotation={rotation[i] ?? 0}
          disabled={status !== 'ready'}
          onRotate={rotate}
        />
      )),
    [cellCanvases, rotation, status, rotate],
  )

  return (
    <main className="app">
      <header className="app__header">
        <div className="app__title-row">
          <h1>maptcha</h1>
          <a className="version-link" href="../">Original version ↗</a>
        </div>
        <p className="app__tagline">
          Nine squares of a real map, each turned the wrong way. Put them back.
        </p>
      </header>

      <LocationBar
        centre={centre}
        onPick={pickCentre}
        onSurprise={() => {
          const c = randomInterestingLocation()
          setCentre(c)
          load(c, metresPerCell)
        }}
      />

      <ScaleBar metresPerCell={metresPerCell} onPick={pickScale} />

      <section className="board" aria-label="Map puzzle">
        {status === 'loading' && (
          <div className="board__overlay" role="status" data-testid="loading">
            <div className="board__spinner" aria-hidden="true" />
            <p>
              Loading map tiles… {progress.loaded}/{progress.total || '…'}
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="board__overlay board__overlay--error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => load(centre, metresPerCell)}>
              Try again
            </button>
          </div>
        )}

        <div
          className="board__grid"
          data-testid="board-grid"
          data-status={status}
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_CSS_PX}px)`,
          }}
        >
          {tiles}
        </div>
      </section>

      <footer className="statusbar">
        <span data-testid="moves">
          {moves} move{moves === 1 ? '' : 's'}
        </span>
        <span data-testid="remaining">
          {remaining} square{remaining === 1 ? '' : 's'} out of place
        </span>
        {finishedMs !== null && <span data-testid="result">solved in {(finishedMs / 1000).toFixed(1)}s</span>}
      </footer>

      {solved && (
        <div className="win" role="status" data-testid="win">
          <h2>The map is whole again</h2>
          <p>
            {moves} move{moves === 1 ? '' : 's'}
            {finishedMs !== null && <> in {(finishedMs / 1000).toFixed(1)}s</>}
          </p>
          <button type="button" onClick={() => load(centre, metresPerCell)}>
            Another one
          </button>
        </div>
      )}

      <p className="attribution">
        Map data {source.attribution} · Geocoding © OpenStreetMap contributors
      </p>
    </main>
  )
}

export default Board
