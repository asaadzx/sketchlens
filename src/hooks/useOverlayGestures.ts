import { useCallback, useEffect, useRef } from 'react'
import type { PixelTransform, Vec } from '../lib/overlay'
import { angleOf, applyGesture, centroid, distance, rotateVec, type GestureSnapshot } from '../lib/overlay'

interface Pointers {
  x: number
  y: number
}

export interface GestureOptions {
  element: HTMLElement | null
  enabled: boolean
  /** Reads the current transform so a gesture always starts from live state. */
  read: () => PixelTransform
  write: (next: PixelTransform) => void
  onGestureStart?: () => void
}

function measure(el: HTMLElement, pointers: Map<number, Pointers>) {
  const rect = el.getBoundingClientRect()
  const list = [...pointers.values()]
  const points: Vec[] = list.map((point) => ({
    x: point.x - rect.left - rect.width / 2,
    y: point.y - rect.top - rect.height / 2,
  }))
  const mid = centroid(points)
  const span = points.length >= 2 ? distance(points[0], points[1]) : 0
  const angle = points.length >= 2 ? angleOf(points[0], points[1]) : 0
  return { count: points.length, mid, span, angle }
}

/**
 * Pointer-events based drag / pinch / rotate. Pointer events cover touch,
 * mouse and stylus with one code path, which matters here because the real
 * device is a phone held up against a wall.
 */
export function useOverlayGestures({
  element,
  enabled,
  read,
  write,
  onGestureStart,
}: GestureOptions) {
  const pointers = useRef(new Map<number, Pointers>())
  const snapshot = useRef<GestureSnapshot | null>(null)
  const readRef = useRef(read)
  const writeRef = useRef(write)
  const startRef = useRef(onGestureStart)

  // Keep the handler bindings fresh without re-registering the listeners on
  // every render, which would drop a gesture in flight.
  useEffect(() => {
    readRef.current = read
    writeRef.current = write
    startRef.current = onGestureStart
  })

  const begin = useCallback(() => {
    if (!element) return
    const current = measure(element, pointers.current)
    snapshot.current = {
      count: current.count,
      mid: current.mid,
      span: current.span,
      angle: current.angle,
      base: readRef.current(),
    }
  }, [element])

  useEffect(() => {
    if (!element || !enabled) {
      pointers.current.clear()
      snapshot.current = null
      return
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      event.preventDefault()
      element.setPointerCapture?.(event.pointerId)
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      startRef.current?.()
      begin()
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!pointers.current.has(event.pointerId) || !snapshot.current) return
      event.preventDefault()
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      const current = measure(element, pointers.current)
      writeRef.current(applyGesture(snapshot.current, current))
    }

    const end = (event: PointerEvent) => {
      if (!pointers.current.delete(event.pointerId)) return
      if (element.hasPointerCapture?.(event.pointerId)) {
        element.releasePointerCapture(event.pointerId)
      }
      // Re-anchor on the remaining fingers so lifting one does not jump.
      if (pointers.current.size > 0) begin()
      else snapshot.current = null
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      const cursor: Vec = {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2,
      }
      const base = readRef.current()
      const k = Math.max(0.02, base.k * Math.exp(-event.deltaY * 0.0022))
      const rot = event.shiftKey ? base.rot + event.deltaY * 0.4 : base.rot
      const anchor = rotateVec({ x: cursor.x - base.cx, y: cursor.y - base.cy }, -base.rot)
      const offset = rotateVec({ x: anchor.x / base.k, y: anchor.y / base.k }, rot)
      writeRef.current({
        cx: cursor.x - offset.x * k,
        cy: cursor.y - offset.y * k,
        rot,
        k,
      })
    }

    element.addEventListener('pointerdown', onPointerDown, { passive: false })
    element.addEventListener('pointermove', onPointerMove, { passive: false })
    element.addEventListener('pointerup', end)
    element.addEventListener('pointercancel', end)
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      element.removeEventListener('pointerdown', onPointerDown)
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerup', end)
      element.removeEventListener('pointercancel', end)
      element.removeEventListener('wheel', onWheel)
    }
  }, [element, enabled, begin])

  return useCallback(() => {
    pointers.current.clear()
    snapshot.current = null
  }, [])
}
