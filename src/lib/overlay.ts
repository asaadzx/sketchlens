import type { OverlayState } from './types'
import { MAX_SIZE, MIN_SIZE, clamp } from './types'

/**
 * Gestures are computed in pixel space, then normalised on commit so that a
 * share link keeps the same apparent size on a phone and on a laptop.
 */
export interface PixelTransform {
  /** Centre of the overlay, in px, relative to the centre of the stage. */
  cx: number
  cy: number
  /** Degrees. */
  rot: number
  /** Device pixels per source-image pixel. */
  k: number
}

/** Reference edge used to convert between pixels and normalised fractions. */
export function viewportBase(vw: number, vh: number): number {
  return Math.max(1, Math.min(vw, vh))
}

/** Reconstructs a full overlay state from a pixel transform, for capture. */
export function toPixel(state: OverlayState, vw: number, vh: number): PixelTransform {
  const natural = Math.max(1, state.naturalW)
  return {
    cx: state.x * vw,
    cy: state.y * vh,
    rot: state.rot,
    k: (state.size * viewportBase(vw, vh)) / natural,
  }
}

export function fromPixel(
  pixel: PixelTransform,
  naturalW: number,
  naturalH: number,
  vw: number,
  vh: number,
): OverlayState {
  return {
    src: '',
    attribution: '',
    naturalW,
    naturalH,
    x: pixel.cx / Math.max(1, vw),
    y: pixel.cy / Math.max(1, vh),
    size: clamp((pixel.k * Math.max(1, naturalW)) / viewportBase(vw, vh), MIN_SIZE, MAX_SIZE),
    rot: pixel.rot,
    opacity: 1,
    shareable: true,
  }
}

export interface Vec {
  x: number
  y: number
}

export function rotateVec(v: Vec, degrees: number): Vec {
  const rad = (degrees * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos }
}

/** Wraps an angle difference into [-180, 180). */
export function angleDelta(from: number, to: number): number {
  let delta = (to - from) % 360
  if (delta >= 180) delta -= 360
  if (delta < -180) delta += 360
  return delta
}

export function distance(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function angleOf(a: Vec, b: Vec): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
}

export function centroid(points: Vec[]): Vec {
  if (points.length === 0) return { x: 0, y: 0 }
  let x = 0
  let y = 0
  for (const p of points) {
    x += p.x
    y += p.y
  }
  return { x: x / points.length, y: y / points.length }
}

export interface GestureSnapshot {
  count: number
  mid: Vec
  span: number
  angle: number
  base: PixelTransform
}

/**
 * Resolves the next transform for a gesture.
 *
 * With one pointer this is a pure translation. With two or more it scales and
 * rotates about the point that sat under the gesture centroid, so the artwork
 * stays pinned between the fingers instead of drifting away from them.
 */
export function applyGesture(
  snapshot: GestureSnapshot,
  next: { count: number; mid: Vec; span: number; angle: number },
): PixelTransform {
  const base = snapshot.base
  if (next.count < 2 || snapshot.count < 2 || snapshot.span < 1) {
    return {
      ...base,
      cx: base.cx + (next.mid.x - snapshot.mid.x),
      cy: base.cy + (next.mid.y - snapshot.mid.y),
    }
  }

  const k = Math.max(0.02, (base.k * next.span) / snapshot.span)
  const rot = base.rot + angleDelta(snapshot.angle, next.angle)

  const anchor = rotateVec({ x: snapshot.mid.x - base.cx, y: snapshot.mid.y - base.cy }, -base.rot)
  const anchorImage = { x: anchor.x / base.k, y: anchor.y / base.k }
  const offset = rotateVec(anchorImage, rot)
  const scaled = { x: offset.x * k, y: offset.y * k }

  return { cx: next.mid.x - scaled.x, cy: next.mid.y - scaled.y, rot, k: k }
}

/** Displayed overlay box in px, relative to the centre of the stage. */
export function overlayBox(pixel: PixelTransform, naturalW: number, naturalH: number) {
  return {
    width: pixel.k * Math.max(1, naturalW),
    height: pixel.k * Math.max(1, naturalH),
  }
}

export function roundTo(value: number, places: number): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}
