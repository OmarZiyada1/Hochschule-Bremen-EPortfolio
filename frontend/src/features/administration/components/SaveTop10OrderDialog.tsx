import type { RefObject } from "react"
import { useTranslation } from "react-i18next"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { Alert, AlertTitle } from "@/components/ui/alert"
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
 * Rueckfrage vor „Reihenfolge speichern" (§3.11.1 Regel 3, §3.17; KAN-40).
 *
 * <p><strong>Warum hier gefragt wird und beim Filtern nicht.</strong> Der
 * Aufruf aendert die oeffentliche Startseite und schreibt eine Zeile je
 * bewegtem Projekt ins unveraenderliche Protokoll (§3.17). Zuruecknehmen
 * laesst sich das nicht mit demselben Klick: die alte Reihenfolge waere ein
 * zweiter Vorgang mit weiteren Protokollzeilen. Damit faellt die Handlung
 * unter „Umsortieren mit Datenwirkung" (Skill frontend-design, Abschnitt 5,
 * SC 3.3.4).
 *
 * <p><strong>Der Text nennt, was herausfaellt.</strong> {@code PUT
 * /admin/top10} ersetzt die Liste: was nicht genannt ist, verliert seinen
 * Platz. Wer eine Kachel weggenommen hat, sieht hier, welche; ohne diese
 * Aufzaehlung waere das Entfernen der einzige Schritt der Ansicht, der
 * stillschweigend wirkt.
 *
 * <p><strong>Keine {@code destructive}-Betonung.</strong> Geloescht wird
 * nichts: ein Projekt verliert seinen Platz und bleibt veroeffentlicht.
 */
export function SaveTop10OrderDialog({
  open,
  onOpenChange,
  removedTitles,
  count,
  pending,
  error,
  onConfirm,
  finalFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Titel der Projekte, die mit dem Speichern ihren Platz verlieren. */
  removedTitles: readonly string[]
  /** Zahl der Projekte, die danach in der Liste stehen. */
  count: number
  pending: boolean
  error: unknown
  onConfirm: () => void
  /**
   * Ziel des Fokus beim Schliessen: der Knopf „Reihenfolge speichern" ist
   * nach einem Erfolg gesperrt, ohne dieses Ziel fiele der Fokus auf
   * {@code body} (SC 2.4.3).
   */
  finalFocus?: RefObject<HTMLElement | null>
}) {
  const { t } = useTranslation()
  const failed = isApiError(error) ? error : null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-modal" finalFocus={finalFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("administration.top10.save.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("administration.top10.save.description", { count })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {removedTitles.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="type-body-sm font-medium">
              {t("administration.top10.save.removedTitle", {
                count: removedTitles.length,
              })}
            </p>
            <ul className="list-inside list-disc type-body-sm text-muted-foreground">
              {removedTitles.map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ul>
          </div>
        )}

        {failed !== null && (
          <Alert variant="destructive">
            <AlertTitle>
              {t(apiErrorMessageKey(failed), { defaultValue: failed.message })}
            </AlertTitle>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.action.cancel")}</AlertDialogCancel>
          {/* AlertDialogAction schliesst nicht von sich aus; ueber das
              Schliessen entscheidet der Erfolg, damit ein Fehler an
              derselben Stelle steht, an der die Handlung ausgeloest
              wurde. */}
          <AlertDialogAction disabled={pending} onClick={onConfirm}>
            {t("administration.top10.save.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
