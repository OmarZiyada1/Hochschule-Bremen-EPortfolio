import { useQuery } from "@tanstack/react-query"
import { useState, type RefObject } from "react"
import { useTranslation } from "react-i18next"

import { isApiError } from "@/api/errors"
import { projectQueries } from "@/api/queries/projects"
import { ErrorState } from "@/components/common/ErrorState"
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
import { Skeleton } from "@/components/ui/skeleton"
import { ProjectEditorsField } from "@/features/projects/components/ProjectEditorsField"
import type { PersonValue } from "@/features/projects/ProjectMetadataForm.schema"

/**
 * Die Redaktionszuweisung aus der Projektverwaltung (§6.1, PUT
 * /projects/{id}/editors, KAN-38).
 *
 * <p><strong>Der Stand wird nachgeladen, nicht geraten.</strong>
 * {@code ProjectCardResponse} fuehrt {@code editors} nicht (§6.1); die Zeile
 * der Tabelle weiss also nicht, wer zugewiesen ist. Der Dialog laedt das
 * Projektdetail, sobald er sich oeffnet, und nicht je Zeile im Voraus: das
 * waere genau das N+1, das die Kachel vermeidet.
 *
 * <p><strong>Kein eigenes Auswahlfeld.</strong> Gewaehlt wird mit
 * {@code ProjectEditorsField} aus dem Metadatenformular (KAN-35): dieselbe
 * Fachlichkeit, dieselben Ausschluesse aus §5 Fussnote 3, dieselbe
 * Pillenliste. Ein zweites Feld daneben liefe beim naechsten Contract-Schritt
 * auseinander.
 *
 * <p><strong>Ohne Version.</strong> Anders als der Metadaten-PUT laeuft dieser
 * Endpoint nicht gegen das Optimistic Locking (§6.4): er aendert keine
 * Metadaten, und die Administration darf jederzeit umverteilen, unabhaengig
 * vom Status.
 *
 * <p>Ein leeres Feld ist eine gueltige Eingabe: {@code []} hebt die Zuweisung
 * auf. Der Dialog sagt das, statt das Speichern zu sperren.
 */
export function EditorAssignmentDialog({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  pending,
  error,
  onSubmit,
  finalFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectTitle: string
  pending: boolean
  error: unknown
  onSubmit: (editorIds: string[]) => void
  /** Ziel des Fokus beim Schliessen, sonst faellt er auf body (SC 2.4.3). */
  finalFocus?: RefObject<HTMLElement | null>
}) {
  const { t } = useTranslation()
  const detail = useQuery({
    ...projectQueries.detail(projectId),
    enabled: open,
  })

  const [chosen, setChosen] = useState<PersonValue[] | null>(null)

  /*
   * Der Serverstand ist der Ausgangspunkt, aber nur einmal.
   *
   * Angepasst wird waehrend des Renderns und nicht in einem Effekt: das ist
   * das vorgesehene Muster fuer abgeleiteten Zustand, es kommt ohne den
   * zweiten Durchlauf aus und der Lint beanstandet es zu Recht andersherum
   * (react-hooks/set-state-in-effect). Zurueckgesetzt wird nichts, denn die
   * aufrufende Seite haengt den Dialog ab, sobald er zu ist; ein neuer
   * beginnt deshalb wieder bei null.
   *
   * <p>Uebernommen wird erst die Antwort <em>dieser</em> Montierung
   * ({@code isFetchedAfterMount}). Ohne die Bedingung stuende beim ersten
   * Render ein womoeglich veralteter Stand aus dem Cache da, etwa nach einem
   * frueheren Besuch der Detailseite; der Hintergrund-Refetch aktualisiert
   * danach zwar {@code detail.data}, aber {@code chosen} bleibt bewusst
   * stehen. Weil {@code PUT /editors} die Liste vollstaendig ersetzt und ohne
   * Version laeuft (§6.4), schriebe das Speichern den alten Stand zurueck
   * (Befund des frontend-reviewers).
   *
   * <p>editors ist nullable (§3.3): wem die Antwort das Feld nicht freigibt,
   * bekommt null. Als ADMIN kommt es immer, aber der Typ sagt das nicht zu,
   * und eine leere Liste ist hier die richtige Auslegung.
   */
  if (
    chosen === null &&
    detail.data !== undefined &&
    detail.isFetchedAfterMount
  ) {
    setChosen(
      (detail.data.editors ?? []).map((editor) => ({
        id: editor.id,
        firstName: editor.firstName,
        lastName: editor.lastName,
      }))
    )
  }

  const failed = isApiError(error) ? error : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="rounded-modal sm:max-w-lg"
        finalFocus={finalFocus}
      >
        <DialogHeader>
          <DialogTitle>
            {t("administration.projects.editorsDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("administration.projects.editorsDialog.description", {
              title: projectTitle,
            })}
          </DialogDescription>
        </DialogHeader>

        {detail.isPending && <Skeleton className="h-24 w-full rounded-card" />}

        {detail.error !== null && <ErrorState error={detail.error} />}

        {chosen !== null && detail.data !== undefined && (
          <>
            <ProjectEditorsField
              value={chosen}
              onChange={setChosen}
              /* Die Projektseite steht nicht zur Wahl (§5 Fussnote 3): die
                 Autor:in und die Projektmitglieder wuerden serverseitig mit
                 400 abgewiesen. Das eigene Konto ist hier nicht
                 ausgeschlossen: ein Admin darf sich einem fremden Projekt
                 zuweisen, sofern er nicht selbst dazugehoert. */
              authorId={detail.data.author.id}
              memberIds={detail.data.members.map((member) => member.userId)}
            />
            {chosen.length === 0 && (
              <p className="type-body-sm text-muted-foreground">
                {t("administration.projects.editorsDialog.emptyHint")}
              </p>
            )}
          </>
        )}

        {failed !== null && <ErrorState error={failed} />}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {t("common.action.cancel")}
          </DialogClose>
          <Button
            type="button"
            disabled={pending || chosen === null}
            onClick={() => {
              if (chosen !== null) {
                onSubmit(chosen.map((person) => person.id))
              }
            }}
          >
            {t("common.action.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
