import type { CSSProperties, ReactNode } from 'react'

export function IconButton({
  label,
  onClick,
  active = false,
  disabled = false,
  tone = 'cream',
  children,
}: {
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  tone?: 'cream' | 'char' | 'clay'
  children: ReactNode
}) {
  const tones = {
    cream: active
      ? 'bg-ink text-cream border-ink'
      : 'bg-card/92 text-ink border-line hover:border-ink/40',
    char: active
      ? 'bg-cream text-char border-cream'
      : 'bg-char/85 text-cream/90 border-cream/20 hover:bg-char',
    clay: active
      ? 'bg-clay-deep text-cream border-clay-deep'
      : 'bg-clay text-cream border-clay hover:bg-clay-deep',
  } as const

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full border backdrop-blur-md transition disabled:pointer-events-none disabled:opacity-40 ${tones[tone]}`}
    >
      {children}
    </button>
  )
}

export function Slider({
  label,
  value,
  onChange,
  icon,
  hint,
  min = 0,
  max = 1,
  step = 0.01,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  icon?: ReactNode
  hint?: string
  min?: number
  max?: number
  step?: number
}) {
  const percent = ((value - min) / (max - min)) * 100
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-soft">
        {icon}
        {label}
        {hint ? <span className="tabular ml-auto text-ink-faint">{hint}</span> : null}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        className="range-clay"
        style={{ '--fill': `${percent}%` } as CSSProperties}
      />
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div role="tablist" className="flex gap-1 rounded-full bg-shell p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
            option.value === value ? 'bg-card text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Panel({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex max-h-[78%] flex-col justify-end">
      <div className="animate-rise rounded-t-3xl border-t border-line bg-cream/97 shadow-[0_-12px_40px_rgb(33_28_23/0.18)] backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-shell hover:text-ink"
          >
            Done
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  )
}

export function Toast({ message, tone = 'ok' }: { message: string; tone?: 'ok' | 'warn' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none absolute inset-x-0 top-3 z-40 mx-auto w-fit max-w-[92%] rounded-full px-4 py-2 text-center text-sm font-medium shadow-lg backdrop-blur-md ${
        tone === 'ok' ? 'bg-char/92 text-cream' : 'bg-clay-deep text-cream'
      }`}
    >
      {message}
    </div>
  )
}
