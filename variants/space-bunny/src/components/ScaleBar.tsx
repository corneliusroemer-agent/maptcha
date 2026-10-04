export interface Scale {
  label: string
  metres: number
}

/** Ground size of one square, as offered in the UI. */
export const SCALES: readonly Scale[] = [
  { label: '100 m', metres: 100 },
  { label: '250 m', metres: 250 },
  { label: '500 m', metres: 500 },
  { label: '1 km', metres: 1000 },
  { label: '2 km', metres: 2000 },
  { label: '10 km', metres: 10000 },
]

interface Props {
  metresPerCell: number
  onPick: (metres: number) => void
}

export function ScaleBar({ metresPerCell, onPick }: Props) {
  return (
    <div
      className="scalebar"
      role="group"
      aria-label="Ground size of each square"
    >
      {SCALES.map((s) => (
        <button
          key={s.metres}
          type="button"
          className="chip"
          aria-pressed={metresPerCell === s.metres}
          data-testid={`scale-${s.metres}`}
          onClick={() => onPick(s.metres)}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}
