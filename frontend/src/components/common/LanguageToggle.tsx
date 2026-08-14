import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

/**
 * Umschalter zwischen Deutsch und Englisch (Figma "Nav Bar", rechter Block).
 *
 * Beide Sprachen sind gepflegt (Frontend-Regel 7), waren bisher aber nur
 * ueber die Spracheinstellung des Browsers erreichbar. Die Schaltflaeche
 * zeigt wie im Design das Kuerzel der *anderen* Sprache, also das Ziel des
 * Klicks; der zugaengliche Name sagt denselben Satz aus, weil zwei
 * Buchstaben allein nicht verraten, was passiert.
 *
 * Das lang-Attribut ist kein Beiwerk: ohne es liest eine deutsche Stimme
 * "EN" als deutsches Wort vor (SC 3.1.2).
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { t, i18n } = useTranslation()
  const next = i18n.resolvedLanguage?.startsWith("de") ? "en" : "de"

  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      aria-label={t(`common.language.switchTo.${next}`)}
      onClick={() => {
        void i18n.changeLanguage(next)
      }}
    >
      <span lang={next} className="uppercase">
        {next}
      </span>
    </Button>
  )
}
