import { expect, test } from '@playwright/test'
import { readRotations, solveByClicking, stubMapAndSearch, waitForBoard } from './helpers'

test.beforeEach(async ({ page }) => {
  await stubMapAndSearch(page)
})

test.describe('the board', () => {
  test('loads nine squares and asks you to fix them', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)

    await expect(page.locator('.tile')).toHaveCount(9)
    await expect(page.getByRole('heading', { name: 'maptcha' })).toBeVisible()
  })

  test('never deals an already-solved board', async ({ page }) => {
    // Re-dealing must always leave work to do, or the first click would win.
    for (let round = 0; round < 5; round++) {
      await page.goto('/')
      await waitForBoard(page)
      const rotations = await readRotations(page)
      expect(rotations.some((r) => r !== 0)).toBe(true)
      await page.reload()
    }
  })

  test('starts with at least one square already in place', async ({ page }) => {
    // Mirrors the original: some squares are left alone, so there is a foothold.
    await page.goto('/')
    await waitForBoard(page)
    const rotations = await readRotations(page)
    expect(rotations.filter((r) => r === 0).length).toBeGreaterThanOrEqual(1)
  })
})

test.describe('turning squares', () => {
  test('a click turns a square a quarter turn clockwise', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)

    const tile = page.getByTestId('tile-4')
    const before = Number(await tile.getAttribute('data-rotation'))

    await tile.click()
    await expect(tile).toHaveAttribute('data-rotation', String((before + 1) % 4))
  })

  test('four clicks put a square back exactly where it started', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)

    const tile = page.getByTestId('tile-0')
    const before = await tile.getAttribute('data-rotation')

    for (let i = 0; i < 4; i++) await tile.click()
    await expect(tile).toHaveAttribute('data-rotation', before ?? '0')
  })

  test('right-click turns a square back the other way', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)

    const tile = page.getByTestId('tile-1')
    const before = Number(await tile.getAttribute('data-rotation'))

    await tile.click({ button: 'right' })
    await expect(tile).toHaveAttribute('data-rotation', String((before + 3) % 4))
  })

  test('turning applies a real CSS rotation', async ({ page }) => {
    // The transform is what actually draws the turn; the data attribute is only
    // the state. This is the assertion that would catch a board that counts
    // clicks without moving anything.
    await page.goto('/')
    await waitForBoard(page)

    const tile = page.getByTestId('tile-2')
    const inner = tile.locator('.tile__inner')
    const start = Number(await tile.getAttribute('data-rotation'))

    /** The rotation a CSS 2D matrix actually renders, as a multiple of 90. */
    const renderedQuarterTurns = () =>
      inner.evaluate((el) => {
        const t = getComputedStyle(el).transform
        if (t === 'none') return -1
        const m = t.match(/matrix\(([^)]+)\)/)
        if (!m) return -1
        const [a, b] = m[1]!.split(',').map(Number)
        // b is sin(theta) and a is cos(theta); atan2 recovers the angle.
        const deg = (Math.atan2(b as number, a as number) * 180) / Math.PI
        return Math.round(((deg + 360) % 360) / 90) % 4
      })

    for (let i = 1; i <= 4; i++) {
      const expected = (start + i) % 4
      await tile.click()
      await expect(tile).toHaveAttribute('data-rotation', String(expected))

      // The transform is animated, so poll until it settles rather than reading
      // a frame from the middle of the easing curve.
      await expect
        .poll(renderedQuarterTurns, {
          message: `square should be rendered at ${expected * 90} degrees`,
        })
        .toBe(expected)
    }

    // Four turns is a whole circle: back to the start, and a settled identity.
    expect(await renderedQuarterTurns()).toBe(start)
  })

  test('counts every turn as a move', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)

    await expect(page.getByTestId('moves')).toHaveText('0 moves')
    await page.getByTestId('tile-0').click()
    await page.getByTestId('tile-1').click()
    await expect(page.getByTestId('moves')).toHaveText('2 moves')
  })
})

test.describe('winning', () => {
  test('solving every square shows the win state', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)

    const clicks = await solveByClicking(page)

    await expect(page.getByTestId('win')).toBeVisible()
    await expect(page.getByTestId('win')).toContainText(`${clicks} moves`)
    await expect(page.getByTestId('remaining')).toHaveText('0 squares out of place')
  })

  test('reports no squares out of place while the board is wrong', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)
    await expect(page.getByTestId('win')).toHaveCount(0)

    await solveByClicking(page)
    await expect(page.getByTestId('remaining')).toHaveText('0 squares out of place')
  })

  test('shows how many squares are still out of place', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)

    const before = await page.getByTestId('remaining').textContent()
    expect(before).toMatch(/^\d+ squares? out of place$/)

    await page.getByTestId('tile-0').click()
    await expect(page.getByTestId('remaining')).toBeVisible()
  })

  test('records a time for the round', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)

    await solveByClicking(page)
    await expect(page.getByTestId('result')).toContainText(/solved in [\d.]+s/)
  })

  test('offers a fresh board after a win', async ({ page }) => {
    await page.goto('/')
    await waitForBoard(page)
    await solveByClicking(page)

    await page.getByRole('button', { name: 'Another one' }).click()
    await waitForBoard(page)

    await expect(page.getByTestId('moves')).toHaveText('0 moves')
    await expect(page.getByTestId('win')).toHaveCount(0)
    const rotations = await readRotations(page)
    expect(rotations.some((r) => r !== 0)).toBe(true)
  })
})
