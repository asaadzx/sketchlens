import type { OverlayState, WorkState } from './types'
import { MAX_SIZE, MIN_OPACITY, MAX_OPACITY, MIN_SIZE, clamp } from './types'
import { roundTo } from './overlay'

/**
 * Share links carry the whole setup as query params, so no backend is needed
 * for anything that has a public URL.
 */
export function encodeState(state: WorkState): string {
  const overlay = state.overlay
  if (!overlay || !overlay.shareable) return ''
  const params = new URLSearchParams()
  params.set('img', overlay.src)
  if (overlay.attribution) params.set('by', overlay.attribution)
  params.set('w', String(Math.round(overlay.naturalW)))
  params.set('h', String(Math.round(overlay.naturalH)))
  params.set('x', String(roundTo(overlay.x, 4)))
  params.set('y', String(roundTo(overlay.y, 4)))
  params.set('size', String(roundTo(overlay.size, 4)))
  params.set('rot', String(roundTo(overlay.rot, 2)))
  params.set('op', String(roundTo(overlay.opacity, 3)))
  if (!state.visible) params.set('hide', '1')
  if (state.trace) params.set('trace', '1')
  return params.toString()
}

function num(params: URLSearchParams, key: string, fallback: number): number {
  const raw = params.get(key)
  if (raw === null) return fallback
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

export function decodeState(search: string): Partial<WorkState> | null {
  const params = new URLSearchParams(search)
  const src = params.get('img')
  if (!src) return null

  const overlay: OverlayState = {
    src,
    attribution: params.get('by') ?? '',
    naturalW: clamp(Math.abs(num(params, 'w', 1200)), 1, 12000),
    naturalH: clamp(Math.abs(num(params, 'h', 1200)), 1, 12000),
    x: clamp(num(params, 'x', 0), -2, 2),
    y: clamp(num(params, 'y', 0), -2, 2),
    size: clamp(num(params, 'size', 0.62), MIN_SIZE, MAX_SIZE),
    rot: num(params, 'rot', 0),
    opacity: clamp(num(params, 'op', 0.9), MIN_OPACITY, MAX_OPACITY),
    shareable: true,
  }

  return {
    overlay,
    visible: params.get('hide') !== '1',
    trace: params.get('trace') === '1',
    locked: true,
  }
}

export function buildShareUrl(state: WorkState): string {
  const query = encodeState(state)
  const url = new URL(window.location.href)
  url.search = query
  url.hash = ''
  return url.toString()
}
