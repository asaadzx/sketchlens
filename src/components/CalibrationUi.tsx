import { useState } from 'react'
import { MoveHorizontal, TriangleAlert } from 'lucide-react'
import {
  formatRealSize,
  parseRealSize,
  toUnit,
  type QualityLevel,
  type Unit,
} from '../lib/calibration'

/**
 * Real size field. Dragging stays the primary interaction, but typing an exact
 * size matters when you already know it and are chasing a specific dimension.
 */
/** Live readout of what the overlay measures on the actual wall. */
export function RealSizeReadout({
  targetMm,
  calibrated,
}: {
  targetMm: number | null
  calibrated: boolean
}) {
  if (!calibrated || targetMm === null) {
    return <span className="tabular text-cream/55">size unknown</span>
  }
  return (
    <span className="tabular">
      <span className="font-semibold text-cream">{formatRealSize(targetMm)}</span>
      {' '}
      <span className="text-cream/50">wide</span>
    </span>
  )
}

export function SizeField({
  targetMm,
  unit,
  onUnitChange,
  onCommit,
  minMm = 10,
  maxMm = 20000,
}: {
  targetMm: number
  unit: Unit
  onUnitChange: (unit: Unit) => void
  onCommit: (mm: number) => void
  minMm?: number
  maxMm?: number
}) {
  const format = (mm: number, forUnit: Unit) => toUnit(mm, forUnit).toFixed(forUnit === 'mm' ? 0 : 2)
  const [text, setText] = useState(() => format(targetMm, unit))
  const [error, setError] = useState('')

  // Re-sync when the target changes from a drag or a calibration. Adjusting
  // state during render is the React-recommended alternative to an effect here.
  const [syncKey, setSyncKey] = useState(`${targetMm}|${unit}`)
  if (syncKey !== `${targetMm}|${unit}`) {
    setSyncKey(`${targetMm}|${unit}`)
    setText(format(targetMm, unit))
    setError('')
  }

  const submit = () => {
    const mm = parseRealSize(text)
    if (mm === null) {
      setError('Enter a number like 21, 21cm or 1.4m')
      return
    }
    if (mm < minMm || mm > maxMm) {
      setError(`Must be between ${formatRealSize(minMm)} and ${formatRealSize(maxMm)}`)
      return
    }
    setError('')
    onCommit(mm)
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-card px-2.5 py-1.5 focus-within:border-clay">
        <input
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setError('')
          }}
          onBlur={submit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
          inputMode="decimal"
          aria-label={`Projected width in ${unit}`}
          className="tabular w-full min-w-0 bg-transparent text-base outline-none"
        />
        <div className="flex shrink-0 gap-0.5">
          {(['mm', 'cm', 'm'] as Unit[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setText(format(targetMm, option))
                onUnitChange(option)
              }}
              className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
                option === unit ? 'bg-clay text-cream' : 'bg-shell text-ink-soft hover:text-ink'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      {error ? <p className="text-xs text-clay-deep">{error}</p> : null}
    </div>
  )
}

/**
 * Warns when the source image cannot hold up at the projected size. The
 * thresholds come from the mode: a three metre projection needs far more source
 * resolution than a sheet of A4.
 */
export function QualityWarning({
  level,
  sourcePx,
  requiredSourcePx,
  targetMm,
}: {
  level: QualityLevel
  sourcePx: number
  requiredSourcePx: number
  targetMm: number
}) {
  if (level === 'ok') return null

  const fuzzy = level === 'fuzzy'

  return (
    <p
      role="status"
      className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs leading-relaxed ${
        fuzzy
          ? 'border-clay/45 bg-clay/12 text-clay-deep'
          : 'border-line bg-shell/80 text-ink-soft'
      }`}
    >
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
      {fuzzy ? (
        <>
          Your {sourcePx} px image will look fuzzy at {formatRealSize(targetMm)} wide.{' '}
          {requiredSourcePx} px or more is needed. Pick a higher resolution image, or project it
          smaller.
        </>
      ) : (
        <>
          A little soft at {formatRealSize(targetMm)} wide. It will be enlarged past its{' '}
          {sourcePx} px source; {requiredSourcePx} px or more would be sharp.
        </>
      )}
    </p>
  )
}

export function DriftWarning({ modeLabel }: { modeLabel: string }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-clay/35 bg-clay/10 px-3 py-2 text-xs leading-relaxed text-cream/85">
      <MoveHorizontal className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
      This scale holds only while the phone stays put. On {modeLabel.toLowerCase()} sizes, prop the
      phone up or have someone hold it, then lock the overlay before you start tracing.
    </p>
  )
}
