import { expect, test } from '@playwright/test'
import { readRotations, waitForBoard } from './helpers'

/**
 * The one suite that talks to the real world.
 *
 * Everything else stubs the tile server so it is fast and deterministic; this
 * file exists because a puzzle that only ever renders flat grey squares would
 * pass all of those. It checks that real OSM tiles actually arrive, decode and
 * come out looking like a map with the seams continuous.
 *
 * Needs network access, so it is skipped when the base URL is unreachable.
 */
test.describe('against the real OpenStreetMap tiles', () => {
  test.slow()

  test('renders a genuine map with continuous seams', async ({ page, baseURL }) => {
    const failed: string[] = []
    page.on('requestfailed', (r) => failed.push(r.url()))

    await page.goto('/')
    await waitForBoard(page)

    expect(failed, `requests failed: ${failed.join(', ')}`).toHaveLength(0)

    // The centre square should contain actual map detail: several distinct
    // colours, not one flat fill.
    const colours = await page
      .getByTestId('tile-4')
      .locator('canvas')
      .evaluate((c: HTMLCanvasElement) => {
        const ctx = c.getContext('2d')!
        const d = ctx.getImageData(0, 0, c.width, c.height).data
        const seen = new Set<string>()
        for (let i = 0; i < d.length; i += 4 * 37) {
          seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`)
        }
        return seen.size
      })

    expect(colours, 'centre square should show varied map detail').toBeGreaterThan(20)
  })

  /**
   * How continuous two image edges are, as a median absolute RGB difference.
   *
   * Median, not max, and deliberately: a map is full of hard features — building
   * outlines, road casings, text — so the largest single-pixel difference across
   * a seam is large even when the map is perfectly aligned. What distinguishes a
   * real seam from a broken one is that a real seam looks like the map's own
   * local gradient, while a broken one is a hard jump everywhere.
   */
  async function seamMedians(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
      const cs = Array.from(document.querySelectorAll<HTMLCanvasElement>('.tile canvas'))
      const rgb = (c: HTMLCanvasElement, x: number, y: number) => {
        const d = c.getContext('2d')!.getImageData(x, y, 1, 1).data
        return [d[0], d[1], d[2]] as const
      }
      const diff = (a: readonly number[], b: readonly number[]) =>
        Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])
      const median = (xs: number[]) => {
        const s = [...xs].sort((a, b) => a - b)
        return s.length ? s[Math.floor(s.length / 2)]! : 0
      }

      // Every horizontal seam: right edge of (r,c) against left edge of (r,c+1).
      const horizontal: number[] = []
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 2; c++) {
          const a = cs[r * 3 + c]!
          const b = cs[r * 3 + c + 1]!
          for (let y = 0; y < a.height; y++) {
            horizontal.push(diff(rgb(a, a.width - 1, y), rgb(b, 0, y)))
          }
        }
      }

      // Every vertical seam: bottom edge of (r,c) against top edge of (r+1,c).
      const vertical: number[] = []
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          const a = cs[r * 3 + c]!
          const b = cs[(r + 1) * 3 + c]!
          for (let x = 0; x < a.width; x++) {
            vertical.push(diff(rgb(a, x, a.height - 1), rgb(b, x, 0)))
          }
        }
      }

      // Control: the map's own pixel-to-pixel gradient inside one square, and a
      // deliberately wrong seam for comparison. A correct composite has to look
      // like the former, not the latter.
      const inside: number[] = []
      const centre = cs[4]!
      for (let y = 0; y < centre.height; y++) {
        inside.push(diff(rgb(centre, centre.width - 3, y), rgb(centre, centre.width - 2, y)))
      }
      const wrong: number[] = []
      for (let y = 0; y < centre.height; y++) {
        wrong.push(diff(rgb(centre, centre.width - 1, y), rgb(cs[8]!, 0, y)))
      }

      return {
        horizontal: median(horizontal),
        vertical: median(vertical),
        inside: median(inside),
        wrong: median(wrong),
      }
    })
  }

  test('the solved map lines up across a seam', async ({ page }) => {
    // The real test of the compositing: neighbouring squares must be continuous
    // slices of one image, so the pixels either side of a shared edge have to
    // match. Cropping each square from its own tile would fail here instead.
    await page.goto('/')
    await waitForBoard(page)

    const m = await seamMedians(page)

    // The seam must be at least as continuous as the map's own local detail...
    expect(m.horizontal).toBeLessThanOrEqual(m.inside * 2 + 5)
    expect(m.vertical).toBeLessThanOrEqual(m.inside * 2 + 5)
    // ...and nowhere near the discontinuity of two unrelated squares.
    expect(m.horizontal).toBeLessThan(m.wrong * 0.6)
    expect(m.vertical).toBeLessThan(m.wrong * 0.6)
  })

  test('a deliberately wrong pair is measurably discontinuous', async ({ page }) => {
    // Guards the test above: without this, a broken board that happened to
    // compare two identical squares would make the assertions pass vacuously.
    await page.goto('/')
    await waitForBoard(page)

    const m = await seamMedians(page)
    expect(m.wrong).toBeGreaterThan(m.horizontal * 1.5)
  })

  test('a very small square zooms the map right in', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('scale-100').click()
    await waitForBoard(page)

    const rotations = await readRotations(page)
    expect(rotations.some((r) => r !== 0)).toBe(true)
    await expect(page.locator('.tile')).toHaveCount(9)
  })
})
