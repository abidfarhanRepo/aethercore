import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, ShieldCheck, ShieldX } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { authAPI, getNetworkErrorMessage } from '@/lib/api'

type MfaStatus = {
  mfaEnabled: boolean
  recoveryCodesRemaining: number
  recoveryCodes: string[]
}

export default function MfaSettings() {
  const [status, setStatus] = useState<MfaStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [secret, setSecret] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [token, setToken] = useState('')

  const loadStatus = async () => {
    try {
      const response = await authAPI.getMfaStatus()
      setStatus(response.data)
      setRecoveryCodes(response.data.recoveryCodes || [])
    } catch (statusError: any) {
      setError(getNetworkErrorMessage(statusError))
    }
  }

  useEffect(() => {
    void loadStatus()
  }, [])

  const startEnrollment = async () => {
    try {
      setLoading(true)
      setError(null)
      setSuccess(null)
      const response = await authAPI.enrollMfa()
      setSecret(response.data.secret)
      setQrCode(response.data.qrCode)
      setRecoveryCodes(response.data.recoveryCodes || [])
      setToken('')
      setSuccess('MFA enrollment started. Scan the QR code, then verify with a 6-digit code.')
    } catch (enrollError: any) {
      setError(getNetworkErrorMessage(enrollError))
    } finally {
      setLoading(false)
    }
  }

  const verifyEnrollment = async () => {
    try {
      setLoading(true)
      setError(null)
      await authAPI.verifyMfa(token)
      setSuccess('MFA enabled successfully.')
      setSecret('')
      setQrCode('')
      await loadStatus()
    } catch (verifyError: any) {
      setError(getNetworkErrorMessage(verifyError))
    } finally {
      setLoading(false)
    }
  }

  const resetMfa = async () => {
    const confirmed = window.confirm(
      'Reset MFA for your account? You will need to enroll and pair your authenticator app again.'
    )
    if (!confirmed) {
      return
    }

    try {
      setLoading(true)
      setError(null)
      await authAPI.resetMfa()
      setSecret('')
      setQrCode('')
      setRecoveryCodes([])
      setToken('')
      setSuccess('MFA reset complete. Start enrollment to pair a new authenticator app.')
      await loadStatus()
    } catch (resetError: any) {
      setError(getNetworkErrorMessage(resetError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      {success ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            <p className="text-sm text-green-700">{success}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Authenticator MFA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            {status?.mfaEnabled ? (
              <ShieldCheck className="h-4 w-4 text-green-600" />
            ) : (
              <ShieldX className="h-4 w-4 text-amber-600" />
            )}
            <span>
              Status: <strong>{status?.mfaEnabled ? 'Enabled' : 'Not enabled'}</strong>
            </span>
          </div>
          <p className="text-muted-foreground">
            Recovery codes remaining: <strong>{status?.recoveryCodesRemaining ?? 0}</strong>
          </p>

          <div className="flex flex-wrap gap-3">
            <Button onClick={startEnrollment} disabled={loading || Boolean(status?.mfaEnabled)}>
              Enroll Authenticator
            </Button>
            <Button variant="outline" onClick={resetMfa} disabled={loading}>
              Reset MFA
            </Button>
          </div>
        </CardContent>
      </Card>

      {recoveryCodes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Recovery Codes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Keep these codes in a secure location. Each code is single-use.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {recoveryCodes.map((code) => (
                <code key={code} className="rounded bg-muted px-2 py-1 text-xs">
                  {code}
                </code>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {secret && qrCode ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Complete Enrollment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <img
                src={`data:image/png;base64,${qrCode}`}
                alt="MFA QR code"
                className="h-48 w-48 rounded-lg border border-border p-2"
              />
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm">
              <p className="font-medium text-foreground">Manual secret key</p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{secret}</p>
            </div>

            <div className="rounded-lg border border-amber-400/50 bg-amber-500/10 p-4 text-sm">
              <p className="font-semibold text-foreground">Save your recovery codes</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {recoveryCodes.map((code) => (
                  <code key={code} className="rounded bg-background px-2 py-1 text-xs">
                    {code}
                  </code>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="settings-mfa-token" className="text-sm font-medium text-foreground">
                Enter 6-digit code from authenticator
              </label>
              <Input
                id="settings-mfa-token"
                value={token}
                onChange={(event) => setToken(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                className="h-12 text-base"
              />
            </div>

            <Button onClick={verifyEnrollment} disabled={loading || token.length !== 6}>
              Verify and Enable MFA
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
