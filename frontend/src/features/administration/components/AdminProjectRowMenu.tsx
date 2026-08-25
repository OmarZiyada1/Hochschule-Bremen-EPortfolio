import {
  MessageSquareIcon,
  MoreVerticalIcon,
  RotateCcwIcon,
  SendIcon,
  Trash2Icon,
  UserCogIcon,
} from "lucide-react"
import { useRef, useState, type RefObject } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import type { ProjectCardResponse } from "@/api/types"
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
import { useBreadcrumbOrigin } from "@/routes/useBreadcrumb"

/**
 * Das Zeilenmenue der Projektverwaltung (Template „Admin Projects", KAN-38):
 * oeffnen, Status aendern, Redaktion zuweisen, loeschen.
 *
 * <p><strong>„Oeffnen" fuehrt in den Review-Modus, nicht in den
 * Editor.</strong> Der Admin darf Inhalte fremder Projekte nicht bearbeiten,
 * nur lesen und den Status wechseln (§7, offener Punkt 2). Der bearbeitende
 * Editor stuende ihm ohnehin mit 403 gegenueber; der Review-Modus ist die
 * Ansicht, die seine Rechte abbildet. Aendert sich der offene Punkt, aendert
 * sich diese Zeilenaktion mit.
 *
 * <p><strong>Die beiden Statuswechsel folgen §4.1 und werden ausgeblendet,
 * wo sie nicht greifen.</strong> Veroeffentlichen geht aus {@code APPROVED},
 * die Rueckgabe zur Ueberarbeitung aus {@code SUBMITTED}, {@code APPROVED}
 * und {@code PUBLISHED}. In den uebrigen Staenden waeren es keine Faelle, die
 * man erklaeren muesste, sondern schlicht keine; das unterscheidet sie vom
 * Nominierungseintrag in „Meine Reviews", der gesperrt <em>und</em> begruendet
 * dasteht. Verbindlich bleibt der Server: ein trotzdem eintreffendes 409
 * behandelt die Seite sichtbar.
 *
 * <p><strong>Beide Wechsel laufen ueber denselben Sammel-Dialog wie die
 * Mehrfachauswahl</strong>, nur mit genau einem Projekt darin. Sonst gaebe es
 * die Begruendungspflicht aus §6.1 an zwei Stellen: einmal je Zeile und einmal
 * fuer die Auswahl, mit zwei zod-Schemata, die auseinanderlaufen.
 *
 * <p><strong>Loeschen fragt zurueck und nennt die Folgen.</strong> Fuer ADMIN
 * ist es in jedem Status erlaubt (§6.1), und Bloecke wie Dateien fallen per
 * Cascade mit; das steht in der Rueckfrage, weil es sich nicht rueckgaengig
 * machen laesst.
 */
export function AdminProjectRowMenu({
  project,
  deletePending,
  onChangeStatus,
  onAssignEditors,
  onDelete,
}: {
  project: ProjectCardResponse
  deletePending: boolean
  /**
   * Oeffnet den Statusdialog fuer genau dieses Projekt und bekommt den
   * Ausloeser mit: der Menueeintrag ist beim Oeffnen schon abgebaut, der
   * Dialog braucht fuer die Fokusrueckgabe deshalb den Menueknopf
   * (SC 2.4.3).
   */
  onChangeStatus: (
    action: "publish" | "request-revision",
    trigger: RefObject<HTMLElement | null>
  ) => void
  onAssignEditors: (trigger: RefObject<HTMLElement | null>) => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  /* Herkunft fuer den Brotkrumenpfad des Ziels (KAN-80). */
  const origin = useBreadcrumbOrigin()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const mayPublish = project.status === "APPROVED"
  const mayRequestRevision =
    project.status === "SUBMITTED" ||
    project.status === "APPROVED" ||
    project.status === "PUBLISHED"

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          ref={triggerRef}
          render={<Button variant="ghost" size="icon-sm" />}
        >
          <MoreVerticalIcon aria-hidden="true" />
          {/* Der Name nennt das Projekt: in einer Tabelle stuenden sonst
              mehrere gleichnamige Menues nebeneinander, die eine
              Elementliste nicht auseinanderhalten kann (SC 2.4.6). */}
          <span className="sr-only">
            {t("administration.projects.row.menuFor", {
              title: project.title,
            })}
          </span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem
            render={
              <Link to={`/projects/${project.id}/review`} state={origin} />
            }
            nativeButton={false}
          >
            <MessageSquareIcon aria-hidden="true" />
            {t("administration.projects.row.open")}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => onAssignEditors(triggerRef)}
            closeOnClick
          >
            <UserCogIcon aria-hidden="true" />
            {t("administration.projects.row.assignEditors")}
          </DropdownMenuItem>

          {(mayPublish || mayRequestRevision) && <DropdownMenuSeparator />}

          {mayPublish && (
            <DropdownMenuItem
              onClick={() => onChangeStatus("publish", triggerRef)}
            >
              <SendIcon aria-hidden="true" />
              {t("administration.projects.action.publish")}
            </DropdownMenuItem>
          )}

          {mayRequestRevision && (
            <DropdownMenuItem
              onClick={() => onChangeStatus("request-revision", triggerRef)}
            >
              <RotateCcwIcon aria-hidden="true" />
              {t("administration.projects.action.requestRevision")}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2Icon aria-hidden="true" />
            {t("administration.projects.row.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="rounded-modal" finalFocus={triggerRef}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("administration.projects.deleteDialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("administration.projects.deleteDialog.description", {
                title: project.title,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.action.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletePending}
              onClick={() => {
                setConfirmDelete(false)
                onDelete()
              }}
            >
              {t("administration.projects.deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
