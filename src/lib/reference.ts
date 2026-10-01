/**
 * Geometry for the calibration reference frame. Kept out of the component so
 * the clamps are unit-testable and the module only exports a component.
 */

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se'

const MIN = 40

/** Keeps at least one dimension usable so the box can never vanish. */
export function applyDrag(
  start: Box,
  handle: Handle,
  dx: number,
  dy: number,
  viewportWidth: number,
  viewportHeight: number,
): Box {
  const clampX = (value: number, size: number) =>
    Math.max(0, Math.min(value, viewportWidth - size))
  const clampY = (value: number, size: number) =>
    Math.max(0, Math.min(value, viewportHeight - size))

  if (handle === 'move') {
    return {
      ...start,
      x: clampX(start.x + dx, start.width),
      y: clampY(start.y + dy, start.height),
    }
  }

  // Track edges rather than position plus size, so dragging a west or north
  // handle keeps the opposite corner pinned instead of translating the box.
  let left = start.x
  let top = start.y
  let right = start.x + start.width
  let bottom = start.y + start.height

  if (handle.includes('w')) left = Math.max(0, Math.min(left + dx, right - MIN))
  if (handle.includes('e')) right = Math.min(viewportWidth, Math.max(right + dx, left + MIN))
  if (handle.startsWith('n')) top = Math.max(0, Math.min(top + dy, bottom - MIN))
  if (handle.startsWith('s')) bottom = Math.min(viewportHeight, Math.max(bottom + dy, top + MIN))

  return { x: left, y: top, width: right - left, height: bottom - top }
}

/** Sensible starting frame: two thirds of the shorter edge, centred. */
export function defaultBox(viewportWidth: number, viewportHeight: number, aspect = 1.414): Box {
  const width = Math.round(Math.min(viewportWidth, viewportHeight) * 0.66)
  const height = Math.round(width / aspect)
  return {
    x: Math.round((viewportWidth - width) / 2),
    y: Math.round((viewportHeight - height) / 2.2),
    width,
    height,
  }
}
