import { FormEvent, useState } from 'react'
import { receivingAPI } from '@/lib/phase3API'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function ReceivingCenter() {
  const [purchaseOrderId, setPurchaseOrderId] = useState<string>('')
  const [sessionId, setSessionId] = useState<string>('')
  const [itemId, setItemId] = useState<string>('')
  const [qtyExpected, setQtyExpected] = useState<number>(0)
  const [qtyReceived, setQtyReceived] = useState<number>(0)
  const [reason, setReason] = useState<string>('SHORTFALL')
  const [message, setMessage] = useState<string>('')
  const [error, setError] = useState<string>('')

  const startSession = async (e: FormEvent) => {
    e.preventDefault()
    setMessage('')
    setError('')
    try {
      const { data } = await receivingAPI.startSession(purchaseOrderId)
      setSessionId(data.id)
      setMessage('Receiving session started')
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to start receiving session')
    }
  }

  const logDiscrepancy = async () => {
    setMessage('')
    setError('')
    try {
      await receivingAPI.createDiscrepancy(purchaseOrderId, {
        sessionId,
        purchaseOrderItemId: itemId,
        qtyExpected,
        qtyReceived,
        discrepancyReason: reason,
      })
      setMessage('Discrepancy logged')
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to log discrepancy')
    }
  }

  const completeSession = async () => {
    setMessage('')
    setError('')
    try {
      await receivingAPI.completeSession(purchaseOrderId, sessionId)
      setMessage('Receiving session completed')
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to complete receiving session')
    }
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Receiving Center</h1>
      <form className="flex items-center gap-2" onSubmit={startSession}>
        <Input placeholder="Purchase order id" value={purchaseOrderId} onChange={(e) => setPurchaseOrderId(e.target.value)} />
        <Button type="submit">Start Session</Button>
      </form>

      <div className="grid gap-2 rounded-md border p-4 md:grid-cols-2">
        <Input placeholder="Session id" value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
        <Input placeholder="PO item id" value={itemId} onChange={(e) => setItemId(e.target.value)} />
        <Input type="number" placeholder="Qty expected" value={qtyExpected} onChange={(e) => setQtyExpected(Number(e.target.value) || 0)} />
        <Input type="number" placeholder="Qty received" value={qtyReceived} onChange={(e) => setQtyReceived(Number(e.target.value) || 0)} />
        <Input placeholder="Reason (SHORTFALL/OVERAGE/DAMAGE)" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => void logDiscrepancy()}>Log Discrepancy</Button>
        <Button onClick={() => void completeSession()}>Complete Session</Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-600">{message}</p> : null}
    </div>
  )
}
