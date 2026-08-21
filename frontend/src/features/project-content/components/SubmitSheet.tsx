import { InfoIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { isApiError } from "@/api/errors"
import { submitProject, updateProject } from "@/api/queries/projects"
import type {
  ProjectDetailResponse,
  ProjectUpdateRequest,
} from "@/api/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { missingForSubmit } from "@/features/project-content/submitRequirements"
import { ProjectMetadataForm } from "@/features/projects/ProjectMetadataForm"

/**
 * Einreichen, und zwar durch die Metadaten hindurch (§3.3, §4.1).
 *
 * <p><strong>Warum nicht einfach senden.</strong> Der Server verlangt zum
 * Einreichen sieben Angaben, von denen im Editor keine einzige sichtbar
 * ist: Projekttyp, Fakultaet, Studiengang, Abschluss, Kategorie, Semester
 * und mindestens eine Redaktionszuweisung. Ein blinder Aufruf endete
 * regelmaessig in 400 {@code PROJECT_INCOMPLETE} mit einer Liste von
 * Feldnamen, und die Autor:in stuende danach vor der Frage, wo sie die
 * eintraegt. Dieser Weg fuehrt sie dorthin, statt sie zurueckzuschicken;
 * der Fehler kann so gar nicht mehr auftreten.
 *
 * <p><strong>Es ist dasselbe Formular wie auf der Metadatenseite</strong>
 * ({@code ProjectMetadataForm} aus KAN-35, das genau dafuer ohne Huelle
 * gebaut ist) und dasselbe zod-Schema. Eine zweite Fassung waere eine
 * zweite Wahrheit ueber dieselben Felder.
 *
 * <p><strong>Zwei Aufrufe, in dieser Reihenfolge:</strong> erst
 * {@code PUT /projects/{id}} mit der vollstaendigen Metadatenkarte, dann
 * {@code POST /projects/{id}/submit}. Sie zusammenzufassen ginge nicht,
 * §6.1 trennt Metadaten und Uebergang; scheitert der zweite Aufruf, sind
 * die Angaben trotzdem gespeichert, und das ist die richtige Richtung.
 *
 * <p>Ein Sheet und kein Dialog: das Formular ist lang, und ein Sheet bringt
 * das Blaettern mit, ohne dass der Dialog den Bildschirm sprengt. Der
 * Dialogtitel traegt bereits eine {@code h2}, deshalb laufen die
 * Abschnitte des Formulars auf Ebene 3 (SC 1.3.1).
 */
export function SubmitSheet({
  open,
  onOpenChange,
  project,
  onUploadCoverImage,
  onSubmitted,
  onVersionConflict,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: ProjectDetailResponse
  onUploadCoverImage: (file: File) => Promise<string>
  onSubmitted: (project: ProjectDetailResponse) => void
  onVersionConflict: () => void
}) {
  const { t } = useTranslation()
  const missing = missingForSubmit(project)

  const saveAndSubmit = async (
    request: ProjectUpdateRequest
  ): Promise<ProjectDetailResponse> => {
    try {
      await updateProject(project.id, request)
      const submitted = await submitProject(project.id)
      onSubmitted(submitted)
      onOpenChange(false)
      return submitted
    } catch (error) {
      if (
        isApiError(error) &&
        error.errorCode === "PROJECT_VERSION_CONFLICT"
      ) {
        onVersionConflict()
      }
      /* Weiterwerfen: das Formular ordnet 400 VALIDATION_FAILED den Feldern
         zu und zeigt alles Uebrige als Meldung an sich selbst. */
      throw error
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-2xl"
      >
        <SheetHeader>
          <SheetTitle>{t("projectContent.submit.title")}</SheetTitle>
          <SheetDescription>
            {t("projectContent.submit.description")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-8">
          {missing.length > 0 && (
            <Alert>
              <InfoIcon aria-hidden="true" />
              <AlertTitle>{t("projectContent.submit.missingTitle")}</AlertTitle>
              <AlertDescription>
                {t("projectContent.submit.missingDescription", {
                  fields: missing
                    .map((field) => t(`projectContent.submit.field.${field}`))
                    .join(", "),
                })}
              </AlertDescription>
            </Alert>
          )}

          <ProjectMetadataForm
            key={`${project.id}-${project.version}`}
            project={project}
            headingLevel={3}
            submitLabel={t("projectContent.header.submit")}
            submitPendingLabel={t("projectContent.submit.pending")}
            onUploadCoverImage={onUploadCoverImage}
            onSubmit={saveAndSubmit}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
