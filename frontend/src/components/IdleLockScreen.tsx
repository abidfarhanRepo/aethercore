import { useState } from 'react'
import { authAPI, getNetworkErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type IdleLockScreenProps = {
  onUnlock: () => void
  onForceLogout: () => void
  hasPinSet: boolean
}

export default function IdleLockScreen({ onUnlock, onForceLogout, hasPinSet }: IdleLockScreenProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const unlock = async () => {
    if (!hasPinSet) {
      onForceLogout()
      return
    }

    try {
      setError(null)
      setIsSubmitting(true)
      await authAPI.verifyPin(pin)
      setPin('')
      onUnlock()
    } catch (unlockError: any) {
      setError(getNetworkErrorMessage(unlockError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <h2 className="text-2xl font-bold text-foreground">Session Locked</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {hasPinSet
            ? 'Enter your PIN to unlock this session.'
            : 'No lock PIN is set for this account. You must log in again.'}
        </p>

        {hasPinSet ? (
          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <label htmlFor="idle-lock-pin" className="text-sm font-medium text-foreground">
                PIN
              </label>
              <Input
                id="idle-lock-pin"
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="Enter your PIN"
                className="h-12 text-base"
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button onClick={unlock} disabled={isSubmitting || pin.length < 4}>
                {isSubmitting ? 'Unlocking...' : 'Unlock'}
              </Button>
              <Button variant="outline" onClick={onForceLogout}>
                Log out
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <Button onClick={onForceLogout}>Return to login</Button>
          </div>
        )}
      </div>
    </div>
  )
}
