import { useTranslation } from "react-i18next"

import type { StatusHistoryResponse } from "@/api/types"
import { EmptyState } from "@/components/common/EmptyState"
import { StatusBadge } from "@/components/common/StatusBadge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { fullNameOf } from "@/lib/name"

/**
 * Die Statushistorie eines Projekts (Contract 3.12).
 *
 * <p><strong>Sie kommt aus {@code GET /api/projects/{id}} und braucht
 * keinen eigenen Endpoint.</strong> {@code ProjectDetailResponse.statusHistory}
 * traegt sie mit; welche Eintraege jemand sehen darf, entscheidet der
 * Server (5, Fussnote 7). Der Client raet daran nichts.
 *
 * <p><strong>{@code null} und die leere Liste sind zwei verschiedene
 * Dinge</strong>, und der Contract sagt das ausdruecklich: {@code null}
 * heisst „nicht sichtbar", eine leere Liste „noch kein Wechsel". Der Dialog
 * zeigt deshalb zwei verschiedene Meldungen und nicht eine.
 *
 * <p>Aufsteigend nach Zeitpunkt, wie der Server sie liefert; die Ordnung
 * wird nicht umgedreht, damit die Reihenfolge dieselbe ist wie ueberall
 * sonst im Projekt.
 */
export function HistoryDialog({
  open,
  onOpenChange,
  history,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Aus der Detailantwort; {@code null} heisst „nicht sichtbar". */
  history: StatusHistoryResponse[] | null
}) {
  const { t, i18n } = useTranslation()

  const format = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-modal sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("projectContent.history.title")}</DialogTitle>
          <DialogDescription>
            {t("projectContent.history.description")}
          </DialogDescription>
        </DialogHeader>

        {history === null ? (
          <EmptyState
            headingLevel={3}
            title={t("projectContent.history.hidden.title")}
            description={t("projectContent.history.hidden.description")}
          />
        ) : history.length === 0 ? (
          <EmptyState
            headingLevel={3}
            title={t("projectContent.history.empty.title")}
            description={t("projectContent.history.empty.description")}
          />
        ) : (
          <ol className="flex flex-col gap-3">
            {history.map((entry, index) => (
              <li
                key={`${entry.timestamp}-${index}`}
                className="flex flex-col gap-1 border-b border-border pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center gap-2">
                  {/* Der Ausgangsstatus fehlt beim ersten Eintrag: es gibt
                      dann keinen Vorzustand (3.12). */}
                  {entry.fromStatus !== null && (
                    <>
                      <StatusBadge status={entry.fromStatus} />
                      <span aria-hidden="true" className="text-muted-foreground">
                        &rarr;
                      </span>
                    </>
                  )}
                  <StatusBadge status={entry.toStatus} />
                </div>
                <p className="type-body-sm text-muted-foreground">
                  {t("projectContent.history.entry", {
                    person: fullNameOf(entry.changedBy),
                    timestamp: format.format(new Date(entry.timestamp)),
                  })}
                </p>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  )
}
