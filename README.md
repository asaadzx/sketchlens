# SketchLens

Trace art on a real wall through your phone camera.

Open the link, grant camera access, drop an image over the view, line it up against the wall
until it looks right, then lock it and trace the outline. No account, no install, no native app.

![Stack](https://img.shields.io/badge/React_19-Vite-informational) ![Stack](https://img.shields.io/badge/Tailwind_4-38bdf8)

## Try it

**[sketchlens-iota.vercel.app](https://sketchlens-iota.vercel.app)** — open the link and it works.
Add to home screen on Android, or Share → Add to Home Screen on iOS.

## How it works

There is no plane detection here, and that is a deliberate choice. Reliable AR wall tracking on a
phone browser needs WebXR plus sensor fusion that the web platform still does not expose. So
SketchLens does the honest version: it composites an image over the live camera feed and lets you
align it by eye.

That solves the actual problem — *what will this look like on the wall before I paint it?* — without
pretending to be SLAM.

1. Pick a size profile and calibrate against a real reference (see below)
2. Search, paste a link, or upload an image
3. Drag to move, pinch to size, twist to angle — or type an exact real width
4. Drop the opacity until the line reads without the photo fighting you
5. Lock it, enter trace mode, and trace on the plaster
6. Optionally snap a reference photo or copy a share link

## Scale and calibration

Without a reference, a browser can only guess how big something should be. Calibration fixes that.
You tell the app the real width of an object on the wall, and it works out how many screen pixels
make a millimetre at that distance.

The formula is the same in every mode:

```
pxPerMm = on-screen reference width (px) / real reference width (mm)
```

Pick the profile that matches your job, frame the reference, stretch the box over it, and press
**Use this scale**. The overlay then reports its real width on the wall, and you can drag it or type
an exact size (`210`, `21cm`, `1.4m`).

| Profile | Reference | Typical target |
| --- | --- | --- |
| A4 paper | one A4 sheet (210 mm) | paper-sized art |
| Paper (generic) | any rectangle you measure | custom sizes |
| Small wall | metre rule or two A4 sheets (594 mm) | roughly 1–2 m |
| Big wall | one A4 sheet, stepped back | 3–5 m and beyond |

Calibration is only valid while the phone stays at the same distance and angle, so the app warns
when it matters and reminds you to lock the overlay. Big-wall projections also warn when the source
image does not have enough resolution to look sharp at that size.

## Gestures

| Gesture | Desktop |
| --- | --- |
| Move | drag |
| Scale | scroll |
| Rotate | shift + scroll |
| Nudge rotate | the 5° button |
| Reset | the reset button |

Everything is pointer events, so touch, mouse and stylus share one code path. Pinch and rotate are
anchored at the gesture centroid, which means the artwork stays pinned between your fingers
instead of orbiting away from them. Lifting one finger of a two-finger gesture re-anchors on the
remaining one rather than jumping.

## Share links

A share link encodes the whole setup, so the person receiving it sees the same image at the same
apparent size and angle:

```
?img=<url>&w=<px>&h=<px>&x=<0..1>&y=<0..1>&size=<0..1>&rot=<deg>&op=<0..1>&mm=<width>&mode=<id>
```

Size is stored as a fraction of the viewport's shorter edge rather than in pixels, so a link made on
a phone lands at the same relative size on a laptop. No backend is involved: the only thing needed
is a public image URL.

A calibrated link also carries the intended real width (`mm`) and profile (`mode`). The sender's
`px/mm` cannot travel — it belongs to their screen and holding distance — so the recipient
re-calibrates on their own device and the overlay snaps to the shared real size.

Uploaded images use `blob:` URLs and cannot be shared in v1. That is a real limitation, not an
oversight — hosting them would mean a backend, and base64-in-URL does not survive contact with a
real image.

## Images

Search runs through [Openverse](https://openverse.org/) and [Wikimedia Commons](https://commons.wikimedia.org/),
filtered to licences that allow commercial use and modification. Both need no API key, unlike
Unsplash, and they serve CORS headers so results can be drawn onto a canvas for the photo capture.
Commons is queried in parallel as a fallback when Openverse returns little or nothing.

Credit is displayed on screen and travels in the share link.

## Tech

React 19, Vite 8, Tailwind CSS 4, Lucide icons, TypeScript. Camera via plain
`getUserMedia`, gestures hand-written on pointer events, PWA via `vite-plugin-pwa`.

```
npm install
npm run dev        # dev server (HTTPS or localhost for camera)
npm run build      # typecheck + production build
npm run lint       # eslint
npm test           # vitest (overlay, calibration and share logic)
npm run preview
```

## Privacy

Camera frames never leave the device. The app has no backend, no analytics and no accounts.
Search queries go to Openverse; everything else stays local.

## Honest limits

- No wall detection. The overlay moves with the phone, so keep still or prop the phone up.
- Calibration is only valid while the phone stays at the same distance and angle. Move and the
  reported size is wrong; re-calibrate or lock the overlay.
- Calibration accuracy depends on how carefully you frame the reference. A half-pixel finger wobble
  at a small reference is a real millimetre error, so the app shows a precision readout.
- Share links need a public image URL, so uploads are excluded.
- One image at a time, no layers.

## Licence

MIT.
