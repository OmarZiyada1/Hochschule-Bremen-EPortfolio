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
import { Top10PlacementMenuItem } from "@/features/administration/components/Top10PlacementMenuItem"
import { top10PlacementBlockReason } from "@/features/administration/top10Placement"
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
 * <p><strong>„In die Top 10 aufnehmen" nimmt unmittelbar auf und schlaegt
 * nicht vor</strong> (§3.11.1, §5 Zeile „Top-10 kuratieren"; Nacharbeit an
 * KAN-87). KAN-87 hatte hier zunaechst „Fuer Top-10 nominieren" eingesetzt,
 * damit ein Admin auch ohne Zuweisung vorschlagen kann. Das beschreibt seine
 * Rolle in dieser Ansicht falsch herum: In der Administration entscheidet er,
 * er schlaegt nicht vor, und ein Vorschlag, den dieselbe Person danach selbst
 * annimmt, ist ein Umweg mit zwei Protokollzeilen fuer einen Vorgang. Der
 * Nominierungsweg bleibt ihm unveraendert dort, wo er als Redaktion
 * arbeitet: in „Meine Reviews" und auf der Projektdetailseite. §5 aendert
 * sich dadurch nicht, der Admin behaelt beide Rechte.
 *
 * <p><strong>Der Eintrag erscheint nur bei {@code PUBLISHED}</strong> und
 * folgt damit den beiden Statuswechseln darueber. In dieser Liste stehen alle
 * Projekte jedes Status nebeneinander, meist unveroeffentlichte; ein dauerhaft
 * gesperrter Eintrag in fast jeder Zeile erklaerte nichts, er verstellte nur
 * den Blick. Steht das Projekt dagegen in {@code PUBLISHED} und ist trotzdem
 * gesperrt, weil es bereits in der Liste steht oder alle zehn Plaetze vergeben
 * sind, dann ist das ein Fall, den man erklaeren muss: dort bleibt der Eintrag
 * sichtbar und begruendet sich (SC 3.3.2).
 */
export function AdminProjectRowMenu({
  project,
  inTop10,
  listFull,
  deletePending,
  onChangeStatus,
  onAssignEditors,
  onPlaceInTop10,
  onDelete,
}: {
  project: ProjectCardResponse
  /** Das Projekt belegt bereits einen Platz der Top-10 (§3.11.1, Regel 2). */
  inTop10: boolean
  /**
   * Alle zehn Plaetze sind vergeben (§3.11). Dann raeumt auch die
   * unmittelbare Aufnahme keinen Platz; zuerst muss einer frei werden.
   */
  listFull: boolean
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
  /** Oeffnet den Aufnahme-Dialog, mit dem Ausloeser fuer die Fokusrueckgabe. */
  onPlaceInTop10: (trigger: RefObject<HTMLElement | null>) => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  /* Herkunft fuer den Brotkrumenpfad des Ziels (KAN-80). */
  const origin = useBreadcrumbOrigin()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const mayPlaceInTop10 = project.status === "PUBLISHED"
  const placementBlocked = top10PlacementBlockReason(project, inTop10, listFull)
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
          {/* Nur bei einem veroeffentlichten Projekt: in jedem anderen
              Status fuehrt der Zeilentitel selbst in die Reviewansicht
              (siehe {@code projectHref}), und der Eintrag waere der zweite
              Weg an dieselbe Adresse. */}
          {project.status === "PUBLISHED" && (
            <DropdownMenuItem
              render={
                <Link to={`/projects/${project.id}/review`} state={origin} />
              }
              nativeButton={false}
            >
              <MessageSquareIcon aria-hidden="true" />
              {t("administration.projects.row.open")}
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onClick={() => onAssignEditors(triggerRef)}
            closeOnClick
          >
            <UserCogIcon aria-hidden="true" />
            {t("administration.projects.row.assignEditors")}
          </DropdownMenuItem>

          {mayPlaceInTop10 && (
            <Top10PlacementMenuItem
              blocked={placementBlocked}
              onPlace={() => onPlaceInTop10(triggerRef)}
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
