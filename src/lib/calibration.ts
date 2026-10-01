import type { Mode, ModeId } from './modes'

/**
 * A calibration maps on-screen pixels to real millimetres at the distance the
 * phone is currently being held.
 *
 * Important caveat, which the UI repeats to the user: this is only valid while
 * the phone stays at the same distance and angle from the wall. Walking closer
 * invalidates it, which is why the app warns rather than pretending otherwise.
 */
export interface Calibration {
  /** Screen pixels per real millimetre. */
  pxPerMm: number
  /** Which reference the user aligned to. */
  referenceWidthMm: number
  modeId: ModeId
}

/** Core formula, identical for every mode. */
export function pxPerMmFor(onScreenPx: number, referenceWidthMm: number): number {
  if (!(onScreenPx > 0) || !(referenceWidthMm > 0)) return 0
  return onScreenPx / referenceWidthMm
}

export function isCalibrationUsable(calibration: Calibration | null): calibration is Calibration {
  return Boolean(calibration && calibration.pxPerMm > 0 && calibration.referenceWidthMm > 0)
}

/** Overlay width in real millimetres, given its width as a fraction of the viewport's short edge. */
export function realWidthMm(sizeFraction: number, viewportShortEdge: number, calibration: Calibration | null): number | null {
  if (!isCalibrationUsable(calibration)) return null
  const px = sizeFraction * viewportShortEdge
  return px / calibration.pxPerMm
}

/** Inverse: the size fraction needed to project a given real width. */
export function sizeFractionFor(targetMm: number, viewportShortEdge: number, calibration: Calibration): number {
  if (!(targetMm > 0) || !(calibration.pxPerMm > 0) || viewportShortEdge <= 0) return 0
  return (targetMm * calibration.pxPerMm) / viewportShortEdge
}

/** Default overlay size for a mode, expressed as a viewport fraction. */
export function defaultSizeFor(mode: Mode, viewportShortEdge: number, calibration: Calibration): number {
  return sizeFractionFor(mode.defaultTargetMm, viewportShortEdge, calibration)
}

export type QualityLevel = 'ok' | 'soft' | 'fuzzy'

export interface QualityReport {
  level: QualityLevel
  /** Source pixels needed per mm of projection for this mode. */
  requiredSourcePx: number
  /** Actual source width of the chosen image, in px. */
  sourcePx: number
  targetMm: number
}

/**
 * A projected image is upscaled by the browser whenever its on-screen width
 * exceeds its intrinsic width. Bigger modes demand more source resolution
 * because the same image covers far more millimetres of wall.
 */
export function assessQuality(
  sourceNaturalWidth: number,
  targetMm: number,
  mode: Mode,
  _viewportShortEdge: number,
  calibration: Calibration | null,
): QualityReport | null {
  if (!isCalibrationUsable(calibration) || !(targetMm > 0)) return null

  const requiredSourcePx = Math.round(targetMm * mode.resolutionFactor)
  const sourcePx = sourceNaturalWidth
  const effective = Math.round(targetMm * calibration.pxPerMm)

  if (effective <= sourcePx) return { level: 'ok', requiredSourcePx, sourcePx, targetMm }
  if (sourcePx >= requiredSourcePx / 2) return { level: 'soft', requiredSourcePx, sourcePx, targetMm }
  return { level: 'fuzzy', requiredSourcePx, sourcePx, targetMm }
}

export interface PrecisionReport {
  /** On-screen width of the reference box, in px. */
  referencePx: number
  /** Below this the measurement is too coarse to trust. */
  minPx: number
  level: 'good' | 'coarse' | 'unusable'
  /** Rough millimetre error from a half-pixel finger placement, in mm. */
  errorMm: number
}

/**
 * Finger placement is the dominant error source. With N reference pixels across
 * a known width, a consistent half-pixel wobble is 0.5/pxPerMm millimetres out.
 */
export function assessPrecision(referencePx: number, calibrationPxPerMm: number, mode: Mode): PrecisionReport {
  const minPx = mode.minReferencePx
  const errorMm = calibrationPxPerMm > 0 ? 0.5 / calibrationPxPerMm : Infinity
  if (referencePx >= minPx * 1.5) return { referencePx, minPx, level: 'good', errorMm }
  if (referencePx >= minPx) return { referencePx, minPx, level: 'coarse', errorMm }
  return { referencePx, minPx, level: 'unusable', errorMm }
}

/* ---------------------------------------------------------------- units --- */

export type Unit = 'mm' | 'cm' | 'm'

/** Picks the friendliest unit for a millimetre value. */
export function bestUnit(mm: number): Unit {
  const abs = Math.abs(mm)
  if (abs >= 1000) return 'm'
  if (abs >= 100) return 'cm'
  return 'mm'
}

export function toUnit(mm: number, unit: Unit): number {
  if (unit === 'm') return mm / 1000
  if (unit === 'cm') return mm / 10
  return mm
}

export function fromUnit(value: number, unit: Unit): number {
  if (unit === 'm') return value * 1000
  if (unit === 'cm') return value * 10
  return value
}

/** A short human label, e.g. "21 cm", "1.4 m", "148 mm". */
export function formatRealSize(mm: number, unit?: Unit): string {
  const chosen = unit ?? bestUnit(mm)
  const value = toUnit(mm, chosen)
  // mm needs no decimals; cm and m step down in precision as the value grows,
  // so a metre-scale number does not read "3.20 m".
  const decimals = chosen === 'mm' ? 0 : value >= 10 ? 1 : chosen === 'cm' ? 2 : 1
  return `${value.toFixed(decimals)} ${chosen}`
}

/** Parses "21", "21cm", "1.4m" into millimetres. Returns null when unparseable. */
export function parseRealSize(input: string): number | null {
  const text = input.trim().toLowerCase().replace(',', '.')
  const match = /^(-?\d+(?:\.\d+)?)\s*(mm|cm|m)?$/.exec(text)
  if (!match) return null
  const value = Number(match[1])
  if (!Number.isFinite(value)) return null
  const unit = (match[2] as Unit | undefined) ?? 'mm'
  const mm = fromUnit(value, unit)
  return mm > 0 ? mm : null
}

export function parseReferenceWidth(input: string): number | null {
  const mm = parseRealSize(input)
  if (mm === null) return null
  // Anything from a business card to a wall section.
  return mm >= 20 && mm <= 20000 ? mm : null
}
