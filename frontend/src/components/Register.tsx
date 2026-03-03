import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/auth'
import { authAPI } from '@/lib/api'

export default function Register(){
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
      await authAPI.register(email, password)
      // Auto-login after registration
      const loginRes = await authAPI.login(email, password)
      const { accessToken, refreshToken, user } = loginRes.data
      setTokens(accessToken, refreshToken)
      setUser(user)
      navigate('/checkout')
    }catch(e:any){
      console.error('Register error:', e)
      const message = e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Registration failed'
      setError(message)
    }finally{
      setIsLoading(false)
    }
  }

  return (
    <div style={{padding:20}}>
      <h3>Register</h3>
      <form onSubmit={submit}>
        <div><input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} /></div>
        <div><input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} /></div>
        <div style={{marginTop:8}}>
          <button type="submit">Create account</button>
        </div>
        {error && <div style={{color:'red'}}>{error}</div>}
      </form>
    </div>
  )
}
