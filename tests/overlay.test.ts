import { describe, expect, it } from 'vitest'
import {
  angleDelta,
  applyGesture,
  centroid,
  distance,
  overlayBox,
  roundTo,
  toPixel,
  viewportBase,
  type GestureSnapshot,
} from '../src/lib/overlay'
import { decodeState, encodeState } from '../src/lib/share'
import { DEFAULT_SIZE, type OverlayState } from '../src/lib/types'

function base(): OverlayState {
  return {
    src: 'https://example.com/a.jpg',
    attribution: 'Someone — CC BY',
    naturalW: 1000,
    naturalH: 500,
    x: 0.1,
    y: -0.2,
    size: 0.5,
    rot: 30,
    opacity: 0.7,
    shareable: true,
  }
}

function snap(count: number, mid: { x: number; y: number }, span: number, angle: number, b = toPixel(base(), 800, 600)): GestureSnapshot {
  return { count, mid, span, angle, base: b }
}

describe('viewport maths', () => {
  it('uses the shorter edge as the reference', () => {
    expect(viewportBase(1200, 800)).toBe(800)
    expect(viewportBase(0, 0)).toBe(1)
  })

  it('sizes the overlay as a fraction of the shorter edge', () => {
    const state = { ...base(), size: 0.5 }
    const pixel = toPixel(state, 1000, 500)
    const box = overlayBox(pixel, state.naturalW, state.naturalH)
    expect(box.width).toBeCloseTo(250, 6)
    expect(box.height).toBeCloseTo(125, 6)
  })

  it('keeps relative size identical across viewports', () => {
    const state = { ...base(), size: 0.62, rot: 0 }
    const phone = overlayBox(toPixel(state, 390, 844), 1000, 1000)
    const desktop = overlayBox(toPixel(state, 1440, 900), 1000, 1000)
    expect(phone.width / 390).toBeCloseTo(desktop.width / 900, 10)
  })
})

describe('one pointer drag', () => {
  it('translates by the centroid delta', () => {
    const s = snap(1, { x: 100, y: 50 }, 0, 0)
    const next = applyGesture(s, { count: 1, mid: { x: 130, y: 20 }, span: 0, angle: 0 })
    expect(next.cx - s.base.cx).toBeCloseTo(30, 6)
    expect(next.cy - s.base.cy).toBeCloseTo(-30, 6)
  })

  it('does not change scale or rotation', () => {
    const s = snap(1, { x: 0, y: 0 }, 0, 0)
    const next = applyGesture(s, { count: 1, mid: { x: 40, y: 40 }, span: 0, angle: 0 })
    expect(next.k).toBeCloseTo(s.base.k, 10)
    expect(next.rot).toBeCloseTo(s.base.rot, 10)
  })
})

describe('two finger pinch', () => {
  it('scales by the ratio of spans', () => {
    const s = snap(2, { x: 0, y: 0 }, 100, 0)
    const next = applyGesture(s, { count: 2, mid: { x: 0, y: 0 }, span: 250, angle: 0 })
    expect(next.k / s.base.k).toBeCloseTo(2.5, 6)
  })

  it('keeps the anchored point under the gesture centroid', () => {
    // Pinch outwards from an off-centre centroid.
    const s = snap(2, { x: 60, y: -40 }, 100, 0)
    const nextMid = { x: 60, y: -40 }
    const next = applyGesture(s, { count: 2, mid: nextMid, span: 200, angle: 0 })

    // Map the anchor forward and confirm it lands under the fingers.
    const rad = (next.rot * Math.PI) / 180
    const localX = ((nextMid.x - s.base.cx) * Math.cos(-rad) - (nextMid.y - s.base.cy) * Math.sin(-rad)) / s.base.k
    const localY = ((nextMid.x - s.base.cx) * Math.sin(-rad) + (nextMid.y - s.base.cy) * Math.cos(-rad)) / s.base.k
    const ax = next.cx + (localX * Math.cos(rad) - localY * Math.sin(rad)) * next.k
    const ay = next.cy + (localX * Math.sin(rad) + localY * Math.cos(rad)) * next.k
    expect(ax).toBeCloseTo(nextMid.x, 6)
    expect(ay).toBeCloseTo(nextMid.y, 6)
  })

  it('never collapses to zero scale', () => {
    const s = snap(2, { x: 0, y: 0 }, 400, 0)
    const next = applyGesture(s, { count: 2, mid: { x: 0, y: 0 }, span: 0, angle: 0 })
    expect(next.k).toBeGreaterThan(0)
  })
})

describe('two finger rotate', () => {
  it('adds the angle difference', () => {
    const s = snap(2, { x: 0, y: 0 }, 100, 0)
    const next = applyGesture(s, { count: 2, mid: { x: 0, y: 0 }, span: 100, angle: 45 })
    expect(next.rot).toBeCloseTo(s.base.rot + 45, 6)
  })

  it('wraps across the 180 degree boundary', () => {
    const s = snap(2, { x: 0, y: 0 }, 100, 170)
    const next = applyGesture(s, { count: 2, mid: { x: 0, y: 0 }, span: 100, angle: -170 })
    expect(next.rot).toBeCloseTo(s.base.rot + 20, 6)
  })

  it('wraps angle differences into a half turn', () => {
    expect(angleDelta(179, -179)).toBeCloseTo(2, 6)
    expect(angleDelta(-179, 179)).toBeCloseTo(-2, 6)
    expect(angleDelta(0, 0)).toBe(0)
    expect(angleDelta(10, 370)).toBeCloseTo(0, 6)
  })

  it('rotates in place when the centroid sits on the overlay centre', () => {
    const centre = { x: 80, y: -120 }
    const s = snap(2, centre, 120, 0)
    const next = applyGesture(s, { count: 2, mid: centre, span: 120, angle: 30 })
    expect(next.cx).toBeCloseTo(s.base.cx, 6)
    expect(next.cy).toBeCloseTo(s.base.cy, 6)
    expect(next.rot).toBeCloseTo(s.base.rot + 30, 6)
  })

  it('moves the centre when rotating about an off-centre point', () => {
    // Rotating about a point away from the centre must orbit it, which is the
    // behaviour that makes a two-finger rotate feel anchored to the fingers.
    const s = snap(2, { x: 0, y: 0 }, 120, 0)
    const next = applyGesture(s, { count: 2, mid: { x: 0, y: 0 }, span: 120, angle: 30 })
    expect(Math.hypot(next.cx - s.base.cx, next.cy - s.base.cy)).toBeGreaterThan(1)
  })
})

describe('gesture fallbacks', () => {
  it('falls back to translation when a finger is lifted', () => {
    const s = snap(2, { x: 0, y: 0 }, 100, 30)
    const next = applyGesture(s, { count: 1, mid: { x: 10, y: 10 }, span: 0, angle: 0 })
    expect(next.k).toBeCloseTo(s.base.k, 6)
    expect(next.rot).toBeCloseTo(s.base.rot, 6)
    expect(next.cx - s.base.cx).toBeCloseTo(10, 6)
  })

  it('ignores a degenerate span on gesture start', () => {
    const s = snap(2, { x: 0, y: 0 }, 0, 0)
    const next = applyGesture(s, { count: 2, mid: { x: 5, y: 5 }, span: 200, angle: 90 })
    expect(next.cx - s.base.cx).toBeCloseTo(5, 6)
    expect(Number.isFinite(next.k)).toBe(true)
  })
})

describe('helpers', () => {
  it('computes centroid and distance', () => {
    expect(centroid([{ x: 0, y: 0 }, { x: 10, y: 20 }])).toEqual({ x: 5, y: 10 })
    expect(centroid([])).toEqual({ x: 0, y: 0 })
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })

  it('rounds for url encoding', () => {
    expect(roundTo(0.123456, 3)).toBe(0.123)
    expect(roundTo(12.3456, 2)).toBe(12.35)
  })
})

describe('share encoding', () => {
  it('round trips a full setup', () => {
    const state = {
      overlay: { ...base(), size: 0.42 },
      visible: true,
      trace: false,
      locked: false,
    }
    const decoded = decodeState(encodeState(state))
    expect(decoded?.overlay).toMatchObject({
      src: state.overlay.src,
      attribution: state.overlay.attribution,
      naturalW: 1000,
      naturalH: 500,
      x: 0.1,
      y: -0.2,
      size: 0.42,
      rot: 30,
      opacity: 0.7,
    })
  })

  it('preserves trace mode and the hidden flag', () => {
    const query = encodeState({
      overlay: base(),
      visible: false,
      trace: true,
      locked: false,
    })
    const decoded = decodeState(query)
    expect(decoded?.trace).toBe(true)
    expect(decoded?.visible).toBe(false)
  })

  it('produces nothing for an upload, since blob urls cannot travel', () => {
    expect(encodeState({ overlay: { ...base(), src: 'blob:x', shareable: false }, visible: true, trace: false, locked: false })).toBe('')
  })

  it('returns null when there is no image', () => {
    expect(decodeState('')).toBeNull()
    expect(decodeState('?x=1&y=2')).toBeNull()
  })

  it('clamps hostile values out of range', () => {
    const decoded = decodeState('img=https%3A%2F%2Fx.com%2Fa.jpg&size=9999&op=-5&x=1e9&rot=1e9&w=0')
    expect(decoded?.overlay?.size).toBeLessThanOrEqual(3)
    expect(decoded?.overlay?.opacity).toBeGreaterThan(0)
    expect(decoded?.overlay?.x).toBeLessThanOrEqual(2)
    expect(decoded?.overlay?.naturalW).toBeGreaterThan(0)
  })

  it('falls back to defaults for non numeric input', () => {
    const decoded = decodeState('img=https%3A%2F%2Fx.com%2Fa.jpg&size=abc&op=zzz')
    expect(decoded?.overlay?.size).toBe(DEFAULT_SIZE)
    expect(decoded?.overlay?.opacity).toBeCloseTo(0.9, 6)
  })
})
