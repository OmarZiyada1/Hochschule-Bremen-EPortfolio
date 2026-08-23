import {
  EyeIcon,
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
import { nominationBlockReason } from "@/features/reviews/nominationBlock"

/**
 * Das Zeilenmenue der Reviewliste (Template „Meine Reviews", KAN-37):
 * Anzeigen, Review, Nominieren, Zuweisung abgeben.
 *
 * <p><strong>Der Nominierungseintrag ist immer sichtbar</strong> und dort,
 * wo er nicht greift, gesperrt <em>und begruendet</em>. Ein blosses
 * Ausgrauen sagt nicht, warum (SC 3.3.2); der Grund steht deshalb als Text
 * im Eintrag und nicht nur als Farbe.
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
          <DropdownMenuItem
            render={<Link to={`/projects/${project.id}`} />}
            nativeButton={false}
          >
            <EyeIcon aria-hidden="true" />
            {t("review.list.row.view")}
          </DropdownMenuItem>

          <DropdownMenuItem
            render={<Link to={`/projects/${project.id}/review`} />}
            nativeButton={false}
          >
            <MessageSquareIcon aria-hidden="true" />
            {t("review.list.row.review")}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            disabled={blocked !== null}
            onClick={() => {
              if (blocked === null) {
                onNominate(triggerRef)
              }
            }}
          >
            <TrophyIcon aria-hidden="true" />
            <span className="flex flex-col items-start">
              {t("review.list.row.nominate")}
              {blocked !== null && (
                <span className="type-label-xs text-muted-foreground">
                  {t(`review.list.row.nominateBlocked.${blocked}`)}
                </span>
              )}
            </span>
          </DropdownMenuItem>

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
