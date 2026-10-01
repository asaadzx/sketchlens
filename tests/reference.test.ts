import { describe, expect, it } from 'vitest'
import { applyDrag, defaultBox } from '../src/lib/reference'
import { MODES, getMode } from '../src/lib/modes'
import {
  assessQuality,
  bestUnit,
  defaultSizeFor,
  formatRealSize,
  parseRealSize,
  pxPerMmFor,
  realWidthMm,
  sizeFractionFor,
  type Calibration,
} from '../src/lib/calibration'

describe('reference box geometry', () => {
  it('moves without leaving the viewport', () => {
    const box = { x: 20, y: 20, width: 100, height: 100 }
    expect(applyDrag(box, 'move', 10, 10, 390, 844)).toEqual({
      x: 30,
      y: 30,
      width: 100,
      height: 100,
    })
    expect(applyDrag(box, 'move', -100, -100, 390, 844)).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    })
    expect(applyDrag(box, 'move', 1000, 1000, 390, 844)).toEqual({
      x: 290,
      y: 744,
      width: 100,
      height: 100,
    })
  })

  it('resizes from the south-east corner and clamps to a minimum', () => {
    const box = { x: 100, y: 100, width: 200, height: 150 }
    expect(applyDrag(box, 'se', 40, 30, 390, 844)).toEqual({
      x: 100,
      y: 100,
      width: 240,
      height: 180,
    })
    const tiny = applyDrag(box, 'se', -500, -500, 390, 844)
    expect(tiny.width).toBe(40)
    expect(tiny.height).toBe(40)
  })

  it('resizes from the north-west corner while keeping the opposite corner fixed', () => {
    const box = { x: 100, y: 100, width: 200, height: 150 }
    const next = applyDrag(box, 'nw', 20, 15, 390, 844)
    expect(next.x).toBe(120)
    expect(next.y).toBe(115)
    expect(next.x + next.width).toBe(300)
    expect(next.y + next.height).toBe(250)
  })

  it('never lets the frame escape the viewport while resizing', () => {
    const box = { x: 0, y: 0, width: 100, height: 100 }
    const next = applyDrag(box, 'se', 10000, 10000, 390, 844)
    expect(next.width).toBe(390)
    expect(next.height).toBe(844)
  })

  it('starts centred and wider than it is tall', () => {
    const box = defaultBox(390, 844)
    expect(box.width).toBe(Math.round(390 * 0.66))
    expect(box.height).toBeLessThan(box.width)
    expect(box.x).toBe(Math.round((390 - box.width) / 2))
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
  })
})

describe('modes', () => {
  it('exposes exactly the four documented profiles', () => {
    expect(MODES.map((mode) => mode.id)).toEqual(['a4', 'paper', 'small-wall', 'big-wall'])
  })

  it('gives every mode steps, a tip, and sane thresholds', () => {
    for (const mode of MODES) {
      expect(mode.steps.length).toBeGreaterThan(0)
      expect(mode.tip.length).toBeGreaterThan(0)
      expect(mode.referenceWidthMm).toBeGreaterThan(0)
      expect(mode.defaultTargetMm).toBeGreaterThan(0)
      expect(mode.minReferencePx).toBeGreaterThan(0)
      expect(mode.targetSize).toBeGreaterThanOrEqual(44)
      expect(mode.resolutionFactor).toBeGreaterThan(0)
    }
  })

  it('falls back to the first mode for an unknown id', () => {
    expect(getMode('nope' as never).id).toBe('a4')
  })
})

describe('calibration round trips across modes', () => {
  it('turns a drag into a real width and back into the same drag', () => {
    for (const mode of MODES) {
      const calibration: Calibration = { pxPerMm: 2.5, referenceWidthMm: mode.referenceWidthMm, modeId: mode.id }
      const shortEdge = 390
      const targetMm = 500
      const fraction = sizeFractionFor(targetMm, shortEdge, calibration)
      expect(fraction).toBeGreaterThan(0)
      expect(realWidthMm(fraction, shortEdge, calibration)).toBeCloseTo(targetMm, 6)
      expect(defaultSizeFor(mode, shortEdge, calibration)).toBeGreaterThan(0)
    }
  })

  it('rate-limits quality warnings by mode resolution factor', () => {
    const calibration: Calibration = { pxPerMm: 1, referenceWidthMm: 210, modeId: 'a4' }
    const a4 = getMode('a4')
    const small = assessQuality(300, 200, a4, 390, calibration)
    expect(small?.level).toBe('ok')

    const tooSmall = assessQuality(40, 2000, a4, 390, calibration)
    expect(tooSmall?.level).toBe('fuzzy')
  })
})

describe('unit helpers', () => {
  it('chooses readable units', () => {
    expect(bestUnit(80)).toBe('mm')
    expect(bestUnit(210)).toBe('cm')
    expect(bestUnit(1400)).toBe('m')
  })

  it('parses typed sizes with and without units', () => {
    expect(parseRealSize('210')).toBe(210)
    expect(parseRealSize('21cm')).toBe(210)
    expect(parseRealSize('1.4m')).toBe(1400)
    expect(parseRealSize('nope')).toBeNull()
    expect(parseRealSize('-5')).toBeNull()
  })

  it('formats a wall-sized width without false precision', () => {
    expect(formatRealSize(1000)).toBe('1.0 m')
    expect(pxPerMmFor(420, 210)).toBe(2)
  })
})
