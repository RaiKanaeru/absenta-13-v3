import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = Readonly<{
  children: ReactNode
  defaultTheme?: Theme
  storageKey?: string
}>

interface ThemeProviderState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "absenta-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (typeof globalThis !== "undefined" && globalThis.localStorage
      ? (globalThis.localStorage.getItem(storageKey) as Theme) || defaultTheme
      : defaultTheme)
  )

  useEffect(() => {
    if (typeof globalThis === "undefined" || !globalThis.document) return

    const root = globalThis.document.documentElement

    root.classList.remove("light", "dark")

    if (theme === "system") {
      const systemTheme = globalThis.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"

      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      setTheme: (newTheme: Theme) => {
        if (typeof globalThis !== "undefined" && globalThis.localStorage) {
          globalThis.localStorage.setItem(storageKey, newTheme)
        }
        setTheme(newTheme)
      },
    }),
    [theme, storageKey]
  )

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
