import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

/**
 * Fortschrittspunkte des Registrierungsflows (KAN-33): drei Balken unter
 * der Markenkachel, gefuellt nach erledigten Eingabeschritten. Drei statt
 * vier, weil die Aktiviert-Seite kein Eingabeschritt ist und der
 * Rollenschritt entfallen ist (Contract v41, KAN-63; Zaehlung vom
 * 17.08.2026).
 *
 * Die Balken sind dekorativ (aria-hidden); den Stand traegt ein
 * sichtbarer sr-only-Text daneben, damit er auch vorgelesen wird.
 */
export function RegistrationProgress({ filled }: { filled: 1 | 2 | 3 }) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center">
      <div aria-hidden="true" className="flex items-center gap-1">
        {[1, 2, 3].map((step) => (
          <span
            key={step}
            className={cn(
              "h-1 w-4.5 rounded-pill",
              /* primary statt surface-brand: im dunklen Modus faellt
                 surface-brand mit der Kartenfarbe zusammen und der
                 gefuellte Balken verschwaende (Review zu KAN-33). */
              step <= filled ? "bg-primary" : "bg-border"
            )}
          />
        ))}
      </div>
      <span className="sr-only">
        {t("register.progress", { filled, total: 3 })}
      </span>
    </div>
  )
}
