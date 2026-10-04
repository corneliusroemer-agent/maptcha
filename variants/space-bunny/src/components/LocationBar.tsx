import { useEffect, useState } from 'react'
import { geocode, type GeocodeResult } from '../lib/geocode'
import type { LatLon } from '../lib/geo'

interface Props {
  centre: LatLon
  onPick: (c: LatLon) => void
  onSurprise: () => void
}

export function LocationBar({ centre, onPick, onSurprise }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [busy, setBusy] = useState(false)
  const [coordText, setCoordText] = useState('')
  const [coordError, setCoordError] = useState(false)

  // Debounced: Nominatim's usage policy asks for at most one request a second,
  // and a request per keystroke would be both impolite and useless.
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 3) {
      setResults([])
      setBusy(false)
      return
    }
    const ac = new AbortController()
    setBusy(true)
    const t = setTimeout(() => {
      geocode(trimmed, ac.signal)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setBusy(false))
    }, 600)
    return () => {
      clearTimeout(t)
      ac.abort()
    }
  }, [query])

  const submitCoords = () => {
    const m = coordText.match(
      /^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/,
    )
    if (!m) {
      setCoordError(true)
      return
    }
    const lat = Number(m[1])
    const lon = Number(m[2])
    if (!Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      setCoordError(true)
      return
    }
    setCoordError(false)
    onPick({ lat, lon })
  }

  return (
    <section className="locationbar">
      <div className="locationbar__row">
        <input
          type="search"
          className="locationbar__search"
          placeholder="Search a place…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search for a place"
          data-testid="place-search"
        />
        <input
          type="text"
          className="locationbar__coords"
          placeholder="50.09, 14.42"
          value={coordText}
          onChange={(e) => {
            setCoordText(e.target.value)
            setCoordError(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitCoords()
          }}
          aria-label="Latitude and longitude"
          aria-invalid={coordError}
          data-testid="coord-input"
        />
        <button type="button" onClick={onSurprise} data-testid="surprise">
          Surprise me
        </button>
      </div>

      {coordError && (
        <p className="locationbar__error" role="alert">
          That does not look like a latitude and longitude.
        </p>
      )}

      {results.length > 0 && (
        <ul className="locationbar__results" data-testid="results">
          {results.map((r) => (
            <li key={`${r.lat},${r.lon},${r.displayName}`}>
              <button
                type="button"
                onClick={() => {
                  onPick(r)
                  setResults([])
                  setQuery('')
                }}
              >
                {r.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}

      {busy && results.length === 0 && (
        <p className="locationbar__busy" role="status">
          Searching…
        </p>
      )}

      <p className="locationbar__current" data-testid="current-location">
        {centre.lat.toFixed(4)}, {centre.lon.toFixed(4)}
      </p>
    </section>
  )
}
