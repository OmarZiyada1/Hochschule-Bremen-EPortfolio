import {
  InfoIcon,
  KeyRoundIcon,
  MoreVerticalIcon,
  UserCheckIcon,
  UserCogIcon,
  UserMinusIcon,
} from "lucide-react"
import { useRef, useState, type RefObject } from "react"
import { useTranslation } from "react-i18next"

import type { AdminUserResponse } from "@/api/types"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { fullNameOf } from "@/lib/name"

/**
 * Das Zeilenmenue der Nutzerverwaltung (Template „Users", KAN-39): Details,
 * Rolle aendern, deaktivieren beziehungsweise wieder aktivieren, Passwort
 * zuruecksetzen.
 *
 * <p><strong>Am eigenen Konto fehlen zwei Eintraege.</strong> {@code PATCH}
 * auf die eigene ID mit {@code role} oder {@code status} und {@code DELETE}
 * auf die eigene ID ergeben <strong>400</strong> VALIDATION_FAILED (Contract
 * v26): beides wirkt beim naechsten Request (§6.5) und liesse sich danach
 * nicht mehr zuruecknehmen. Die Regel gilt serverseitig; das Ausblenden ist
 * Bequemlichkeit, und die aufrufende Seite behandelt einen trotzdem
 * eintreffenden 400 sichtbar.
 *
 * <p><strong>Die Passwort-Zuruecksetzung bleibt auch dort.</strong> Sie
 * prueft den Status des Zielkontos nicht und funktioniert am eigenen Konto
 * (§6.1, Contract v35): anders als eine Rollen- oder Statusaenderung laesst
 * sich dieser Schritt selbst wieder aufloesen.
 *
 * <p><strong>Die Deaktivierung fragt hier zurueck, die uebrigen nicht.</strong>
 * Sie greift sofort, auch bei gueltigem Token (§2.9, §6.5), und das steht in
 * der Rueckfrage, weil es sich von aussen nicht ansehen laesst. Rollenwechsel
 * und Zuruecksetzung tragen denselben Hinweis in ihrem eigenen Dialog; das
 * Wiederaktivieren gibt Zugang zurueck und braucht keinen.
 */
export function AdminUserRowMenu({
  account,
  isSelf,
  pending,
  onShowDetails,
  onChangeRole,
  onSetActive,
  onDeactivate,
  onResetPassword,
}: {
  account: AdminUserResponse
  /** Ist das die angemeldete Person? Dann fehlen Rolle und Status. */
  isSelf: boolean
  pending: boolean
  onShowDetails: (trigger: RefObject<HTMLElement | null>) => void
  onChangeRole: (trigger: RefObject<HTMLElement | null>) => void
  onSetActive: () => void
  onDeactivate: () => void
  onResetPassword: (trigger: RefObject<HTMLElement | null>) => void
}) {
  const { t } = useTranslation()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)

  const name = fullNameOf(account)
  const mayChangeStatus = !isSelf

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          ref={triggerRef}
          render={<Button variant="ghost" size="icon-sm" />}
        >
          <MoreVerticalIcon aria-hidden="true" />
          {/* Der Name nennt das Konto: in einer Tabelle stuenden sonst
              mehrere gleichnamige Menues nebeneinander, die eine
              Elementliste nicht auseinanderhalten kann (SC 2.4.6). */}
          <span className="sr-only">
            {t("administration.users.row.menuFor", { name })}
          </span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onShowDetails(triggerRef)}>
            <InfoIcon aria-hidden="true" />
            {t("administration.users.row.details")}
          </DropdownMenuItem>

          {!isSelf && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onChangeRole(triggerRef)}>
                <UserCogIcon aria-hidden="true" />
                {t("administration.users.row.changeRole")}
              </DropdownMenuItem>
            </>
          )}

          {mayChangeStatus && account.status === "DEACTIVATED" && (
            <DropdownMenuItem onClick={onSetActive}>
              <UserCheckIcon aria-hidden="true" />
              {t("administration.users.row.activate")}
            </DropdownMenuItem>
          )}

          {/* Ohne destruktive Kennzeichnung: die Deaktivierung laesst sich
              umkehren, „Konto aktivieren" steht direkt daneben, und geloescht
              wird nichts (§6.1). Rot bleibt dem vorbehalten, wo wirklich
              etwas verloren geht. */}
          {mayChangeStatus && account.status !== "DEACTIVATED" && (
            <DropdownMenuItem onClick={() => setConfirmDeactivate(true)}>
              <UserMinusIcon aria-hidden="true" />
              {t("administration.users.row.deactivate")}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => onResetPassword(triggerRef)}>
            <KeyRoundIcon aria-hidden="true" />
            {t("administration.users.row.resetPassword")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate}>
        <AlertDialogContent className="rounded-modal" finalFocus={triggerRef}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("administration.users.deactivateDialog.title")}
            </AlertDialogTitle>
            {/* Die Rueckfrage sagt beides: dass die Beitraege bleiben (es
                ist kein Loeschen, §6.1) und dass die Sperre sofort greift,
                auch bei gueltigem Token (§6.5). */}
            <AlertDialogDescription>
              {t("administration.users.deactivateDialog.description", { name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.action.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => {
                setConfirmDeactivate(false)
                onDeactivate()
              }}
            >
              {t("administration.users.deactivateDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
