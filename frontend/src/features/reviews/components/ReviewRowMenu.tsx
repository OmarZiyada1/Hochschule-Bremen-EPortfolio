import {
  MessageSquareIcon,
  MoreVerticalIcon,
  TrophyIcon,
  UserMinusIcon,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { nominationBlockReason } from "@/features/reviews/nominationBlock"

/**
 * Das Zeilenmenue der Reviewliste (Template „Meine Reviews", KAN-37):
 * Anzeigen, Review, Nominieren, Zuweisung abgeben.
 *
 * <p><strong>Der Nominierungseintrag ist immer sichtbar</strong> und dort,
 * wo er nicht greift, gesperrt <em>und begruendet</em>. Ein blosses
 * Ausgrauen sagt nicht, warum (SC 3.3.2).
 *
 * <p><strong>Der Grund steht seit der Nacharbeit an KAN-37 in einem
 * Kurzhinweis und nicht mehr als zweite Zeile im Eintrag.</strong> Zwei
 * Zeilen machten aus einem Menueeintrag einen Absatz und liessen das Menue
 * je nach Zeile unterschiedlich hoch werden. Der haeufigste Fall bekommt
 * stattdessen die Beschriftung selbst: liegt bereits ein Vorschlag vor,
 * heisst der Eintrag „Bereits nominiert" und braucht keine Erklaerung
 * daneben.
 *
 * <p><strong>Gesperrt heisst {@code aria-disabled} und nicht
 * {@code disabled}.</strong> Ein wirklich gesperrter Eintrag ist nicht mehr
 * fokussierbar, und damit waere der Hinweis fuer die Tastatur unerreichbar:
 * genau die Erklaerung, die SC 3.3.2 verlangt, saehe dann nur, wer mit der
 * Maus darueberfaehrt. Base UIs {@code MenuItem} schliesst das Menue
 * allerdings auch bei {@code aria-disabled} ({@code closeOnClick} steht auf
 * true), und ein Menue, das sich ohne Wirkung und ohne Meldung schliesst,
 * laesst den Hinweis nie zu Ende lesen; gesperrte Eintraege setzen deshalb
 * {@code closeOnClick={false}}. Gedaempft wird ueber die Rolle
 * {@code text-disabled} und nicht ueber {@code opacity}, sonst faellt die
 * Beschriftung unter den Kontrastwert (SC 1.4.3). Dasselbe Muster wie beim
 * Standwechsel in der Kommentarspalte.
 *
 * <p><strong>„Zuweisung abgeben" erscheint nur in SUBMITTED und
 * REVISION</strong> (§4.1): im Entwurf pflegt die Autor:in die Zuweisung
 * selbst, ab APPROVED ist die redaktionelle Arbeit getan. Anders als beim
 * Nominieren wird der Eintrag hier ausgeblendet und nicht gesperrt: er
 * waere in den uebrigen Status kein Fall, den man erklaeren muesste,
 * sondern schlicht keiner.
 *
 * <p><strong>Der Rueckfall wird als Bedingung genannt.</strong> Ob es die
 * letzte Zuweisung ist, weiss die Zeile nicht: {@code ProjectCardResponse}
 * fuehrt {@code editors} nicht (§6.1), und ein Nachladen je Zeile waere
 * genau das N+1, das die Kachel vermeidet. Die Rueckfrage nennt die Folge
 * deshalb als Bedingung, statt eine Gewissheit zu behaupten, die sie nicht
 * hat.
 */
export function ReviewRowMenu({
  project,
  inTop10,
  alreadyNominated,
  resignPending,
  onNominate,
  onResign,
}: {
  project: ProjectCardResponse
  inTop10: boolean
  alreadyNominated: boolean
  resignPending: boolean
  /**
   * Oeffnet den Nominierungsdialog und bekommt den Ausloeser mit: der
   * Menueeintrag ist beim Oeffnen schon abgebaut, der Dialog braucht fuer
   * die Fokusrueckgabe deshalb den Menueknopf (SC 2.4.3).
   */
  onNominate: (trigger: RefObject<HTMLElement | null>) => void
  onResign: () => void
}) {
  const { t } = useTranslation()
  const [confirmResign, setConfirmResign] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const blocked = nominationBlockReason(project, inTop10, alreadyNominated)
  const mayResign =
    project.status === "SUBMITTED" || project.status === "REVISION"

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
            {t("review.list.row.menuFor", { title: project.title })}
          </span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          {/* Kein Eintrag „Anzeigen": der Projektname der Zeile ist bereits
              der Weg auf die Detailseite, und ein zweiter daneben sagt
              dasselbe ein zweites Mal. */}
          <DropdownMenuItem
            render={<Link to={`/projects/${project.id}/review`} />}
            nativeButton={false}
          >
            <MessageSquareIcon aria-hidden="true" />
            {t("review.list.row.review")}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <NominateItem
            blocked={blocked}
            onNominate={() => onNominate(triggerRef)}
          />

          {mayResign && (
            <DropdownMenuItem onClick={() => setConfirmResign(true)}>
              <UserMinusIcon aria-hidden="true" />
              {t("review.list.row.resign")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmResign} onOpenChange={setConfirmResign}>
        <AlertDialogContent className="rounded-modal" finalFocus={triggerRef}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("review.list.resignDialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("review.list.resignDialog.description", {
                title: project.title,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.action.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={resignPending}
              onClick={() => {
                setConfirmResign(false)
                onResign()
              }}
            >
              {t("review.list.resignDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/**
 * Der Nominierungseintrag mit seinen vier Zustaenden.
 *
 * <p>Eigene Komponente, weil der Kurzhinweis den Eintrag umschliessen muss:
 * {@code TooltipTrigger} rendert sein Kind, und ein Menueeintrag, der
 * zwischen zwei Formen wechselt, waere im Menue selbst schlecht zu lesen.
 *
 * <p><strong>„Bereits nominiert" traegt keinen Hinweis</strong>, die
 * Beschriftung sagt bereits alles. Die beiden uebrigen Sperren behalten die
 * gewohnte Beschriftung und erklaeren sich im Hinweis; ein Eintrag, dessen
 * Text je nach Grund wechselt, waere schwerer wiederzufinden.
 */
function NominateItem({
  blocked,
  onNominate,
}: {
  blocked: ReturnType<typeof nominationBlockReason>
  onNominate: () => void
}) {
  const { t } = useTranslation()

  const item = (
    <DropdownMenuItem
      aria-disabled={blocked !== null}
      className={blocked !== null ? "text-text-disabled" : undefined}
      closeOnClick={blocked === null}
      onClick={() => {
        if (blocked === null) {
          onNominate()
        }
      }}
    >
      <TrophyIcon aria-hidden="true" />
      {blocked === "nominated"
        ? t("review.list.row.nominateBlocked.nominated")
        : t("review.list.row.nominate")}
    </DropdownMenuItem>
  )

  if (blocked === null || blocked === "nominated") {
    return item
  }

  return (
    <Tooltip>
      <TooltipTrigger render={item} />
      <TooltipContent side="left">
        {t(`review.list.row.nominateBlocked.${blocked}`)}
      </TooltipContent>
    </Tooltip>
  )
}
