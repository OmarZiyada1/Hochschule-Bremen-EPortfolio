import { PrinterIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Der Knopf, der das Projekt ausdruckt (KAN-41).
 *
 * <p>Rund und mit Symbol, wie im Prototyp verabredet, und in jeder Breite
 * sichtbar: der Ausdruck ist keine Beigabe der schmalen Ansicht. Auf dem
 * Titelbild traegt er dieselbe gedeckte Flaeche wie der Knopf gegenueber,
 * damit er auf jedem Foto sichtbar bleibt (SC 1.4.11); mit 2rem liegt er
 * ueber dem Mindestmass aus SC 2.5.8.
 *
 * <p><strong>Seit KAN-83 an zwei Stellen im Einsatz</strong>, deshalb hier
 * und nicht mehr als lokale Funktion der Detailseite: die Reviewansicht
 * druckt dasselbe Blatt, und ihn ein zweites Mal zu schreiben hiesse,
 * zwei Fassungen derselben Zusagen zu pflegen.
 *
 * <p>Der zugaengliche Name sagt, was geschieht, und nicht nur „PDF": ein
 * Symbol ohne Text braucht ihn, und „PDF" allein waere fuer sich genommen
 * keine Handlung (SC 2.4.6).
 *
 * <p><strong>Waehrend der Vorbereitung meldet er {@code aria-disabled} und
 * nicht {@code disabled}</strong>, wie die Ausrichtung im
 * {@code AlignMenu}: eine Schaltflaeche, die im Augenblick des Klicks
 * {@code disabled} wird, verliert den Fokus an den Seitenanfang
 * (SC 2.4.3). Ein zweites Ausloesen faengt der Handler ab, damit kein
 * zweiter Druckdialog aufgeht.
 */
export function PrintTrigger({
  onPrint,
  busy,
  floating = false,
}: {
  onPrint: () => void
  busy: boolean
  floating?: boolean
}) {
  const { t } = useTranslation()

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      onClick={(event) => {
        if (busy) {
          event.preventDefault()
          return
        }
        onPrint()
      }}
      aria-disabled={busy}
      aria-label={t("projectContent.print.actionLabel")}
      className={cn(
        "rounded-full",
        busy && "opacity-50",
        floating ? "absolute top-4 right-4 z-10 shadow-md" : undefined
      )}
    >
      <PrinterIcon aria-hidden="true" />
    </Button>
  )
}
