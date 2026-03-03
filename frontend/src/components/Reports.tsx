import React, { useEffect, useState } from 'react'
import axios from 'axios'

export default function Reports(){
  const [reports, setReports] = useState<any>({})
  useEffect(()=>{
    axios.get('/api/reports').then(r=>setReports(r.data)).catch(()=>{
      axios.get('http://localhost:4000/reports').then(r=>setReports(r.data)).catch(()=>{})
    })
  },[])

  return (
    <div style={{padding:20}}>
      <h2>Reports</h2>
      <p>Available report endpoints:</p>
      <ul>
        <li>/api/reports/daily-sales</li>
        <li>/api/reports/inventory-valuation</li>
      </ul>
      <pre style={{background:'#f6f6f6',padding:10,borderRadius:6}}>{JSON.stringify(reports,null,2)}</pre>
    </div>
  )
}
