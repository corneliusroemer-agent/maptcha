# Validation

- TypeScript strict checking and Vite production build pass.
- Seven unit tests cover coordinate parsing, unsupported coordinates, scramble invariants and metre-based projection at five latitudes and five scales.
- Thirty-six Playwright cases pass: twelve scenarios each in desktop Chromium, Firefox and phone-sized Chromium. They cover square crop geometry, overflow, clockwise/counterclockwise and keyboard input, completion, reset, peek state, coordinates, scale and link persistence, address selection, failed/empty search, tile failure and retry, cancellation of stale search, invalid links, and sharing feedback.
- A separate live browser check successfully loads real OpenStreetMap imagery and Photon search, selects a result, changes scale, and captures desktop, complete-map and phone screenshots. No JavaScript page errors or horizontal overflow occur in that check.
- The production layout is inspected visually as well as through geometry assertions. Reduced-motion preferences disable rotation animation.
- `npm audit` reports no known dependency vulnerabilities at validation time.

The deterministic browser suite mocks remote providers; it proves application behaviour independently of network availability. The live check confirms provider access at the time of execution, not future uptime. Mobile testing uses Chromium device emulation rather than an actual iPhone or Safari. Automated tests do not constitute a full screen-reader accessibility audit.

Puzzle correctness is orientation-based. Visually uniform map squares can look correct in multiple orientations; the game expects north-up. Share links preserve place and scale, not a particular shuffle. Address search may return places with identical names in different countries, so selection is explicit.
