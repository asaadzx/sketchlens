import { useMemo } from 'react'
import { ArrowRight, Crosshair, Ruler, TriangleAlert } from 'lucide-react'
import type { Mode, ModeId } from '../lib/modes'
import { MODES, getMode } from '../lib/modes'
import { formatRealSize } from '../lib/calibration'

export function ModeSelect({
  onPick,
  sharedTargetMm,
}: {
  onPick: (id: ModeId) => void
  sharedTargetMm?: number | null
}) {
  return (
    <div className="absolute inset-0 z-50 overflow-y-auto overscroll-contain bg-char">
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#3a3128_0%,#14110e_70%)]" />
      <div className="relative mx-auto flex min-h-full w-full max-w-md flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
        <header className="text-center">
          <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-cream/15 bg-cream/10">
            <Crosshair className="size-7" strokeWidth={1.6} />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-cream">What are you tracing onto?</h1>
          <p className="mt-2 text-pretty text-sm leading-relaxed text-cream/65">
            Each mode calibrates against a different reference object, so the app can show sizes in
            real millimetres instead of screen pixels.
          </p>
          {sharedTargetMm ? (
            <p className="mt-4 rounded-xl border border-clay/40 bg-clay/15 px-3 py-2.5 text-sm leading-relaxed text-cream/85">
              This link was shared at {formatRealSize(sharedTargetMm)} wide. Calibrate on this device
              and the overlay will match that real size.
            </p>
          ) : null}
        </header>

        <ul className="mt-6 space-y-2.5">
          {MODES.map((mode) => (
            <li key={mode.id}>
              <button
                type="button"
                onClick={() => onPick(mode.id)}
                style={{ minHeight: mode.targetSize + 26 }}
                className="group flex w-full items-center gap-4 rounded-2xl border border-cream/12 bg-cream/[0.06] px-4 py-3.5 text-left transition hover:border-clay hover:bg-cream/10"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-clay/90 text-cream">
                  <Ruler className="size-5" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.95rem] font-semibold text-cream">{mode.label}</span>
                  <span className="block truncate text-xs text-cream/55">{mode.hint}</span>
                </span>
                <ArrowRight
                  className="size-4 shrink-0 text-cream/30 transition group-hover:translate-x-0.5 group-hover:text-clay"
                  strokeWidth={2}
                />
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => onPick('paper')}
          className="mt-5 w-full rounded-full px-4 py-3 text-sm font-medium text-cream/50 underline underline-offset-4 transition hover:text-cream/80"
        >
          Skip — just eyeball the size
        </button>
      </div>
    </div>
  )
}

export function Instructions({
  modeId,
  step,
  stepCount,
  onNext,
  onBack,
  onSkip,
  targetSize,
}: {
  modeId: ModeId
  step: number
  stepCount: number
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  targetSize: number
}) {
  const mode = getMode(modeId)
  const current = mode.steps[step]
  const last = step >= mode.steps.length - 1

  const dots = useMemo(
    () => mode.steps.map((_, index) => index),
    [mode.steps],
  )

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-char/92 backdrop-blur-sm">
      <div className="w-full rounded-t-3xl border-t border-cream/12 bg-char/97 px-5 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cream/50">
            {mode.label} · {step + 1}/{stepCount}
          </p>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-cream/50 transition hover:bg-cream/10 hover:text-cream"
          >
            Skip
          </button>
        </div>

        <div className="mt-3 flex gap-1.5">
          {dots.map((index) => (
            <span
              key={index}
              className={`h-1 flex-1 rounded-full transition ${
                index <= step ? 'bg-clay' : 'bg-cream/15'
              }`}
            />
          ))}
        </div>

        <h2 className="mt-4 text-xl leading-tight font-semibold text-cream">{current.title}</h2>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-cream/70">{current.body}</p>

        <div className="mt-5 flex gap-2.5">
          {step > 0 ? (
            <button
              type="button"
              onClick={onBack}
              style={{ minHeight: targetSize + 6 }}
              className="rounded-full border border-cream/20 px-5 text-sm font-semibold text-cream/80 transition hover:bg-cream/10"
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={onNext}
            style={{ minHeight: targetSize + 6 }}
            className="flex-1 rounded-full bg-clay px-6 text-base font-semibold text-cream transition hover:bg-clay-deep"
          >
            {last ? 'Set the scale' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ModeTip({ mode }: { mode: Mode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-line bg-shell/70 px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
      {mode.tip}
    </p>
  )
}

export function CalibrationBadge({
  targetMm,
  modeLabel,
}: {
  targetMm: number | null
  modeLabel: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-cream/20 bg-char/70 px-2.5 py-1 text-[0.7rem] font-medium text-cream/80 backdrop-blur-md">
      <Ruler className="size-3" strokeWidth={2.2} />
      {modeLabel}
      {targetMm !== null ? <span className="tabular text-cream/55">{' '}{formatRealSize(targetMm)}</span> : null}
    </span>
  )
}
