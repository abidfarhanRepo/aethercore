import { create } from 'zustand'

export interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STOCK_CLERK' | 'SUPERVISOR'
  isActive: boolean
  mfaEnabled?: boolean
  hasPinSet?: boolean
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
  // Track refresh attempts to prevent infinite retry loops
  const refreshAttempts = new Map<string, { count: number; resetTime: number }>()
  const MAX_RETRY_ATTEMPTS = 3
  const RETRY_RESET_TIME = 5000 // 5 seconds
  
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
      const requestKey = `${originalRequest.method}:${originalRequest.url}`

      // FIX: Implement proper retry limit mechanism
      if (error.response?.status === 401 && refreshToken && !originalRequest._retry) {
        originalRequest._retry = true
        
        // Check if we've exceeded max retry attempts for this endpoint
        const now = Date.now()
        const attempt = refreshAttempts.get(requestKey) || { count: 0, resetTime: now }
        
        // Reset count if window has expired
        if (now > attempt.resetTime) {
          attempt.count = 0
          attempt.resetTime = now + RETRY_RESET_TIME
        }
        
        // Increment retry count
        attempt.count++
        refreshAttempts.set(requestKey, attempt)
        
        // If exceeded max attempts, logout immediately
        if (attempt.count > MAX_RETRY_ATTEMPTS) {
          console.error(`Auth retry limit exceeded (${attempt.count}/${MAX_RETRY_ATTEMPTS}) for ${requestKey}`)
          useAuthStore.getState().logout()
          window.location.href = '/login'
          return Promise.reject(error)
        }
        
        try {
          console.debug(`Attempting token refresh (attempt ${attempt.count}/${MAX_RETRY_ATTEMPTS})`)
          const response = await apiInstance.post(
            '/api/v1/auth/refresh',
            refreshToken ? { refreshToken } : {}
          )
          const { accessToken, refreshToken: newRefreshToken } = response.data
          
          if (!accessToken || !newRefreshToken) {
            throw new Error('Invalid refresh response: missing tokens')
          }
          
          // Reset retry count on successful refresh
          refreshAttempts.delete(requestKey)
          
          useAuthStore.getState().setTokens(accessToken, newRefreshToken)
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return apiInstance(originalRequest)
        } catch (refreshError: any) {
          console.error('Token refresh failed:', refreshError.response?.status, refreshError.message)
          // Logout and redirect to prevent infinite retry
          useAuthStore.getState().logout()
          window.location.href = '/login'
          return Promise.reject(refreshError)
        }
      }
      return Promise.reject(error)
    }
  )
}
