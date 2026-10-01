import type { OverlayState } from '../lib/types'
import { overlayBox, toPixel } from '../lib/overlay'

/**
 * Renders the artwork as a transformed layer over the camera feed.
 *
 * The box is sized in px from the same helpers the gesture hook uses, so what
 * your fingers move and what the browser paints cannot drift apart. Rotation
 * happens about the element's own centre, which is what makes a two-finger
 * rotate feel anchored instead of orbiting.
 */
export function Overlay({
  state,
  width: viewportWidth,
  height: viewportHeight,
  trace,
}: {
  state: OverlayState
  width: number
  height: number
  trace: boolean
}) {
  const pixel = toPixel(state, viewportWidth, viewportHeight)
  const box = overlayBox(pixel, state.naturalW, state.naturalH)

  return (
    <img
      src={state.src}
      alt=""
      draggable={false}
      decoding="async"
      className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
      style={{
        width: `${box.width}px`,
        height: `${box.height}px`,
        marginLeft: `${-box.width / 2}px`,
        marginTop: `${-box.height / 2}px`,
        transform: `translate(${pixel.cx}px, ${pixel.cy}px) rotate(${state.rot}deg)`,
        transformOrigin: 'center',
        opacity: state.opacity,
        filter: trace ? 'contrast(1.16) saturate(0.5) brightness(1.05)' : 'none',
        boxShadow: trace
          ? '0 0 0 1px rgb(255 246 235 / 0.5), 0 0 26px rgb(20 17 14 / 0.32)'
          : '0 8px 30px rgb(20 17 14 / 0.2)',
        willChange: 'transform, opacity',
      }}
    />
  )
}
