import React, { createContext, useContext, useState, useEffect } from 'react'

export type Theme = 'dark' | 'light' | 'forest' | 'ocean' | 'sunset'

interface ThemeContextType {
  theme: Theme
  setTheme: (t: Theme) => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  setTheme: () => {},
  isDark: true
})

export const useTheme = () => useContext(ThemeContext)

const THEME_VARS: Record<Theme, Record<string, string>> = {
  dark: {
    '--bg':       '#0a0f1e',
    '--surface':  '#111827',
    '--card':     '#1a2332',
    '--border':   '#1e3048',
    '--text':     '#e8f4f0',
    '--muted':    '#6b8fa8',
    '--brand':    '#00d4a0',
    '--brand-dk': '#00a87e',
  },
  light: {
    '--bg':       '#f0f4f8',
    '--surface':  '#ffffff',
    '--card':     '#ffffff',
    '--border':   '#d1dde8',
    '--text':     '#1a2332',
    '--muted':    '#6b8fa8',
    '--brand':    '#00a87e',
    '--brand-dk': '#007d5e',
  },
  forest: {
    '--bg':       '#0d1f0d',
    '--surface':  '#122212',
    '--card':     '#1a301a',
    '--border':   '#1e3d1e',
    '--text':     '#e8f4e8',
    '--muted':    '#6b9a6b',
    '--brand':    '#4ade80',
    '--brand-dk': '#22c55e',
  },
  ocean: {
    '--bg':       '#0a0e1f',
    '--surface':  '#0f1535',
    '--card':     '#151d45',
    '--border':   '#1e2a5e',
    '--text':     '#e8eef8',
    '--muted':    '#6b7fa8',
    '--brand':    '#60a5fa',
    '--brand-dk': '#3b82f6',
  },
  sunset: {
    '--bg':       '#1f0a0a',
    '--surface':  '#2d1010',
    '--card':     '#3d1515',
    '--border':   '#5e1e1e',
    '--text':     '#f8e8e8',
    '--muted':    '#a86b6b',
    '--brand':    '#f97316',
    '--brand-dk': '#ea580c',
  }
}

export const THEME_LABELS: Record<Theme, { label: string; emoji: string }> = {
  dark:   { label: 'Dark',   emoji: '🌙' },
  light:  { label: 'Light',  emoji: '☀️' },
  forest: { label: 'Forest', emoji: '🌿' },
  ocean:  { label: 'Ocean',  emoji: '🌊' },
  sunset: { label: 'Sunset', emoji: '🌅' },
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('b360_theme') as Theme) || 'dark'
  })

  const applyTheme = (t: Theme) => {
    const vars = THEME_VARS[t]
    const root = document.documentElement
    Object.entries(vars).forEach(([key, val]) => {
      root.style.setProperty(key, val)
    })
    // Apply body bg
    document.body.style.backgroundColor = vars['--bg']
    document.body.style.color = vars['--text']
  }

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem('b360_theme', t)
    applyTheme(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark: theme !== 'light' }}>
      {children}
    </ThemeContext.Provider>
  )
}
