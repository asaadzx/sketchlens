import {
  Camera,
  Check,
  Crosshair,
  Eye,
  EyeOff,
  ImagePlus,
  Lock,
  LockOpen,
  MoveHorizontal,
  PenTool,
  RotateCcw,
  Share2,
  SlidersHorizontal,
} from 'lucide-react'
import { IconButton, Slider } from './ui'

export interface ControlProps {
  hasOverlay: boolean
  visible: boolean
  locked: boolean
  trace: boolean
  opacity: number
  canShare: boolean
  shared: boolean
  onOpenSource: () => void
  onToggleVisible: () => void
  onToggleLock: () => void
  onToggleTrace: () => void
  onOpacity: (value: number) => void
  onCapture: () => void
  onShare: () => void
  onReset: () => void
}

export function ControlBar(props: ControlProps) {
  const { hasOverlay, visible, locked, trace, opacity, canShare, shared } = props

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {hasOverlay && visible && !locked && !trace ? (
        <div className="animate-rise w-full max-w-md space-y-1 rounded-2xl border border-line bg-card/94 p-3 shadow-[0_10px_30px_rgb(33_28_23/0.16)] backdrop-blur-md">
          <p className="flex items-center justify-center gap-1.5 text-[0.68rem] font-medium text-ink-faint">
            <MoveHorizontal className="size-3.5" strokeWidth={2} />
            Drag to move · pinch to size · twist to angle
          </p>
          <Slider
            label="Opacity"
            value={opacity}
            onChange={props.onOpacity}
            hint={`${Math.round(opacity * 100)}%`}
            icon={<Eye className="size-3.5" strokeWidth={2} />}
          />
        </div>
      ) : null}

      {trace ? (
        <TraceBar onExit={props.onToggleTrace} onUnlock={props.onToggleLock} locked={locked} />
      ) : hasOverlay ? (
        <div className="flex items-center gap-2.5 rounded-full border border-line bg-card/94 p-2 pr-2 shadow-[0_10px_30px_rgb(33_28_23/0.16)] backdrop-blur-md">
          <IconButton label="Choose a different image" onClick={props.onOpenSource} tone="cream">
            <ImagePlus className="size-5" strokeWidth={1.75} />
          </IconButton>
          <IconButton
            label="Reset position"
            onClick={props.onReset}
            tone="cream"
            disabled={locked}
          >
            <RotateCcw className="size-5" strokeWidth={1.75} />
          </IconButton>
          <IconButton
            label={visible ? 'Hide the overlay' : 'Show the overlay'}
            onClick={props.onToggleVisible}
            active={!visible}
            tone="cream"
          >
            {visible ? (
              <Eye className="size-5" strokeWidth={1.75} />
            ) : (
              <EyeOff className="size-5" strokeWidth={1.75} />
            )}
          </IconButton>
          <IconButton
            label="Take a reference photo"
            onClick={props.onCapture}
            tone="cream"
            disabled={!visible}
          >
            <Camera className="size-5" strokeWidth={1.75} />
          </IconButton>
          <IconButton
            label={canShare ? 'Copy a share link' : 'Uploads cannot be shared'}
            onClick={props.onShare}
            active={shared}
            tone={canShare ? 'clay' : 'cream'}
            disabled={!canShare}
          >
            {shared ? <Check className="size-5" strokeWidth={2} /> : <Share2 className="size-5" strokeWidth={1.75} />}
          </IconButton>
          <IconButton
            label={locked ? 'Unlock the overlay' : 'Lock the overlay'}
            onClick={props.onToggleLock}
            active={locked}
            tone="cream"
          >
            {locked ? <Lock className="size-5" strokeWidth={1.75} /> : <LockOpen className="size-5" strokeWidth={1.75} />}
          </IconButton>
        </div>
      ) : (
        <button
          type="button"
          onClick={props.onOpenSource}
          className="inline-flex items-center gap-2.5 rounded-full bg-clay px-6 py-4 text-base font-semibold text-cream shadow-[0_10px_30px_rgb(33_28_23/0.24)] transition hover:bg-clay-deep"
        >
          <ImagePlus className="size-5" strokeWidth={2} />
          Pick an image
        </button>
      )}

      {!trace ? (
        <button
          type="button"
          onClick={props.onToggleTrace}
          disabled={!hasOverlay}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition disabled:opacity-35 ${
            hasOverlay
              ? 'border-cream/25 bg-char/85 text-cream/90 backdrop-blur-md hover:bg-char'
              : 'border-line bg-card/80 text-ink-faint'
          }`}
        >
          <PenTool className="size-4" strokeWidth={2} />
          Trace mode
        </button>
      ) : null}
    </div>
  )
}

function TraceBar({
  onExit,
  onUnlock,
  locked,
}: {
  onExit: () => void
  onUnlock: () => void
  locked: boolean
}) {
  return (
    <div className="animate-rise flex w-full max-w-md items-center gap-3 rounded-2xl border border-cream/15 bg-char/92 p-3 text-cream shadow-[0_14px_40px_rgb(20_17_14/0.5)] backdrop-blur-md">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-clay/90">
        <Crosshair className="size-4.5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">Tracing mode</p>
        <p className="truncate text-xs leading-tight text-cream/60">
          {locked ? 'Position locked — go ahead and trace' : 'Fine tune, then lock it'}
        </p>
      </div>
      <button
        type="button"
        onClick={onUnlock}
        className="inline-flex items-center gap-1.5 rounded-full border border-cream/20 px-3 py-2 text-xs font-semibold transition hover:bg-cream/10"
      >
        {locked ? <Lock className="size-3.5" strokeWidth={2} /> : <SlidersHorizontal className="size-3.5" strokeWidth={2} />}
        {locked ? 'Unlock' : 'Adjust'}
      </button>
      <button
        type="button"
        onClick={onExit}
        className="rounded-full bg-cream px-3.5 py-2 text-xs font-semibold text-char transition hover:bg-white"
      >
        Done
      </button>
    </div>
  )
}
