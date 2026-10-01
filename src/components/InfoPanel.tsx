import { Ban, Hand, Lock, PenTool, Ruler, ScanLine, ZoomIn } from 'lucide-react'
import { Panel } from './ui'

const STEPS = [
  {
    icon: ScanLine,
    title: 'Calibrate against something real',
    body: 'Pick a mode, frame the reference, and stretch the box onto it. An A4 sheet gives you exact paper sizes; a metre rule or any known rectangle handles walls.',
  },
  {
    icon: Hand,
    title: 'Line it up',
    body: 'One finger drags. Two fingers pinch and rotate. On a desktop, scroll to zoom and hold shift while scrolling to rotate.',
  },
  {
    icon: ZoomIn,
    title: 'Fade it until it fits',
    body: 'Drop the opacity to around 40% once the edges sit on the wall. You still get the line, without the picture fighting you.',
  },
  {
    icon: Lock,
    title: 'Lock it',
    body: 'Locking freezes the overlay so you can stop touching the screen and hold the phone steady while you trace.',
  },
  {
    icon: PenTool,
    title: 'Trace it',
    body: 'Trace mode dims the wall, softens the photo to a line drawing and adds guides so the pencil lines read clearly.',
  },
]

export function InfoPanel({
  onClose,
  onRecalibrate,
}: {
  onClose: () => void
  onRecalibrate: () => void
}) {
  return (
    <Panel title="How SketchLens works" onClose={onClose}>
      <div className="space-y-4 pb-1">
        <ol className="space-y-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-clay-soft text-clay-deep">
                <step.icon className="size-4.5" strokeWidth={1.9} />
              </span>
              <div>
                <p className="text-sm font-semibold leading-snug">
                  {index + 1}. {step.title}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="rounded-2xl border border-line bg-shell/70 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Ruler className="size-4" strokeWidth={2} />
            About the sizing
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            In setup you calibrate against something you can measure: an A4 sheet, a metre rule, or
            any flat rectangle whose width you know. The app divides the on-screen width by the real
            width, so it can tell you the overlay is 60 cm wide, not just how many pixels across it
            is.
          </p>
          <button
            type="button"
            onClick={onRecalibrate}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-clay px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-clay-deep"
          >
            <Ruler className="size-4" strokeWidth={2} />
            Set the scale again
          </button>
        </div>

        <div className="rounded-2xl border border-line bg-shell/70 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Ban className="size-4" strokeWidth={2} />
            What it is not
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            SketchLens does not detect the wall. Nothing is locked in 3D space, so if you move the
            phone the overlay moves with it, and the calibrated size stops being true. Keep still,
            or lock the overlay and prop the phone up.
          </p>
        </div>

        <p className="pb-1 text-xs leading-relaxed text-ink-faint">
          Images come from Openverse and are filtered to licences that allow commercial use and
          modification. Credit is shown on screen and travels with the share link. Anything you
          upload stays on your device.
        </p>
      </div>
    </Panel>
  )
}
