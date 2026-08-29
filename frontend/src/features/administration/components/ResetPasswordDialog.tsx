import { CopyIcon } from "lucide-react"
import { useState, type RefObject } from "react"
import { useTranslation } from "react-i18next"

import { isApiError } from "@/api/errors"
import type { AdminUserResponse } from "@/api/types"
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
import { Button } from "@/components/ui/button"
import { useResetUserPassword } from "@/features/administration/hooks/useAdminUsers"
import { copyText } from "@/lib/clipboard"
import { fullNameOf } from "@/lib/name"

/**
 * Die Zeilenaktion „Passwort zuruecksetzen" (§6.1, §6.7, KAN-43) in zwei
 * Schritten: Rueckfrage, dann das erzeugte Initialpasswort.
 *
 * <p><strong>Hier erzeugt der Server</strong>, anders als beim Anlegen
 * (Contract v27): es gibt kein Formular, in das ein Passwort einzutragen
 * waere. Das Ergebnis steht in genau dieser einen Antwort und wird nirgends
 * gespeichert; wer den Dialog schliesst, ohne es zu notieren, setzt erneut
 * zurueck.
 *
 * <p><strong>Ein {@code alert-dialog} und kein Dialog mit aufgesetzter
 * Rolle.</strong> Die Primitive bringt mehr mit als die Rolle: sie schliesst
 * nicht beim Klick daneben. Genau das zaehlt, sobald das Initialpasswort
 * dasteht, denn ein versehentliches Schliessen ist nicht rueckgaengig zu
 * machen (Befund des frontend-reviewers). Die Rolle wechselt waehrend des
 * offenen Dialogs nicht, auch nicht, wenn das Ergebnis darin erscheint.
 *
 * <p><strong>Die Rueckfrage steht davor, weil das alte Passwort danach nicht
 * mehr gilt.</strong> Die Person kommt bis zur Weitergabe des neuen nicht
 * mehr herein, und {@code passwordChangeRequired} sperrt sie zusaetzlich bis
 * zur eigenen Aenderung (§6.7).
 */
export function ResetPasswordDialog({
  account,
  onOpenChange,
  onDone,
  finalFocus,
}: {
  /** Das betroffene Konto, oder {@code null}, wenn der Dialog zu ist. */
  account: AdminUserResponse | null
  onOpenChange: (open: boolean) => void
  /** Meldung fuer die Live-Region der Seite. */
  onDone?: (account: AdminUserResponse) => void
  finalFocus?: RefObject<HTMLElement | null>
}) {
  const { t } = useTranslation()
  const reset = useResetUserPassword()
  const [password, setPassword] = useState<string | null>(null)
  const [copyNotice, setCopyNotice] = useState("")

  const name = account === null ? "" : fullNameOf(account)
  const failed = isApiError(reset.error) ? reset.error : null

  return (
    <AlertDialog
      open={account !== null}
      onOpenChange={(next) => {
        if (!next) {
          setPassword(null)
          setCopyNotice("")
          reset.reset()
        }
        onOpenChange(next)
      }}
    >
      {/* Die Breite steht mit demselben Modifikator da, den die erzeugte
          Datei benutzt: ein blankes sm:max-w-lg liegt fuer tailwind-merge in
          einer anderen Gruppe und verlöre gegen den Attributselektor
          (dasselbe Muster wie in FilterSelect). */}
      <AlertDialogContent
        className="rounded-modal data-[size=default]:sm:max-w-lg"
        finalFocus={finalFocus}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("administration.users.resetDialog.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {password === null
              ? t("administration.users.resetDialog.description", { name })
              : t("administration.users.resetDialog.doneDescription", { name })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {failed !== null && <ErrorState error={failed} />}

        {password !== null && (
          <div className="flex flex-col gap-2">
            <p className="type-label-xs text-muted-foreground uppercase">
              {t("administration.users.resetDialog.passwordLabel")}
            </p>
            {/* Im Klartext und auswaehlbar: der Wert muss weitergegeben
                werden, und ein verborgenes Feld zwaenge zum Umweg ueber die
                Zwischenablage, die nicht ueberall funktioniert. */}
            <p className="rounded-control border bg-muted px-3 py-2 font-mono break-all">
              {password}
            </p>
            <p className="type-body-sm text-muted-foreground">
              {t("administration.users.resetDialog.hint")}
            </p>
          </div>
        )}

        <AlertDialogFooter>
          {password === null ? (
            <>
              <AlertDialogCancel variant="ghost">
                {t("common.action.cancel")}
              </AlertDialogCancel>
              {/* AlertDialogAction schliesst nicht von selbst; das ist hier
                  Absicht, denn das Ergebnis erscheint im selben Dialog. */}
              <AlertDialogAction
                type="button"
                disabled={reset.isPending || account === null}
                onClick={() => {
                  if (account === null) {
                    return
                  }
                  reset.mutate(account.id, {
                    onSuccess: (response) => {
                      setPassword(response.initialPassword)
                      onDone?.(account)
                    },
                  })
                }}
              >
                {t("administration.users.resetDialog.confirm")}
              </AlertDialogAction>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void copyText(password).then((ok) => {
                    setCopyNotice(
                      ok
                        ? t("administration.users.create.passwordCopied")
                        : t("administration.users.create.copyFailed")
                    )
                  })
                }}
              >
                <CopyIcon aria-hidden="true" />
                {t("administration.users.create.copyPassword")}
              </Button>
              <AlertDialogCancel variant="default">
                {t("administration.users.create.done")}
              </AlertDialogCancel>
            </>
          )}
        </AlertDialogFooter>

        <span className="sr-only" role="status">
          {copyNotice}
        </span>
      </AlertDialogContent>
    </AlertDialog>
  )
}
