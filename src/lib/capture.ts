import type { PixelTransform } from './overlay'
import { overlayBox } from './overlay'

export interface CaptureInput {
  video: HTMLVideoElement | null
  image: HTMLImageElement | null
  pixel: PixelTransform
  stageW: number
  stageH: number
  opacity: number
  trace: boolean
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceW: number,
  sourceH: number,
  boxW: number,
  boxH: number,
) {
  if (sourceW <= 0 || sourceH <= 0) return
  const scale = Math.max(boxW / sourceW, boxH / sourceH)
  const drawW = sourceW * scale
  const drawH = sourceH * scale
  ctx.drawImage(source, (boxW - drawW) / 2, (boxH - drawH) / 2, drawW, drawH)
}

function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const gradient = ctx.createLinearGradient(0, 0, w, h)
  gradient.addColorStop(0, '#e8dfd2')
  gradient.addColorStop(1, '#d6c9b6')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)
}

/**
 * Flattens the live feed and the overlay into a single still, using the same
 * object-cover maths as the CSS so the photo matches what was on screen.
 */
export function captureFrame(input: CaptureInput): Promise<Blob | null> {
  const { video, image, pixel, stageW, stageH, opacity, trace } = input
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(stageW)
  canvas.height = Math.round(stageH)
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)

  const videoReady = Boolean(
    video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0,
  )

  if (videoReady && video) {
    drawCover(ctx, video, video.videoWidth, video.videoHeight, stageW, stageH)
  } else {
    drawBackdrop(ctx, stageW, stageH)
  }

  if (trace) {
    ctx.fillStyle = 'rgba(20, 17, 14, 0.26)'
    ctx.fillRect(0, 0, stageW, stageH)
  }

  if (image && image.complete && image.naturalWidth > 0) {
    const { width, height } = overlayBox(pixel, image.naturalWidth, image.naturalHeight)
    const halfW = width / 2
    const halfH = height / 2

    if (trace) {
      ctx.save()
      ctx.translate(stageW / 2 + pixel.cx, stageH / 2 + pixel.cy)
      ctx.rotate((pixel.rot * Math.PI) / 180)
      ctx.strokeStyle = 'rgba(255, 246, 235, 0.5)'
      ctx.lineWidth = Math.max(1, stageW / 500)
      ctx.setLineDash([stageW / 90, stageW / 60])
      ctx.strokeRect(-halfW, -halfH, width, height)
      ctx.restore()
    }

    ctx.save()
    ctx.globalAlpha = opacity
    ctx.translate(stageW / 2 + pixel.cx, stageH / 2 + pixel.cy)
    ctx.rotate((pixel.rot * Math.PI) / 180)
    ctx.drawImage(image, -halfW, -halfH, width, height)
    ctx.restore()
  }

  if (trace) {
    ctx.save()
    ctx.strokeStyle = 'rgba(255, 246, 235, 0.22)'
    ctx.lineWidth = 1
    for (let i = 1; i < 3; i += 1) {
      ctx.beginPath()
      ctx.moveTo((stageW / 3) * i, 0)
      ctx.lineTo((stageW / 3) * i, stageH)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, (stageH / 3) * i)
      ctx.lineTo(stageW, (stageH / 3) * i)
      ctx.stroke()
    }
    ctx.restore()
  }

  // A host that serves images without CORS headers taints the canvas, and
  // toBlob throws rather than returning null.
  return new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92)
    } catch {
      resolve(null)
    }
  })
}
