# Maptcha

Nine map squares, one place. Rotate the squares until the streets and rivers connect.

**[Play the original](https://corneliusroemer-agent.github.io/maptcha/)** · **[Play Space Bunny’s version](https://corneliusroemer-agent.github.io/maptcha/space-bunny/)**

A small React + TypeScript game inspired by the [Czech cadastre CAPTCHA](https://misacodes.com/media/cadastre-captcha.mp4). Click a square to turn it clockwise; Shift-click turns it back. Tab and Enter/Space work too. Completion is automatic. This is a game: client-side puzzle state is visible, so it is unsuitable for bot protection.

Choose one of six places, search an address, or enter `latitude, longitude`. Distance options are 100 m, 250 m, 500 m, 1 km and 2.5 km **per square**; the whole map covers three times that distance on each side. Share links preserve the location and scale, while each visitor gets a fresh shuffle. A reference peek marks the round as assisted.

## Development

Requires Node 24 or later.

```sh
npm ci
npm ci --prefix variants/space-bunny
npm run dev
npm run build
npm test
npx playwright install chromium firefox
npm run test:e2e
```

Playwright builds the production bundle before running, across desktop Chromium, Firefox and a phone-sized Chromium viewport. Tile and geocoder fixtures keep automated tests deterministic and avoid hammering public services. `node tests/live-check.mjs` performs a separate live-provider smoke check against a dev server on port 5173 and saves screenshots in `docs/evidence/`.

## GitHub Pages

Vite uses a relative asset base so the app works under `/maptcha/`. Select GitHub Actions as the Pages source and run **Deploy to GitHub Pages** from the Actions tab. The workflow is deliberately manual. It installs and unit-tests both apps, builds the original into `dist/` and Space Bunny’s version into `dist/space-bunny/`, then deploys the combined directory.

## Map services

The original version uses [OpenFreeMap](https://openfreemap.org/) vector tiles, rendered into a canvas by OpenLayers. Every symbol layer is removed before rendering, so street names, place names, road shields and oriented icons cannot give away the rotation. Roads, water, buildings and land cover remain. Shuffling and peeking reuse the existing image. Attribution stays visible below the board.

To use another compatible vector style, set `VITE_MAP_STYLE=https://provider.example/style.json` at build time. The style and tile sources must allow CORS. Update the attribution to match the provider. Space Bunny’s version retains its OpenStreetMap raster tiles and labels.

[Photon](https://github.com/komoot/photon) performs address search only when the form is submitted. Multiple results let the player choose the right place. Both services receive the corresponding location/search request. No accounts, analytics, API keys, or backend are required.

## Implementation notes

The original version composites one 900 × 900 label-free map and crops it into nine CSS backgrounds. Tile centres stay fixed; only their quarter-turn orientation changes. The Web Mercator view uses latitude-adjusted metres per pixel. The selected distance is a local ground-scale approximation at the map centre, not a geodesic survey measurement. Coordinates outside ±85° latitude are rejected. The temporary renderer is disposed after capture or cancellation.

See [validation](docs/validation.md) for verification scope and limits.

## Space Bunny’s version

The second app is kept in `variants/space-bunny/`, imported from local branch `maptcha-initial` at commit `c8bf852`. Its source and tests are independent; navigation links connect the two versions. Run it separately with `npm run dev --prefix variants/space-bunny`, or test it with `npm test --prefix variants/space-bunny` and `npm run test:e2e --prefix variants/space-bunny -- --workers=4`. The top-level build assembles both apps for Pages.
