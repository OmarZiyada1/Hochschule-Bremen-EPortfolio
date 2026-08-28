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
import { NominateMenuItem } from "@/features/reviews/components/NominateMenuItem"
import { nominationBlockReason } from "@/features/reviews/nominationBlock"
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
 *
 * <p><strong>„Fuer Top-10 nominieren" steht seit KAN-87 auch hier</strong>
 * (§3.11.1, §5 Zeile „Projekt fuer Top-10 nominieren"). Bis dahin fuehrte der
 * Weg zur Nominierung allein ueber „Meine Reviews", also nur ueber
 * zugewiesene Projekte; ein Admin darf jedes veroeffentlichte Projekt
 * vorschlagen und hatte dafuer kein Bedienelement. Der zweite Weg in die
 * Top-10, die unmittelbare Aufnahme ueber den {@code Top10ProjectPicker},
 * bleibt daneben bestehen: er ist die Entscheidung, dies ist der Vorschlag
 * mit Stufe und Protokoll.
 *
 * <p><strong>Der Eintrag erscheint nur bei {@code PUBLISHED}</strong> und
 * folgt damit den beiden Statuswechseln darueber, nicht dem Verhalten in
 * „Meine Reviews". In dieser Liste stehen alle Projekte jedes Status
 * nebeneinander, meist unveroeffentlichte; ein dauerhaft gesperrter Eintrag
 * in fast jeder Zeile erklaerte nichts, er verstellte nur den Blick. Steht
 * das Projekt dagegen in {@code PUBLISHED} und ist trotzdem gesperrt, weil
 * es bereits in der Liste steht oder schon vorgeschlagen wurde, dann ist das
 * ein Fall, den man erklaeren muss: dort bleibt der Eintrag sichtbar und
 * begruendet sich (SC 3.3.2, Entscheidung der Klaerungsrunde zu KAN-87).
 */
export function AdminProjectRowMenu({
  project,
  inTop10,
  deletePending,
  onChangeStatus,
  onAssignEditors,
  onNominate,
  onDelete,
}: {
  project: ProjectCardResponse
  /**
   * Das Projekt belegt bereits einen Platz der Top-10 (§3.11.1, Regel 2). Der
   * zweite Sperrgrund steht seit Contract v90 an der Kachel selbst
   * ({@code hasOpenNomination}, §3.11).
   */
  inTop10: boolean
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
  /** Oeffnet den Nominierungsdialog, mit dem Ausloeser fuer die Fokusrueckgabe. */
  onNominate: (trigger: RefObject<HTMLElement | null>) => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  /* Herkunft fuer den Brotkrumenpfad des Ziels (KAN-80). */
  const origin = useBreadcrumbOrigin()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const mayNominate = project.status === "PUBLISHED"
  const nominationBlocked = nominationBlockReason(project, inTop10)
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

          {mayNominate && (
            <NominateMenuItem
              blocked={nominationBlocked}
              onNominate={() => onNominate(triggerRef)}
            />
          )}

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
