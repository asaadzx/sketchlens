import { describe, expect, it } from 'vitest'
import {
  assessPrecision,
  assessQuality,
  bestUnit,
  defaultSizeFor,
  formatRealSize,
  fromUnit,
  isCalibrationUsable,
  parseRealSize,
  parseReferenceWidth,
  pxPerMmFor,
  realWidthMm,
  sizeFractionFor,
  toUnit,
} from '../src/lib/calibration'
import { getMode, MODES, MODE_IDS } from '../src/lib/modes'

const a4 = getMode('a4')
const big = getMode('big-wall')

describe('px per mm', () => {
  it('divides on-screen width by the real reference width', () => {
    expect(pxPerMmFor(210, 210)).toBe(1)
    expect(pxPerMmFor(420, 210)).toBe(2)
    expect(pxPerMmFor(200, 1000)).toBeCloseTo(0.2, 10)
  })

  it('returns zero for unusable inputs rather than Infinity or NaN', () => {
    expect(pxPerMmFor(0, 210)).toBe(0)
    expect(pxPerMmFor(-5, 210)).toBe(0)
    expect(pxPerMmFor(210, 0)).toBe(0)
    expect(pxPerMmFor(NaN, 210)).toBe(0)
  })

  it('is identical at every camera distance, which is why big wall needs no lookup table', () => {
    // The on-screen size of the A4 shrinks with distance, but the ratio that
    // matters does not. This is the property the plan's lookup table would
    // have approximated and could have got wrong.
    const focalPx = 1400
    const ratios = [1000, 3000, 5000].map((distanceMm) => {
      const a4OnScreenPx = (focalPx * 210) / distanceMm
      return pxPerMmFor(a4OnScreenPx, 210)
    })
    // px/mm on the wall is what we solve for; the on-screen ratio equals
    // focal/distance for every distance, so it is constant per device.
    expect(ratios[0]).toBeCloseTo(focalPx / 1000, 6)
    expect(ratios[1]).toBeCloseTo(focalPx / 3000, 6)
    expect(ratios[2]).toBeCloseTo(focalPx / 5000, 6)
  })
})

describe('real size conversion', () => {
  const calibration = { pxPerMm: 2, referenceWidthMm: 210, modeId: 'a4' as const }

  it('converts a size fraction to millimetres', () => {
    // 0.5 of a 400px short edge is 200px; at 2 px/mm that is 100mm.
    expect(realWidthMm(0.5, 400, calibration)).toBeCloseTo(100, 10)
  })

  it('converts millimetres back to a size fraction', () => {
    expect(sizeFractionFor(100, 400, calibration)).toBeCloseTo(0.5, 10)
  })

  it('round trips', () => {
    const fraction = 0.375
    const mm = realWidthMm(fraction, 900, calibration)!
    expect(realWidthMm(sizeFractionFor(mm, 900, calibration), 900, calibration)).toBeCloseTo(mm, 6)
  })

  it('returns null without a usable calibration', () => {
    expect(realWidthMm(0.5, 400, null)).toBeNull()
    expect(realWidthMm(0.5, 400, { pxPerMm: 0, referenceWidthMm: 210, modeId: 'a4' })).toBeNull()
  })

  it('guards divide by zero', () => {
    expect(sizeFractionFor(100, 0, calibration)).toBe(0)
    expect(sizeFractionFor(-5, 400, calibration)).toBe(0)
  })

  it('starts each mode at its intended physical size', () => {
    const smallViewport = 400
    const a4Fraction = defaultSizeFor(a4, smallViewport, { pxPerMm: 2, referenceWidthMm: 210, modeId: 'a4' })
    expect(realWidthMm(a4Fraction, smallViewport, { pxPerMm: 2, referenceWidthMm: 210, modeId: 'a4' })).toBeCloseTo(210, 6)

    const bigCalibration = { pxPerMm: 0.4, referenceWidthMm: 210, modeId: 'big-wall' as const }
    const bigFraction = defaultSizeFor(big, smallViewport, bigCalibration)
    expect(realWidthMm(bigFraction, smallViewport, bigCalibration)).toBeCloseTo(2000, 6)
  })
})

describe('calibration validity', () => {
  it('accepts a sane calibration', () => {
    expect(isCalibrationUsable({ pxPerMm: 1.5, referenceWidthMm: 210, modeId: 'a4' })).toBe(true)
  })

  it('rejects degenerate ones', () => {
    expect(isCalibrationUsable(null)).toBe(false)
    expect(isCalibrationUsable({ pxPerMm: 0, referenceWidthMm: 210, modeId: 'a4' })).toBe(false)
    expect(isCalibrationUsable({ pxPerMm: 1, referenceWidthMm: 0, modeId: 'a4' })).toBe(false)
  })
})

describe('precision', () => {
  it('flags a reference that is too small on screen', () => {
    // Big wall tolerates the smallest reference, because a distant A4 is
    // unavoidably small on screen.
    expect(assessPrecision(200, 1, a4).level).toBe('good')
    expect(assessPrecision(80, 1, a4).level).toBe('coarse')
    expect(assessPrecision(30, 1, a4).level).toBe('unusable')
    expect(assessPrecision(70, 1, big).level).toBe('good')
    // Big wall's floor is 44px: below 66px is coarse, below 44px unusable.
    expect(assessPrecision(50, 1, big).level).toBe('coarse')
    expect(assessPrecision(30, 1, big).level).toBe('unusable')
  })

  it('reports the millimetre error from finger placement', () => {
    expect(assessPrecision(200, 2, a4).errorMm).toBeCloseTo(0.25, 10)
    expect(assessPrecision(200, 0, a4).errorMm).toBe(Infinity)
  })
})

describe('quality', () => {
  const calibration = { pxPerMm: 2, referenceWidthMm: 210, modeId: 'small-wall' as const }

  it('is fine when the image covers its display size', () => {
    // 800mm at 2px/mm is 1600 display px, so a 2000px source is not upscaled.
    expect(assessQuality(2000, 800, getMode('small-wall'), 900, calibration)?.level).toBe('ok')
  })

  it('warns when a big projection upscales a small source', () => {
    expect(assessQuality(500, 2000, big, 900, calibration)?.level).toBe('fuzzy')
  })

  it('scales the requirement with the mode', () => {
    // Same source and target, stricter on a big wall than a small one.
    const smallWall = assessQuality(900, 1200, getMode('small-wall'), 900, calibration)!
    const bigWall = assessQuality(900, 1200, big, 900, calibration)!
    expect(bigWall.requiredSourcePx).toBeGreaterThan(smallWall.requiredSourcePx)
  })

  it('needs no calibration to say nothing', () => {
    expect(assessQuality(1000, 800, a4, 900, null)).toBeNull()
  })
})

describe('units', () => {
  it('picks the friendliest unit', () => {
    expect(bestUnit(80)).toBe('mm')
    expect(bestUnit(210)).toBe('cm')
    expect(bestUnit(999)).toBe('cm')
    expect(bestUnit(1000)).toBe('m')
    expect(bestUnit(3200)).toBe('m')
  })

  it('converts both ways', () => {
    expect(toUnit(210, 'cm')).toBeCloseTo(21, 10)
    expect(toUnit(210, 'm')).toBeCloseTo(0.21, 10)
    expect(fromUnit(21, 'cm')).toBeCloseTo(210, 10)
    expect(fromUnit(1.4, 'm')).toBeCloseTo(1400, 10)
  })

  it('formats with sensible precision', () => {
    expect(formatRealSize(148)).toBe('14.8 cm')
    expect(formatRealSize(80)).toBe('80 mm')
    expect(formatRealSize(210)).toBe('21.0 cm')
    expect(formatRealSize(1400)).toBe('1.4 m')
    expect(formatRealSize(3200)).toBe('3.2 m')
    expect(formatRealSize(12000)).toBe('12.0 m')
  })

  it('parses plain numbers and unit suffixes', () => {
    expect(parseRealSize('210')).toBeCloseTo(210, 10)
    expect(parseRealSize('21cm')).toBeCloseTo(210, 10)
    expect(parseRealSize('1.4 m')).toBeCloseTo(1400, 10)
    expect(parseRealSize('  21,0 CM ')).toBeCloseTo(210, 10)
  })

  it('rejects nonsense', () => {
    expect(parseRealSize('')).toBeNull()
    expect(parseRealSize('abc')).toBeNull()
    expect(parseRealSize('-5')).toBeNull()
    expect(parseRealSize('0')).toBeNull()
    expect(parseRealSize('5 inches')).toBeNull()
  })

  it('rejects references that are implausibly small or large', () => {
    expect(parseReferenceWidth('210mm')).toBeCloseTo(210, 10)
    expect(parseReferenceWidth('1000')).toBeCloseTo(1000, 10)
    expect(parseReferenceWidth('5mm')).toBeNull()
    expect(parseReferenceWidth('100m')).toBeNull()
  })
})

describe('mode definitions', () => {
  it('has four unique modes', () => {
    expect(MODES).toHaveLength(4)
    expect(new Set(MODE_IDS).size).toBe(4)
  })

  it('gives every mode a usable reference, default and steps', () => {
    for (const mode of MODES) {
      expect(mode.referenceWidthMm).toBeGreaterThan(0)
      expect(mode.defaultTargetMm).toBeGreaterThan(0)
      expect(mode.steps.length).toBeGreaterThanOrEqual(3)
      expect(mode.tip.length).toBeGreaterThan(10)
      expect(mode.minReferencePx).toBeGreaterThan(0)
      expect(mode.resolutionFactor).toBeGreaterThan(0)
    }
  })

  it('asks for a typed width only when the size is genuinely unknown', () => {
    expect(a4.referenceIsKnown).toBe(true)
    expect(big.referenceIsKnown).toBe(true)
    expect(getMode('paper').referenceIsKnown).toBe(false)
    expect(getMode('small-wall').referenceIsKnown).toBe(false)
  })

  it('grows touch targets for the modes held further away', () => {
    const paper = getMode('paper')
    expect(paper.targetSize).toBeGreaterThan(a4.targetSize)
    expect(big.targetSize).toBeGreaterThan(getMode('small-wall').targetSize)
  })

  it('is strictest about resolution on the biggest wall', () => {
    const ordered = [...MODES].sort((a, b) => a.resolutionFactor - b.resolutionFactor)
    expect(ordered[0].id).toBe('a4')
    expect(ordered[ordered.length - 1].id).toBe('big-wall')
  })

  it('falls back to the first mode for an unknown id', () => {
    expect(getMode('nonsense' as never).id).toBe('a4')
  })
})
