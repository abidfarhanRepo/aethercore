import { useEffect, useState } from 'react'
import { expiryAPI } from '@/lib/phase3API'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

type AlertRow = {
  lotId: string
  productId: string
  productName?: string
  batchNumber: string
  expiryDate: string
  nearExpiryQty: number
  daysLeft: number
}

export default function ExpiryLots() {
  const [thresholdDays, setThresholdDays] = useState<number>(30)
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const loadAlerts = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await expiryAPI.alerts(thresholdDays)
      setAlerts(Array.isArray(data?.alerts) ? data.alerts : [])
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to fetch expiry alerts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAlerts()
  }, [])

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Expiry And Lot Alerts</h1>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          value={thresholdDays}
          onChange={(e) => setThresholdDays(Number(e.target.value) || 1)}
          className="w-40"
        />
        <Button onClick={() => void loadAlerts()}>Refresh</Button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p>Loading...</p> : null}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="p-2">Product</th>
              <th className="p-2">Batch</th>
              <th className="p-2">Expiry</th>
              <th className="p-2">Days Left</th>
              <th className="p-2">Qty</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.lotId} className="border-b">
                <td className="p-2">{a.productName || a.productId}</td>
                <td className="p-2">{a.batchNumber}</td>
                <td className="p-2">{new Date(a.expiryDate).toLocaleDateString()}</td>
                <td className="p-2">{a.daysLeft}</td>
                <td className="p-2">{a.nearExpiryQty}</td>
              </tr>
            ))}
            {alerts.length === 0 && !loading ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={5}>No expiring lots.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
