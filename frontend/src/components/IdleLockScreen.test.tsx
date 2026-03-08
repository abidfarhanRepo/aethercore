import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import IdleLockScreen from './IdleLockScreen'
import { authAPI } from '@/lib/api'

jest.mock('@/lib/api', () => ({
  authAPI: {
    verifyPin: jest.fn(),
  },
  getNetworkErrorMessage: jest.fn(() => 'Invalid PIN'),
}))

describe('IdleLockScreen', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  test('unlocks session when PIN verification succeeds', async () => {
    ;(authAPI.verifyPin as jest.Mock).mockResolvedValue({ data: { verified: true } })
    const onUnlock = jest.fn()
    const onForceLogout = jest.fn()

    render(<IdleLockScreen onUnlock={onUnlock} onForceLogout={onForceLogout} hasPinSet={true} />)

    await userEvent.type(screen.getByLabelText('PIN'), '1234')
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }))

    await waitFor(() => {
      expect(authAPI.verifyPin).toHaveBeenCalledWith('1234')
      expect(onUnlock).toHaveBeenCalledTimes(1)
    })

    expect(onForceLogout).not.toHaveBeenCalled()
  })

  test('forces logout from explicit logout action', async () => {
    const onUnlock = jest.fn()
    const onForceLogout = jest.fn()

    render(<IdleLockScreen onUnlock={onUnlock} onForceLogout={onForceLogout} hasPinSet={true} />)

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))

    expect(onForceLogout).toHaveBeenCalledTimes(1)
    expect(onUnlock).not.toHaveBeenCalled()
  })

  test('forces logout immediately when no PIN is set', async () => {
    const onUnlock = jest.fn()
    const onForceLogout = jest.fn()

    render(<IdleLockScreen onUnlock={onUnlock} onForceLogout={onForceLogout} hasPinSet={false} />)

    await userEvent.click(screen.getByRole('button', { name: 'Return to login' }))

    expect(onForceLogout).toHaveBeenCalledTimes(1)
    expect(onUnlock).not.toHaveBeenCalled()
    expect(authAPI.verifyPin).not.toHaveBeenCalled()
  })
})
