import { memo, useCallback } from 'react'

interface TileProps {
  index: number
  canvas: HTMLCanvasElement | null
  rotation: number
  disabled: boolean
  onRotate: (index: number, amount: number) => void
}

/**
 * One square of the puzzle.
 *
 * The map pixels live in a canvas that is drawn once and then only ever turned:
 * the rotation is a CSS transform, so it animates on the compositor without
 * redrawing anything. That also means the transformation is exactly reversible —
 * four clicks return the square to precisely where it started, subpixel and all.
 */
function TileImpl({ index, canvas, rotation, disabled, onRotate }: TileProps) {
  const hostRef = useCallback(
    (node: HTMLSpanElement | null) => {
      // A callback ref re-runs when `canvas` changes, so a new puzzle replaces
      // the old canvas instead of leaving it behind.
      if (node && canvas) node.replaceChildren(canvas)
    },
    [canvas],
  )

  return (
    <button
      type="button"
      className="tile"
      data-testid={`tile-${index}`}
      data-rotation={rotation}
      disabled={disabled}
      onClick={() => onRotate(index, 1)}
      onContextMenu={(e) => {
        e.preventDefault()
        onRotate(index, -1)
      }}
      aria-label={
        `Square ${index + 1}, turned ${rotation * 90} degrees. ` +
        `Click to turn clockwise, right-click to turn back.`
      }
    >
      <span
        ref={hostRef}
        className="tile__inner"
        style={{ transform: `rotate(${rotation * 90}deg)` }}
      />
    </button>
  )
}

export const Tile = memo(TileImpl)
