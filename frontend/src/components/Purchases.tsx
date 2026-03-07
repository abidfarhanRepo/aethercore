import React, { useEffect, useState } from 'react'
import axios from 'axios'

export default function Purchases(){
  const [products, setProducts] = useState<any[]>([])
  const [poItems, setPoItems] = useState<any[]>([])
  const [pos, setPos] = useState<any[]>([])

  useEffect(()=>{
    axios.get('/api/v1/products').then(r=>{
      const data = Array.isArray(r.data) ? r.data : (r.data?.products || [])
      setProducts(data)
    }).catch(()=>{
      axios.get('http://localhost:4000/products').then(r=>{
        const data = Array.isArray(r.data) ? r.data : (r.data?.products || [])
        setProducts(data)
      }).catch(()=>setProducts([]))
    })
    fetchPOs()
  },[])

  function addLine(p:any){
    setPoItems([...poItems, { productId: p.id, name: p.name, qty:1, unitPrice:p.priceCents }])
  }

  function changeQty(i:number, v:number){
    setPoItems(poItems.map((it,idx)=> idx===i?{...it,qty:v}:it))
  }

  async function createPO(){
    try{
      const res = await axios.post('http://localhost:4000/purchases', { items: poItems })
      alert('PO created: ' + res.data.purchaseOrderId)
      setPoItems([])
      fetchPOs()
    }catch(e){ alert('failed') }
  }

  async function receive(id:string){
    try{
      await axios.post(`http://localhost:4000/purchases/${id}/receive`, { items: [] })
      alert('Received')
      fetchPOs()
    }catch(e){ alert('failed') }
  }

  async function fetchPOs(){
    try{
      const r = await axios.get('http://localhost:4000/purchases')
      const data = Array.isArray(r.data) ? r.data : (r.data?.purchases || [])
      setPos(data)
    }catch(e){
      setPos([])
    }
  }

  return (
    <div style={{padding:20}}>
      <h2>Purchases</h2>
      <div style={{display:'flex',gap:20}}>
        <div style={{flex:1}}>
          <h3>Create PO</h3>
          <ul>
            {products.map(p=> (<li key={p.id}>{p.sku} — {p.name} <button onClick={()=>addLine(p)}>Add</button></li>))}
          </ul>
          <div>
            <h4>Lines</h4>
            <ul>
              {poItems.map((it,idx)=> (
                <li key={idx}>{it.name} <input type="number" value={it.qty} onChange={e=>changeQty(idx, Number(e.target.value))} /></li>
              ))}
            </ul>
            <button onClick={createPO}>Create PO</button>
          </div>
        </div>
        <div style={{width:320}}>
          <h3>Purchase Orders</h3>
          <ul>
            {pos.map(p=> (<li key={p.id}>{p.id} — {p.status} <button onClick={()=>receive(p.id)}>Receive</button></li>))}
          </ul>
        </div>
      </div>
    </div>
  )
}
