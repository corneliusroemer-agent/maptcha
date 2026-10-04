import { expect, test } from '@playwright/test'
import { stubMapAndSearch, waitForBoard } from './helpers'

test.beforeEach(async ({ page }) => {
  await stubMapAndSearch(page)
})

test.describe('choosing a place', () => {
  test('starts on Prague', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)
    await expect(page.getByTestId('current-location')).toHaveText('50.0875, 14.4213')
  })

  test('searches for a place and jumps to the result', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)

    await page.getByTestId('place-search').fill('Prague')
    await expect(page.getByTestId('results')).toBeVisible()
    await page.getByRole('button', { name: /Prague, Czechia/ }).click()

    await waitForBoard(page)
    await expect(page.getByTestId('current-location')).toHaveText('50.0875, 14.4213')
  })

  test('accepts a latitude and longitude directly', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)

    await page.getByTestId('coord-input').fill('48.8584, 2.2945')
    await page.getByTestId('coord-input').press('Enter')

    await waitForBoard(page)
    await expect(page.getByTestId('current-location')).toHaveText('48.8584, 2.2945')
  })

  test('accepts a space instead of a comma', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)

    await page.getByTestId('coord-input').fill('-33.8568 151.2153')
    await page.getByTestId('coord-input').press('Enter')

    await waitForBoard(page)
    await expect(page.getByTestId('current-location')).toHaveText('-33.8568, 151.2153')
  })

  test('rejects coordinates that are not coordinates', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)

    await page.getByTestId('coord-input').fill('somewhere nice')
    await page.getByTestId('coord-input').press('Enter')

    await expect(page.getByRole('alert')).toContainText('latitude and longitude')
    await expect(page.getByTestId('current-location')).toHaveText('50.0875, 14.4213')
  })

  test('rejects a latitude outside the world', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)

    await page.getByTestId('coord-input').fill('120, 30')
    await page.getByTestId('coord-input').press('Enter')

    await expect(page.getByRole('alert')).toBeVisible()
  })

  test('does not search on one or two characters', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)

    await page.getByTestId('place-search').fill('Pr')
    // Nominatim's policy allows at most a request a second; a two-letter query
    // must not produce one at all.
    await page.waitForTimeout(900)
    await expect(page.getByTestId('results')).toHaveCount(0)
  })

  test('surprise me moves somewhere new', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)

    let moved = false
    for (let i = 0; i < 5 && !moved; i++) {
      await page.getByTestId('surprise').click()
      await waitForBoard(page)
      const text = await page.getByTestId('current-location').textContent()
      moved = text !== '50.0875, 14.4213'
    }
    expect(moved).toBe(true)
  })
})

test.describe('choosing a scale', () => {
  test('offers the square sizes and marks the active one', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)

    await expect(page.getByTestId('scale-500')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('scale-100')).toHaveAttribute('aria-pressed', 'false')
  })

  test('changing the size asks the tile server for a different zoom', async ({ page }) => {
    const { tileUrls } = await stubMapAndSearch(page)
    await page.goto('/')
    await waitForBoard(page)

    const zoomOf = (u: string) => Number(new URL(u).pathname.split('/')[1])

    await page.getByTestId('scale-100').click()
    await waitForBoard(page)
    const closeZooms = tileUrls.map(zoomOf)

    tileUrls.length = 0
    await page.getByTestId('scale-10000').click()
    await waitForBoard(page)
    const wideZooms = tileUrls.map(zoomOf)

    // 100 m per square needs far more detail than 10 km per square.
    expect(Math.min(...closeZooms)).toBeGreaterThan(Math.min(...wideZooms))
    await expect(page.getByTestId('scale-10000')).toHaveAttribute('aria-pressed', 'true')
  })

  test('keeps the puzzle playable at every size', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)

    for (const metres of [100, 250, 500, 1000, 2000, 10000]) {
      await page.getByTestId(`scale-${metres}`).click()
      await waitForBoard(page)
      await expect(page.locator('.tile')).toHaveCount(9)
      // A fresh board at a new size must still need work.
      const rotations = await page.locator('.tile').evaluateAll((els) =>
        els.map((el) => Number(el.getAttribute('data-rotation'))),
      )
      expect(rotations.some((r) => r !== 0)).toBe(true)
    }
  })

  test('resets the move count when the size changes', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)

    await page.getByTestId('tile-0').click()
    await page.getByTestId('tile-1').click()
    await expect(page.getByTestId('moves')).toHaveText('2 moves')

    await page.getByTestId('scale-1000').click()
    await waitForBoard(page)
    await expect(page.getByTestId('moves')).toHaveText('0 moves')
  })
})

test.describe('the map underneath', () => {
  test('asks for raster tiles and nothing else', async ({ page }) => {
    const { tileUrls } = await stubMapAndSearch(page)
    await page.goto('/')
    await waitForBoard(page)

    expect(tileUrls.length).toBeGreaterThan(0)
    for (const u of tileUrls) {
      expect(u).toContain('tile.openstreetmap.org')
    }
  })

  test('does not hotlink a tile server it does not credit', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)

    // OSM's terms require visible attribution wherever their data is shown.
    await expect(page.locator('.attribution')).toContainText('OpenStreetMap')
  })

  test('draws real pixels into the squares', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)

    const painted = await page
      .getByTestId('tile-0')
      .locator('canvas')
      .evaluate((c: HTMLCanvasElement) => {
        const ctx = c.getContext('2d')
        if (!ctx) return null
        const d = ctx.getImageData(0, 0, c.width, c.height).data
        // Fully opaque means a tile really was composited in; an empty canvas
        // would leave the pixel transparent.
        return d[3] === 255 && d[0] > 0
      })

    expect(painted).toBe(true)
  })

  test('sizes every square to the same canvas resolution', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)

    const dims = await page.locator('.tile canvas').evaluateAll((els) =>
      els.map((c) => (c as HTMLCanvasElement).width),
    )

    expect(dims).toHaveLength(9)
    expect(new Set(dims).size).toBe(1)
    expect(dims[0]).toBeGreaterThan(0)
  })
})
