import { useEffect, useState } from 'react'

export interface Viewport {
  width: number
  height: number
}

export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))

  useEffect(() => {
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setViewport((previous) => {
          const width = window.innerWidth
          const height = window.innerHeight
          return previous.width === width && previous.height === height
            ? previous
            : { width, height }
        })
      })
    }

    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [])

  return viewport
}
