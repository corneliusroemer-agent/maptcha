# Validation

- TypeScript strict checking and Vite production build pass.
- Eight unit tests cover coordinate parsing, unsupported coordinates, scramble invariants metre-based projection at five latitudes and five scales, and removal of all map symbol layers.
- Forty-two Playwright cases pass: fourteen scenarios each in desktop Chromium, Firefox and phone-sized Chromium. They cover square crop geometry, overflow, clockwise/counterclockwise and keyboard input, completion, reset, peek state, coordinates, scale and link persistence, address selection, failed/empty search, tile failure and retry, cancellation of stale search, invalid links, sharing feedback, and navigation between both versions, and cancellation/cleanup during a stalled style-resource request.
- A separate live browser check successfully loads real map imagery and Photon search, selects a result, changes scale, and captures desktop, complete-map and phone screenshots. No JavaScript page errors or horizontal overflow occur in that check.
- The production layout is inspected visually as well as through geometry assertions. Reduced-motion preferences disable rotation animation.
- The Space Bunny app includes its original tests: 64 unit cases plus its Playwright suite, including live OpenStreetMap seam checks.

The deterministic browser suite mocks remote providers; it proves application behaviour independently of network availability. The live check confirms provider access at the time of execution, not future uptime. Mobile testing uses Chromium device emulation rather than an actual iPhone or Safari. Automated tests do not constitute a full screen-reader accessibility audit.

Puzzle correctness is orientation-based. Visually uniform map squares can look correct in multiple orientations; the game expects north-up. Share links preserve place and scale, not a particular shuffle. Address search may return places with identical names in different countries, so selection is explicit.

Both builds are assembled into one Pages artifact. Relative asset paths are verified at `/maptcha/` and `/maptcha/space-bunny/`; each version links back to the other. Source provenance is recorded in the README.
