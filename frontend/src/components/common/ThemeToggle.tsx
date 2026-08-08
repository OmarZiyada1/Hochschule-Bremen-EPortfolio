import { Moon, Sun } from "lucide-react"
import { useTranslation } from "react-i18next"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { useIsDarkMode } from "@/lib/theme"

/**
 * Umschalter zwischen hellem und dunklem Modus (KAN-6, Abschnitt 5).
 *
 * Den Zustand haelt der ThemeProvider aus der shadcn-CLI: er speichert die
 * Wahl und setzt die Klasse an <html>, ohne Neuladen. Diese Komponente
 * traegt nur die Beschriftung und die Richtung des naechsten Klicks.
 */
export function ThemeToggle() {
  const { t } = useTranslation()
  const { setTheme } = useTheme()
  const isDark = useIsDarkMode()

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? t("common.theme.toLight") : t("common.theme.toDark")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  )
}
