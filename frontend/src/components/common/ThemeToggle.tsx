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
 * traegt nur die Beschriftung und die Richtung des naechsten Klicks; die
 * className kommt vom Einbauort, weil die NavBar (KAN-7) eigene Farben und
 * einen eigenen Fokusring braucht, wie beim LanguageToggle.
 *
 * Aus demselben Grund ist die Groesse waehlbar (KAN-86): in der NavBar steht
 * der Knopf allein und traegt die Standardgroesse, in der Werkzeugzeile des
 * Editors steht er neben Rueckgaengig, Wiederholen und Drucken und folgt
 * deren Mass. Gereicht wird die Variante des Buttons durch, statt sie per
 * className zu ueberschreiben: eine zweite Groessenangabe daneben gaebe zwei
 * Quellen fuer dieselbe Entscheidung.
 */
export function ThemeToggle({
  className,
  size = "icon",
}: {
  className?: string
  size?: React.ComponentProps<typeof Button>["size"]
}) {
  const { t } = useTranslation()
  const { setTheme } = useTheme()
  const isDark = useIsDarkMode()

  return (
    <Button
      variant="ghost"
      size={size}
      className={className}
      aria-label={isDark ? t("common.theme.toLight") : t("common.theme.toDark")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  )
}
