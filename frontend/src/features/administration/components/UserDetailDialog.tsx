import type { RefObject } from "react"
import { useTranslation } from "react-i18next"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { RoleBadge } from "@/components/common/RoleBadge"
import { UserStatusBadge } from "@/components/common/UserStatusBadge"
import { DetailRow } from "@/features/administration/components/DetailRow"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"

import { useAdminUserDetail } from "@/features/administration/hooks/useAdminUsers"
import { fullNameOf } from "@/lib/name"

/**
 * Die Detailansicht eines Kontos (§6.1, {@code GET /api/admin/users/{id}},
 * KAN-39).
 *
 * <p><strong>Sie zeigt mehr als die Zeile, sonst gaebe es sie nicht.</strong>
 * Die Tabelle fuehrt Name, beide Adressen, Rolle, Status und den
 * Anlegezeitpunkt; hier kommen die beiden Verifizierungsflags und
 * {@code updatedAt} dazu (§3.1). Der eigene Aufruf ist damit kein zweiter
 * Weg zu denselben Daten, sondern der einzige zu diesen dreien.
 *
 * <p><strong>Gelesen wird erst beim Oeffnen.</strong> Die Abfrage haengt an
 * {@code userId}; ohne offenen Dialog laeuft keine. Ein Konto, das inzwischen
 * geloescht waere, ergaebe 404 RESOURCE_NOT_FOUND und erscheint als Meldung,
 * nicht als leere Flaeche.
 *
 * <p>Die HSB-Adresse steht hier wie in der Liste: die Nutzerverwaltung ist
 * der einzige Ort, an dem sie fuer fremde Konten erscheint (§3.1).
 */
export function UserDetailDialog({
  userId,
  onOpenChange,
  finalFocus,
}: {
  /** Das anzuzeigende Konto, oder {@code null}, wenn der Dialog zu ist. */
  userId: string | null
  onOpenChange: (open: boolean) => void
  finalFocus?: RefObject<HTMLElement | null>
}) {
  const { t, i18n } = useTranslation()
  const detail = useAdminUserDetail(userId)

  const dateTime = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return (
    <Dialog open={userId !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className="rounded-modal sm:max-w-xl"
        finalFocus={finalFocus}
      >
        <DialogHeader>
          <DialogTitle>
            {detail.data === undefined
              ? t("administration.users.detail.title")
              : fullNameOf(detail.data)}
          </DialogTitle>
          <DialogDescription>
            {t("administration.users.detail.subtitle")}
          </DialogDescription>
        </DialogHeader>

        {detail.isPending && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-6 w-2/3 rounded-control" />
            <Skeleton className="h-6 w-1/2 rounded-control" />
            <Skeleton className="h-6 w-1/3 rounded-control" />
          </div>
        )}

        {detail.error !== null && (
          <Alert variant="destructive">
            <AlertTitle>
              {isApiError(detail.error)
                ? t(apiErrorMessageKey(detail.error), {
                    defaultValue: detail.error.message,
                  })
                : t("apiError.INTERNAL_ERROR")}
            </AlertTitle>
          </Alert>
        )}

        {detail.data !== undefined && (
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailRow
              label={t("administration.users.column.email")}
              value={detail.data.email}
            />
            <DetailRow
              label={t("administration.users.column.hsbEmail")}
              value={detail.data.hsbEmail}
            />
            <DetailRow label={t("administration.users.column.role")}>
              <RoleBadge role={detail.data.role} />
            </DetailRow>
            <DetailRow label={t("administration.users.column.status")}>
              <UserStatusBadge status={detail.data.status} />
            </DetailRow>
            <DetailRow
              label={t("administration.users.detail.emailVerified")}
              value={t(detail.data.emailVerified ? "common.yes" : "common.no")}
            />
            <DetailRow
              label={t("administration.users.detail.hsbEmailVerified")}
              value={t(
                detail.data.hsbEmailVerified ? "common.yes" : "common.no"
              )}
            />
            <DetailRow
              label={t("administration.users.detail.passwordChangeRequired")}
              value={t(
                detail.data.passwordChangeRequired ? "common.yes" : "common.no"
              )}
            />
            <DetailRow
              label={t("administration.users.column.createdAt")}
              value={dateTime.format(new Date(detail.data.createdAt))}
            />
            <DetailRow
              label={t("administration.users.detail.updatedAt")}
              value={dateTime.format(new Date(detail.data.updatedAt))}
            />
          </dl>
        )}

        <DialogFooter>
          <DialogClose render={<Button type="button" />}>
            {t("common.action.close")}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
