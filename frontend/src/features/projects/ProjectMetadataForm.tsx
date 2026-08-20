import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { useAuth } from "@/api/auth/AuthContext"
import {
  apiErrorMessageKey,
  applyValidationErrors,
  isApiError,
} from "@/api/errors"
import { masterDataQueries } from "@/api/queries/masterData"
import type { ProjectDetailResponse, ProjectUpdateRequest } from "@/api/types"
import { CharacterCounter } from "@/components/common/CharacterCounter"
import {
  FilterSelect,
  type FilterOption,
} from "@/components/common/FilterSelect"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CoverImageField } from "@/features/projects/components/CoverImageField"
import { ProjectEditorsField } from "@/features/projects/components/ProjectEditorsField"
import { ProjectMembersField } from "@/features/projects/components/ProjectMembersField"
import { TagCombobox } from "@/features/projects/components/TagCombobox"
import {
  PROJECT_METADATA_FIELDS,
  SUMMARY_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  projectMetadataSchema,
  toProjectMetadataValues,
  toProjectUpdateRequest,
  type ProjectMetadataValues,
} from "@/features/projects/ProjectMetadataForm.schema"
import {
  FILTER_DEGREES,
  FILTER_PROJECT_TYPES,
} from "@/features/projects/projectFilters"
import { useQuery } from "@tanstack/react-query"

/**
 * Das Metadatenformular (KAN-35), Template "Projekt-Metadaten".
 *
 * <p><strong>Ohne Seitenhuelle.</strong> Keine Brotkrume, keine
 * Routenueberschrift, kein Routenbezug. Die Huelle setzt die Route; sonst
 * braechte diese Komponente die Brotkrume in den Editor-Dialog mit, der
 * dieselben Felder als Sheet oeffnet (KAN-36).
 *
 * <p><strong>Die Umkehr bei {@code onSubmit} ist der Kern.</strong> Die
 * Komponente ruft {@code api.*} nicht selbst und setzt keine eigene
 * Mutation ab. Die Route reicht ihre Mutation hinein, der Editor spaeter
 * seine Schreibwarteschlange. Ohne diese Umkehr liefe der Metadaten-PUT aus
 * dem Editor an dessen Versionsspeicher vorbei und erzeugte einen
 * Selbstkonflikt mit dem laufenden Autosave (§6.4).
 *
 * <p><strong>Ein 409 {@code PROJECT_VERSION_CONFLICT} wird durchgereicht</strong>
 * und hier nicht als Formularfehler dargestellt (Skill frontend-api,
 * Abschnitt 3). Nur die aufrufende Stelle kann neu laden, also entscheidet
 * sie; sie zeigt dafuer {@code VersionConflictDialog}. Alles andere
 * erscheint am Feld oder als Meldung am Formular.
 *
 * <p><strong>Kein Autosave.</strong> Ein entprelltes Speichern auf
 * kaskadierenden Auswahlfeldern schriebe Zwischenzustaende: wer die
 * Fakultaet wechselt, haette fuer einen Moment einen Studiengang ohne
 * passende Fakultaet gespeichert.
 */
export function ProjectMetadataForm({
  project,
  onSubmit,
  onCancel,
  onDirtyChange,
  onUploadCoverImage,
  disabled = false,
  headingLevel = 2,
}: {
  /** Zuletzt bekannter Stand; Ausgangswerte und Quelle der {@code version}. */
  project: ProjectDetailResponse
  /**
   * Schreibt den Body. Wirft einen {@code ApiError}; ein 409
   * {@code PROJECT_VERSION_CONFLICT} wird von dieser Komponente bewusst
   * nicht abgefangen.
   */
  onSubmit: (request: ProjectUpdateRequest) => Promise<ProjectDetailResponse>
  onCancel: () => void
  /**
   * Meldet nach oben, ob ungespeicherte Eingaben vorliegen. Die Route
   * braucht das fuer die Rueckfrage, bevor ein anderer Weg sie verwirft
   * (Skill frontend-design, Abschnitt 5), wie im Profilformular aus
   * KAN-34.
   */
  onDirtyChange?: (dirty: boolean) => void
  /**
   * Laedt das Titelbild hoch und liefert die Referenz
   * {@code /api/files/{id}}. Der Upload braucht eine {@code projectId}
   * (§3.15); auf beiden Verwendungsstellen gibt es sie, weil das Projekt
   * vorher angelegt wird.
   */
  onUploadCoverImage: (file: File) => Promise<string>
  /** Status ohne Bearbeitungsrecht: alles schreibgeschuetzt (§4.1). */
  disabled?: boolean
  /**
   * Ebene der Abschnittsueberschriften, passend zur Umgebung. Auf der Route
   * traegt die Seite die {@code h1}, also gilt 2; im Sheet des Editors
   * traegt der Dialogtitel bereits eine {@code h2}, dort gilt 3. Die
   * Primitiven koennen das nicht wissen, die Huelle schon (Skill
   * frontend-design, Abschnitt 4).
   */
  headingLevel?: 2 | 3
}) {
  const { t } = useTranslation()
  /* Die Rolle kommt aus dem Kontext und nicht aus dem Token (§6.5); der
     Server liest sie bei jedem Request neu aus der Datenbank. */
  const { user, role } = useAuth()
  const Heading = `h${headingLevel}` as "h2" | "h3"

  const form = useForm<ProjectMetadataValues>({
    resolver: zodResolver(projectMetadataSchema),
    defaultValues: toProjectMetadataValues(project),
  })

  const [uploading, setUploading] = useState(false)
  /*
   * Was die Kaskade zuletzt zurueckgesetzt hat, fuer die Ansage. Eine
   * Aenderung an einer uebergeordneten Auswahl aendert eine untergeordnete
   * mit, und das ist genau der Fall, den SC 3.2.2 gemeldet sehen will.
   */
  const [cascadeNotice, setCascadeNotice] = useState("")

  /* Der einzige Weg, den Zustand des Formulars nach aussen zu geben: er
     lebt in react-hook-form, und die Route muss ihn kennen, ohne das
     Formular zu besitzen (wie im Profilformular aus KAN-34). */
  const isDirty = form.formState.isDirty
  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  /* useWatch statt form.watch: vertraeglich mit dem React Compiler
     (Lint react-hooks/incompatible-library), wie im Profilformular. Beide
     Auswahlen steuern die untergeordnete Liste und deren Sperre. */
  const facultyId = useWatch({ control: form.control, name: "facultyId" })
  const studyProgramId = useWatch({
    control: form.control,
    name: "studyProgramId",
  })

  const faculties = useQuery(masterDataQueries.faculties())
  const categories = useQuery(masterDataQueries.categories())
  /* Nur aktive Semester sind waehlbar (§3.18); ein inaktives ergaebe 400
     VALIDATION_FAILED. Ein bereits gespeichertes, inzwischen deaktiviertes
     Semester bleibt trotzdem stehen, siehe semesterOptions unten. */
  const semesters = useQuery(masterDataQueries.semesters(true))
  /* Die untergeordneten Listen laufen erst, wenn ihre uebergeordnete Wahl
     steht: ungefiltert kaemen alle Studiengaenge der Hochschule, und die
     Auswahl waere unbrauchbar lang. */
  const studyPrograms = useQuery({
    ...masterDataQueries.studyPrograms(facultyId ?? undefined),
    enabled: facultyId !== null,
  })
  const modules = useQuery({
    ...masterDataQueries.modules(studyProgramId ?? undefined),
    enabled: studyProgramId !== null,
  })

  const referenceOptions = (
    entries: { id: string; name: string }[] | undefined
  ): FilterOption[] =>
    (entries ?? []).map((entry) => ({ value: entry.id, label: entry.name }))

  /*
   * Ein deaktiviertes Semester bleibt am Projekt stehen und wird weiter
   * angezeigt (§3.18); die Auswahl bietet es nur nicht mehr an. Ohne diese
   * Ergaenzung stuende das Feld nach dem Laden leer da, und das erste
   * Speichern loeschte die Angabe still.
   */
  const semesterOptions = useMemo(() => {
    const options = referenceOptions(semesters.data)
    const saved = project.semester
    if (
      saved !== null &&
      !options.some((option) => option.value === saved.id)
    ) {
      return [...options, { value: saved.id, label: saved.name }]
    }
    return options
  }, [semesters.data, project.semester])

  const enumOptions = (
    values: readonly string[],
    prefix: string
  ): FilterOption[] =>
    values.map((value) => ({ value, label: t(`${prefix}.${value}`) }))

  /**
   * Warum die Redaktionszuweisung nicht aenderbar ist, oder
   * {@code undefined}, wenn sie es ist.
   *
   * <p>Gespiegelt wird {@code ProjectPermissionService.mayAssignEditors},
   * und zwar vollstaendig: ADMIN darf immer, die Rolle EDITOR nie, sonst
   * nur die Autor:in und nur im {@code DRAFT} (§5 Fussnote 3, §3.13.1).
   * Die beiden mittleren Faelle fehlten zunaechst, und das war kein
   * Schoenheitsfehler: ein Projektmitglied und eine Autor:in mit der Rolle
   * EDITOR haetten ein bedienbares Feld vorgefunden, dessen Aenderung den
   * <em>gesamten</em> PUT mit 403 verwirft, also auch Titel, Tags und
   * Mitglieder (Befund des contract-pruefers).
   *
   * <p>Die Oberflaeche ersetzt die Serverpruefung damit nicht, sie nimmt
   * ihr nur die Ueberraschung.
   */
  const editorsReadOnlyReason: string | undefined = (() => {
    if (role === "ADMIN") {
      return undefined
    }
    if (role === "EDITOR") {
      return t("project.metadata.editors.lockedForEditorRole")
    }
    if (user !== null && user.id !== project.author.id) {
      return t("project.metadata.editors.lockedForMembers")
    }
    return project.status === "DRAFT"
      ? undefined
      : t("project.metadata.editors.lockedAfterDraft")
  })()

  const messageOf = (
    error: { message?: string; type?: string } | undefined
  ): string | undefined => {
    if (error?.message === undefined) {
      return undefined
    }
    return error.type === "server" ? error.message : t(error.message)
  }

  /* Bruecke zwischen applyValidationErrors (kennt nur Feldnamen als String)
     und der typisierten setError-Signatur von react-hook-form. */
  const setServerFieldError = (
    name: string,
    fieldError: { type: "server"; message: string }
  ) => {
    /* editorIds heisst im Request so, im Formular aber editors. Der
       Serverfehler gehoert trotzdem an dieses Feld. */
    const field = name === "editorIds" ? "editors" : name
    form.setError(field as Parameters<typeof form.setError>[0], fieldError)
  }

  /**
   * Kennzeichnung "erforderlich zum Einreichen" (§3.3): Symbol und Text,
   * nicht Farbe allein (SC 1.4.1). Der sichtbare Stern erklaert sich ueber
   * die Legende am Abschnitt, der Text ueber den zugaenglichen Namen des
   * Feldes.
   */
  const requiredForSubmit = (
    <span className="ml-0.5">
      {/* Ein Sternzeichen statt eines Symbols: es erbt Farbe und Groesse der
          Beschriftung und sitzt eng daran, statt als eigenes Icon daneben zu
          stehen. */}
      <span aria-hidden="true">*</span>
      {/* Das Leerzeichen ist kein Schoenheitsfehler: JSX wirft die
          Zeilenumbrueche weg, und ohne es liefe der zugaengliche Name
          zusammen (Befund des frontend-reviewers). */}
      <span className="sr-only">
        {" "}
        {t("project.metadata.requiredForSubmit.marker")}
      </span>
    </span>
  )

  /**
   * Pflichtkennzeichnung der Mitgliederfelder. Gleiches Zeichen wie oben,
   * anderer Grund: hier geht es nicht um das Einreichen, sondern darum, dass
   * ohne beide Angaben kein Eintrag entsteht (§3.13).
   */
  const memberRequired = (
    <span className="ml-0.5">
      <span aria-hidden="true">*</span>
      <span className="sr-only"> {t("project.metadata.members.required")}</span>
    </span>
  )

  const submit = form.handleSubmit(async (values) => {
    form.clearErrors("root.server")
    try {
      await onSubmit(toProjectUpdateRequest(project, values))
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      if (error.errorCode === "PROJECT_VERSION_CONFLICT") {
        /* Durchgereicht: nur die aufrufende Stelle kann neu laden, und sie
           zeigt dafuer VersionConflictDialog. Eine zweite Darstellung
           desselben Problems am Formular waere Rauschen. */
        return
      }
      if (error.errorCode === "VALIDATION_FAILED") {
        applyValidationErrors(
          error,
          PROJECT_METADATA_FIELDS,
          setServerFieldError
        )
        return
      }
      form.setError("root.server", {
        type: "server",
        message: t(apiErrorMessageKey(error), { defaultValue: error.message }),
      })
    }
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-8">
      <div className="grid gap-8 lg:grid-cols-[3fr_4fr]">
        {/*
         * Linke Spalte: die Vorschau, also das, was Aussenstehende von
         * diesem Projekt in Listen und auf Karten sehen werden.
         *
         * Sie bleibt beim Scrollen stehen, damit Titelbild, Titel und
         * Kurzbeschreibung sichtbar sind, waehrend rechts die Klassifikation
         * gefuellt wird. self-start ist dabei Bedingung: ein Grid-Element
         * fuellt sonst die volle Zeilenhoehe, und sticky haette nichts, an
         * dem es kleben koennte. Erst ab lg, denn schmal stehen die Spalten
         * untereinander und eine klebende Flaeche verdeckte den Rest.
         */}
        <section
          aria-labelledby="project-metadata-preview"
          className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start"
        >
          <Heading
            id="project-metadata-preview"
            className="type-h3 font-semibold text-primary"
          >
            {t("project.metadata.preview.heading")}
          </Heading>

          <Controller
            name="coverImageUrl"
            control={form.control}
            render={({ field }) => (
              <CoverImageField
                value={field.value}
                onChange={field.onChange}
                uploading={uploading}
                disabled={disabled}
                onUpload={async (file) => {
                  setUploading(true)
                  try {
                    return await onUploadCoverImage(file)
                  } finally {
                    setUploading(false)
                  }
                }}
              />
            )}
          />

          <Controller
            name="title"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1.5">
                {/*
                 * Die Beschriftung bleibt fuer Screenreader stehen, sichtbar
                 * traegt sie der Platzhalter: die Spalte ist eine Vorschau
                 * und soll aussehen wie die Kachel, nicht wie ein Formular
                 * (Vorgabe zu KAN-35). Ein Feld ohne verbundenes Label waere
                 * trotzdem ein Befund (SC 3.3.2), deshalb sr-only statt gar
                 * nicht.
                 */}
                <FieldLabel htmlFor={field.name} className="sr-only">
                  {t("project.metadata.title.label")}
                </FieldLabel>
                {/* Gross, fett und ohne Rahmen, nur mit einer Unterlinie:
                    der Platzhalter traegt dieselbe Groesse und dasselbe
                    Gewicht wie der spaetere Titel. */}
                <Input
                  {...field}
                  id={field.name}
                  disabled={disabled}
                  className="type-h3 h-auto rounded-none border-0 border-b bg-transparent px-0 py-1 font-semibold shadow-none focus-visible:border-ring focus-visible:ring-0 dark:bg-transparent"
                  placeholder={t("project.metadata.title.placeholder")}
                  aria-invalid={fieldState.invalid}
                  aria-describedby="project-metadata-title-counter"
                />
                <CharacterCounter
                  id="project-metadata-title-counter"
                  value={field.value}
                  max={TITLE_MAX_LENGTH}
                />
                {fieldState.invalid && (
                  <FieldError
                    errors={[{ message: messageOf(fieldState.error) }]}
                  />
                )}
              </Field>
            )}
          />

          <Controller
            name="summary"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1.5">
                <FieldLabel htmlFor={field.name} className="sr-only">
                  {t("project.metadata.summary.label")}
                </FieldLabel>
                <Textarea
                  {...field}
                  id={field.name}
                  rows={3}
                  disabled={disabled}
                  className="resize-none rounded-none border-0 border-b bg-transparent px-0 py-1 shadow-none focus-visible:border-ring focus-visible:ring-0 dark:bg-transparent"
                  placeholder={t("project.metadata.summary.placeholder")}
                  aria-invalid={fieldState.invalid}
                  aria-describedby="project-metadata-summary-counter project-metadata-preview-hint"
                />
                <CharacterCounter
                  id="project-metadata-summary-counter"
                  value={field.value}
                  max={SUMMARY_MAX_LENGTH}
                />
                {fieldState.invalid && (
                  <FieldError
                    errors={[{ message: messageOf(fieldState.error) }]}
                  />
                )}
              </Field>
            )}
          />

          <FieldDescription id="project-metadata-preview-hint">
            {t("project.metadata.preview.hint")}
          </FieldDescription>
        </section>

        <div className="flex flex-col gap-8">
          {/*
           * Ohne Abschnittsueberschrift: die Beschriftung ueber jedem Feld
           * sagt bereits, worum es geht, und eine Ueberschrift daruber
           * wiederholte das nur (Rueckmeldung zu KAN-35). Die Gliederung
           * traegt der Abstand, nicht ein zweiter Text.
           */}
          <div className="flex flex-col gap-4">
            {/* Die Legende zum Stern bleibt: ohne sie traegt das Symbol
                allein die Information, und das genuegt SC 1.4.1 nicht. */}
            <FieldDescription>
              {t("project.metadata.requiredForSubmit.legend")}
            </FieldDescription>

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                name="facultyId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <FilterSelect
                    id={field.name}
                    label={t("project.metadata.faculty.label")}
                    labelSuffix={requiredForSubmit}
                    allLabel={t("project.metadata.select.empty")}
                    options={referenceOptions(faculties.data)}
                    value={field.value}
                    disabled={disabled}
                    error={messageOf(fieldState.error)}
                    onValueChange={(next) => {
                      field.onChange(next)
                      /* Die untergeordneten Wahlen passen nicht mehr: ein
                         Studiengang gehoert zu genau einer Fakultaet, ein
                         Modul zu genau einem Studiengang. Stehen bleiben
                         hiesse, eine unmoegliche Kombination zu speichern. */
                      if (
                        form.getValues("studyProgramId") !== null ||
                        form.getValues("moduleId") !== null
                      ) {
                        form.setValue("studyProgramId", null, {
                          shouldDirty: true,
                        })
                        form.setValue("moduleId", null, { shouldDirty: true })
                        setCascadeNotice(
                          t("project.metadata.cascade.facultyChanged")
                        )
                      }
                    }}
                  />
                )}
              />

              <Controller
                name="studyProgramId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <FilterSelect
                    id={field.name}
                    label={t("project.metadata.studyProgram.label")}
                    labelSuffix={requiredForSubmit}
                    allLabel={
                      facultyId === null
                        ? t("project.metadata.studyProgram.needsFaculty")
                        : t("project.metadata.select.empty")
                    }
                    options={referenceOptions(studyPrograms.data)}
                    value={field.value}
                    disabled={disabled || facultyId === null}
                    error={messageOf(fieldState.error)}
                    onValueChange={(next) => {
                      field.onChange(next)
                      if (form.getValues("moduleId") !== null) {
                        form.setValue("moduleId", null, { shouldDirty: true })
                        setCascadeNotice(
                          t("project.metadata.cascade.studyProgramChanged")
                        )
                      }
                    }}
                  />
                )}
              />

              <Controller
                name="degree"
                control={form.control}
                render={({ field, fieldState }) => (
                  <FilterSelect
                    id={field.name}
                    label={t("project.metadata.degree.label")}
                    labelSuffix={requiredForSubmit}
                    allLabel={t("project.metadata.select.empty")}
                    options={enumOptions(FILTER_DEGREES, "project.degree")}
                    value={field.value}
                    disabled={disabled}
                    error={messageOf(fieldState.error)}
                    onValueChange={(next) => {
                      field.onChange(next)
                      /* Die Kaskadenmeldung gilt der letzten Aenderung; eine
                         andere Auswahl macht sie gegenstandslos. */
                      setCascadeNotice("")
                    }}
                  />
                )}
              />

              <Controller
                name="semesterId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <FilterSelect
                    id={field.name}
                    label={t("project.metadata.semester.label")}
                    labelSuffix={requiredForSubmit}
                    allLabel={t("project.metadata.select.empty")}
                    options={semesterOptions}
                    value={field.value}
                    disabled={disabled}
                    error={messageOf(fieldState.error)}
                    onValueChange={(next) => {
                      field.onChange(next)
                      /* Die Kaskadenmeldung gilt der letzten Aenderung; eine
                         andere Auswahl macht sie gegenstandslos. */
                      setCascadeNotice("")
                    }}
                  />
                )}
              />

              <Controller
                name="projectType"
                control={form.control}
                render={({ field, fieldState }) => (
                  <FilterSelect
                    id={field.name}
                    label={t("project.metadata.projectType.label")}
                    labelSuffix={requiredForSubmit}
                    allLabel={t("project.metadata.select.empty")}
                    options={enumOptions(FILTER_PROJECT_TYPES, "project.type")}
                    value={field.value}
                    disabled={disabled}
                    error={messageOf(fieldState.error)}
                    onValueChange={(next) => {
                      field.onChange(next)
                      /* Die Kaskadenmeldung gilt der letzten Aenderung; eine
                         andere Auswahl macht sie gegenstandslos. */
                      setCascadeNotice("")
                    }}
                  />
                )}
              />

              <Controller
                name="categoryId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <FilterSelect
                    id={field.name}
                    label={t("project.metadata.category.label")}
                    labelSuffix={requiredForSubmit}
                    allLabel={t("project.metadata.select.empty")}
                    options={referenceOptions(categories.data)}
                    value={field.value}
                    disabled={disabled}
                    error={messageOf(fieldState.error)}
                    onValueChange={(next) => {
                      field.onChange(next)
                      /* Die Kaskadenmeldung gilt der letzten Aenderung; eine
                         andere Auswahl macht sie gegenstandslos. */
                      setCascadeNotice("")
                    }}
                  />
                )}
              />

              <Controller
                name="moduleId"
                control={form.control}
                render={({ field, fieldState }) => (
                  /* Ohne Stern: §3.3 fuehrt das Modul als dauerhaft
                     freiwilligen Bezug, es steht nicht unter den
                     Pflichtfeldern des Einreichens. */
                  <FilterSelect
                    id={field.name}
                    label={t("project.metadata.module.label")}
                    allLabel={
                      studyProgramId === null
                        ? t("project.metadata.module.needsStudyProgram")
                        : t("project.metadata.select.empty")
                    }
                    options={referenceOptions(modules.data)}
                    value={field.value}
                    disabled={disabled || studyProgramId === null}
                    error={messageOf(fieldState.error)}
                    onValueChange={(next) => {
                      field.onChange(next)
                      /* Die Kaskadenmeldung gilt der letzten Aenderung; eine
                         andere Auswahl macht sie gegenstandslos. */
                      setCascadeNotice("")
                    }}
                  />
                )}
              />
            </div>

            {/* Die Kaskade meldet sich, statt die Auswahl still zu leeren
                (SC 3.2.2). Sichtbar und angesagt: wer das Feld nicht im
                Blick hat, bemerkt es sonst erst beim Speichern. */}
            <p
              aria-live="polite"
              className="type-body-sm text-muted-foreground"
            >
              {cascadeNotice}
            </p>
          </div>

          {/* Die Obergrenze steht in der TagCombobox selbst; ein zweiter
              Hinweis darueber sagte dasselbe zweimal. */}
          <div className="flex flex-col gap-3">
            <Controller
              name="tags"
              control={form.control}
              render={({ field }) => (
                <TagCombobox
                  value={field.value}
                  onChange={field.onChange}
                  disabled={disabled}
                />
              )}
            />
          </div>

          <div className="flex flex-col gap-3">
            <Controller
              name="editors"
              control={form.control}
              render={({ field, fieldState }) => (
                <>
                  <ProjectEditorsField
                    value={field.value}
                    onChange={field.onChange}
                    currentUserId={user?.id}
                    disabled={disabled}
                    labelSuffix={requiredForSubmit}
                    readOnlyReason={editorsReadOnlyReason}
                  />
                  {fieldState.invalid && (
                    <FieldError
                      errors={[{ message: messageOf(fieldState.error) }]}
                    />
                  )}
                </>
              )}
            />
          </div>

          <div className="flex flex-col gap-3">
            <Controller
              name="members"
              control={form.control}
              render={({ field, fieldState }) => (
                <>
                  <ProjectMembersField
                    value={field.value}
                    onChange={field.onChange}
                    authorId={project.author.id}
                    disabled={disabled}
                    labelSuffix={memberRequired}
                  />
                  {/* Ein Schemafehler an einem Array-Pfad traegt keine eigene
                      message; ohne diese Zeile bliebe das Speichern
                      wirkungslos und stumm, etwa bei einem Altdatensatz mit
                      leerer Funktionsbezeichnung (Befund des
                      frontend-reviewers). */}
                  {fieldState.invalid && (
                    <FieldError>
                      {messageOf(fieldState.error) ??
                        t("project.metadata.members.invalid")}
                    </FieldError>
                  )}
                </>
              )}
            />
          </div>

          {disabled && (
            <Alert>
              <AlertTitle>
                {t("project.metadata.readOnly", {
                  status: t(`project.status.${project.status}`),
                })}
              </AlertTitle>
            </Alert>
          )}

          {/*
           * Auffangmeldung: haengt das Absenden an einem Schemafehler, der
           * an keinem Feld erscheint, saehe die Person einen Knopf, der
           * nichts tut (SC 3.3.1).
           */}
          {form.formState.submitCount > 0 &&
            !form.formState.isValid &&
            form.formState.errors.root?.server === undefined && (
              <Alert variant="destructive">
                <AlertTitle>{t("project.metadata.invalid")}</AlertTitle>
              </Alert>
            )}

          {form.formState.errors.root?.server && (
            <Alert variant="destructive">
              <AlertTitle>
                {form.formState.errors.root.server.message}
              </AlertTitle>
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <Button
              type="submit"
              disabled={disabled || form.formState.isSubmitting || uploading}
            >
              {form.formState.isSubmitting
                ? t("project.metadata.submitPending")
                : t("project.metadata.submit")}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t("common.action.cancel")}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
