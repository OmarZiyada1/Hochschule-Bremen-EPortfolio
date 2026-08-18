import { PencilIcon, Trash2Icon, Undo2Icon } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  useDeleteProject,
  useWithdrawProject,
} from "@/features/portfolio/hooks/useProjectActions"

/**
 * Die statusabhaengige Handlung einer eigenen Projektkachel unter
 * "My Portfolio" (KAN-69), als action-Slot der ProjectCard:
 *
 * <ul>
 * <li>DRAFT und REVISION: "Bearbeiten" fuehrt in den Editor; nur dort ist
 * der Inhalt aenderbar (§4.1). Im DRAFT steht daneben "Loeschen", denn die
 * Rechtematrix erlaubt der Autor:in das Loeschen nur im Entwurf (§6.1).</li>
 * <li>SUBMITTED: "Zurueckziehen" gegen POST /projects/{id}/withdraw (§4.1,
 * seit Contract v50); danach steht die Karte als Entwurf da.</li>
 * <li>APPROVED und PUBLISHED: keine Handlung. Die Seite haengt diese
 * Komponente dort gar nicht erst ein, damit die veroeffentlichte Karte
 * ihre Reaktionszahl behaelt (action-Slot der ProjectCard).</li>
 * </ul>
 *
 * <p><strong>Symbole statt beschrifteter Knoepfe</strong> (Sichtpruefung zu
 * KAN-69): die Fusszeile der Kachel ist schmal, drei Textknoepfe drueckten
 * das Semester an den Rand und zogen die Aufmerksamkeit von Titel und
 * Teaser weg. Die Bedeutung tragen die eingefuehrten Sinnbilder Stift,
 * Pfeil zurueck und Papierkorb; den zugaenglichen Namen traegt jeder Knopf
 * als sr-only-Text, wird also vorgelesen und ist per Tastatur erreichbar
 * (SC 4.1.2). Ein blosses {@code title} genuegte dafuer nicht.
 *
 * <p><strong>Beide Handlungen fragen vorher nach</strong> (Skill
 * frontend-design, Abschnitt 5): das Loeschen, weil es unwiderruflich ist,
 * das Zurueckziehen, weil es den Status fuer die Redaktion sichtbar
 * aendert. Rot traegt allein das Loeschen; das Zurueckziehen laesst sich
 * mit dem naechsten Einreichen umkehren und bekommt deshalb die normale
 * Betonung. Der Weg in den Editor fragt nicht: eine Navigation nimmt
 * nichts weg.
 *
 * <p>Fehler (etwa ein 409, wenn die Redaktion schneller war) erscheinen als
 * Text an der Kachel, nicht still; die Liste laedt danach neu, weil beide
 * Mutationen den projects-Ast invalidieren.
 */
export function OwnProjectCardActions({
  project,
  onDone,
}: {
  project: ProjectCardResponse
  /**
   * Meldet den gelungenen Ausgang nach oben. Die Ansage gehoert in die
   * Liste und nicht in die Kachel: beim Loeschen verschwindet die Kachel
   * mitsamt einer Meldung, die in ihr steht (Befund aus dem Review zu
   * KAN-69).
   */
  onDone?: (message: string) => void
}) {
  const { t } = useTranslation()
  const withdraw = useWithdrawProject()
  const remove = useDeleteProject()
  const [serverError, setServerError] = useState<string | null>(null)
  const [openDialog, setOpenDialog] = useState<"withdraw" | "delete" | null>(
    null
  )

  const projectId = project.id
  if (projectId === undefined) {
    return null
  }

  const title = project.title ?? ""

  /**
   * Fuehrt eine bestaetigte Handlung aus. Der Dialog schliesst in jedem
   * Ausgang: bei Erfolg verschwindet die Karte beziehungsweise wechselt
   * ihren Status, im Fehlerfall stuende die Meldung am Kartenfuss sonst
   * unsichtbar hinter dem offenen Modal (Befund aus dem Review zu KAN-69).
   */
  const run = async (action: () => Promise<unknown>, doneMessage: string) => {
    setServerError(null)
    try {
      await action()
      onDone?.(doneMessage)
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      setServerError(
        t(apiErrorMessageKey(error), { defaultValue: error.message })
      )
    } finally {
      setOpenDialog(null)
    }
  }

  /**
   * Rueckfrage nach dem Muster aus Abschnitt 5 des Skills
   * frontend-design: Titel, was genau geschieht (mit dem Projekttitel im
   * Text), Abbrechen zuerst, die Handlung mit ihrem eigenen Verb.
   */
  const confirmation = (
    kind: "withdraw" | "delete",
    trigger: ReactNode,
    options: { destructive?: boolean; pending: boolean }
  ) => (
    <AlertDialog
      open={openDialog === kind}
      onOpenChange={(next) => setOpenDialog(next ? kind : null)}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <AlertDialogTrigger
              render={
                <Button
                  size="icon-sm"
                  variant={
                    options.destructive === true ? "destructive" : "ghost"
                  }
                />
              }
            />
          }
        >
          {trigger}
        </TooltipTrigger>
        <TooltipContent>
          {t(`portfolio.myPortfolio.card.${kind}`)}
        </TooltipContent>
      </Tooltip>
      <AlertDialogContent className="rounded-modal">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(`portfolio.myPortfolio.card.${kind}Dialog.title`)}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(`portfolio.myPortfolio.card.${kind}Dialog.description`, {
              title,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t("portfolio.myPortfolio.card.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={options.destructive === true ? "destructive" : "default"}
            disabled={options.pending}
            onClick={() => {
              void (kind === "delete"
                ? run(
                    () => remove.mutateAsync(projectId),
                    t("portfolio.myPortfolio.card.deleteDone")
                  )
                : run(
                    () => withdraw.mutateAsync(projectId),
                    t("portfolio.myPortfolio.card.withdrawDone")
                  ))
            }}
          >
            {t(`portfolio.myPortfolio.card.${kind}Dialog.confirm`)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return (
    <div className="flex flex-col items-end gap-1">
      {/* Ein Provider je Kachel teilt die Verzoegerung der drei Knoepfe: wer
          von einem zum naechsten faehrt, wartet nicht erneut. */}
      <TooltipProvider delay={400}>
        <div className="flex items-center gap-1">
          {(project.status === "DRAFT" || project.status === "REVISION") && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    nativeButton={false}
                    render={<Link to={`/projects/${projectId}/editor`} />}
                  />
                }
              >
                <PencilIcon aria-hidden="true" />
                {/* Der Name nennt das Projekt: in einer Liste stuenden sonst
                    mehrere gleichnamige "Bearbeiten" nebeneinander, und die
                    Elementliste eines Screenreaders koennte sie nicht
                    auseinanderhalten (SC 2.4.6, Befund aus dem Review). Der
                    Tooltip daneben ist die sichtbare Ergaenzung fuer die
                    Maus, nicht der Name: er erscheint weder per Tastatur
                    zuverlaessig noch auf Touch. */}
                <span className="sr-only">
                  {t("portfolio.myPortfolio.card.editFor", { title })}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {t("portfolio.myPortfolio.card.edit")}
              </TooltipContent>
            </Tooltip>
          )}

          {project.status === "SUBMITTED" &&
            confirmation(
              "withdraw",
              <>
                <Undo2Icon aria-hidden="true" />
                <span className="sr-only">
                  {t("portfolio.myPortfolio.card.withdrawFor", { title })}
                </span>
              </>,
              { pending: withdraw.isPending }
            )}

          {project.status === "DRAFT" &&
            confirmation(
              "delete",
              <>
                <Trash2Icon aria-hidden="true" />
                <span className="sr-only">
                  {t("portfolio.myPortfolio.card.deleteFor", { title })}
                </span>
              </>,
              { destructive: true, pending: remove.isPending }
            )}
        </div>
      </TooltipProvider>

      {serverError !== null && (
        <p role="alert" className="type-caption text-destructive">
          {serverError}
        </p>
      )}
    </div>
  )
}
