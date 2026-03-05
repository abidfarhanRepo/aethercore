import React, { useEffect, useMemo, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import {
  type ResolvedTheme,
  type ThemePreference,
  applyThemePreference,
  getStoredThemePreference,
  persistThemePreference,
  resolveTheme,
} from '@/lib/theme'

const THEME_ORDER: ThemePreference[] = ['system', 'light', 'dark']

const LABELS: Record<ThemePreference, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
}

const ICONS: Record<ThemePreference, React.ReactNode> = {
  system: <Monitor className="h-4 w-4" />,
  light: <Sun className="h-4 w-4" />,
  dark: <Moon className="h-4 w-4" />,
}

export function ThemeToggle({ compact = false, className }: { compact?: boolean; className?: string }) {
  const [preference, setPreference] = useState<ThemePreference>(() => getStoredThemePreference())
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(getStoredThemePreference()))

  useEffect(() => {
    const nextResolvedTheme = applyThemePreference(preference)
    setResolvedTheme(nextResolvedTheme)
    persistThemePreference(preference)
  }, [preference])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystemThemeChange = () => {
      if (preference === 'system') {
        setResolvedTheme(applyThemePreference('system'))
      }
    }

    media.addEventListener('change', onSystemThemeChange)
    return () => media.removeEventListener('change', onSystemThemeChange)
  }, [preference])

  const nextThemePreference = useMemo(() => {
    const currentIndex = THEME_ORDER.indexOf(preference)
    return THEME_ORDER[(currentIndex + 1) % THEME_ORDER.length]
  }, [preference])

  return (
    <Button
      variant="outline"
      size="default"
      type="button"
      className={cn(compact ? 'h-10 w-10 p-0' : 'w-full justify-start gap-2 h-12', className)}
      onClick={() => setPreference(nextThemePreference)}
      title="Toggle theme mode"
      aria-label={`Current theme ${LABELS[preference]}. Click to switch to ${LABELS[nextThemePreference]}.`}
    >
      {ICONS[preference]}
      {!compact && (
        <>
          Theme: {LABELS[preference]}
          <span className="ml-auto text-xs text-muted-foreground">{resolvedTheme}</span>
        </>
      )}
    </Button>
  )
}
