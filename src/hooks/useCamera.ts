import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraStatus = 'idle' | 'requesting' | 'live' | 'denied' | 'missing' | 'error'

export interface CameraState {
  status: CameraStatus
  error: string
  facing: 'environment' | 'user'
  hasMultiple: boolean
  start: (facing?: 'environment' | 'user') => void | Promise<void>
  flip: () => void
}

const MESSAGES: Record<string, string> = {
  NotAllowedError:
    'Camera access was blocked. Allow the camera for this site in your browser settings, then try again.',
  NotFoundError: 'No camera was found on this device.',
  NotReadableError: 'Another app is already using the camera. Close it and try again.',
  OverconstrainedError: 'This camera cannot provide the requested video mode.',
  SecurityError: 'The browser blocked the camera. A secure (https) connection is required.',
}

export function useCamera(): CameraState {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState('')
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [hasMultiple, setHasMultiple] = useState(false)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const start = useCallback(
    async (nextFacing: 'environment' | 'user' = 'environment') => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('missing')
        setError(
          window.isSecureContext
            ? 'This browser does not expose a camera API.'
            : 'Camera access needs a secure (https) connection.',
        )
        return
      }

      stop()
      setStatus('requesting')
      setError('')

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: nextFacing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
        streamRef.current = stream

        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          try {
            await video.play()
          } catch {
            /* Autoplay can still be refused; the stream stays attached. */
          }
        }

        const track = stream.getVideoTracks()[0]
        const settings = track?.getSettings?.()
        setHasMultiple(track ? track.getCapabilities?.().facingMode?.length !== 1 : false)
        setFacing((settings?.facingMode as 'environment' | 'user' | undefined) ?? nextFacing)
        setStatus('live')
      } catch (cause) {
        const name = cause instanceof DOMException ? cause.name : ''
        setError(MESSAGES[name] ?? 'The camera could not be started.')
        setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error')
      }
    },
    [stop],
  )

  const flip = useCallback(() => {
    void start(facing === 'environment' ? 'user' : 'environment')
  }, [facing, start])

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        setHasMultiple(devices.filter((device) => device.kind === 'videoinput').length > 1)
      })
      .catch(() => undefined)
  }, [status])

  useEffect(() => stop, [stop])

  return { status, error, facing, hasMultiple, start, flip }
}
