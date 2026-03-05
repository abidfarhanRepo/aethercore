export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'aether-theme'

const isThemePreference = (value: string | null): value is ThemePreference => {
  return value === 'light' || value === 'dark' || value === 'system'
}

export const getStoredThemePreference = (): ThemePreference => {
  if (typeof window === 'undefined') {
    return 'system'
  }

  const storedValue = window.localStorage.getItem(THEME_STORAGE_KEY)
  return isThemePreference(storedValue) ? storedValue : 'system'
}

export const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const resolveTheme = (preference: ThemePreference): ResolvedTheme => {
  return preference === 'system' ? getSystemTheme() : preference
}

export const applyThemePreference = (preference: ThemePreference): ResolvedTheme => {
  const resolvedTheme = resolveTheme(preference)

  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
  }

  return resolvedTheme
}

export const persistThemePreference = (preference: ThemePreference): void => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  }
}

export const applyInitialTheme = (): { preference: ThemePreference; resolvedTheme: ResolvedTheme } => {
  const preference = getStoredThemePreference()
  const resolvedTheme = applyThemePreference(preference)
  return { preference, resolvedTheme }
}
