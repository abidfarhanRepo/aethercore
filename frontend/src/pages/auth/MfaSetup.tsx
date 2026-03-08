import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI, getNetworkErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'

export default function MfaSetup() {
  const navigate = useNavigate()
  const [secret, setSecret] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)

  useEffect(() => {
    const enroll = async () => {
      try {
        const response = await authAPI.enrollMfa()
        setSecret(response.data.secret)
        setQrCode(response.data.qrCode)
        setRecoveryCodes(response.data.recoveryCodes || [])
      } catch (enrollError: any) {
        setError(getNetworkErrorMessage(enrollError))
      } finally {
        setIsLoading(false)
      }
    }

    void enroll()
  }, [])

  const verifyMfa = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsVerifying(true)

    try {
      await authAPI.verifyMfa(token)
      navigate('/checkout')
    } catch (verifyError: any) {
      setError(getNetworkErrorMessage(verifyError))
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-3xl items-center justify-center px-4 py-8 sm:px-6">
      <Card className="w-full border-border/70 bg-card/95 shadow-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Enable Multi-Factor Authentication</CardTitle>
          <CardDescription>
            MFA is required for admin and manager accounts. Scan the QR code, then verify with a 6-digit code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Preparing MFA enrollment...</p>
          ) : (
            <>
              {qrCode ? (
                <div className="flex justify-center">
                  <img
                    src={`data:image/png;base64,${qrCode}`}
                    alt="MFA QR code"
                    className="h-48 w-48 rounded-lg border border-border p-2"
                  />
                </div>
              ) : null}

              <div className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm">
                <p className="font-medium text-foreground">Manual secret key</p>
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{secret}</p>
              </div>

              <div className="rounded-lg border border-amber-400/50 bg-amber-500/10 p-4 text-sm">
                <p className="font-semibold text-foreground">Save your recovery codes now</p>
                <p className="mt-1 text-muted-foreground">
                  Each code can be used once if you lose access to your authenticator app.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {recoveryCodes.map((code) => (
                    <code key={code} className="rounded bg-background px-2 py-1 text-xs">
                      {code}
                    </code>
                  ))}
                </div>
              </div>

              <form onSubmit={verifyMfa} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <label htmlFor="mfa-token" className="text-sm font-medium text-foreground">
                    6-digit verification code
                  </label>
                  <Input
                    id="mfa-token"
                    value={token}
                    onChange={(event) => setToken(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    className="h-12 text-base"
                    required
                  />
                </div>

                {error ? (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={isVerifying || token.length !== 6}>
                    {isVerifying ? 'Verifying...' : 'Verify and enable MFA'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate('/checkout')}>
                    Skip for now
                  </Button>
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
