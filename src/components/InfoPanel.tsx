import { Ban, Hand, Lock, PenTool, Ruler, ZoomIn } from 'lucide-react'
import { Panel } from './ui'

const STEPS = [
  {
    icon: Hand,
    title: 'Line it up by eye',
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

export function InfoPanel({ onClose }: { onClose: () => void }) {
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
            A browser cannot measure the real wall, so scale here is judged by eye. If you need an
            exact size, drop a sheet of A4 paper on the wall first, line it up with the paper, then
            use it as your reference.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-shell/70 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Ban className="size-4" strokeWidth={2} />
            What it is not
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            SketchLens does not detect the wall. Nothing is locked in 3D space, so if you move the
            phone the overlay moves with it. Keep still, or lock the overlay and prop the phone up.
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
