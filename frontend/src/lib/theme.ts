import { useSyncExternalStore } from "react"

import { useTheme } from "@/components/theme-provider"

const DARK_QUERY = "(prefers-color-scheme: dark)"

function subscribeToSystemTheme(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY)
  query.addEventListener("change", onChange)

  return () => query.removeEventListener("change", onChange)
}

function getSystemPrefersDark() {
  return window.matchMedia(DARK_QUERY).matches
}

/**
 * Sagt, ob gerade der dunkle Modus gilt.
 *
 * Den Zustand haelt der ThemeProvider aus der shadcn-CLI. Er kennt drei
 * Werte, "light", "dark" und "system"; ohne gespeicherte Wahl steht er auf
 * "system". Wer nur diesen Wert liest, zeigt einem Nutzer mit dunkel
 * eingestelltem System die falsche Beschriftung an.
 *
 * Die Systemeinstellung wird deshalb abonniert und nicht einmalig
 * abgefragt: sie kann sich waehrend der Sitzung aendern.
 */
export function useIsDarkMode() {
  const { theme } = useTheme()
  const systemPrefersDark = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemPrefersDark
  )

  return theme === "system" ? systemPrefersDark : theme === "dark"
}
