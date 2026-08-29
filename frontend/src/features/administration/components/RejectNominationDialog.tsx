import type { RefObject } from "react"
import { useTranslation } from "react-i18next"

import { isApiError } from "@/api/errors"
import type { Top10NominationResponse } from "@/api/types"
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
import { useRejectNomination } from "@/features/administration/hooks/useAdminTop10"

/**
 * Rueckfrage vor dem Ablehnen einer Nominierung (§3.11.1, §6.1; KAN-40).
 *
 * <p><strong>Warum eine Rueckfrage, obwohl der Frame nur einen Knopf
 * zeigt.</strong> Ablehnen entscheidet ueber den Vorschlag einer anderen
 * Person und laesst sich nicht mit demselben Klick zuruecknehmen: ein
 * abgelehnter Vorschlag bleibt abgelehnt, und ein neuer waere ein neuer
 * Vorschlag. Damit faellt die Handlung unter „Statuswechsel, der fremde
 * Sicht aendert" (Skill frontend-design, Abschnitt 5, SC 3.3.4). Der
 * Gegenpart, das Annehmen, hat seine Bestaetigung ohnehin, dort ist sie der
 * Dialog mit der Platzwahl.
 *
 * <p><strong>Keine {@code destructive}-Betonung.</strong> Abgelehnt wird ein
 * Vorschlag, nicht das Projekt; nichts wird geloescht. Rot bliebe dann fuer
 * das Loeschen nicht mehr uebrig (Skill frontend-design, Abschnitt 5).
 *
 * <p><strong>Ablehnen verlangt kein PUBLISHED.</strong> Nur die Aufnahme tut
 * das (§3.11.1). Ein Vorschlag zu einem inzwischen zurueckgezogenen Projekt
 * laesst sich hier also abraeumen, statt offen stehen zu bleiben; genau
 * darauf weist der Text hin, wenn das Projekt nicht mehr veroeffentlicht
 * ist.
 *
 * <p><strong>Der Dialog fuehrt die Mutation selbst</strong> und bleibt bei
 * einem Fehler offen, wie der Rueckzugs-Dialog aus KAN-37: der Weg ueber die
 * Seite endete in einer geschlossenen Rueckfrage und einer Meldung weit
 * daneben. Ein 409 {@code NOMINATION_ALREADY_DECIDED} heisst, dass jemand
 * anders schon entschieden hat; ein zweiter Versuch scheiterte mit
 * derselben Begruendung (Frontend-Regel 4).
 */
export function RejectNominationDialog({
  nomination,
  onOpenChange,
  finalFocus,
  onDone,
}: {
  /** Der betroffene Vorschlag, oder {@code null}, wenn der Dialog zu ist. */
  nomination: Top10NominationResponse | null
  onOpenChange: (open: boolean) => void
  /**
   * Ziel des Fokus beim Schliessen: der ausloesende Knopf verschwindet mit
   * der Entscheidung aus der Liste, ohne dieses Ziel fiele der Fokus auf
   * {@code body} (SC 2.4.3).
   */
  finalFocus?: RefObject<HTMLElement | null>
  /** Ansage nach dem Erfolg, fuer die Live-Region der Seite (SC 4.1.3). */
  onDone?: (message: string) => void
}) {
  const { t } = useTranslation()
  const reject = useRejectNomination()
  const failed = isApiError(reject.error) ? reject.error : null

  return (
    <AlertDialog
      open={nomination !== null}
      onOpenChange={(next) => {
        if (!next) {
          reject.reset()
        }
        onOpenChange(next)
      }}
    >
      <AlertDialogContent className="rounded-modal" finalFocus={finalFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("administration.top10.reject.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {nomination === null
              ? ""
              : t("administration.top10.reject.description", {
                  title: nomination.project.title,
                })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {failed !== null && <ErrorState error={failed} />}

        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.action.cancel")}</AlertDialogCancel>
          {/* AlertDialogAction ist ein gewoehnlicher Knopf und schliesst
              nicht von sich aus; ueber das Schliessen entscheidet deshalb
              der Erfolg. */}
          <AlertDialogAction
            disabled={reject.isPending}
            onClick={() => {
              if (nomination === null) {
                return
              }
              reject.mutate(nomination.id, {
                onSuccess: () => {
                  onDone?.(
                    t("administration.top10.reject.done", {
                      title: nomination.project.title,
                    })
                  )
                  onOpenChange(false)
                },
              })
            }}
          >
            {t("administration.top10.reject.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
