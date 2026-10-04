# Maptcha

Nine map squares, one place. Rotate the squares until the streets and rivers connect.

**[Play Maptcha](https://corneliusroemer-agent.github.io/maptcha/)**

A small React + TypeScript game inspired by the [Czech cadastre CAPTCHA](https://misacodes.com/media/cadastre-captcha.mp4). Click a square to turn it clockwise; Shift-click turns it back. Tab and Enter/Space work too. Completion is automatic. This is a game: client-side puzzle state is visible, so it is unsuitable for bot protection.

Choose one of six places, search an address, or enter `latitude, longitude`. Distance options are 100 m, 250 m, 500 m, 1 km and 2.5 km **per square**; the whole map covers three times that distance on each side. Share links preserve the location and scale, while each visitor gets a fresh shuffle. A reference peek marks the round as assisted.

## Development

Requires Node 24 or later.

```sh
npm ci
npm run dev
npm run build
npm test
npx playwright install chromium firefox
npm run test:e2e
```

Playwright builds the production bundle before running, across desktop Chromium, Firefox and a phone-sized Chromium viewport. Tile and geocoder fixtures keep automated tests deterministic and avoid hammering public services. `node tests/live-check.mjs` performs a separate live-provider smoke check against a dev server on port 5173 and saves screenshots in `docs/evidence/`.

## GitHub Pages

Vite uses a relative asset base so the app works under `/maptcha/`. Select GitHub Actions as the Pages source and run **Deploy to GitHub Pages** from the Actions tab. The workflow is deliberately manual, builds and tests the app, then deploys `dist`.

## Map services

The browser fetches only tiles needed for the current board from OpenStreetMap, respecting normal HTTP caching. Shuffling and peeking reuse the existing map and fetch no additional tiles. Attribution stays visible below the board. Follow the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/); the public service is best-effort. For higher traffic, use a suitable provider with `VITE_TILE_URL=https://provider.example/{z}/{x}/{y}.png` at build time. It must permit CORS for canvas rendering. Replace attribution to match the provider when changing it.

[Photon](https://github.com/komoot/photon) performs address search only when the form is submitted. Multiple results let the player choose the right place. Both services receive the corresponding location/search request. No accounts, analytics, API keys, or backend are required.

## Implementation notes

One 900 × 900 canvas is rendered from XYZ raster tiles and cropped into nine CSS backgrounds. Tile centres stay fixed; only their quarter-turn orientation changes. The Web Mercator zoom and crop width use latitude-adjusted metres per pixel. The selected distance is a local ground-scale approximation at the map centre, not a geodesic survey measurement. Coordinates outside ±85° latitude are rejected; longitude wraps at the date line. A small polar-edge crop clamps the tile row to the provider's supported extent.

See [validation](docs/validation.md) for verification scope and limits.
