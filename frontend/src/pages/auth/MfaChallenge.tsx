import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI, getNetworkErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import { logSecurityEvent } from '@/lib/security'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'

type ChallengeMode = 'totp' | 'recovery'

export default function MfaChallenge() {
  const navigate = useNavigate()
  const { setTokens, setUser } = useAuthStore()
  const [mode, setMode] = useState<ChallengeMode>('totp')
  const [totpToken, setTotpToken] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const tempSessionToken = useMemo(() => sessionStorage.getItem('mfaTempSessionToken') || '', [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!tempSessionToken) {
      setError('Missing MFA session. Please sign in again.')
      return
    }

    setIsSubmitting(true)
    try {
      const payload =
        mode === 'totp'
          ? { tempSessionToken, token: totpToken }
          : { tempSessionToken, recoveryCode: recoveryCode.trim() }

      const response = await authAPI.completeMfaChallenge(payload)
      const { accessToken, refreshToken, user } = response.data

      sessionStorage.removeItem('mfaTempSessionToken')
      setTokens(accessToken, refreshToken)
      setUser(user)
      navigate('/checkout')
    } catch (challengeError: any) {
      const message = getNetworkErrorMessage(challengeError)
      logSecurityEvent(
        'auth.mfa_failed',
        {
          mode,
          reason: message,
          status: challengeError?.response?.status,
        },
        'high'
      )
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg items-center justify-center px-4 py-8 sm:px-6">
      <Card className="w-full border-border/70 bg-card/95 shadow-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Multi-Factor Authentication</CardTitle>
          <CardDescription>Enter your authenticator code or a one-time recovery code to continue.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={mode === 'totp' ? 'default' : 'outline'} onClick={() => setMode('totp')}>
              Authenticator code
            </Button>
            <Button
              type="button"
              variant={mode === 'recovery' ? 'default' : 'outline'}
              onClick={() => setMode('recovery')}
            >
              Recovery code
            </Button>
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            {mode === 'totp' ? (
              <div className="space-y-2">
                <label htmlFor="mfa-totp" className="text-sm font-medium text-foreground">
                  6-digit code
                </label>
                <Input
                  id="mfa-totp"
                  value={totpToken}
                  onChange={(event) => setTotpToken(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  className="h-12 text-base"
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label htmlFor="mfa-recovery" className="text-sm font-medium text-foreground">
                  Recovery code
                </label>
                <Input
                  id="mfa-recovery"
                  value={recoveryCode}
                  onChange={(event) => setRecoveryCode(event.target.value.toUpperCase())}
                  placeholder="ABCD-1234"
                  className="h-12 text-base"
                  required
                />
              </div>
            )}

            {error ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  (mode === 'totp' ? totpToken.length !== 6 : recoveryCode.trim().length === 0)
                }
              >
                {isSubmitting ? 'Verifying...' : 'Verify'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/login')}>
                Back to login
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
