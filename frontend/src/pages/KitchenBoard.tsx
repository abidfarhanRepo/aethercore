import { useEffect, useState } from 'react'
import { kitchenAPI } from '@/lib/phase3API'
import { Button } from '@/components/ui/Button'

type TicketRow = {
  id: string
  status: string
  saleId: string
  table?: { tableNumber: number }
  createdAt: string
}

const FLOW = ['NEW', 'IN_PROGRESS', 'READY', 'COMPLETED']

export default function KitchenBoard() {
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [error, setError] = useState<string>('')

  const load = async () => {
    setError('')
    try {
      const { data } = await kitchenAPI.listTickets()
      setTickets(Array.isArray(data?.tickets) ? data.tickets : [])
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load tickets')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const nextStatus = async (ticket: TicketRow) => {
    const idx = FLOW.indexOf(ticket.status)
    const target = FLOW[Math.min(idx + 1, FLOW.length - 1)]
    try {
      await kitchenAPI.updateTicketStatus(ticket.id, target)
      await load()
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to update ticket')
    }
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Kitchen Board</h1>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="p-2">Ticket</th>
              <th className="p-2">Sale</th>
              <th className="p-2">Table</th>
              <th className="p-2">Status</th>
              <th className="p-2">Created</th>
              <th className="p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="border-b">
                <td className="p-2">{t.id.slice(0, 8)}</td>
                <td className="p-2">{t.saleId.slice(0, 8)}</td>
                <td className="p-2">{t.table?.tableNumber || '-'}</td>
                <td className="p-2">{t.status}</td>
                <td className="p-2">{new Date(t.createdAt).toLocaleString()}</td>
                <td className="p-2">
                  <Button size="sm" onClick={() => void nextStatus(t)} disabled={t.status === 'COMPLETED'}>
                    Advance
                  </Button>
                </td>
              </tr>
            ))}
            {tickets.length === 0 ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={6}>No kitchen tickets.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
