import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type UseIdleTimerOptions = {
  enabled: boolean
  timeoutMinutes: number
  onIdle: () => void
}

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'touchstart', 'mousedown']

export function useIdleTimer({ enabled, timeoutMinutes, onIdle }: UseIdleTimerOptions) {
  const timeoutMs = useMemo(() => Math.max(1, timeoutMinutes) * 60 * 1000, [timeoutMinutes])
  const [lastActivityAt, setLastActivityAt] = useState<number>(Date.now())
  const [isIdle, setIsIdle] = useState(false)
  const onIdleRef = useRef(onIdle)

  useEffect(() => {
    onIdleRef.current = onIdle
  }, [onIdle])

  const resetTimer = useCallback(() => {
    setLastActivityAt(Date.now())
    setIsIdle(false)
  }, [])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const handleActivity = () => {
      setLastActivityAt(Date.now())
      setIsIdle(false)
    }

    ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, handleActivity, { passive: true }))

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, handleActivity))
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || isIdle) {
      return
    }

    const interval = window.setInterval(() => {
      if (Date.now() - lastActivityAt >= timeoutMs) {
        setIsIdle(true)
        onIdleRef.current()
      }
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [enabled, isIdle, lastActivityAt, timeoutMs])

  return {
    isIdle,
    resetTimer,
    lastActivityAt,
  }
}
