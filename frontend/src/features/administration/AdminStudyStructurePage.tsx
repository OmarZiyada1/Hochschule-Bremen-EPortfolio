import { useQuery } from "@tanstack/react-query"
import { PencilIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { masterDataQueries } from "@/api/queries/masterData"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { MasterDataRowMenu } from "@/features/administration/components/MasterDataRowMenu"
import { StudyStructureColumn } from "@/features/administration/components/StudyStructureColumn"
import { StudyStructureDialog } from "@/features/administration/components/StudyStructureDialog"
import {
  type StudyStructureFormValues,
  type StudyStructureKind,
} from "@/features/administration/components/StudyStructureDialog.schema"
import {
  useCreateFaculty,
  useCreateModule,
  useCreateStudyProgram,
  useDeleteFaculty,
  useDeleteModule,
  useDeleteStudyProgram,
  useUpdateFaculty,
  useUpdateModule,
  useUpdateStudyProgram,
} from "@/features/administration/hooks/useMasterDataAdmin"

interface DialogState {
  kind: StudyStructureKind
  mode: "create" | "edit"
  /** Nur beim Aendern gesetzt. */
  entityId?: string
  initial: StudyStructureFormValues
}

/**
 * Die Studienstruktur der Administrationsseite (Template „Studienstruktur",
 * Frame {@code Admin · Studienstruktur}, KAN-39): Fakultaet, Studiengang und
 * Modul in drei Spalten, in denen die Auswahl links die Liste rechts
 * einschraenkt.
 *
 * <p><strong>Die Auswahl steht in der Adresse</strong> und nicht in
 * {@code useState}: sie beschreibt einen teilbaren Ausschnitt, und ohne sie
 * ueberlebte er den Zurueck-Knopf nicht (Skill frontend-modul, Abschnitt 3).
 * Ein Fakultaetswechsel raeumt die Studiengangsauswahl mit weg, denn der
 * gewaehlte Studiengang gehoert dann nicht mehr zur Liste.
 *
 * <p><strong>Kein Statusfeld und kein Abschluss.</strong> §3.7 kennt am
 * Studiengang {@code name}, {@code abbreviation} und {@code facultyId},
 * sonst nichts; {@code Degree} haengt am Projekt (§2.7). Diese drei
 * Stammdaten tragen kein {@code active}, es gibt hier also nur Anlegen,
 * Aendern und Loeschen. Das Semester ist die einzige Ausnahme und hat seine
 * eigene Seite.
 *
 * <p><strong>Die Loeschsperre greift auch durch die Ebene darunter.</strong>
 * Eine Fakultaet laesst sich nicht loeschen, solange ein Studiengang an ihr
 * haengt, ein Studiengang nicht, solange ein Modul an ihm haengt, und das
 * unabhaengig von Projekten (409 RESOURCE_IN_USE, §6.1). Die Rueckfrage
 * nennt das vorher, die Meldung danach.
 *
 * <p><strong>Ohne Fakultaetsfarben.</strong> Fakultaet und Studiengang
 * erscheinen ueberall im neutralen Badge-Paar; eine frei gewaehlte Farbe
 * waere zur Laufzeit nicht kontrastpruefbar (Designentscheidungen 2.4).
 */
export default function AdminStudyStructurePage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()

  const facultyId = searchParams.get("faculty")
  const studyProgramId = searchParams.get("studyProgram")

  const faculties = useQuery(masterDataQueries.faculties())
  const studyPrograms = useQuery(
    masterDataQueries.studyPrograms(facultyId ?? undefined)
  )
  /* Ohne gewaehlten Studiengang gibt es nichts zu zeigen: die Liste aller
     Module waere in dieser Spalte irrefuehrend, weil die Ueberschrift links
     etwas anderes verspricht. */
  const modules = useQuery({
    ...masterDataQueries.modules(studyProgramId ?? undefined),
    enabled: studyProgramId !== null,
  })

  const createFaculty = useCreateFaculty()
  const updateFaculty = useUpdateFaculty()
  const deleteFaculty = useDeleteFaculty()
  const createStudyProgram = useCreateStudyProgram()
  const updateStudyProgram = useUpdateStudyProgram()
  const deleteStudyProgram = useDeleteStudyProgram()
  const createModule = useCreateModule()
  const updateModule = useUpdateModule()
  const deleteModule = useDeleteModule()

  /*
   * Beim Betreten steht schon etwas zur Auswahl: die erste Fakultaet und
   * darin der erste Studiengang, samt seinen Modulen. Eine Seite, die mit
   * drei Spalten und ohne Auswahl aufmacht, laesst die beiden rechten leer
   * und sieht aus, als sei nichts angelegt.
   *
   * replace statt push: die Vorauswahl ist kein Schritt, den jemand
   * zurueckgehen will. Gesetzt wird nur, was fehlt, sonst liefe der Effekt
   * gegen eine getroffene Auswahl an.
   */
  useEffect(() => {
    const first = faculties.data?.[0]
    if (facultyId === null && first !== undefined) {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          next.set("faculty", first.id)
          return next
        },
        { replace: true }
      )
    }
  }, [facultyId, faculties.data, setSearchParams])

  useEffect(() => {
    const first = studyPrograms.data?.[0]
    if (facultyId !== null && studyProgramId === null && first !== undefined) {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          next.set("studyProgram", first.id)
          return next
        },
        { replace: true }
      )
    }
  }, [facultyId, studyProgramId, studyPrograms.data, setSearchParams])

  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [notice, setNotice] = useState("")
  const dialogTrigger = useRef<HTMLElement | null>(null)

  function messageOf(error: unknown): string {
    return isApiError(error)
      ? t(apiErrorMessageKey(error), { defaultValue: error.message })
      : t("apiError.INTERNAL_ERROR")
  }

  /**
   * Der 409 beim Loeschen meint die Sperre durch die Ebene darunter (§6.1),
   * und die ist je Ebene eine andere: an der Fakultaet haengt ein
   * Studiengang, an ihm ein Modul, am Modul ein Projekt. Der allgemeine Text
   * zu RESOURCE_IN_USE nennt nichts davon.
   */
  function reportDeleteError(
    error: unknown,
    kind: StudyStructureKind,
    name: string
  ) {
    const message =
      isApiError(error) && error.errorCode === "RESOURCE_IN_USE"
        ? t(`administration.studyStructure.deleteBlocked.${kind}`, { name })
        : messageOf(error)
    setRowError(message)
    setNotice(message)
  }

  function select(key: "faculty" | "studyProgram", value: string | null) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      if (value === null) {
        next.delete(key)
      } else {
        next.set(key, value)
      }
      /* Ein Fakultaetswechsel raeumt die Studiengangsauswahl mit weg: der
         bisher gewaehlte Studiengang gehoert dann nicht mehr zur Liste, und
         die Modulspalte zeigte sonst die Module einer Zeile, die links gar
         nicht mehr zu sehen ist. */
      if (key === "faculty") {
        next.delete("studyProgram")
      }
      return next
    })
  }

  /** Anlegen und Aendern laufen ueber dasselbe Formular (§3.7 bis §3.9). */
  async function submitDialog(values: StudyStructureFormValues) {
    if (dialog === null) {
      return
    }
    setRowError(null)

    if (dialog.kind === "faculty") {
      if (dialog.mode === "create") {
        await createFaculty.mutateAsync({
          name: values.name,
          abbreviation: values.abbreviation,
        })
      } else {
        await updateFaculty.mutateAsync({
          facultyId: dialog.entityId ?? "",
          request: { name: values.name, abbreviation: values.abbreviation },
        })
      }
    } else if (dialog.kind === "studyProgram") {
      if (dialog.mode === "create") {
        /* Das Kuerzel ist seit Contract v81 auf allen drei Ebenen Pflicht
           (KAN-80); die leere Zeichenkette kommt aus dem Formular nicht mehr
           durch, und der Server wiese sie mit 400 ab. */
        await createStudyProgram.mutateAsync({
          name: values.name,
          abbreviation: values.abbreviation,
          facultyId: values.parentId,
        })
      } else {
        await updateStudyProgram.mutateAsync({
          studyProgramId: dialog.entityId ?? "",
          /* Beim Aendern hiesse null „unveraendert" (§6.1); die leere
             Zeichenkette loescht seit Contract v81 nichts mehr, sondern
             ergibt 400. Das Formular laesst sie deshalb gar nicht erst zu. */
          request: {
            name: values.name,
            abbreviation: values.abbreviation,
            facultyId: values.parentId,
          },
        })
      }
    } else {
      if (dialog.mode === "create") {
        await createModule.mutateAsync({
          name: values.name,
          abbreviation: values.abbreviation,
          studyProgramId: values.parentId,
        })
      } else {
        await updateModule.mutateAsync({
          moduleId: dialog.entityId ?? "",
          request: {
            name: values.name,
            abbreviation: values.abbreviation,
            studyProgramId: values.parentId,
          },
        })
      }
    }

    setNotice(
      t(`administration.studyStructure.saved.${dialog.mode}`, {
        name: values.name,
      })
    )
  }

  const dialogPending =
    createFaculty.isPending ||
    updateFaculty.isPending ||
    createStudyProgram.isPending ||
    updateStudyProgram.isPending ||
    createModule.isPending ||
    updateModule.isPending

  const parentsForDialog =
    dialog?.kind === "studyProgram"
      ? (faculties.data ?? [])
      : dialog?.kind === "module"
        ? (studyPrograms.data ?? [])
        : []

  return (
    <>
      <header className="flex flex-col gap-2">
        <p className="type-overline text-muted-foreground">
          {t("administration.label")}
        </p>
        <h1 className="type-title text-primary">
          {t("administration.studyStructure.title")}
        </h1>
        <p className="type-body-lg text-muted-foreground">
          {t("administration.studyStructure.subtitle")}
        </p>
        <hr className="mt-2" />
      </header>

      {rowError !== null && (
        <Alert variant="destructive">
          <AlertTitle>{rowError}</AlertTitle>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <StudyStructureColumn
          title={t("administration.studyStructure.column.faculties")}
          items={faculties.data ?? []}
          selectedId={facultyId}
          onSelect={(id) => select("faculty", id)}
          loading={faculties.isPending}
          error={
            faculties.error === null ? undefined : messageOf(faculties.error)
          }
          emptyTitle={t("administration.studyStructure.empty.faculties")}
          createLabel={t("administration.studyStructure.create.faculty")}
          onCreate={(trigger) => {
            dialogTrigger.current = trigger.current
            setDialog({
              kind: "faculty",
              mode: "create",
              initial: { name: "", abbreviation: "", parentId: "" },
            })
          }}
          renderMenu={(item) => (
            <MasterDataRowMenu
              name={item.name}
              pending={deleteFaculty.isPending}
              deleteLabel={t("administration.masterData.delete")}
              deleteTitle={t(
                "administration.studyStructure.deleteDialog.faculty"
              )}
              deleteDescription={t(
                "administration.studyStructure.deleteDialog.facultyDescription",
                { name: item.name }
              )}
              deleteConfirm={t("administration.masterData.deleteConfirm")}
              onDelete={() => {
                setRowError(null)
                deleteFaculty.mutate(item.id, {
                  onSuccess: () => {
                    if (item.id === facultyId) {
                      select("faculty", null)
                    }
                    setNotice(
                      t("administration.studyStructure.deleted", {
                        name: item.name,
                      })
                    )
                  },
                  onError: (error) =>
                    reportDeleteError(error, "faculty", item.name),
                })
              }}

              items={[
                {
                  key: "edit",
                  label: t("administration.masterData.edit"),
                  icon: <PencilIcon aria-hidden="true" />,
                  onSelect: (trigger) => {
                    dialogTrigger.current = trigger.current
                    const faculty = (faculties.data ?? []).find(
                      (entry) => entry.id === item.id
                    )
                    setDialog({
                      kind: "faculty",
                      mode: "edit",
                      entityId: item.id,
                      initial: {
                        name: faculty?.name ?? item.name,
                        abbreviation: faculty?.abbreviation ?? "",
                        parentId: "",
                      },
                    })
                  },
                },
              ]}
            />
          )}
        />

        <StudyStructureColumn
          title={t("administration.studyStructure.column.studyPrograms")}
          count={studyPrograms.data?.length}
          items={studyPrograms.data ?? []}
          selectedId={studyProgramId}
          onSelect={(id) => select("studyProgram", id)}
          loading={studyPrograms.isPending}
          error={
            studyPrograms.error === null
              ? undefined
              : messageOf(studyPrograms.error)
          }
          emptyTitle={t("administration.studyStructure.empty.studyPrograms")}
          createLabel={t("administration.studyStructure.create.studyProgram")}
          createDisabled={facultyId === null}
          disabledHint={t("administration.studyStructure.selectFacultyFirst")}
          onCreate={(trigger) => {
            dialogTrigger.current = trigger.current
            setDialog({
              kind: "studyProgram",
              mode: "create",
              initial: {
                name: "",
                abbreviation: "",
                parentId: facultyId ?? "",
              },
            })
          }}
          renderMenu={(item) => (
            <MasterDataRowMenu
              name={item.name}
              pending={deleteStudyProgram.isPending}
              deleteLabel={t("administration.masterData.delete")}
              deleteTitle={t(
                "administration.studyStructure.deleteDialog.studyProgram"
              )}
              deleteDescription={t(
                "administration.studyStructure.deleteDialog.studyProgramDescription",
                { name: item.name }
              )}
              deleteConfirm={t("administration.masterData.deleteConfirm")}
              onDelete={() => {
                setRowError(null)
                deleteStudyProgram.mutate(item.id, {
                  onSuccess: () => {
                    if (item.id === studyProgramId) {
                      select("studyProgram", null)
                    }
                    setNotice(
                      t("administration.studyStructure.deleted", {
                        name: item.name,
                      })
                    )
                  },
                  onError: (error) =>
                    reportDeleteError(error, "studyProgram", item.name),
                })
              }}

              items={[
                {
                  key: "edit",
                  label: t("administration.masterData.edit"),
                  icon: <PencilIcon aria-hidden="true" />,
                  onSelect: (trigger) => {
                    dialogTrigger.current = trigger.current
                    const program = (studyPrograms.data ?? []).find(
                      (entry) => entry.id === item.id
                    )
                    setDialog({
                      kind: "studyProgram",
                      mode: "edit",
                      entityId: item.id,
                      initial: {
                        name: program?.name ?? item.name,
                        abbreviation: program?.abbreviation ?? "",
                        parentId: program?.facultyId ?? facultyId ?? "",
                      },
                    })
                  },
                },
              ]}
            />
          )}
        />

        <StudyStructureColumn
          title={t("administration.studyStructure.column.modules")}
          count={studyProgramId === null ? undefined : modules.data?.length}
          items={studyProgramId === null ? [] : (modules.data ?? [])}
          selectedId={null}
          loading={studyProgramId !== null && modules.isPending}
          error={modules.error === null ? undefined : messageOf(modules.error)}
          emptyTitle={
            studyProgramId === null
              ? t("administration.studyStructure.empty.noStudyProgram")
              : t("administration.studyStructure.empty.modules")
          }
          createLabel={t("administration.studyStructure.create.module")}
          createDisabled={studyProgramId === null}
          disabledHint={t(
            "administration.studyStructure.selectStudyProgramFirst"
          )}
          onCreate={(trigger) => {
            dialogTrigger.current = trigger.current
            setDialog({
              kind: "module",
              mode: "create",
              initial: {
                name: "",
                abbreviation: "",
                parentId: studyProgramId ?? "",
              },
            })
          }}
          renderMenu={(item) => (
            <MasterDataRowMenu
              name={item.name}
              pending={deleteModule.isPending}
              deleteLabel={t("administration.masterData.delete")}
              deleteTitle={t(
                "administration.studyStructure.deleteDialog.module"
              )}
              deleteDescription={t(
                "administration.studyStructure.deleteDialog.moduleDescription",
                { name: item.name }
              )}
              deleteConfirm={t("administration.masterData.deleteConfirm")}
              onDelete={() => {
                setRowError(null)
                deleteModule.mutate(item.id, {
                  onSuccess: () =>
                    setNotice(
                      t("administration.studyStructure.deleted", {
                        name: item.name,
                      })
                    ),
                  onError: (error) =>
                    reportDeleteError(error, "module", item.name),
                })
              }}

              items={[
                {
                  key: "edit",
                  label: t("administration.masterData.edit"),
                  icon: <PencilIcon aria-hidden="true" />,
                  onSelect: (trigger) => {
                    dialogTrigger.current = trigger.current
                    const entry = (modules.data ?? []).find(
                      (candidate) => candidate.id === item.id
                    )
                    setDialog({
                      kind: "module",
                      mode: "edit",
                      entityId: item.id,
                      initial: {
                        name: entry?.name ?? item.name,
                        abbreviation: entry?.abbreviation ?? "",
                        parentId: entry?.studyProgramId ?? studyProgramId ?? "",
                      },
                    })
                  },
                },
              ]}
            />
          )}
        />
      </div>

      {dialog !== null && (
        <StudyStructureDialog
          kind={dialog.kind}
          mode={dialog.mode}
          open
          onOpenChange={(next) => {
            if (!next) {
              setDialog(null)
            }
          }}
          initial={dialog.initial}
          parents={parentsForDialog}
          pending={dialogPending}
          finalFocus={dialogTrigger}
          onSubmit={submitDialog}
        />
      )}

      {/* Anlegen, Aendern und Loeschen aendern die Spalten daneben; ohne
          Live-Region bliebe das fuer Screenreader unbemerkt (SC 4.1.3). */}
      <span className="sr-only" role="status">
        {notice}
      </span>
    </>
  )
}
