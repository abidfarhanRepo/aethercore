import { useEffect, useMemo, useState } from 'react'
import { Calculator, RefreshCw, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { cashSessionsAPI, CashSession } from '@/lib/api'

type Denomination = {
  label: string
  valueCents: number
}

const DENOMINATIONS: Denomination[] = [
  { label: '$100', valueCents: 10000 },
  { label: '$50', valueCents: 5000 },
  { label: '$20', valueCents: 2000 },
  { label: '$10', valueCents: 1000 },
  { label: '$5', valueCents: 500 },
  { label: '$1', valueCents: 100 },
  { label: '25c', valueCents: 25 },
  { label: '10c', valueCents: 10 },
  { label: '5c', valueCents: 5 },
  { label: '1c', valueCents: 1 },
]

function formatCurrency(cents: number | null | undefined): string {
  const safe = Number.isFinite(cents) ? Number(cents) : 0
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(safe / 100)
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

export default function CashReconciliation() {
  const [sessions, setSessions] = useState<CashSession[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [terminalId, setTerminalId] = useState('')
  const [openingFloatInput, setOpeningFloatInput] = useState('100.00')
  const [counts, setCounts] = useState<Record<number, string>>(() =>
    DENOMINATIONS.reduce((acc, denom) => {
      acc[denom.valueCents] = ''
      return acc
    }, {} as Record<number, string>)
  )

  const activeSession = useMemo(
    () => sessions.find((session) => session.status === 'OPEN') || null,
    [sessions]
  )

  const declaredCashCents = useMemo(() => {
    return DENOMINATIONS.reduce((total, denom) => {
      const rawCount = counts[denom.valueCents] || '0'
      const parsed = Number(rawCount)
      const count = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0
      return total + count * denom.valueCents
    }, 0)
  }, [counts])

  const variancePreviewCents = useMemo(() => {
    if (!activeSession) {
      return null
    }
    const expected = activeSession.systemCashCents ?? activeSession.openingFloatCents
    return declaredCashCents - expected
  }, [activeSession, declaredCashCents])

  const loadSessions = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await cashSessionsAPI.list({ limit: 100, offset: 0 })
      setSessions(response.data.items || [])
    } catch (err: any) {
      console.error('Failed to load cash sessions', err)
      setError(err?.response?.data?.error || 'Failed to load cash sessions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSessions()
  }, [])

  const handleOpenSession = async () => {
    setActionLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const parsedAmount = Number(openingFloatInput)
      const openingFloatCents = Number.isFinite(parsedAmount) ? Math.round(parsedAmount * 100) : NaN

      if (!Number.isFinite(openingFloatCents) || openingFloatCents < 0) {
        setError('Opening float must be a valid non-negative amount.')
        return
      }

      await cashSessionsAPI.open({
        terminalId: terminalId.trim() || undefined,
        openingFloatCents,
      })

      setSuccess('Cash session opened successfully.')
      await loadSessions()
    } catch (err: any) {
      console.error('Failed to open cash session', err)
      setError(err?.response?.data?.error || 'Failed to open cash session')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCloseSession = async () => {
    if (!activeSession) {
      setError('No active cash session found to close.')
      return
    }

    setActionLoading(true)
    setError(null)
    setSuccess(null)

    try {
      await cashSessionsAPI.close(activeSession.id, { declaredCashCents })
      setSuccess('Cash session closed successfully.')
      setCounts(
        DENOMINATIONS.reduce((acc, denom) => {
          acc[denom.valueCents] = ''
          return acc
        }, {} as Record<number, string>)
      )
      await loadSessions()
    } catch (err: any) {
      console.error('Failed to close cash session', err)
      setError(err?.response?.data?.error || 'Failed to close cash session')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6" data-testid="page-cash-reconciliation">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cash Reconciliation</h1>
          <p className="text-sm text-muted-foreground">
            Open shift sessions, close with denomination counts, and review cash variance.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={loadSessions} disabled={loading || actionLoading}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error ? <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}
      {success ? <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">{success}</div> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wallet className="h-5 w-5" />
              Open Cash Session
            </CardTitle>
            <CardDescription>Start a shift by recording opening float for a terminal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="terminal-id">
                Terminal ID
              </label>
              <Input
                id="terminal-id"
                placeholder="Terminal-01"
                value={terminalId}
                onChange={(event) => setTerminalId(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="opening-float">
                Opening Float (USD)
              </label>
              <Input
                id="opening-float"
                type="number"
                min="0"
                step="0.01"
                value={openingFloatInput}
                onChange={(event) => setOpeningFloatInput(event.target.value)}
              />
            </div>
            <Button className="w-full" disabled={Boolean(activeSession) || actionLoading} onClick={handleOpenSession}>
              {activeSession ? 'An Open Session Already Exists' : 'Open Session'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5" />
              Close Session
            </CardTitle>
            <CardDescription>
              Use denomination counts to calculate declared cash, then close the active shift.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeSession ? (
              <div className="rounded-md border border-dashed border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
                No active cash session.
              </div>
            ) : (
              <>
                <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                  <p>
                    <span className="font-semibold">Session:</span> {activeSession.id}
                  </p>
                  <p>
                    <span className="font-semibold">Opened:</span> {formatDate(activeSession.openedAt)}
                  </p>
                  <p>
                    <span className="font-semibold">Terminal:</span> {activeSession.terminalId || 'Unassigned'}
                  </p>
                  <p>
                    <span className="font-semibold">Opening Float:</span> {formatCurrency(activeSession.openingFloatCents)}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {DENOMINATIONS.map((denom) => (
                    <div key={denom.valueCents} className="flex items-center gap-2">
                      <div className="w-16 text-sm font-medium text-muted-foreground">{denom.label}</div>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={counts[denom.valueCents] || ''}
                        onChange={(event) => {
                          setCounts((prev) => ({
                            ...prev,
                            [denom.valueCents]: event.target.value,
                          }))
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="rounded-md border border-border bg-background p-3">
                  <p className="text-sm text-muted-foreground">Declared Cash</p>
                  <p className="text-2xl font-semibold">{formatCurrency(declaredCashCents)}</p>
                  {variancePreviewCents !== null ? (
                    <p className={`text-sm font-medium ${variancePreviewCents === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                      Variance Preview: {formatCurrency(variancePreviewCents)}
                    </p>
                  ) : null}
                </div>

                <Button className="w-full" onClick={handleCloseSession} disabled={actionLoading}>
                  Close Session
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Session History</CardTitle>
          <CardDescription>Recent open and closed sessions across this tenant.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading sessions...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-2 py-3 font-medium text-muted-foreground">Session</th>
                    <th className="px-2 py-3 font-medium text-muted-foreground">Terminal</th>
                    <th className="px-2 py-3 font-medium text-muted-foreground">Opened</th>
                    <th className="px-2 py-3 font-medium text-muted-foreground">Closed</th>
                    <th className="px-2 py-3 text-right font-medium text-muted-foreground">Opening Float</th>
                    <th className="px-2 py-3 text-right font-medium text-muted-foreground">System Cash</th>
                    <th className="px-2 py-3 text-right font-medium text-muted-foreground">Declared Cash</th>
                    <th className="px-2 py-3 text-right font-medium text-muted-foreground">Variance</th>
                    <th className="px-2 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id} className="border-b border-border/60">
                      <td className="px-2 py-3 font-mono text-xs">{session.id}</td>
                      <td className="px-2 py-3">{session.terminalId || 'Unassigned'}</td>
                      <td className="px-2 py-3">{formatDate(session.openedAt)}</td>
                      <td className="px-2 py-3">{formatDate(session.closedAt)}</td>
                      <td className="px-2 py-3 text-right">{formatCurrency(session.openingFloatCents)}</td>
                      <td className="px-2 py-3 text-right">{formatCurrency(session.systemCashCents)}</td>
                      <td className="px-2 py-3 text-right">{formatCurrency(session.declaredCashCents)}</td>
                      <td
                        className={`px-2 py-3 text-right font-semibold ${
                          (session.varianceCents || 0) === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                        }`}
                      >
                        {formatCurrency(session.varianceCents)}
                      </td>
                      <td className="px-2 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            session.status === 'OPEN'
                              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                              : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {session.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!sessions.length ? (
                    <tr>
                      <td className="px-2 py-10 text-center text-sm text-muted-foreground" colSpan={9}>
                        No sessions found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
