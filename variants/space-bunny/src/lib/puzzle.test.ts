import { describe, expect, it } from 'vitest'
import {
  hasMoved,
  isCellSolved,
  isSolved,
  scramble,
  solvedCount,
  turn,
  turnBy,
  type RotationState,
} from './puzzle'

describe('turnBy', () => {
  it('turns one cell clockwise by default', () => {
    expect(turnBy([0, 0, 0], 1, 1)).toEqual([0, 1, 0])
  })

  it('wraps past three back to zero', () => {
    expect(turnBy([0, 0, 0], 0, 4)).toEqual([0, 0, 0])
    expect(turnBy([0, 3, 0], 1, 1)).toEqual([0, 0, 0])
  })

  it('turns anticlockwise with a negative amount', () => {
    expect(turnBy([0, 0, 0], 2, -1)).toEqual([0, 0, 3])
    expect(turnBy([0, 0, 1], 2, -1)).toEqual([0, 0, 0])
  })

  it('survives turning backwards past zero', () => {
    expect(turnBy([0, 0, 0], 2, -1)).toEqual([0, 0, 3])
    expect(turnBy([0, 0, 0], 2, -5)).toEqual([0, 0, 3])
  })

  it('leaves the other cells alone and does not mutate the input', () => {
    const before: RotationState = [1, 2, 3]
    const after = turnBy(before, 1, 1)
    expect(before).toEqual([1, 2, 3])
    expect(after).toEqual([1, 3, 3])
  })

  it('returns to the exact starting state after four turns', () => {
    const start: RotationState = [0, 1, 2, 3]
    let state = start
    for (let i = 0; i < 4; i++) state = turn(state, 2)
    expect(state).toEqual(start)
  })
})

describe('solved detection', () => {
  it('treats only a whole number of full turns as solved', () => {
    expect(isCellSolved(0)).toBe(true)
    expect(isCellSolved(4)).toBe(true)
    expect(isCellSolved(8)).toBe(true)
    expect(isCellSolved(1)).toBe(false)
    expect(isCellSolved(2)).toBe(false)
    expect(isCellSolved(3)).toBe(false)
  })

  it('normalises negatives, so an anticlockwise turn back to zero counts', () => {
    expect(isCellSolved(-4)).toBe(true)
    expect(isCellSolved(-3)).toBe(false)
  })

  it('solves only when every cell is home', () => {
    expect(isSolved([0, 0, 0, 0])).toBe(true)
    expect(isSolved([4, 8, 0, 12])).toBe(true)
    expect(isSolved([0, 0, 0, 1])).toBe(false)
    expect(isSolved([3, 0, 0, 0])).toBe(false)
  })

  it('counts the cells already home', () => {
    expect(solvedCount([0, 1, 0, 3])).toBe(2)
    expect(solvedCount([0, 0, 0, 0])).toBe(4)
    expect(solvedCount([])).toBe(0)
  })

  it('reports whether anything has been touched', () => {
    expect(hasMoved([0, 0, 0])).toBe(false)
    expect(hasMoved([0, 4, 0])).toBe(false)
    expect(hasMoved([0, 1, 0])).toBe(true)
  })
})

describe('scramble', () => {
  it('returns one rotation per cell', () => {
    expect(scramble(9)).toHaveLength(9)
    expect(scramble(16)).toHaveLength(16)
  })

  it('only ever uses the four right-angle rotations', () => {
    for (let i = 0; i < 200; i++) {
      for (const r of scramble(9)) {
        expect([0, 1, 2, 3]).toContain(r)
      }
    }
  })

  it('never hands back an already-solved board', () => {
    // 2000 draws: without the guard this fails roughly 1 time in 512.
    for (let i = 0; i < 2000; i++) {
      expect(isSolved(scramble(9))).toBe(false)
    }
  })

  it('never hands back an entirely-unsolved board either', () => {
    // A board where no square is in place gives no foothold at all.
    for (let i = 0; i < 2000; i++) {
      expect(hasMoved(scramble(9))).toBe(true)
    }
  })

  it('always leaves at least one square already in place', () => {
    // The foothold the player reads the rest of the map from. Without it a board
    // can deal as nine wrong squares, which is both harder to start and not what
    // the original captcha looks like.
    for (let i = 0; i < 2000; i++) {
      const state = scramble(9)
      expect(state.filter((r) => r === 0).length).toBeGreaterThanOrEqual(1)
      // ...while still needing work.
      expect(isSolved(state)).toBe(false)
    }
  })

  it('leaves a foothold even when the random source keeps drawing the same value', () => {
    for (const constant of [0, 0.25, 0.5, 0.75, 0.99]) {
      const state = scramble(9, () => constant)
      expect(state.filter((r) => r === 0).length).toBeGreaterThanOrEqual(1)
      expect(isSolved(state)).toBe(false)
    }
  })

  it('is reproducible for a given random source', () => {
    const seeded = () => 0.5
    expect(scramble(9, seeded)).toEqual(scramble(9, seeded))
  })

  it('still guards a random source that always returns zero', () => {
    // rng() === 0 would produce an all-zero board without the repair step.
    expect(isSolved(scramble(9, () => 0))).toBe(false)
  })

  it('uses the whole range of rotations over many draws', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 2000; i++) scramble(9).forEach((r) => seen.add(r))
    expect([...seen].sort()).toEqual([0, 1, 2, 3])
  })
})
