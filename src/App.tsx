import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Layers } from 'lucide-react'
import { CameraFeed, CameraGate, FlipButton, RotateNudge } from './components/CameraFeed'
import { ControlBar } from './components/ControlBar'
import { InfoPanel } from './components/InfoPanel'
import { Overlay } from './components/Overlay'
import { SourcePanel, type PickedImage } from './components/SourcePanel'
import { CalibrationBadge, Instructions, ModeSelect, ModeTip } from './components/ModeScreens'
import { ReferenceBox } from './components/ReferenceBox'
import { defaultBox, type Box } from './lib/reference'
import {
  DriftWarning,
  QualityWarning,
  RealSizeReadout,
  SizeField,
} from './components/CalibrationUi'
import { IconButton, Toast } from './components/ui'
import { useCamera } from './hooks/useCamera'
import { useOverlayGestures } from './hooks/useOverlayGestures'
import { useViewport } from './hooks/useViewport'
import { captureFrame } from './lib/capture'
import { toPixel, type PixelTransform } from './lib/overlay'
import { buildShareUrl, decodeState, encodeState, type SharedState, type SharedTarget } from './lib/share'
import { getMode, type ModeId } from './lib/modes'
import {
  assessQuality,
  bestUnit,
  defaultSizeFor,
  formatRealSize,
  isCalibrationUsable,
  realWidthMm,
  sizeFractionFor,
  type Calibration,
  type Unit,
} from './lib/calibration'
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
type Phase = 'mode' | 'instructions' | 'calibrate' | 'work'

const EMPTY: WorkState = { overlay: null, visible: true, trace: false, locked: false }
const GUIDES = [33.333, 66.666]

/** Strips the calibration fields so a shared link can seed plain work state. */
function workFrom(incoming: SharedState | null): WorkState {
  if (!incoming?.overlay) return EMPTY
  return {
    overlay: incoming.overlay,
    visible: incoming.visible ?? true,
    trace: incoming.trace ?? false,
    locked: incoming.locked ?? true,
  }
}

export default function App() {
  const viewport = useViewport()
  const camera = useCamera()
  const [incoming] = useState<SharedState | null>(() => decodeState(window.location.search))
  const [state, setState] = useState<WorkState>(() => workFrom(incoming))
  const [sheet, setSheet] = useState<Sheet>('none')
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'warn' } | null>(null)
  const [shared, setShared] = useState(false)
  const [loadingImage, setLoadingImage] = useState(false)
  const [stage, setStage] = useState<HTMLDivElement | null>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const [skipped, setSkipped] = useState(false)

  /* Scale and profile state. Kept beside WorkState because calibration is a
     property of the session, not of the artwork. A link carrying a physical
     target has to be re-calibrated on this device before it means anything. */
  const [phase, setPhase] = useState<Phase>(() => {
    if (!incoming?.overlay) return 'mode'
    return incoming.targetMm ? 'mode' : 'work'
  })
  const [modeId, setModeId] = useState<ModeId>(incoming?.modeId ?? 'a4')
  const [sharedTargetMm, setSharedTargetMm] = useState<number | null>(incoming?.targetMm ?? null)
  const [calibration, setCalibration] = useState<Calibration | null>(null)
  const [step, setStep] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const [unit, setUnit] = useState<Unit>('mm')

  const objectUrlRef = useRef<string | null>(null)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const overlay = state.overlay
  const mode = getMode(modeId)
  const shortEdge = Math.max(1, Math.min(viewport.width, viewport.height))

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
     the canvas capture needs a decoded, CORS-clean copy. */
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
          (next.k * Math.max(1, current.naturalW)) /
            Math.max(1, Math.min(viewport.width, viewport.height)),
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
    enabled: phase === 'work' && Boolean(overlay) && state.visible && !state.locked,
    read: readPixel,
    write: writePixel,
    onGestureStart: () => setShared(false),
  })

  /* Mirror the live setup in the address bar so the phone's own share sheet
     hands over a working link. */
  useEffect(() => {
    if (!overlay?.shareable) return
    // The physical target travels, the local px/mm does not: it is specific to
    // the sender's screen and holding distance.
    const target: SharedTarget | null = isCalibrationUsable(calibration)
      ? { targetMm: realWidthMm(overlay.size, shortEdge, calibration) ?? 0, modeId: calibration.modeId }
      : sharedTargetMm !== null
        ? { targetMm: sharedTargetMm, modeId }
        : null
    const query = encodeState(state, target)
    if (!query) return
    window.history.replaceState(null, '', `${window.location.pathname}?${query}`)
  }, [overlay, state, calibration, shortEdge, sharedTargetMm, modeId])

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
    const size = isCalibrationUsable(calibration)
      ? defaultSizeFor(mode, shortEdge, calibration)
      : DEFAULT_SIZE
    patchOverlay({ x: 0, y: 0, size, rot: 0 })
    flash(isCalibrationUsable(calibration) ? `Reset to ${formatRealSize(mode.defaultTargetMm)}` : 'Overlay reset')
  }, [patchOverlay, flash, calibration, mode, shortEdge])

  const share = useCallback(async () => {
    const current = stateRef.current
    const currentOverlay = current.overlay
    const target: SharedTarget | null =
      isCalibrationUsable(calibration) && currentOverlay
        ? { targetMm: realWidthMm(currentOverlay.size, shortEdge, calibration) ?? 0, modeId: calibration.modeId }
        : sharedTargetMm !== null
          ? { targetMm: sharedTargetMm, modeId }
          : null
    const url = buildShareUrl(current, target)
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
  }, [flash, calibration, shortEdge, sharedTargetMm, modeId])

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

  const chooseMode = useCallback((id: ModeId) => {
    setModeId(getMode(id).id)
    setStep(0)
    setPhase('instructions')
  }, [])

  const startCalibrating = useCallback(() => {
    setBox(defaultBox(viewport.width, viewport.height, mode.referenceAspect ?? 1.414))
    setPhase('calibrate')
  }, [viewport.width, viewport.height, mode.referenceAspect])

  const applyCalibration = useCallback(
    (pxPerMm: number, referenceMm: number) => {
      if (!(pxPerMm > 0) || !(referenceMm > 0)) return
      const next: Calibration = { pxPerMm, referenceWidthMm: referenceMm, modeId }
      setCalibration(next)
      setPhase('work')
      // A shared link carries a physical target, so honour it instead of the
      // mode default. Otherwise fall back to the mode's natural size.
      const targetMm = sharedTargetMm ?? mode.defaultTargetMm
      setUnit(bestUnit(targetMm))
      setState((previous) =>
        previous.overlay
          ? {
              ...previous,
              overlay: {
                ...previous.overlay,
                size: clamp(sizeFractionFor(targetMm, shortEdge, next), MIN_SIZE, MAX_SIZE),
              },
            }
          : previous,
      )
      setSharedTargetMm(null)
      flash(
        sharedTargetMm
          ? `Scale set · link target ${formatRealSize(sharedTargetMm)} wide`
          : `Scale set: 1 mm ≈ ${pxPerMm.toFixed(2)} px`,
      )
    },
    [modeId, mode, shortEdge, flash, sharedTargetMm],
  )

  const setTargetMm = useCallback(
    (mm: number) => {
      if (!isCalibrationUsable(calibration)) return
      const fraction = sizeFractionFor(mm, shortEdge, calibration)
      patchOverlay({ size: clamp(fraction, MIN_SIZE, MAX_SIZE) })
    },
    [calibration, shortEdge, patchOverlay],
  )

  const targetMm = useMemo(
    () => (overlay ? realWidthMm(overlay.size, shortEdge, calibration) : null),
    [overlay, shortEdge, calibration],
  )

  const quality = useMemo(() => {
    if (!overlay || !isCalibrationUsable(calibration) || targetMm === null) return null
    return assessQuality(overlay.naturalW, targetMm, mode, shortEdge, calibration)
  }, [overlay, calibration, targetMm, mode, shortEdge])

  const hasOverlay = Boolean(overlay)
  const cameraLive = camera.status === 'live'
  const working = phase === 'work'

  return (
    <div className="relative h-full w-full overflow-hidden bg-char text-cream">
      {working ? (
        <div ref={setStage} className="no-touch absolute inset-0 select-none overflow-hidden">
          <CameraFeed stream={camera.stream} camera={camera} trace={state.trace} onVideo={setVideo} />

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
      ) : (
        <div className="absolute inset-0">
          <CameraFeed stream={camera.stream} camera={camera} trace={false} onVideo={setVideo} />
        </div>
      )}

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl border border-cream/20 bg-char/70 text-cream backdrop-blur-md">
            <Layers className="size-4.5" strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <p className="text-sm leading-none font-semibold tracking-tight">SketchLens</p>
            {working ? (
              <RealSizeReadout
                targetMm={targetMm}
                calibrated={isCalibrationUsable(calibration)}
              />
            ) : (
              <p className="mt-1 text-[0.7rem] leading-none text-cream/60">Set up</p>
            )}
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {working && hasOverlay && !state.locked ? (
            <RotateNudge onRotate={() => patchOverlay({ rot: (overlay?.rot ?? 0) + 5 })} />
          ) : null}
          {camera.hasMultiple ? <FlipButton onFlip={camera.flip} /> : null}
          {working ? (
            <IconButton label="How it works" onClick={() => setSheet('info')} tone="char">
              <span className="text-sm font-semibold">?</span>
            </IconButton>
          ) : null}
        </div>
      </header>

      {phase === 'mode' ? (
        <ModeSelect onPick={chooseMode} sharedTargetMm={sharedTargetMm} />
      ) : null}

      {phase === 'instructions' ? (
        <Instructions
          modeId={modeId}
          step={step}
          stepCount={mode.steps.length}
          targetSize={mode.targetSize}
          onNext={() => (step >= mode.steps.length - 1 ? startCalibrating() : setStep(step + 1))}
          onBack={() => (step === 0 ? setPhase('mode') : setStep(step - 1))}
          onSkip={() => (mode.referenceIsKnown ? startCalibrating() : setPhase('work'))}
        />
      ) : null}

      {phase === 'calibrate' && box ? (
        <>
          <ReferenceBox
            modeId={modeId}
            referenceWidthMm={mode.referenceWidthMm}
            box={box}
            viewportWidth={viewport.width}
            viewportHeight={viewport.height}
            onBox={setBox}
            onCalibrate={applyCalibration}
          />
          <div className="pointer-events-none absolute inset-x-0 top-[max(3.5rem,env(safe-area-inset-top))] z-10 flex justify-center px-4">
            <CalibrationBadge targetMm={null} modeLabel={mode.label} />
          </div>
          <div className="absolute inset-x-0 top-[max(5.5rem,env(safe-area-inset-top))] z-10 mx-auto w-fit max-w-[92%]">
            <ModeTip mode={mode} />
          </div>
        </>
      ) : null}

      {working ? (
        <>
          {isCalibrationUsable(calibration) && targetMm !== null ? (
            <div className="pointer-events-none absolute inset-x-0 top-[max(3.25rem,env(safe-area-inset-top))] z-10 flex justify-center px-4">
              <CalibrationBadge targetMm={targetMm} modeLabel={mode.label} />
            </div>
          ) : null}

          {isCalibrationUsable(calibration) && mode.id === 'big-wall' ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] z-10 mx-auto w-fit max-w-[92%]">
              <DriftWarning modeLabel={mode.label} />
            </div>
          ) : null}

          <ControlBar
            hasOverlay={hasOverlay}
            visible={state.visible}
            locked={state.locked}
            trace={state.trace}
            opacity={overlay?.opacity ?? DEFAULT_OPACITY}
            canShare={Boolean(overlay?.shareable)}
            shared={shared}
            targetSize={mode.targetSize}
            modeLabel={mode.label}
            onOpenSource={() => setSheet('source')}
            onToggleVisible={() => patch({ visible: !state.visible })}
            onToggleLock={() => patch({ locked: !state.locked })}
            onToggleTrace={() => patch({ trace: !state.trace, locked: !state.trace })}
            onOpacity={(value) => patchOverlay({ opacity: clamp(value, MIN_OPACITY, MAX_OPACITY) })}
            onCapture={() => void capture()}
            onShare={() => void share()}
            onReset={reset}
            recalibrate={
              isCalibrationUsable(calibration) ? () => startCalibrating() : undefined
            }
            sizeControls={
              isCalibrationUsable(calibration) && targetMm !== null ? (
                <div className="space-y-2">
                  <SizeField
                    targetMm={targetMm}
                    unit={unit}
                    onUnitChange={setUnit}
                    onCommit={setTargetMm}
                  />
                  {quality ? (
                    <QualityWarning
                      level={quality.level}
                      sourcePx={quality.sourcePx}
                      requiredSourcePx={quality.requiredSourcePx}
                      targetMm={quality.targetMm}
                    />
                  ) : null}
                </div>
              ) : null
            }
          />
        </>
      ) : null}

      <SourcePanel
        open={sheet === 'source'}
        onClose={() => setSheet('none')}
        onPick={pickImage}
        busy={loadingImage}
      />

      {sheet === 'info' ? <InfoPanel onClose={() => setSheet('none')} onRecalibrate={() => {
        setSheet('none')
        setPhase('mode')
      }} /> : null}

      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}

      {cameraLive || skipped || phase === 'work' ? null : (
        <CameraGate
          status={camera.status}
          error={camera.error}
          hasImage={hasOverlay}
          onStart={() => void camera.start()}
          onContinue={() => {
            setSkipped(true)
            setPhase('mode')
          }}
        />
      )}
    </div>
  )
}
