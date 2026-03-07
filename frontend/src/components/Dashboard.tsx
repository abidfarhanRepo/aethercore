import React, { useEffect, useState } from 'react'
import axios from 'axios'

export default function Dashboard(){
  const [dailySales, setDailySales] = useState<{date:string,totalCents:number}[]>([])
  const [inventoryValuation, setInventoryValuation] = useState<{sku:string,qty:number,valueCents:number}[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(()=>{
    setLoading(true)
    Promise.all([
      axios.get('/api/v1/reports/daily-sales').catch(e=>{
        return axios.get('http://localhost:4000/reports/daily-sales').catch(()=>({data:[]}))
      }),
      axios.get('/api/v1/reports/inventory-valuation').catch(e=>{
        return axios.get('http://localhost:4000/reports/inventory-valuation').catch(()=>({data:[]}))
      })
    ]).then(([ds, iv])=>{
      setDailySales(ds.data || [])
      setInventoryValuation(iv.data || [])
      setLoading(false)
    }).catch(e=>{
      setError('Failed to load reports')
      setLoading(false)
    })
  },[])

  if(loading) return <div>Loading reports…</div>
  if(error) return <div style={{color:'crimson'}}>{error}</div>

  const salesTotal = dailySales.reduce((s,d)=>s + d.totalCents,0)
  const inventoryTotal = inventoryValuation.reduce((s,i)=>s + i.valueCents,0)

  return (
    <div style={{padding:20}}>
      <h2>Dashboard</h2>
      <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
        <div style={{flex:'1 1 320px',border:'1px solid #e6e6e6',padding:12,borderRadius:6,background:'#fff'}}>
          <h3>Daily Sales (last days)</h3>
          <div style={{fontSize:24,fontWeight:600}}>${(salesTotal/100).toFixed(2)}</div>
          <ul>
            {dailySales.map(d=> (
              <li key={d.date}>{d.date} — ${(d.totalCents/100).toFixed(2)}</li>
            ))}
          </ul>
        </div>

        <div style={{flex:'1 1 320px',border:'1px solid #e6e6e6',padding:12,borderRadius:6,background:'#fff'}}>
          <h3>Inventory Valuation</h3>
          <div style={{fontSize:24,fontWeight:600}}>${(inventoryTotal/100).toFixed(2)}</div>
          <ul>
            {inventoryValuation.map(i=> (
              <li key={i.sku}>{i.sku} — {i.qty} pcs — ${(i.valueCents/100).toFixed(2)}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
