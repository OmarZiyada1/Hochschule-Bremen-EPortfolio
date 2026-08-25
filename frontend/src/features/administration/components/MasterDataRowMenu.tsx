import { MoreVerticalIcon, Trash2Icon } from "lucide-react"
import { useRef, useState, type ReactNode, type RefObject } from "react"
import { useTranslation } from "react-i18next"

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

/**
 * Ein zusaetzlicher Eintrag ueber dem Loeschen, etwa „Umbenennen".
 *
 * <p>Beschrieben statt gerendert: die Eintraege oeffnen Dialoge und brauchen
 * dafuer den Menueknopf als Fokusziel, und den darf nur ein Ereignishandler
 * lesen, nie das Rendern (Lint {@code react-hooks/refs}).
 */
export interface MasterDataMenuItem {
  key: string
  label: string
  icon: ReactNode
  disabled?: boolean
  onSelect: (trigger: RefObject<HTMLElement | null>) => void
}

/**
 * Das Zeilenmenue der Stammdatenseiten (KAN-39): Kategorien, Semester und
 * Studienstruktur fuehren ihre Zeilenaktionen im selben {@code ⋮}-Menue.
 *
 * <p><strong>Ein Menue statt einer Reihe von Symbolen.</strong> Der Frame der
 * Kategorien zeigt nur einen Papierkorb, der der Semester vier Symbole;
 * Nutzerverwaltung und Studienstruktur fuehren dagegen ein Menue. Entschieden
 * ist das Menue fuer alle Stammdatenseiten (Klaerungsrunde zu KAN-39), damit
 * die Administrationsseite ueberall dieselbe Bedienung hat.
 *
 * <p><strong>Mit einer Ausnahme: die beiden Pfeile der Semesterzeile.</strong>
 * Sie bleiben als Schaltflaechen in der Zeile stehen und wandern nicht
 * hierher. Umsortieren heisst meist mehrmals verschieben, und ein Menue, das
 * sich nach jedem Klick schliesst, machte aus einem Zug drei (Nachtrag zur
 * Klaerungsrunde). Sie aendern die Reihenfolge und sind keine Zeilenaktion
 * wie Umbenennen oder Loeschen.
 *
 * <p><strong>Das Loeschen steht hier und nicht je Seite.</strong> Es ist an
 * allen Stammdaten dieselbe Handlung mit derselben Sperre: eine noch
 * referenzierte Zeile ergibt <strong>409</strong> RESOURCE_IN_USE (§6.1).
 * Die Rueckfrage davor gehoert deshalb an eine Stelle; was im Weg stehen
 * kann, benennt die aufrufende Seite im Beschreibungstext.
 *
 * <p>Die weiteren Eintraege kommen als Beschreibung herein und bekommen den
 * Menueknopf beim Auswaehlen mit: sie oeffnen Dialoge, und der Knopf ist dann
 * schon abgebaut. Ohne ihn faende der Fokus beim Schliessen kein Ziel
 * (SC 2.4.3).
 */
export function MasterDataRowMenu({
  name,
  deleteLabel,
  deleteTitle,
  deleteDescription,
  deleteConfirm,
  pending,
  onDelete,
  items = [],
}: {
  /** Der Zeilenname, fuer den erreichbaren Namen des Menuekopfs. */
  name: string
  deleteLabel: string
  deleteTitle: string
  deleteDescription: string
  deleteConfirm: string
  pending: boolean
  onDelete: () => void
  /** Eintraege ueber dem Loeschen, in ihrer Reihenfolge. */
  items?: readonly MasterDataMenuItem[]
}) {
  const { t } = useTranslation()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          ref={triggerRef}
          render={<Button variant="ghost" size="icon-sm" />}
        >
          <MoreVerticalIcon aria-hidden="true" />
          {/* Der Name nennt die Zeile: in einer Liste stuenden sonst
              mehrere gleichnamige Menues nebeneinander, die eine
              Elementliste nicht auseinanderhalten kann (SC 2.4.6). */}
          <span className="sr-only">
            {t("administration.masterData.menuFor", { name })}
          </span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          {items.map((item) => (
            <DropdownMenuItem
              key={item.key}
              disabled={item.disabled}
              onClick={() => item.onSelect(triggerRef)}
            >
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          ))}
          {items.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2Icon aria-hidden="true" />
            {deleteLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="rounded-modal" finalFocus={triggerRef}>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.action.cancel")}</AlertDialogCancel>
            {/* Rot, weil hier wirklich etwas verloren geht: anders als die
                Deaktivierung eines Kontos loescht dieser Schritt die Zeile
                (§6.1). */}
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() => {
                setConfirmDelete(false)
                onDelete()
              }}
            >
              {deleteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
