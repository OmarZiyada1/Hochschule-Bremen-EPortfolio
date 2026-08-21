import { useTranslation } from "react-i18next"

import type { StatusHistoryResponse } from "@/api/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty"
import { StatusBadge } from "@/components/common/StatusBadge"

/**
 * Die Statushistorie eines Projekts (§3.12).
 *
 * <p><strong>Sie erscheint nur, wenn der Server sie mitliefert.</strong>
 * {@code statusHistory} ist fuer die Projektseite, die zugewiesene
 * Redaktion und Admins gefuellt, sonst {@code null}. Der Client raet daran
 * nichts und zeigt an, was da ist; eine leere Liste heisst „noch kein
 * Uebergang", nicht „nicht sichtbar".
 *
 * <p>Neueste Aenderung zuerst: wer die Historie oeffnet, will wissen, was
 * zuletzt passiert ist.
 */
export function HistoryDialog({
  open,
  onOpenChange,
  history,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  history: StatusHistoryResponse[] | null
}) {
  const { t, i18n } = useTranslation()
  const format = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  })

  const entries = [...(history ?? [])].sort((left, right) =>
    right.timestamp.localeCompare(left.timestamp)
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-modal">
        <DialogHeader>
          <DialogTitle>{t("projectContent.history.title")}</DialogTitle>
          <DialogDescription>
            {t("projectContent.history.description")}
          </DialogDescription>
        </DialogHeader>

        {entries.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyDescription>
                {t("projectContent.history.empty")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ol className="flex flex-col gap-4 py-2">
            {entries.map((entry) => (
              <li
                key={`${entry.timestamp}-${entry.toStatus}`}
                className="flex flex-col gap-1"
              >
                <span className="flex items-center gap-2">
                  <StatusBadge status={entry.toStatus} />
                  <span className="type-caption text-muted-foreground">
                    {format.format(new Date(entry.timestamp))}
                  </span>
                </span>
                <span className="type-body-sm text-muted-foreground">
                  {t("projectContent.history.entry", {
                    person: `${entry.changedBy.firstName} ${entry.changedBy.lastName}`,
                  })}
                </span>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  )
}
