import { create } from 'zustand'

export interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STOCK_CLERK' | 'SUPERVISOR'
  isActive: boolean
}

interface AuthStore {
  user: User | null
  isLoading: boolean
  error: string | null
  accessToken: string | null
  refreshToken: string | null
  
  // Actions
  setUser: (user: User | null) => void
  setTokens: (access: string, refresh: string) => void
  setError: (error: string | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
  clearError: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: false,
  error: null,
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),

  setUser: (user) => set({ user }),
  setTokens: (access, refresh) => {
    localStorage.setItem('accessToken', access)
    localStorage.setItem('refreshToken', refresh)
    set({ accessToken: access, refreshToken: refresh })
  },
  setError: (error) => set({ error }),
  setLoading: (loading) => set({ isLoading: loading }),
  clearError: () => set({ error: null }),
  logout: () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      error: null,
    })
  },
}))

// Configure axios to include auth token
export function setupAxiosInterceptors(apiInstance: any) {
  apiInstance.interceptors.request.use((config: any) => {
    const token = useAuthStore.getState().accessToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  apiInstance.interceptors.response.use(
    (response: any) => response,
    async (error: any) => {
      const originalRequest = error.config
      const { refreshToken } = useAuthStore.getState()

      if (error.response?.status === 401 && refreshToken && !originalRequest._retry) {
        originalRequest._retry = true
        try {
          const response = await apiInstance.post('/api/auth/refresh', { refreshToken })
          const { accessToken, refreshToken: newRefreshToken } = response.data
          useAuthStore.getState().setTokens(accessToken, newRefreshToken)
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return apiInstance(originalRequest)
        } catch {
          useAuthStore.getState().logout()
          window.location.href = '/login'
        }
      }
      return Promise.reject(error)
    }
  )
}
