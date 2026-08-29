import type { RefObject } from "react"
import { useTranslation } from "react-i18next"

import { isApiError } from "@/api/errors"
import { ErrorState } from "@/components/common/ErrorState"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

/**
 * Rueckfrage, bevor ein Projekt seinen Platz in der Top-10 verliert (§3.11,
 * §3.17; KAN-40).
 *
 * <p><strong>Warum ausgerechnet hier gefragt wird und beim Umsortieren
 * nicht.</strong> Beide Handlungen wirken sofort auf die oeffentliche
 * Startseite, aber sie wiegen verschieden. Ein Zug um einen Platz ist mit
 * dem Gegenzug erledigt; ein entferntes Projekt ist von der Startseite
 * verschwunden, und wer es zurueckholen will, muss es erst wiederfinden.
 * Dazu sitzt der Papierkorb neben zwei Pfeilen, die man mehrfach
 * hintereinander drueckt, und ein Fehlklick daneben soll nicht
 * durchschlagen (Skill {@code frontend-design}, Abschnitt 5, SC 3.3.4).
 *
 * <p><strong>Der Platz bleibt frei.</strong> Seit Contract v78 traegt
 * {@code PUT /admin/top10} den freien Platz als {@code null} mit; die
 * uebrigen Eintraege ruecken also nicht nach, wie §3.11 es fuer den Entzug
 * von aussen ohnehin zusagt. Genau das sagt der Text, damit niemand eine
 * Neusortierung erwartet.
 *
 * <p><strong>Keine {@code destructive}-Betonung.</strong> Geloescht wird
 * nichts: das Projekt bleibt veroeffentlicht und verliert nur seinen Platz.
 * Rot bliebe sonst fuer das Loeschen nicht mehr uebrig.
 */
export function RemoveFromTop10Dialog({
  title,
  position,
  onOpenChange,
  pending,
  error,
  onConfirm,
  finalFocus,
}: {
  /** Titel des betroffenen Projekts, oder {@code null}, wenn der Dialog zu ist. */
  title: string | null
  /** Sein Platz, fuer die Anrede im Text. */
  position: number | null
  onOpenChange: (open: boolean) => void
  pending: boolean
  error: unknown
  onConfirm: () => void
  /**
   * Ziel des Fokus beim Schliessen: der Papierkorb verschwindet mit dem
   * Eintrag, ohne dieses Ziel fiele der Fokus auf {@code body} (SC 2.4.3).
   */
  finalFocus?: RefObject<HTMLElement | null>
}) {
  const { t } = useTranslation()
  const failed = isApiError(error) ? error : null

  return (
    <AlertDialog open={title !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-modal" finalFocus={finalFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("administration.top10.remove.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {title === null
              ? ""
              : t("administration.top10.remove.description", {
                  title,
                  position: position ?? 0,
                })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {failed !== null && <ErrorState error={failed} />}

        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.action.cancel")}</AlertDialogCancel>
          {/* AlertDialogAction schliesst nicht von sich aus; ueber das
              Schliessen entscheidet der Erfolg, damit ein Fehler an
              derselben Stelle steht, an der die Handlung ausgeloest
              wurde. */}
          <AlertDialogAction disabled={pending} onClick={onConfirm}>
            {t("administration.top10.remove.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
