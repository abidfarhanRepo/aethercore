import { FormEvent, useState } from 'react'
import { pharmacyAPI } from '@/lib/phase3API'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

type Prescription = {
  id: string
  rxNumber: string
  status: string
  expiryDate: string
  refillsAllowed: number
  refillsUsed: number
  product?: { name?: string }
  customer?: { name?: string }
}

export default function PharmacyConsole() {
  const [rxNumber, setRxNumber] = useState<string>('')
  const [pharmacistId, setPharmacistId] = useState<string>('')
  const [reason, setReason] = useState<string>('Phase 3 manual verification')
  const [record, setRecord] = useState<Prescription | null>(null)
  const [error, setError] = useState<string>('')
  const [info, setInfo] = useState<string>('')

  const lookup = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    try {
      const { data } = await pharmacyAPI.getPrescription(rxNumber)
      setRecord(data)
    } catch (err: any) {
      setRecord(null)
      setError(err?.response?.data?.error || 'Prescription lookup failed')
    }
  }

  const fill = async () => {
    if (!record) {
      return
    }
    setError('')
    setInfo('')
    try {
      await pharmacyAPI.fillPrescription(record.id)
      setInfo('Prescription filled successfully')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to fill prescription')
    }
  }

  const override = async (action: 'APPROVED' | 'DENIED') => {
    if (!record) {
      return
    }
    setError('')
    setInfo('')
    try {
      await pharmacyAPI.createOverride({
        prescriptionId: record.id,
        pharmacistId,
        action,
        reason,
      })
      setInfo(`Override ${action.toLowerCase()} recorded`)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to submit override')
    }
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Pharmacy Console</h1>
      <form className="flex items-center gap-2" onSubmit={lookup}>
        <Input placeholder="RX number" value={rxNumber} onChange={(e) => setRxNumber(e.target.value)} />
        <Button type="submit">Lookup</Button>
      </form>

      {record ? (
        <div className="space-y-3 rounded-md border p-4">
          <p><span className="font-semibold">RX:</span> {record.rxNumber}</p>
          <p><span className="font-semibold">Product:</span> {record.product?.name || '-'}</p>
          <p><span className="font-semibold">Customer:</span> {record.customer?.name || '-'}</p>
          <p><span className="font-semibold">Status:</span> {record.status}</p>
          <p><span className="font-semibold">Expiry:</span> {new Date(record.expiryDate).toLocaleDateString()}</p>
          <p><span className="font-semibold">Refills:</span> {record.refillsUsed}/{record.refillsAllowed}</p>

          <div className="grid gap-2 md:grid-cols-2">
            <Input placeholder="Pharmacist user id" value={pharmacistId} onChange={(e) => setPharmacistId(e.target.value)} />
            <Input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <Button onClick={() => void fill()}>Fill</Button>
            <Button variant="secondary" onClick={() => void override('APPROVED')}>Override Approve</Button>
            <Button variant="destructive" onClick={() => void override('DENIED')}>Override Deny</Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {info ? <p className="text-sm text-green-600">{info}</p> : null}
    </div>
  )
}
