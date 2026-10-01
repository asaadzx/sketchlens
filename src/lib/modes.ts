/**
 * Trace modes pair a physical reference object with the scale maths needed to
 * turn on-screen pixels into millimetres on a real wall.
 *
 * The calibration formula is identical in every mode:
 *
 *     pxPerMm = onScreenWidthPx / referenceWidthMm
 *
 * What differs is the reference, the default projected size, how forgiving the
 * precision check is, and how large the touch targets should be. Keeping one
 * formula means a single tested code path rather than four near-duplicates.
 */

export type ModeId = 'a4' | 'paper' | 'small-wall' | 'big-wall'

export interface ModeStep {
  title: string
  body: string
}

export interface Mode {
  id: ModeId
  label: string
  hint: string
  /** Physical width of the reference object the user lines up on screen. */
  referenceWidthMm: number
  /** Whether the user must type the reference width rather than assume it. */
  referenceIsKnown: boolean
  /** Default projected width of the overlay, in real mm. */
  defaultTargetMm: number
  /** Intrinsic aspect ratio of the reference, when it is a known shape. */
  referenceAspect: number | null
  referenceLabel: string
  /** A projection wider than this in mm gets a resolution warning. */
  warnAboveTargetMm: number
  /** Multiplier on source width required per mm of projection. */
  resolutionFactor: number
  /** Below this on-screen reference width in px, precision is poor. */
  minReferencePx: number
  /** Diameter of interactive targets, in px. Larger modes get larger targets. */
  targetSize: number
  steps: ModeStep[]
  tip: string
}

export const MODES: Mode[] = [
  {
    id: 'a4',
    label: 'A4 paper',
    hint: '210 × 297 mm',
    referenceWidthMm: 210,
    referenceIsKnown: true,
    defaultTargetMm: 210,
    referenceAspect: 210 / 297,
    referenceLabel: 'A4 sheet',
    warnAboveTargetMm: 420,
    resolutionFactor: 1.5,
    minReferencePx: 70,
    targetSize: 44,
    steps: [
      {
        title: 'Pin an A4 sheet to the wall',
        body: 'Tape or pin a single A4 sheet flat against the plaster. A curled or buckled sheet throws the edges off, so flatten the corners.',
      },
      {
        title: 'Frame the sheet',
        body: 'Hold the phone square to the wall and put the whole sheet inside the frame. Keep the phone level, or the sheet measures short and your size will come out large.',
      },
      {
        title: 'Stretch the box over the sheet',
        body: 'Drag the corners onto the paper edges. The width is known at 210 mm, so the app can work out millimetres per pixel straight away.',
      },
    ],
    tip: 'Good for lettering, a stencil, or anything you want exactly A4 sized.',
  },
  {
    id: 'paper',
    label: 'Paper (generic)',
    hint: 'any size, you measure it',
    referenceWidthMm: 210,
    referenceIsKnown: false,
    defaultTargetMm: 210,
    referenceAspect: null,
    referenceLabel: 'sheet of paper',
    warnAboveTargetMm: 500,
    resolutionFactor: 1.5,
    minReferencePx: 60,
    targetSize: 46,
    steps: [
      {
        title: 'Use any flat rectangle',
        body: 'A sheet of paper, a card, a book cover or a chopping board all work. It only needs to be a flat rectangle you know one dimension of.',
      },
      {
        title: 'Type one real dimension',
        body: 'Measure the width in centimetres and type it in. If your sheet is 21.0 cm across, enter 210 mm.',
      },
      {
        title: 'Stretch the box over it',
        body: 'Drag the corners to the edges. The app divides the on-screen width by your real width to get the scale.',
      },
    ],
    tip: 'Use the longest dimension you can measure accurately, to get the most precision.',
  },
  {
    id: 'small-wall',
    label: 'Small wall',
    hint: 'about 1–2 m wide',
    referenceWidthMm: 1000,
    referenceIsKnown: false,
    defaultTargetMm: 800,
    referenceAspect: null,
    referenceLabel: 'metre rule or two A4 sheets',
    warnAboveTargetMm: 1400,
    resolutionFactor: 2,
    minReferencePx: 90,
    targetSize: 48,
    steps: [
      {
        title: 'Find a long straight reference',
        body: 'A metre rule, a tape measure, or two A4 sheets taped side by side for a known 594 mm. A door frame edge works too if you know its width.',
      },
      {
        title: 'Type the real width',
        body: 'One metre is 1000 mm. Two A4 sheets laid side by side is 594 mm. Whatever you use, type its true width.',
      },
      {
        title: 'Line the box up along it',
        body: 'Keep the phone square on and stretch the box along the reference. You are measuring a wall section now, so drift matters more.',
      },
    ],
    tip: 'Prop the phone up once the overlay is placed. At this scale, hand movement is obvious.',
  },
  {
    id: 'big-wall',
    label: 'Big wall',
    hint: '3–5 m and beyond',
    referenceWidthMm: 210,
    referenceIsKnown: true,
    defaultTargetMm: 2000,
    referenceAspect: null,
    referenceLabel: 'A4 sheet, stepped back',
    warnAboveTargetMm: 1800,
    resolutionFactor: 4,
    minReferencePx: 44,
    targetSize: 52,
    steps: [
      {
        title: 'Stick one A4 sheet to the wall',
        body: 'Put it at roughly the height and position you want the artwork, so the projection lands where you are aiming.',
      },
      {
        title: 'Step back and frame it',
        body: 'Step back far enough to cover the wall area, and keep the phone square to the wall. Distance is already accounted for by measuring the sheet on screen, so do not estimate it.',
      },
      {
        title: 'Zoom in to place the box',
        body: 'A distant sheet is small on screen, so precision drops. Pinch to zoom if you can, and the box stays in millimetres as the scale changes.',
      },
    ],
    tip: 'Ask someone to hold the phone, or prop it against something. At 3 m wide, shake is very visible.',
  },
]

export function getMode(id: ModeId): Mode {
  return MODES.find((mode) => mode.id === id) ?? MODES[0]
}

export const MODE_IDS = MODES.map((mode) => mode.id)
