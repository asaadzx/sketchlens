import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraStatus = 'idle' | 'requesting' | 'live' | 'denied' | 'missing' | 'error'

export interface CameraState {
  status: CameraStatus
  error: string
  facing: 'environment' | 'user'
  hasMultiple: boolean
  /** The active stream, held in state so the <video> can sync to it. */
  stream: MediaStream | null
  start: (facing?: 'environment' | 'user') => void
  flip: () => void
}

const MESSAGES: Record<string, string> = {
  NotAllowedError:
    'Camera access was blocked. Allow the camera for this site in your browser settings, then try again.',
  PermissionDeniedError:
    'Camera access was blocked. Allow the camera for this site in your browser settings, then try again.',
  NotFoundError: 'No camera was found on this device.',
  DevicesNotFoundError: 'No camera was found on this device.',
  NotReadableError: 'Another app is already using the camera. Close it and try again.',
  TrackStartError: 'Another app is already using the camera. Close it and try again.',
  OverconstrainedError: 'This camera cannot provide the requested video mode.',
  SecurityError: 'The browser blocked the camera. A secure (https) connection is required.',
}

function describe(cause: unknown): string {
  const name = cause instanceof DOMException ? cause.name : ''
  return MESSAGES[name] ?? 'The camera could not be started.'
}

export function useCamera(): CameraState {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState('')
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [hasMultiple, setHasMultiple] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setStream(null)
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
        // Asking for the bare minimum keeps this working on cheap devices and
        // avoids OverconstrainedError when a camera cannot hit the ideal sizes.
        const next = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: nextFacing } },
          audio: false,
        })
        streamRef.current = next
        setStream(next)

        const settings = next.getVideoTracks()[0]?.getSettings?.()
        setFacing((settings?.facingMode as 'environment' | 'user' | undefined) ?? nextFacing)
        setStatus('live')
      } catch (cause) {
        const name = cause instanceof DOMException ? cause.name : ''
        setError(describe(cause))
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
    let cancelled = false
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        if (!cancelled) {
          setHasMultiple(devices.filter((device) => device.kind === 'videoinput').length > 1)
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [status])

  useEffect(() => {
    const active = streamRef.current
    return () => {
      active?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  return { status, error, facing, hasMultiple, stream, start, flip }
}
