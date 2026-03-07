import React, { createContext, useContext, useState, useEffect } from 'react'
import { api } from '@/lib/api'

type User = { id:string, email:string, role?:string } | null

const AuthContext = createContext<any>(null)

export function AuthProvider({children}:{children:React.ReactNode}){
  const [user, setUser] = useState<User>(null)
  const [accessToken, setAccessToken] = useState<string | null>(localStorage.getItem('accessToken'))
  const [refreshToken, setRefreshToken] = useState<string | null>(localStorage.getItem('refreshToken'))

  useEffect(()=>{
    // attach api interceptor
    const req = api.interceptors.request.use(cfg=>{
      const token = localStorage.getItem('accessToken')
      if(token){ cfg.headers = cfg.headers || {}; cfg.headers['Authorization'] = 'Bearer '+token }
      return cfg
    })

    const res = api.interceptors.response.use(r=>r, async err=>{
      const original = err.config
      if(err.response && err.response.status === 401 && !original._retry){
        original._retry = true
        const rtoken = localStorage.getItem('refreshToken')
        if(!rtoken) { logout(); return Promise.reject(err) }
        try{
          const resp = await api.post('/api/v1/auth/refresh', { refreshToken: rtoken })
          const { accessToken: newAccess, refreshToken: newRefresh, user } = resp.data
          localStorage.setItem('accessToken', newAccess)
          if(newRefresh) localStorage.setItem('refreshToken', newRefresh)
          api.defaults.headers.common['Authorization'] = 'Bearer '+newAccess
          return api(original)
        }catch(e){ logout(); return Promise.reject(e) }
      }
      return Promise.reject(err)
    })

    return ()=>{
      api.interceptors.request.eject(req)
      api.interceptors.response.eject(res)
    }
  },[])

  useEffect(()=>{
    // Try to load user from server if tokens exist
    if(accessToken){
      api.get('/api/v1/auth/me').then(r=>setUser(r.data)).catch(()=>setUser(null))
    }
  },[accessToken])

  function login({accessToken, refreshToken, user}:{accessToken:string, refreshToken?:string, user?:any}){
    localStorage.setItem('accessToken', accessToken)
    if(refreshToken) localStorage.setItem('refreshToken', refreshToken)
    setAccessToken(accessToken)
    setRefreshToken(refreshToken||null)
    if(user) setUser(user)
  }
  function logout(){
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setAccessToken(null); setRefreshToken(null); setUser(null)
  }

  return <AuthContext.Provider value={{user, login, logout, accessToken}}>{children}</AuthContext.Provider>
}

export function useAuth(){ return useContext(AuthContext) }
