import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2Icon, XCircleIcon } from "lucide-react"
import { useId, type RefObject } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import type {
  BulkStatusAction,
  ProjectBulkStatusResultResponse,
} from "@/api/types"
import { CharacterCounter } from "@/components/common/CharacterCounter"
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  bulkStatusSchema,
  type BulkStatusFormValues,
} from "@/features/administration/components/BulkStatusDialog.schema"
import { REVISION_REASON_MAX } from "@/features/reviews/components/RevisionDialog.schema"

/**
 * Der Statuswechsel der Projektverwaltung (§6.1, KAN-38), fuer eine Auswahl
 * von Projekten oder fuer genau eines aus dem Zeilenmenue.
 *
 * <p><strong>Ein Dialog fuer beide Wege.</strong> Der Endpoint ist derselbe,
 * und mit ihm die Begruendungspflicht; zwei Dialoge daneben haetten zwei
 * zod-Schemata, die auseinanderlaufen.
 *
 * <p><strong>Die Begruendung wird einmal abgefragt, nicht je Zeile.</strong>
 * Derselbe Text wird serverseitig je ausgewaehltem Projekt ein eigener
 * CHANGE_REQUEST-Kommentar (§2.3); der Dialog sagt das, damit niemand hier
 * eine interne Notiz vermutet. Bei {@code publish} erscheint das Feld gar
 * nicht: dort ist es nicht bloss wirkungslos, sondern unzulaessig, und eine
 * abgeschickte, aber verworfene Begruendung waere die schlechteste der drei
 * Moeglichkeiten (§6.1, KAN-46).
 *
 * <p><strong>Veroeffentlichen fragt als {@code alertdialog} zurueck, die
 * Rueckgabe zur Ueberarbeitung nicht.</strong> Der Skill {@code frontend-design}
 * verlangt die Rueckfrage ueber {@code alert-dialog}, sobald ein Statuswechsel
 * die fremde Sicht aendert. Bei {@code publish} ist der Dialog genau das, eine
 * Bestaetigung ohne Eingabe, und traegt deshalb die Rolle. Bei
 * {@code request-revision} steht ein Pflichtfeld darin; ein
 * {@code alertdialog} mit Formular waere die falsche Zusage, und die
 * Redaktionsseite haelt es seit KAN-37 mit dem {@code RevisionDialog} ebenso.
 * Die Rolle wechselt waehrend eines offenen Dialogs nicht: sie haengt an der
 * Aktion, nicht an der Phase.
 *
 * <p><strong>Die Antwort ist eine Ergebnisliste, kein Sammelerfolg.</strong>
 * Steht sie an, zeigt der Dialog genau sie: je Projekt Erfolg oder der
 * Fehlercode aus §6.2, uebersetzt ueber i18n und nie als roher Code. Ein
 * Projekt, das nach §4.1 gerade nicht uebergehen darf, blockiert die uebrigen
 * nicht, und der Dialog behauptet deshalb auch nichts anderes. Erst danach
 * schliesst die Aufruferin ihn selbst.
 */
export function BulkStatusDialog({
  open,
  onOpenChange,
  action,
  projectTitles,
  pending,
  error,
  results,
  onSubmit,
  finalFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: BulkStatusAction
  /** Die betroffenen Projekte, fuer die Anrede im Kopf des Dialogs. */
  projectTitles: string[]
  pending: boolean
  error: unknown
  /** Steht erst nach dem Aufruf; bis dahin undefined. */
  results: ProjectBulkStatusResultResponse[] | undefined
  onSubmit: (reason: string | undefined) => void
  /** Ziel des Fokus beim Schliessen, sonst faellt er auf body (SC 2.4.3). */
  finalFocus?: RefObject<HTMLElement | null>
}) {
  const { t } = useTranslation()
  const reasonId = useId()
  const counterId = useId()

  const form = useForm<BulkStatusFormValues>({
    resolver: zodResolver(bulkStatusSchema),
    defaultValues: { action, reason: "" },
    values: { action, reason: "" },
  })

  /* useWatch statt form.watch: vertraeglich mit dem React Compiler
     (Lint react-hooks/incompatible-library), wie im RevisionDialog. */
  const reason = useWatch({ control: form.control, name: "reason" })
  const needsReason = action === "request-revision"
  const failed = isApiError(error) ? error : null
  const done = results !== undefined

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          form.reset({ action, reason: "" })
        }
        onOpenChange(next)
      }}
    >
      <DialogContent
        /* Aufgestreut und nicht als role={… : undefined} gesetzt: die
           Primitive traegt ihr eigenes role="dialog", und ein
           durchgereichtes undefined loeschte es, statt es stehen zu
           lassen. */
        {...(action === "publish" ? { role: "alertdialog" as const } : {})}
        className="rounded-modal sm:max-w-xl"
        finalFocus={finalFocus}
      >
        <DialogHeader>
          {/* Auch der Titel zaehlt: aus dem Zeilenmenue betrifft der Dialog
              genau ein Projekt, und „Projekte veroeffentlichen" waere dort
              falsch. */}
          <DialogTitle>
            {t(`administration.projects.statusDialog.title.${action}`, {
              count: projectTitles.length,
            })}
          </DialogTitle>
          <DialogDescription>
            {t(`administration.projects.statusDialog.description.${action}`, {
              count: projectTitles.length,
            })}
          </DialogDescription>
        </DialogHeader>

        {/* Welche Projekte betroffen sind, steht vor der Handlung und nicht
            erst im Ergebnis: eine Sammelaktion ueber eine Auswahl, die man
            nicht mehr sieht, ist nicht zu verantworten. */}
        {!done && (
          <ul className="max-h-40 overflow-y-auto rounded-card border px-3 py-2">
            {projectTitles.map((title) => (
              <li key={title} className="type-body-sm">
                {title}
              </li>
            ))}
          </ul>
        )}

        {done ? (
          <BulkResultList results={results} projectTitles={projectTitles} />
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit((values) =>
              onSubmit(needsReason ? values.reason.trim() : undefined)
            )}
          >
            {needsReason && (
              <Field
                data-invalid={form.formState.errors.reason ? true : undefined}
              >
                <FieldLabel htmlFor={reasonId}>
                  {t("administration.projects.statusDialog.reasonLabel")}
                </FieldLabel>
                <Textarea
                  id={reasonId}
                  rows={4}
                  placeholder={t(
                    "administration.projects.statusDialog.reasonPlaceholder"
                  )}
                  aria-describedby={counterId}
                  {...form.register("reason")}
                />
                <CharacterCounter
                  id={counterId}
                  value={reason}
                  max={REVISION_REASON_MAX}
                />
                {form.formState.errors.reason?.message && (
                  <FieldError>
                    {t(form.formState.errors.reason.message)}
                  </FieldError>
                )}
              </Field>
            )}

            {failed !== null && (
              <Alert variant="destructive">
                <AlertTitle>
                  {t(apiErrorMessageKey(failed), {
                    defaultValue: failed.message,
                  })}
                </AlertTitle>
              </Alert>
            )}

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {t("common.action.cancel")}
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {t(`administration.projects.action.${toKey(action)}`)}
              </Button>
            </DialogFooter>
          </form>
        )}

        {done && (
          <DialogFooter>
            <DialogClose render={<Button type="button" />}>
              {t("common.action.close")}
            </DialogClose>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Die Ergebnisliste je Projekt.
 *
 * <p><strong>Der Fehlercode wird uebersetzt, nicht gezeigt.</strong> Die Zeile
 * traegt bewusst keinen Meldungstext (§6.1); entschieden und angezeigt wird
 * nach {@code errorCode} ueber i18n (Frontend-Regel 3). Ist der Code
 * unbekannt, faellt die Anzeige auf einen allgemeinen Text zurueck, statt
 * einen rohen Bezeichner zu zeigen.
 *
 * <p>Die Zuordnung zum Titel laeuft ueber den Index: der Contract sagt zu,
 * dass genau eine Zeile je angefragter ID kommt, in der Reihenfolge des Bodys.
 * Ein zweites Nachschlagen ueber die ID braeuchte die Projektliste in dieser
 * Komponente, ohne etwas hinzuzufuegen.
 */
function BulkResultList({
  results,
  projectTitles,
}: {
  results: ProjectBulkStatusResultResponse[]
  projectTitles: string[]
}) {
  const { t } = useTranslation()
  const succeeded = results.filter((entry) => entry.success).length

  return (
    <div className="flex flex-col gap-3">
      <p className="type-body-sm" role="status">
        {t("administration.projects.statusDialog.summary", {
          succeeded,
          total: results.length,
        })}
      </p>
      <ul className="flex max-h-60 flex-col gap-2 overflow-y-auto">
        {results.map((entry, index) => (
          <li key={entry.projectId} className="flex items-start gap-2">
            {entry.success ? (
              <CheckCircle2Icon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-status-published-fg"
              />
            ) : (
              <XCircleIcon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-destructive"
              />
            )}
            <span className="type-body-sm">
              <span className="font-semibold">
                {projectTitles[index] ?? entry.projectId}
              </span>
              {": "}
              {entry.success
                ? t("administration.projects.statusDialog.rowSuccess")
                : t(`apiError.${entry.errorCode}`, {
                    defaultValue: t("apiError.INTERNAL_ERROR"),
                  })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Der i18n-Schluessel zur Aktion; der Contract-Wert traegt einen Bindestrich. */
function toKey(action: BulkStatusAction) {
  return action === "publish" ? "publish" : "requestRevision"
}
