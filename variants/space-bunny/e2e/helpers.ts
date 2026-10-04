import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * A real 256x256 opaque tile, so stubbed runs draw a genuine image with genuine
 * dimensions rather than a degenerate 1x1. A flat colour is enough: these tests
 * are about behaviour, and a map with recognisable features belongs in
 * live.spec.ts, which fetches actual tiles.
 */
export const FAKE_TILE_PNG = readFileSync(
  fileURLToPath(new URL('./fixtures/tile.png', import.meta.url)),
)

/**
 * Answer every tile request with a local image and every geocoding request with
 * a fixed set of results, so the suite never depends on a third party being up.
 */
export async function stubMapAndSearch(page: Page): Promise<{ tileUrls: string[] }> {
  const tileUrls: string[] = []

  await page.route('**/tile.openstreetmap.org/**', async (route) => {
    tileUrls.push(route.request().url())
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: FAKE_TILE_PNG,
    })
  })

  await page.route('**/nominatim.openstreetmap.org/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          lat: '50.0875',
          lon: '14.4213',
          display_name: 'Prague, Czechia',
        },
        {
          lat: '48.8584',
          lon: '2.2945',
          display_name: 'Champ de Mars, Paris, France',
        },
      ]),
    })
  })

  return { tileUrls }
}

/** Wait until the board has finished loading and its tiles are clickable. */
export async function waitForBoard(page: Page): Promise<void> {
  await expect(page.getByTestId('board-grid')).toHaveAttribute('data-status', 'ready')
  await expect(page.getByTestId('tile-0')).toBeEnabled()
}

export async function readRotations(page: Page): Promise<number[]> {
  const grid = page.getByTestId('board-grid')
  return grid.locator('.tile').evaluateAll((els) =>
    els.map((el) => Number(el.getAttribute('data-rotation'))),
  )
}

/**
 * Click tiles until the board is solved, the way a player would.
 *
 * Returns how many clicks it took. Uses whatever the current rotations are, so
 * it works whatever scramble the board was dealt.
 */
export async function solveByClicking(page: Page): Promise<number> {
  let clicks = 0
  for (let guard = 0; guard < 40; guard++) {
    const rotations = await readRotations(page)
    const wrong = rotations.findIndex((r) => ((r % 4) + 4) % 4 !== 0)
    if (wrong === -1) return clicks
    await page.getByTestId(`tile-${wrong}`).click()
    clicks++
  }
  throw new Error('board never came out solved after 40 clicks')
}
