const tokenKey = 'adminPortalToken'

export function getToken(): string {
  return localStorage.getItem(tokenKey) || ''
}

export function setToken(token: string): void {
  localStorage.setItem(tokenKey, token)
}

export function clearToken(): void {
  localStorage.removeItem(tokenKey)
}
