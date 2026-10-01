import { useEffect, useRef } from 'react'
import { Aperture, CameraOff, RotateCw, SwitchCamera } from 'lucide-react'
import type { CameraState } from '../hooks/useCamera'

/**
 * The <video> is mounted permanently, including behind the permission gate.
 * Rendering it conditionally meant the stream had nowhere to attach on the
 * first start, so the preview stayed black on iOS and desktop.
 */
export function CameraFeed({
  stream,
  camera,
  trace,
  onVideo,
}: {
  stream: MediaStream | null
  camera: CameraState
  trace: boolean
  onVideo: (element: HTMLVideoElement | null) => void
}) {
  const localRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const element = localRef.current
    if (!element) return
    onVideo(element)

    if (element.srcObject !== stream) {
      element.srcObject = stream
    }
    if (stream && element.paused) {
      // Muted + playsInline means autoplay is allowed, but Safari can still
      // reject until the element has metadata, so retry on canplay.
      void element.play().catch(() => undefined)
    }
    if (!stream) {
      element.removeAttribute('src')
      element.load()
    }
  }, [stream, onVideo])

  return (
    <video
      ref={localRef}
      playsInline
      muted
      autoPlay
      disablePictureInPicture
      aria-hidden
      tabIndex={-1}
      className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${
        stream ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        filter: trace ? 'brightness(0.82) saturate(0.85)' : 'none',
        transform: camera.facing === 'user' ? 'scaleX(-1)' : 'none',
      }}
      onCanPlay={() => {
        const element = localRef.current
        if (element && stream && element.paused) void element.play().catch(() => undefined)
      }}
    />
  )
}

export function CameraGate({
  status,
  error,
  hasImage,
  onStart,
  onContinue,
}: {
  status: CameraState['status']
  error: string
  hasImage: boolean
  onStart: () => void
  onContinue: () => void
}) {
  const denied = status === 'denied' || status === 'error'
  const waiting = status === 'requesting'
  const unavailable = status === 'missing' || status === 'denied' || status === 'error'

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
          <p className="w-full rounded-2xl border border-clay/40 bg-clay/15 px-4 py-3 text-sm leading-relaxed text-cream/85">
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

          {(hasImage || unavailable) ? (
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-cream/20 px-5 py-3 text-sm font-semibold text-cream/80 transition hover:bg-cream/10 hover:text-cream"
            >
              <CameraOff className="size-4" strokeWidth={1.75} />
              {hasImage ? 'Continue with the shared setup' : 'Skip camera and pick an image'}
            </button>
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
