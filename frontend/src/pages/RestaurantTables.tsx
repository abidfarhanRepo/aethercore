import { useEffect, useState } from 'react'
import { restaurantAPI } from '@/lib/phase3API'
import { Button } from '@/components/ui/Button'

type TableRow = {
  id: string
  tableNumber: number
  seats: number
  status: string
  zone?: string
}

const NEXT_STATUS = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE']

export default function RestaurantTables() {
  const [tables, setTables] = useState<TableRow[]>([])
  const [error, setError] = useState<string>('')

  const load = async () => {
    setError('')
    try {
      const { data } = await restaurantAPI.listTables()
      setTables(Array.isArray(data?.tables) ? data.tables : [])
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load tables')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const rotateStatus = async (row: TableRow) => {
    const idx = NEXT_STATUS.indexOf(row.status)
    const next = NEXT_STATUS[(idx + 1) % NEXT_STATUS.length]
    try {
      await restaurantAPI.updateTable(row.id, { status: next })
      await load()
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to update table')
    }
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Restaurant Tables</h1>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tables.map((t) => (
          <div key={t.id} className="rounded-lg border p-4">
            <p className="text-lg font-semibold">Table {t.tableNumber}</p>
            <p className="text-sm text-muted-foreground">Seats: {t.seats}</p>
            <p className="text-sm">Status: {t.status}</p>
            <p className="text-sm text-muted-foreground">{t.zone || 'No zone'}</p>
            <Button className="mt-3" onClick={() => void rotateStatus(t)}>
              Next Status
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
