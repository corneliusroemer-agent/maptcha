# maptcha

A jigsaw made of real map tiles. Nine squares of a real map are each turned the
wrong way; click them until the map lines up again.

The idea is lifted from the Czech cadastral office's image-map captcha
(`nahlizenidokn.cuzk.gov.cz`), which does exactly this with cadastral tiles.
This is the same game, pointed at anywhere on Earth and at whatever ground size
you feel like.

## Running it

```sh
npm install
npm run dev        # http://localhost:5173
```

```sh
npm run build      # tsc -b && vite build -> dist/
npm run preview    # serve the production build
npm test           # vitest, unit
npm run test:e2e   # playwright, end to end
npm run typecheck
```

## How it works

Choosing "500 m per square" is a real distance, not a zoom level. Tiles only
exist at whole-number zooms, so `zoomForCell` rounds *up* to the next zoom and
the surplus is trimmed by the crop:

1. Pick the finest zoom that carries at least the detail the requested square
   size needs, so the puzzle is never blurrier than asked for.
2. Work out which raster tiles cover the whole 3×3 board, wrapping tile columns
   across the antimeridian and clamping rows at the poles.
3. Draw **all** of them into a single offscreen canvas at exactly the size of
   the finished board.
4. Cut the nine squares out of that one canvas.

Step 3 is what makes the puzzle honest. The nine pieces are guaranteed to be
nine pieces of one continuous map, so they cannot disagree at the seams — which
is the whole premise. `e2e/live.spec.ts` checks that against real tiles by
comparing the pixels either side of a seam.

Rotating is a CSS `transform` on the canvas rather than a redraw, so it animates
on the compositor and is exactly reversible: four clicks return a square to
precisely where it started.

`src/lib/geo.ts` and `src/lib/plan.ts` are pure — no canvas, no network — so
the geometry is unit-tested directly. That is where the arithmetic lives, and it
is where a wrong answer produces a subtly wrong puzzle rather than an error.

## Map data

Tiles come from OpenStreetMap's standard raster server and places from Nominatim.
Both send permissive CORS headers and need no API key, which is what lets this
be a static site with no backend of its own.

Both have usage policies aimed at exactly this kind of casual use. A handful of
tiles per puzzle is well inside them, but if you deploy this somewhere busy,
point `TileSource` in `src/lib/tiles.ts` at your own tile server. Attribution is
required in any case and is rendered in the footer.

## Layout

| Path | |
|---|---|
| `src/lib/geo.ts` | projection, resolution, zoom choice |
| `src/lib/plan.ts` | which tiles, and where each square is cut from |
| `src/lib/puzzle.ts` | rotation rules, scrambling, win detection |
| `src/lib/tiles.ts` | fetching, compositing, slicing |
| `src/lib/geocode.ts` | Nominatim search |
| `src/components/` | the UI |
| `e2e/` | Playwright, incl. one suite against the live tile server |

## Deploying

This app is deployed at [Space Bunny’s version](https://corneliusroemer-agent.github.io/maptcha/space-bunny/). The repository’s top-level build copies this app’s `dist/` into the shared `dist/space-bunny/` directory. Relative asset paths work at that subpath. The top-level Pages workflow deploys both versions together.
