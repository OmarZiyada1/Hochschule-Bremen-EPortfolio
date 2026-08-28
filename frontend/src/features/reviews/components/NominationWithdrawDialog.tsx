import type { RefObject } from "react"
import { useTranslation } from "react-i18next"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import type { Top10NominationResponse } from "@/api/types"
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
import { Alert, AlertTitle } from "@/components/ui/alert"
import { useWithdrawNomination } from "@/features/reviews/hooks/useReviews"

/**
 * Rueckfrage vor dem Zurueckziehen einer Nominierung (§3.11.1, §6.1, seit
 * Contract v70; KAN-37).
 *
 * <p><strong>Warum eine Rueckfrage.</strong> Der Aufruf aendert einen Stand
 * und laesst sich nicht rueckgaengig machen: ein zurueckgezogener Vorschlag
 * bleibt zurueckgezogen, ein neuer waere ein neuer Vorschlag.
 *
 * <p><strong>Nur noch der offene Vorschlag kommt hier an</strong> (Vorgabe
 * zur Nacharbeit an KAN-87, Regel in {@code nominationWithdrawable}). Bis
 * dahin trug der Dialog einen zweiten Absatz fuer den angenommenen Fall, in
 * dem das Projekt zugleich die kuratierte Liste verliess; diesen Weg gibt es
 * nicht mehr, und mit ihm faellt der Absatz weg. Ein Projekt von der
 * Startseite zu nehmen ist jetzt allein „Vom Platz nehmen" in der
 * Platzliste.
 *
 * <p><strong>Der Dialog fuehrt die Mutation selbst</strong> und nicht die
 * Seite darum herum. Damit bleibt er bei einem Fehler offen und zeigt ihn an
 * derselben Stelle, an der die Handlung ausgeloest wurde; der Weg ueber die
 * Seite endete in einer geschlossenen Rueckfrage und einer Meldung weit
 * daneben (Befund des frontend-reviewers zum Abgeben der Zuweisung).
 * {@code AlertDialogAction} ist ein gewoehnlicher Knopf und schliesst nicht
 * von sich aus, das Schliessen entscheidet deshalb der Erfolg.
 *
 * <p><strong>Kein zweiter Versuch.</strong> Ein 409
 * {@code NOMINATION_ALREADY_DECIDED} heisst, dass der Stand sich seit dem
 * letzten Laden geaendert hat; ein Wiederholen scheiterte mit derselben
 * Begruendung (Frontend-Regel 4).
 */
export function NominationWithdrawDialog({
  open,
  onOpenChange,
  nomination,
  finalFocus,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  nomination: Top10NominationResponse
  /**
   * Ziel des Fokus beim Schliessen: der Menueknopf ist zu diesem Zeitpunkt
   * schon abgebaut, ohne dieses Ziel fiele der Fokus auf {@code body}
   * (SC 2.4.3).
   */
  finalFocus?: RefObject<HTMLElement | null>
  /** Ansage nach dem Erfolg, fuer die Live-Region des Bereichs (SC 4.1.3). */
  onDone?: (message: string) => void
}) {
  const { t } = useTranslation()
  const withdraw = useWithdrawNomination()
  const failed = isApiError(withdraw.error) ? withdraw.error : null

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          withdraw.reset()
        }
        onOpenChange(next)
      }}
    >
      <AlertDialogContent className="rounded-modal" finalFocus={finalFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("review.nomination.withdraw.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("review.nomination.withdraw.description", {
              title: nomination.project.title,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {failed !== null && (
          <Alert variant="destructive">
            <AlertTitle>
              {t(apiErrorMessageKey(failed), { defaultValue: failed.message })}
            </AlertTitle>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.action.cancel")}</AlertDialogCancel>
          {/* Keine destruktive Einfaerbung: der Rueckzug setzt WITHDRAWN
              und loescht nichts (Skill frontend-design, Abschnitt 5). Rot
              bliebe sonst nicht mehr unterscheidbar von den Stellen, an
              denen wirklich etwas verloren geht. */}
          <AlertDialogAction
            disabled={withdraw.isPending}
            onClick={() => {
              withdraw.mutate(nomination.id, {
                onSuccess: () => {
                  onOpenChange(false)
                  onDone?.(
                    t("review.nomination.withdraw.done", {
                      title: nomination.project.title,
                    })
                  )
                },
              })
            }}
          >
            {t("review.nomination.withdraw.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
