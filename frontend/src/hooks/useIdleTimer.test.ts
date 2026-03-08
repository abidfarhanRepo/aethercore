import { act, renderHook } from '@testing-library/react'
import { useIdleTimer } from './useIdleTimer'

describe('useIdleTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  test('fires onIdle after timeout and resets on activity', () => {
    const onIdle = jest.fn()

    const { result } = renderHook(() =>
      useIdleTimer({
        enabled: true,
        timeoutMinutes: 1,
        onIdle,
      })
    )

    act(() => {
      jest.advanceTimersByTime(59_000)
    })

    expect(onIdle).not.toHaveBeenCalled()
    expect(result.current.isIdle).toBe(false)

    act(() => {
      jest.setSystemTime(new Date('2026-01-01T00:00:59.000Z'))
      window.dispatchEvent(new Event('mousemove'))
    })

    act(() => {
      jest.advanceTimersByTime(30_000)
    })

    expect(onIdle).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(31_000)
    })

    expect(onIdle.mock.calls.length).toBeGreaterThan(0)
    expect(result.current.isIdle).toBe(true)
  })
})
