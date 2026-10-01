import { Aperture, CameraOff, RotateCw, SwitchCamera } from 'lucide-react'
import type { CameraState } from '../hooks/useCamera'

export function CameraFeed({
  video,
  camera,
  trace,
}: {
  video: React.RefObject<HTMLVideoElement | null>
  camera: CameraState
  trace: boolean
}) {
  return (
    <video
      ref={video}
      playsInline
      muted
      autoPlay
      aria-hidden
      className="absolute inset-0 size-full object-cover transition-[filter] duration-300"
      style={{
        filter: trace ? 'brightness(0.82) saturate(0.85)' : 'none',
        transform: camera.facing === 'user' ? 'scaleX(-1)' : 'none',
      }}
    />
  )
}

export function CameraGate({
  status,
  error,
  hasImage,
  onStart,
}: {
  status: CameraState['status']
  error: string
  hasImage: boolean
  onStart: () => void
}) {
  const denied = status === 'denied' || status === 'error'
  const waiting = status === 'requesting'

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-char">
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#3a3128_0%,#14110e_70%)]" />
      <div className="relative flex w-full max-w-md flex-col items-center gap-6 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-16 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl border border-cream/15 bg-cream/10 text-cream backdrop-blur">
          <Aperture className="size-8" strokeWidth={1.5} />
        </span>

        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-cream">SketchLens</h1>
          <p className="text-pretty text-[0.95rem] leading-relaxed text-cream/70">
            Point your camera at the wall, drop an image on top of it, line it up, and trace it
            straight onto the plaster.
          </p>
        </div>

        {denied ? (
          <p className="rounded-2xl border border-clay/40 bg-clay/15 px-4 py-3 text-sm leading-relaxed text-cream/85">
            {error}
          </p>
        ) : null}

        <div className="flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={onStart}
            disabled={waiting}
            className="inline-flex h-13 w-full items-center justify-center gap-2.5 rounded-2xl bg-clay px-6 py-4 text-base font-semibold text-cream transition hover:bg-clay-deep disabled:opacity-60"
          >
            {waiting ? (
              'Waiting for permission…'
            ) : (
              <>
                <Aperture className="size-5" strokeWidth={2} />
                {denied ? 'Try camera again' : 'Open camera'}
              </>
            )}
          </button>

          {hasImage ? (
            <p className="flex items-center justify-center gap-2 text-sm text-cream/50">
              <CameraOff className="size-4" strokeWidth={1.75} />
              Or continue with the setup from this link
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function FlipButton({ onFlip }: { onFlip: () => void }) {
  return (
    <button
      type="button"
      onClick={onFlip}
      aria-label="Flip camera"
      title="Flip camera"
      className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-card/92 text-ink backdrop-blur-md transition hover:border-ink/40"
    >
      <SwitchCamera className="size-5" strokeWidth={1.75} />
    </button>
  )
}

export function RotateNudge({ onRotate }: { onRotate: () => void }) {
  return (
    <button
      type="button"
      onClick={onRotate}
      aria-label="Rotate 5 degrees"
      title="Rotate 5°"
      className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-card/92 text-ink backdrop-blur-md transition hover:border-ink/40"
    >
      <RotateCw className="size-5" strokeWidth={1.75} />
    </button>
  )
}
