import { useCallback, useEffect, useRef, useState } from 'react'
import { Info, Layers } from 'lucide-react'
import { CameraFeed, CameraGate, FlipButton, RotateNudge } from './components/CameraFeed'
import { ControlBar } from './components/ControlBar'
import { InfoPanel } from './components/InfoPanel'
import { Overlay } from './components/Overlay'
import { SourcePanel, type PickedImage } from './components/SourcePanel'
import { IconButton, Toast } from './components/ui'
import { useCamera } from './hooks/useCamera'
import { useOverlayGestures } from './hooks/useOverlayGestures'
import { useViewport } from './hooks/useViewport'
import { captureFrame } from './lib/capture'
import { toPixel, type PixelTransform } from './lib/overlay'
import { buildShareUrl, decodeState } from './lib/share'
import {
  DEFAULT_OPACITY,
  DEFAULT_SIZE,
  MAX_OPACITY,
  MAX_SIZE,
  MIN_OPACITY,
  MIN_SIZE,
  clamp,
  type OverlayState,
  type WorkState,
} from './lib/types'

type Sheet = 'none' | 'source' | 'info'

const EMPTY: WorkState = { overlay: null, visible: true, trace: false, locked: false }
const GUIDES = [33.333, 66.666]

export default function App() {
  const viewport = useViewport()
  const camera = useCamera()
  /* A shared link carries the whole setup, so seed the initial state from the
     query string instead of patching it in after the first paint. */
  const [state, setState] = useState<WorkState>(() => {
    const incoming = decodeState(window.location.search)
    return incoming?.overlay ? { ...EMPTY, ...incoming } : EMPTY
  })
  const [sheet, setSheet] = useState<Sheet>('none')
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'warn' } | null>(null)
  const [shared, setShared] = useState(false)
  const [loadingImage, setLoadingImage] = useState(false)
  const [stage, setStage] = useState<HTMLDivElement | null>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  /* Lets someone without a working camera still use the overlay on a photo. */
  const [skipped, setSkipped] = useState(false)

  const objectUrlRef = useRef<string | null>(null)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const overlay = state.overlay

  const flash = useCallback((message: string, tone: 'ok' | 'warn' = 'ok') => {
    setToast({ message, tone })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    },
    [],
  )

  /* Probe the source image once: the gesture maths needs its true pixel size and
     the canvas capture needs a decoded, CORS-clean copy. All setState happens in
     the load callbacks, never synchronously in the effect body. */
  const src = overlay?.src
  useEffect(() => {
    if (!src) return

    let cancelled = false
    const finish = () => {
      if (!cancelled) setLoadingImage(false)
    }

    const adopt = (probe: HTMLImageElement) => {
      if (cancelled) return
      setImage(probe)
      finish()
      setState((previous) => {
        const current = previous.overlay
        if (
          !current ||
          current.src !== src ||
          (current.naturalW === probe.naturalWidth && current.naturalH === probe.naturalHeight)
        ) {
          return previous
        }
        return {
          ...previous,
          overlay: { ...current, naturalW: probe.naturalWidth, naturalH: probe.naturalHeight },
        }
      })
    }

    const crossOrigin = new Image()
    crossOrigin.crossOrigin = 'anonymous'
    crossOrigin.referrerPolicy = 'no-referrer'
    crossOrigin.onload = () => adopt(crossOrigin)
    crossOrigin.onerror = () => {
      // Plenty of hosts serve images without CORS headers. They still display
      // fine, they just cannot be drawn onto a canvas.
      if (cancelled) return
      const plain = new Image()
      plain.referrerPolicy = 'no-referrer'
      plain.onload = () => adopt(plain)
      plain.onerror = () => {
        finish()
        if (!src.startsWith('blob:')) flash('That image could not be loaded.', 'warn')
      }
      plain.src = src
    }
    crossOrigin.src = src

    return () => {
      cancelled = true
    }
  }, [src, flash])

  const readPixel = useCallback(
    (): PixelTransform => {
      const current = stateRef.current.overlay
      if (!current) return { cx: 0, cy: 0, rot: 0, k: 1 }
      return toPixel(current, viewport.width, viewport.height)
    },
    [viewport.width, viewport.height],
  )

  const writePixel = useCallback(
    (next: PixelTransform) => {
      setState((previous) => {
        const current = previous.overlay
        if (!current || previous.locked || !previous.visible) return previous
        const size = clamp(
          (next.k * Math.max(1, current.naturalW)) / Math.max(1, Math.min(viewport.width, viewport.height)),
          MIN_SIZE,
          MAX_SIZE,
        )
        return {
          ...previous,
          overlay: {
            ...current,
            x: next.cx / Math.max(1, viewport.width),
            y: next.cy / Math.max(1, viewport.height),
            size,
            rot: next.rot,
          },
        }
      })
    },
    [viewport.width, viewport.height],
  )

  useOverlayGestures({
    element: stage,
    enabled: Boolean(overlay) && state.visible && !state.locked,
    read: readPixel,
    write: writePixel,
    onGestureStart: () => setShared(false),
  })

  /* Mirror the live setup in the address bar so the phone's own share sheet
     hands over a working link. */
  useEffect(() => {
    if (!overlay?.shareable) return
    const params = new URLSearchParams()
    params.set('img', overlay.src)
    if (overlay.attribution) params.set('by', overlay.attribution)
    params.set('w', String(Math.round(overlay.naturalW)))
    params.set('h', String(Math.round(overlay.naturalH)))
    params.set('x', overlay.x.toFixed(4))
    params.set('y', overlay.y.toFixed(4))
    params.set('size', overlay.size.toFixed(4))
    params.set('rot', overlay.rot.toFixed(2))
    params.set('op', overlay.opacity.toFixed(3))
    if (state.trace) params.set('trace', '1')
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
  }, [overlay, state.trace])

  const pickImage = useCallback((picked: PickedImage) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = picked.shareable ? null : picked.src

    const next: OverlayState = {
      src: picked.src,
      attribution: picked.attribution,
      naturalW: 1200,
      naturalH: 1200,
      x: 0,
      y: 0,
      size: DEFAULT_SIZE,
      rot: 0,
      opacity: DEFAULT_OPACITY,
      shareable: picked.shareable,
    }
    setState((previous) => ({ ...previous, overlay: next, visible: true, trace: false, locked: false }))
    setSheet('none')
    setShared(false)
  }, [])

  const patch = useCallback((changes: Partial<WorkState>) => {
    setState((previous) => ({ ...previous, ...changes }))
    setShared(false)
  }, [])

  const patchOverlay = useCallback((changes: Partial<OverlayState>) => {
    setState((previous) =>
      previous.overlay ? { ...previous, overlay: { ...previous.overlay, ...changes } } : previous,
    )
    setShared(false)
  }, [])

  const reset = useCallback(() => {
    patchOverlay({ x: 0, y: 0, size: DEFAULT_SIZE, rot: 0 })
    flash('Overlay reset')
  }, [patchOverlay, flash])

  const share = useCallback(async () => {
    const url = buildShareUrl(stateRef.current)
    try {
      if (navigator.share) {
        await navigator.share({ title: 'SketchLens setup', url })
        setShared(true)
        return
      }
      await navigator.clipboard.writeText(url)
      setShared(true)
      flash('Share link copied')
    } catch {
      flash('Could not share that link.', 'warn')
    }
  }, [flash])

  const capture = useCallback(async () => {
    if (!overlay) return
    const blob = await captureFrame({
      video,
      image,
      pixel: toPixel(overlay, viewport.width, viewport.height),
      stageW: viewport.width,
      stageH: viewport.height,
      opacity: overlay.opacity,
      trace: state.trace,
    })
    if (!blob) {
      flash('That image cannot be saved from this host.', 'warn')
      return
    }
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `sketchlens-${Date.now()}.jpg`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    flash('Photo saved')
  }, [overlay, image, video, viewport.width, viewport.height, state.trace, flash])

  const hasOverlay = Boolean(overlay)
  const cameraLive = camera.status === 'live'

  return (
    <div className="relative h-full w-full overflow-hidden bg-char text-cream">
      <div ref={setStage} className="no-touch absolute inset-0 select-none overflow-hidden">
        {/* Always mounted so the stream has an element to attach to, even
            before the permission gate is dismissed. */}
        <CameraFeed
          stream={camera.stream}
          camera={camera}
          trace={state.trace}
          onVideo={setVideo}
        />

        {state.trace ? (
          <>
            <div aria-hidden className="pointer-events-none absolute inset-0">
              {GUIDES.map((at) => (
                <div key={at}>
                  <div className="absolute inset-y-0 w-px bg-cream/25" style={{ left: `${at}%` }} />
                  <div className="absolute inset-x-0 h-px bg-cream/25" style={{ top: `${at}%` }} />
                </div>
              ))}
            </div>
            <div
              aria-hidden
              className="animate-trace-pulse pointer-events-none absolute inset-4 rounded-2xl border border-dashed border-cream/35"
            />
          </>
        ) : null}

        {overlay && state.visible ? (
          <Overlay state={overlay} width={viewport.width} height={viewport.height} trace={state.trace} />
        ) : null}

        {hasOverlay && !state.visible ? (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-fit rounded-full bg-char/80 px-4 py-2 text-sm text-cream/85 backdrop-blur">
            Overlay hidden — this is the bare wall
          </p>
        ) : null}
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl border border-cream/20 bg-char/70 text-cream backdrop-blur-md">
            <Layers className="size-4.5" strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <p className="text-sm leading-none font-semibold tracking-tight">SketchLens</p>
            <p className="mt-1 truncate text-[0.7rem] leading-none text-cream/60">
              {state.locked ? 'Locked in place' : hasOverlay ? 'Adjust until it fits' : 'No image yet'}
            </p>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {hasOverlay && !state.locked ? (
            <RotateNudge onRotate={() => patchOverlay({ rot: (overlay?.rot ?? 0) + 5 })} />
          ) : null}
          {camera.hasMultiple ? <FlipButton onFlip={camera.flip} /> : null}
          <IconButton label="How it works" onClick={() => setSheet('info')} tone="char">
            <Info className="size-5" strokeWidth={1.75} />
          </IconButton>
        </div>
      </header>

      {hasOverlay && overlay?.attribution && !state.locked ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-[calc(8.25rem+env(safe-area-inset-bottom))] z-10 mx-auto w-fit max-w-[90%] truncate rounded-full bg-char/65 px-3.5 py-1.5 text-[0.7rem] text-cream/75 backdrop-blur-md">
          {overlay.attribution}
        </p>
      ) : null}

      <ControlBar
        hasOverlay={hasOverlay}
        visible={state.visible}
        locked={state.locked}
        trace={state.trace}
        opacity={overlay?.opacity ?? DEFAULT_OPACITY}
        canShare={Boolean(overlay?.shareable)}
        shared={shared}
        onOpenSource={() => setSheet('source')}
        onToggleVisible={() => patch({ visible: !state.visible })}
        onToggleLock={() => patch({ locked: !state.locked })}
        onToggleTrace={() => patch({ trace: !state.trace, locked: !state.trace })}
        onOpacity={(value) => patchOverlay({ opacity: clamp(value, MIN_OPACITY, MAX_OPACITY) })}
        onCapture={() => void capture()}
        onShare={() => void share()}
        onReset={reset}
      />

      <SourcePanel
        open={sheet === 'source'}
        onClose={() => setSheet('none')}
        onPick={pickImage}
        busy={loadingImage}
      />

      {sheet === 'info' ? <InfoPanel onClose={() => setSheet('none')} /> : null}

      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}

      {cameraLive || skipped ? null : (
        <CameraGate
          status={camera.status}
          error={camera.error}
          hasImage={hasOverlay}
          onStart={() => void camera.start()}
          onContinue={() => setSkipped(true)}
        />
      )}
    </div>
  )
}
