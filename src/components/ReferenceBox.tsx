import { useRef, useState } from 'react'
import { Check, Ruler } from 'lucide-react'
import {
  assessPrecision,
  formatRealSize,
  pxPerMmFor,
  bestUnit,
  type Unit,
} from '../lib/calibration'
import { getMode } from '../lib/modes'
import { applyDrag, type Box, type Handle } from '../lib/reference'

/**
 * The user frames their reference by dragging the box, not by tapping corners.
 * A drag is one continuous gesture, so there is no per-tap precision tax, which
 * matters when the phone is held at arm's length against a wall.
 */
export function ReferenceBox({
  modeId,
  referenceWidthMm,
  box,
  viewportWidth,
  viewportHeight,
  onBox,
  onCalibrate,
}: {
  modeId: string
  referenceWidthMm: number
  box: Box
  viewportWidth: number
  viewportHeight: number
  onBox: (box: Box) => void
  onCalibrate: (pxPerMm: number, referenceMm: number) => void
}) {
  const mode = getMode(modeId as never)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ handle: Handle; startX: number; startY: number; start: Box } | null>(null)
  const [widthText, setWidthText] = useState(String(Math.round(referenceWidthMm)))
  const [widthError, setWidthError] = useState('')
  const [editWidth, setEditWidth] = useState(!mode.referenceIsKnown)

  const refMm = Number(widthText)
  const valid = refMm >= 20 && refMm <= 20000
  const pxPerMm = valid ? pxPerMmFor(box.width, refMm) : 0
  const precision = assessPrecision(box.width, pxPerMm || 1, mode)
  const target = mode.targetSize

  const begin = (handle: Handle, event: React.PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const stage = stageRef.current
    if (!stage) return
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
    dragRef.current = { handle, startX: event.clientX, startY: event.clientY, start: box }
  }

  const move = (event: React.PointerEvent) => {
    const drag = dragRef.current
    const stage = stageRef.current
    if (!drag || !stage) return
    event.preventDefault()
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    onBox(applyDrag(drag.start, drag.handle, dx, dy, viewportWidth, viewportHeight))
  }

  const end = (event: React.PointerEvent) => {
    if (!dragRef.current) return
    ;(event.target as Element).releasePointerCapture?.(event.pointerId)
    dragRef.current = null
  }

  const usable = valid && pxPerMm > 0 && precision.level !== 'unusable'

  return (
    <div ref={stageRef} className="no-touch absolute inset-0 select-none">
      <div className="pointer-events-none absolute inset-0 bg-char/35" />

      <div
        role="group"
        aria-label={`Reference frame, ${Math.round(box.width)} by ${Math.round(box.height)} pixels`}
        className="absolute border-2 border-clay"
        style={{
          left: box.x,
          top: box.y,
          width: box.width,
          height: box.height,
          boxShadow: '0 0 0 9999px rgb(20 17 14 / 0.18)',
        }}
        onPointerDown={(event) => begin('move', event)}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <span className="pointer-events-none absolute -top-0.5 left-0 h-1 w-10 bg-clay" />
        <span className="pointer-events-none absolute -top-0.5 right-0 h-1 w-10 bg-clay" />
        <span className="pointer-events-none absolute -bottom-0.5 left-0 h-1 w-10 bg-clay" />
        <span className="pointer-events-none absolute -bottom-0.5 right-0 h-1 w-10 bg-clay" />
        <span className="pointer-events-none absolute top-0 left-0 h-10 w-1 bg-clay" />
        <span className="pointer-events-none absolute top-0 right-0 h-10 w-1 bg-clay" />
        <span className="pointer-events-none absolute bottom-0 left-0 h-10 w-1 bg-clay" />
        <span className="pointer-events-none absolute right-0 bottom-0 h-10 w-1 bg-clay" />

        {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
          <span
            key={corner}
            role="button"
            tabIndex={-1}
            aria-label={`Resize from the ${{ nw: 'top left', ne: 'top right', sw: 'bottom left', se: 'bottom right' }[corner]}`}
            onPointerDown={(event) => begin(corner, event)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            className="absolute rounded-full border-2 border-cream bg-clay"
            style={{
              width: target,
              height: target,
              // Inset by half so the visible dot sits on the actual corner.
              left: corner.includes('w') ? -target / 2 : undefined,
              right: corner.includes('e') ? -target / 2 : undefined,
              top: corner.startsWith('n') ? -target / 2 : undefined,
              bottom: corner.startsWith('s') ? -target / 2 : undefined,
              touchAction: 'none',
            }}
          />
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-md space-y-2 rounded-2xl border border-line bg-card/96 p-3 backdrop-blur-md">
          <div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-soft">
            <Ruler className="size-3.5" strokeWidth={2} />
            Real width of the {mode.referenceLabel}
          </div>

          {editWidth || !mode.referenceIsKnown ? (
            <div className="flex items-center gap-2">
              <input
                value={widthText}
                onChange={(event) => {
                  setWidthText(event.target.value)
                  setWidthError('')
                }}
                inputMode="decimal"
                aria-label="Real width in millimetres"
                className="w-full rounded-lg border border-line bg-shell px-3 py-2 text-base tabular outline-none focus:border-clay"
              />
              <span className="text-sm font-semibold text-ink-soft">mm</span>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">
              Known at{' '}
              <button
                type="button"
                onClick={() => setEditWidth(true)}
                className="font-semibold text-clay underline underline-offset-2"
              >
                {formatRealSize(referenceWidthMm)}
              </button>
            </p>
          )}

          {widthError ? <p className="text-sm text-clay-deep">{widthError}</p> : null}

          <PrecisionLine
            precision={precision.level}
            errorMm={precision.errorMm}
            widthPx={box.width}
          />

          <button
            type="button"
            disabled={!usable}
            onClick={() => onCalibrate(pxPerMm, refMm)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-clay px-4 py-3 text-sm font-semibold text-cream transition hover:bg-clay-deep disabled:opacity-40"
          >
            <Check className="size-4" strokeWidth={2.4} />
            Use this scale
          </button>

          {mode.referenceIsKnown && editWidth ? (
            <button
              type="button"
              onClick={() => {
                setEditWidth(false)
                setWidthText(String(Math.round(referenceWidthMm)))
              }}
              className="w-full text-xs font-medium text-ink-faint hover:text-ink"
            >
              Use the standard size instead
            </button>
          ) : null}
        </div>

        <p className="text-center text-xs text-cream/75">
          Drag the box until its edges sit on the reference
        </p>
      </div>
    </div>
  )
}

function PrecisionLine({
  precision,
  errorMm,
  widthPx,
}: {
  precision: 'good' | 'coarse' | 'unusable'
  errorMm: number
  widthPx: number
}) {
  if (precision === 'unusable') {
    return (
      <p className="text-sm font-medium text-clay-deep">
        Too small to measure. Step closer or zoom in until the box is wider.
      </p>
    )
  }
  const unit = bestUnit(errorMm * 2)
  return (
    <p
      className={`text-xs ${
        precision === 'good' ? 'text-pine' : 'text-clay-deep'
      }`}
    >
      {precision === 'good' ? 'Good precision' : 'Rough, about'} · ±
      {formatRealSize(errorMm * 2, unit as Unit)} at {Math.round(widthPx)} px
    </p>
  )
}
