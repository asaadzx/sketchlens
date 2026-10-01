export interface OverlayState {
  /** Image source: a remote URL or a blob/object URL from a local upload. */
  src: string
  /** Attribution for CC-licensed results. Empty for user uploads. */
  attribution: string
  /** Natural pixel size of the source image, needed for gesture math. */
  naturalW: number
  naturalH: number
  /** Centre position as a fraction of the viewport width/height. */
  x: number
  y: number
  /** Displayed width as a fraction of min(viewport width, height). */
  size: number
  /** Clockwise rotation in degrees. */
  rot: number
  /** 0..1 */
  opacity: number
  /** Uploads use blob: URLs which cannot survive a share link. */
  shareable: boolean
}

export interface WorkState {
  overlay: OverlayState | null
  /** Toggle the overlay off to check the bare wall. */
  visible: boolean
  /** Dim the feed, show guides, boost edge contrast. */
  trace: boolean
  /** Freeze the transform so the screen can be used one-handed while tracing. */
  locked: boolean
}

export const MIN_SIZE = 0.04
export const MAX_SIZE = 3
export const MIN_OPACITY = 0.04
export const MAX_OPACITY = 1

export const DEFAULT_SIZE = 0.62
export const DEFAULT_OPACITY = 0.9

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}
