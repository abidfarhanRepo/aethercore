import React, { useEffect, useState } from 'react'
import axios from 'axios'

export default function Admin(){
  const [users, setUsers] = useState<any[]>([])
  useEffect(()=>{
    axios.get('/api/v1/admin/users').then(r=>setUsers(r.data)).catch(()=>{
      axios.get('http://localhost:4000/admin/users').then(r=>setUsers(r.data)).catch(()=>{})
    })
  },[])

  return (
    <div style={{padding:20}}>
      <h2>Admin</h2>
      <p>Basic user list (from /api/v1/admin/users) — requests should include access token</p>
      <ul>
        {users.map(u=> (<li key={u.id}>{u.email} — {u.role}</li>))}
      </ul>
    </div>
  )
}
