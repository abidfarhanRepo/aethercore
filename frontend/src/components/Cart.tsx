import React, { useEffect } from 'react'

export default function Cart({items, onRemove, onCheckout}:{items:any[], onRemove:Function, onCheckout:Function}){
  const total = items.reduce((s,i)=>s + i.qty * i.unitPrice,0)

  useEffect(()=>{
    function onPrint(){
      const win = window.open('','_blank')
      if(!win) return
      const html = `
        <html>
        <head>
          <title>Receipt</title>
          <style>
            body{font-family: Arial, sans-serif;padding:20px}
            h2{margin-top:0}
            table{width:100%;border-collapse:collapse}
            td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}
            .right{text-align:right}
            @media print{button{display:none}}
          </style>
        </head>
        <body>
          <h2>aether — Receipt</h2>
          <table>
            <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Price</th></tr></thead>
            <tbody>
              ${items.map(it=>`<tr><td>${it.name}</td><td class="right">${it.qty}</td><td class="right">$${(it.unitPrice/100).toFixed(2)}</td></tr>`).join('')}
            </tbody>
            <tfoot>
              <tr><td></td><td class="right"><strong>Total</strong></td><td class="right"><strong>$${(total/100).toFixed(2)}</strong></td></tr>
            </tfoot>
          </table>
          <div style="margin-top:20px">Thank you for your purchase.</div>
          <button onclick="window.print()">Print</button>
        </body>
        </html>
      `
      win.document.write(html)
      win.document.close()
    }
    window.addEventListener('aether-print', onPrint as EventListener)
    return ()=> window.removeEventListener('aether-print', onPrint as EventListener)
  }, [items, total])

  return (
    <div style={{border:'1px solid #ddd',padding:10,marginTop:10}}>
      <h3>Cart</h3>
      <ul>
        {items.map((it,idx)=>(
          <li key={idx} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span>{it.name} x {it.qty}</span>
            <span style={{display:'flex',gap:8,alignItems:'center'}}>
              <span>${(it.unitPrice/100).toFixed(2)}</span>
              <button onClick={()=>onRemove(idx)}>Remove</button>
            </span>
          </li>
        ))}
      </ul>
      <div style={{marginTop:8,display:'flex',justifyContent:'space-between'}}>
        <strong>Total:</strong>
        <strong>${(total/100).toFixed(2)}</strong>
      </div>
      <div style={{marginTop:8,display:'flex',gap:8}}>
        <button onClick={()=>onCheckout()}>Checkout (mock)</button>
        <button onClick={()=>window.dispatchEvent(new CustomEvent('aether-print'))}>Open Receipt</button>
      </div>
    </div>
  )
}
