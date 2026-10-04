import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  coordinate,
  places,
  readLocation,
  scramble,
  type Place,
} from "./puzzle";
import { mapImage } from "./map";
import "./style.css";
const initial = readLocation();
function App() {
  const [place, setPlace] = useState(initial.place),
    [metres, setMetres] = useState(initial.metres);
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false),
    [searchError, setSearchError] = useState("");
  const [map, setMap] = useState(""),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [turns, setTurns] = useState(scramble),
    [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0),
    [started, setStarted] = useState<number | null>(null);
  const [peek, setPeek] = useState(false),
    [assisted, setAssisted] = useState(false),
    [notice, setNotice] = useState("");
  const searchController = useRef<AbortController | null>(null);
  const solved = turns.every((t) => t % 4 === 0);
  function reset() {
    setTurns(scramble());
    setMoves(0);
    setSeconds(0);
    setStarted(null);
    setPeek(false);
    setAssisted(false);
    setNotice("");
  }
  useEffect(() => {
    let active = true;
    setMap("");
    setError("");
    reset();
    history.replaceState(
      null,
      "",
      `#lat=${place.lat}&lon=${place.lon}&m=${metres}`,
    );
    mapImage(place, metres)
      .then((url) => {
        if (active) setMap(url);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [place, metres, retry]);
  useEffect(() => {
    if (!started || solved) return;
    const tick = () => setSeconds(Math.floor((Date.now() - started) / 1000));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [started, solved]);
  useEffect(() => () => searchController.current?.abort(), []);
  function choose(p: Place) {
    searchController.current?.abort();
    setSearching(false);
    setPlace(p);
    setResults([]);
    setSearchError("");
  }
  async function search(e: React.FormEvent) {
    e.preventDefault();
    searchController.current?.abort();
    setSearchError("");
    setResults([]);
    const controller = new AbortController();
    searchController.current = controller;
    if (!query.trim()) {
      setSearchError("Enter a place or latitude, longitude.");
      return;
    }
    try {
      const coords = coordinate(query);
      if (coords) {
        choose(coords);
        return;
      }
      setSearching(true);
      const response = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(query.trim())}&limit=5`,
        {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(12000),
          ]),
        },
      );
      if (!response.ok)
        throw new Error(
          "Address search is unavailable. Try coordinates or a suggested place.",
        );
      const data = await response.json();
      if (controller.signal.aborted) return;
      const options: Place[] = data.features
        .map(
          (f: {
            properties: Record<string, string>;
            geometry: { coordinates: number[] };
          }) => ({
            name: [f.properties.name, f.properties.city, f.properties.country]
              .filter(Boolean)
              .join(" · "),
            lon: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          }),
        )
        .filter(
          (p: Place) =>
            Number.isFinite(p.lat) &&
            Number.isFinite(p.lon) &&
            Math.abs(p.lat) <= 85 &&
            Math.abs(p.lon) <= 180,
        );
      setResults(options);
      if (!options.length)
        setSearchError("No places found. Try a nearby city or coordinates.");
    } catch (e) {
      if (!controller.signal.aborted)
        setSearchError(
          (e as Error).name === "TimeoutError"
            ? "Address search timed out. Try again or enter coordinates."
            : (e as Error).message,
        );
    } finally {
      if (searchController.current === controller) setSearching(false);
    }
  }
  function rotate(i: number, direction = 1) {
    if (!map || solved || peek) return;
    if (!started) setStarted(Date.now());
    setTurns((current) => current.map((t, j) => (j === i ? t + direction : t)));
    setMoves((m) => m + 1);
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(location.href);
      setNotice("Link copied.");
    } catch {
      setNotice("Copy the address bar to share this place.");
    }
  }
  return (
    <main>
      <header>
        <a className="brand" href={location.pathname}>
          maptcha<span className="brand-mark">↗</span>
        </a>
        <span className="edition">A SMALL CARTOGRAPHIC DIVERSION</span>
      </header>
      <div className="layout">
        <section className="intro">
          <p className="eyebrow">NINE SQUARES. ONE PLACE.</p>
          <h1>
            Find your <br />
            way around.
          </h1>
          <p className="description">
            A map, a little out of order. Turn each square until the streets,
            rivers and contours meet.
          </p>
          <form onSubmit={search}>
            <label htmlFor="location">Start somewhere</label>
            <div className="search">
              <input
                id="location"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Address or latitude, longitude"
                maxLength={200}
              />
              <button aria-label="Search location" disabled={searching}>
                {searching ? "…" : "→"}
              </button>
            </div>
          </form>
          {searchError && (
            <p className="error" role="alert">
              {searchError}
            </p>
          )}
          {results.length > 0 && (
            <ul className="results">
              {results.map((p, i) => (
                <li key={i}>
                  <button onClick={() => choose(p)}>{p.name}</button>
                </li>
              ))}
            </ul>
          )}
          <div className="scale">
            <label htmlFor="scale">Distance per square</label>
            <select
              id="scale"
              value={metres}
              onChange={(e) => setMetres(Number(e.target.value))}
            >
              {[100, 250, 500, 1000, 2500].map((m) => (
                <option key={m} value={m}>
                  {m < 1000 ? `${m} m` : `${m / 1000} km`}
                </option>
              ))}
            </select>
          </div>
          <div className="suggestions">
            <p className="eyebrow">OR TAKE A DETOUR</p>
            {places.map((p) => (
              <button
                key={p.name}
                onClick={() => choose(p)}
                className={
                  p.lat === place.lat && p.lon === place.lon ? "selected" : ""
                }
              >
                {p.name}
                <span>↗</span>
              </button>
            ))}
          </div>
          <p className="hint">
            Click to turn clockwise. Shift-click to turn back.
            <br />
            Keyboard: Tab to a square, then Enter or Space.
          </p>
        </section>
        <section className="game" aria-label="Map puzzle">
          <div className="game-heading">
            <div>
              <h2>{place.name}</h2>
              <p>
                {Math.abs(place.lat).toFixed(4)}° {place.lat >= 0 ? "N" : "S"} /{" "}
                {Math.abs(place.lon).toFixed(4)}° {place.lon >= 0 ? "E" : "W"}
              </p>
            </div>
            <span className="north">
              ↑<small>NORTH</small>
            </span>
          </div>
          <div
            className={`board ${solved ? "solved" : ""}`}
            aria-busy={!map && !error}
          >
            {map ? (
              turns.map((t, i) => (
                <button
                  key={i}
                  className="tile"
                  aria-label={`Rotate square ${i + 1}`}
                  disabled={solved || peek}
                  onClick={(e) => rotate(i, e.shiftKey ? -1 : 1)}
                >
                  <span
                    className="map-square"
                    style={{
                      backgroundImage: `url(${map})`,
                      backgroundPosition: `${(i % 3) * 50}% ${Math.floor(i / 3) * 50}%`,
                      transform: `rotate(${peek ? 0 : t * 90}deg)`,
                    }}
                  />
                </button>
              ))
            ) : (
              <div className="board-message" role={error ? "alert" : "status"}>
                {error ? (
                  <>
                    <p>{error}</p>
                    <button onClick={() => setRetry((r) => r + 1)}>
                      Retry map
                    </button>
                  </>
                ) : (
                  <>
                    <span className="loader" />
                    <p>Finding the streets…</p>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="stats">
            <span>
              <strong>{String(moves).padStart(2, "0")}</strong> turns
            </span>
            <span>
              <strong>
                {Math.floor(seconds / 60)}:
                {String(seconds % 60).padStart(2, "0")}
              </strong>{" "}
              elapsed
            </span>
            <span>
              {metres < 1000 ? `${metres} m` : `${metres / 1000} km`} / square
            </span>
          </div>
          <div className="actions">
            <button className="primary" onClick={reset} disabled={!map}>
              New shuffle <span>↻</span>
            </button>
            <button
              onClick={() => {
                setPeek((p) => !p);
                setAssisted(true);
              }}
              disabled={!map || solved}
              aria-pressed={peek}
            >
              {peek ? "Back to puzzle" : "Peek at map"}
            </button>
            <button onClick={share}>Share place ↗</button>
          </div>
          <p className="outcome" role="status">
            {solved
              ? `Everything connects. ${moves} turns${assisted ? " · with a peek" : ""}.`
              : peek
                ? "The complete map. North is up."
                : notice ||
                  "Follow a road across the edges. It’s a good place to start."}
          </p>
          <p className="attribution">
            Map ©{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              OpenStreetMap contributors
            </a>{" "}
            · Search by{" "}
            <a href="https://photon.komoot.io" target="_blank" rel="noreferrer">
              Photon
            </a>
          </p>
        </section>
      </div>
      <footer>
        <span>A puzzle for people who take the scenic route.</span>
        <a href="https://misacodes.com/media/cadastre-captcha.mp4">
          Inspired by the Czech cadastre CAPTCHA ↗
        </a>
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
