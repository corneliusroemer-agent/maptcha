/**
 * Puzzle state: which way each cell is turned, and whether that is the map.
 *
 * Pure and framework-free so the rules can be tested without a browser. The one
 * rule that is easy to get wrong is the win condition — a cell is correct only
 * when its rotation is exactly 0 mod 4, so it is written as a modulo rather
 * than a comparison to keep the "four clicks returns you to the start" case
 * honest.
 */

export const ROTATIONS = [0, 90, 180, 270] as const
export type Rotation = (typeof ROTATIONS)[number]
export const TURNS_PER_ROTATION = 4

export type RotationState = number[]

export const turn = (state: RotationState, index: number): RotationState =>
  state.map((r, i) => (i === index ? (((r + 1) % 4) as Rotation) : r))

export const turnBy = (
  state: RotationState,
  index: number,
  amount: number,
): RotationState =>
  state.map((r, i) =>
    i === index ? ((((r + amount) % 4) + 4) % 4) as Rotation : r,
  )

/** A cell is solved when it has been turned a whole number of full circles. */
export const isCellSolved = (rotation: number): boolean =>
  ((rotation % 4) + 4) % 4 === 0

export const solvedCount = (state: RotationState): number =>
  state.reduce((n, r) => n + (isCellSolved(r) ? 1 : 0), 0)

export const isSolved = (state: RotationState): boolean =>
  state.every(isCellSolved)

/**
 * A scrambled board that always leaves the player something to work with.
 *
 * Two guarantees, because both matter for how the board feels:
 *
 * - at least one cell starts correct, so there is a foothold and the player can
 *   read the map off the untouched squares. This mirrors the original captcha,
 *   which leaves some tiles in place.
 * - at least one cell starts wrong, so the board is never already solved — which
 *   would make the first click win.
 *
 * `rng` is injectable so tests get reproducible boards.
 */
export function scramble(
  cellCount: number,
  rng: () => number = Math.random,
): RotationState {
  const pick = (n: number) => Math.min(cellCount - 1, Math.floor(rng() * n))
  const turnBy = (r: number, n: number) =>
    ((((r + n) % 4) + 4) % 4) as Rotation

  const state: RotationState = []
  for (let i = 0; i < cellCount; i++) {
    state.push((Math.floor(rng() * 4) % 4) as Rotation)
  }

  // Repair whichever guarantee the draw happened to break. `hasInPlace` is
  // checked after the `!isSolved` repair too, since forcing one cell wrong can
  // never remove an in-place cell, but the order keeps both rules obvious.
  if (!state.some(isCellSolved)) {
    state[pick(cellCount)] = 0
  }
  if (isSolved(state)) {
    const i = state.findIndex((r) => r === 0)
    state[i] = turnBy(state[i] ?? 0, 1 + (Math.floor(rng() * 3) % 3))
  }

  return state
}

/**
 * Did the player change anything this round? Used to tell "solved it" apart
 * from "opened a board that happened to be already solved".
 *
 * Modulo-aware like `isCellSolved`, so a cell turned a full four times back to
 * where it started still counts as untouched.
 */
export const hasMoved = (state: RotationState): boolean =>
  state.some((r) => !isCellSolved(r))
