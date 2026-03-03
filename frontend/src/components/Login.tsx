import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/auth'
import { authAPI } from '@/lib/api'

export default function Login(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { setTokens, setUser } = useAuthStore()

  async function submit(e:React.FormEvent){
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try{
      const res = await authAPI.login(email, password)
      const { accessToken, refreshToken, user } = res.data
      setTokens(accessToken, refreshToken)
      setUser(user)
      navigate('/checkout')
    }catch(e:any){
      console.error('Login error:', e)
      const message = e?.response?.data?.error || e?.response?.data?.message || e?.message || 'An unexpected error occurred'
      setError(message)
    }finally{
      setIsLoading(false)
    }
  }

  return (
    <div style={{padding:20}}>
      <h3>Login</h3>
      <form onSubmit={submit}>
        <div><input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} /></div>
        <div><input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} /></div>
        <div style={{marginTop:8}}>
          <button type="submit">Login</button>
        </div>
        {error && <div style={{color:'red'}}>{error}</div>}
      </form>
    </div>
  )
}
