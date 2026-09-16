import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { useAuth } from "@/api/auth/AuthContext"
import { applyValidationErrors, isApiError } from "@/api/errors"
import { masterDataQueries } from "@/api/queries/masterData"
import type { ProjectDetailResponse, ProjectUpdateRequest } from "@/api/types"
import { useApiErrorMessage } from "@/api/useApiErrorMessage"
import { CharacterCounter } from "@/components/common/CharacterCounter"
import { InfoHint } from "@/components/common/InfoHint"
import { ErrorState } from "@/components/common/ErrorState"
import {
  FilterSelect,
  type FilterOption,
} from "@/components/common/FilterSelect"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CoverImageField } from "@/features/projects/components/CoverImageField"
import {
  MetadataStep,
  MetadataStepper,
} from "@/features/projects/components/MetadataStepper"
import { ProjectEditorsField } from "@/features/projects/components/ProjectEditorsField"
import { ProjectMembersField } from "@/features/projects/components/ProjectMembersField"
import {
  METADATA_STEPS,
  firstFlaggedFieldOf,
  firstStepWith,
  type MetadataStepId,
} from "@/features/projects/metadataSteps"
import { isProjectSide } from "@/features/projects/projectPermissions"
import {
  REQUIRED_FOR_SUBMIT,
  type RequiredSubmitField,
} from "@/features/project-content/submitRequirements"
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

/*
 * Feste IDs der beiden Feldfehler, die zu einer Combobox gehoeren. Die
 * Meldung steht als Geschwister neben dem Feld und nicht darin; ohne
 * aria-describedby waere sie zwar als Live-Region einmal zu hoeren, beim
 * Zuruecknavigieren zum Feld aber nicht mehr auffindbar (SC 3.3.1). Fest
 * statt ueber useId, weil das Formular je Seite genau einmal steht.
 */
const EDITORS_ERROR_ID = "project-metadata-editors-error"
const MEMBERS_ERROR_ID = "project-metadata-members-error"

/**
 * Der Feldname des Formulars zu dem, den der Server nennt.
 *
 * <p>{@code editorIds} heisst im Request so, im Formular aber
 * {@code editors}; alle uebrigen Namen sind gleich. Gebraucht wird die
 * Abbildung an zwei Stellen: fuer den Feldfehler aus 400
 * {@code VALIDATION_FAILED} und fuer die Zuordnung einer fehlenden
 * Pflichtangabe (§3.3) zu ihrem Schritt.
 */
const toFormField = (name: string) => (name === "editorIds" ? "editors" : name)

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
/** Welche der beiden Absendeschaltflaechen geklickt wurde. */
export type SubmitIntent = "primary" | "secondary"

export function ProjectMetadataForm({
  project,
  onSubmit,
  onCancel,
  onDirtyChange,
  onUploadCoverImage,
  disabled = false,
  headingLevel = 2,
  highlightMissingForSubmit = false,
  submitLabel,
  submitPendingLabel,
  secondarySubmit,
}: {
  /** Zuletzt bekannter Stand; Ausgangswerte und Quelle der {@code version}. */
  project: ProjectDetailResponse
  /**
   * Schreibt den Body. Wirft einen {@code ApiError}; ein 409
   * {@code PROJECT_VERSION_CONFLICT} wird von dieser Komponente bewusst
   * nicht abgefangen.
   */
  onSubmit: (
    request: ProjectUpdateRequest,
    intent: SubmitIntent
  ) => Promise<ProjectDetailResponse>
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
  /**
   * Sollen die zum Einreichen fehlenden Pflichtangaben (§3.3) im Kopf der
   * Schritte erscheinen, bevor ueberhaupt abgesendet wurde?
   *
   * <p>Gesetzt auf dem Einreichweg {@code ?submit=1}, sonst nicht. Dort
   * sind sie keine Beanstandung, sondern der Grund des Besuchs: die Seite
   * zaehlt sie ohnehin ueber dem Formular auf, und ohne die Markierung
   * nennte sie Felder, die in zugeklappten Schritten stehen. Beim
   * gewoehnlichen Bearbeiten waere dieselbe Markierung eine Ruege fuer
   * etwas, das niemand vorhat: gespeichert wird auch ohne diese Angaben.
   */
  highlightMissingForSubmit?: boolean
  /**
   * Beschriftung der Absendeschaltflaeche. Ohne Angabe „Speichern".
   *
   * <p>Der Editor oeffnet dasselbe Formular auf dem Weg ins Einreichen
   * (KAN-36); dort speichert die Schaltflaeche nicht nur, sie reicht
   * anschliessend ein, und „Speichern" waere an dieser Stelle eine falsche
   * Zusage. Die Beschriftung ist das Einzige, was sich unterscheidet:
   * Felder, Pruefung und Schreibweg sind dieselben.
   */
  submitLabel?: string
  /** Beschriftung waehrend des Absendens; ohne Angabe „Wird gespeichert". */
  submitPendingLabel?: string
  /**
   * Eine zweite Absendeschaltflaeche neben der ersten, mit derselben
   * Pruefung und demselben Schreibweg, aber anderem Ziel.
   *
   * <p><strong>Warum zwei und nicht eine mit Auswahl.</strong> Auf dem Weg
   * ins Einreichen gibt es genau zwei sinnvolle Enden: nur speichern und
   * zurueck in den Editor, oder speichern und einreichen. Beide sind
   * Absenden desselben Formulars; welches gemeint ist, sagt die
   * angeklickte Schaltflaeche und nicht ein Schalter daneben, den man
   * uebersieht. {@link ProjectMetadataFormProps.onSubmit} bekommt es als
   * zweites Argument.
   */
  secondarySubmit?: { label: string; pendingLabel?: string }
}) {
  const { t } = useTranslation()
  const apiMessage = useApiErrorMessage()
  /* Die Rolle kommt aus dem Kontext und nicht aus dem Token (§6.5); der
     Server liest sie bei jedem Request neu aus der Datenbank. */
  const { user } = useAuth()

  /*
   * Zwei Sperren, nicht eine (§6.1, Zeile PUT /projects/{id}: „Autor:in und
   * Mitglieder, in DRAFT und REVISION"; ProjectPermissionService
   * .mayEditMetadata). Die Frage nach der Zugehoerigkeit beantwortet
   * features/projects/projectPermissions und nicht diese Datei: sie steht im
   * Frontend an genau einer Stelle, wie im Backend auch.
   *
   * Der Status allein genuegt nicht, und das war eine echte Luecke: eine
   * zugewiesene Redaktion darf ein Projekt in REVISION lesen (§5, Fussnote
   * 11) und bekam deshalb hier ein voll beschreibbares Formular, dessen
   * Speichern der Server mit 403 NO_PERMISSION beantwortete. Sichtbar wurde
   * daraus „Dafuer fehlt Ihnen die Berechtigung", und zwar erst nach dem
   * Ausfuellen. Der Editor traegt denselben Riegel seit KAN-86
   * (EditorPage.mayEditMetadata); hier fehlte er.
   *
   * Ein Admin faellt ebenfalls darunter, und das ist richtig: die
   * Endpoint-Zeile aus §6.1 nennt ihn nicht, sein PUT endet genauso mit 403.
   *
   * Die Oberflaeche ersetzt die Serverpruefung nicht, sie nimmt ihr die
   * Ueberraschung.
   */
  const projectSide = isProjectSide(project, user?.id)
  const locked = disabled || !projectSide
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

  /*
   * Wohin der Fokus nach dem Aufklappen springt. Ein Objekt und nicht bloss
   * der Feldname: derselbe Fehler zweimal hintereinander soll den Fokus
   * erneut setzen, und ein unveraenderter String loeste den Effekt nicht
   * noch einmal aus.
   */
  const [focusTarget, setFocusTarget] = useState<{
    field: string
    attempt: number
  } | null>(null)

  /*
   * Erst rendern, dann fokussieren: der Bereich eines zugeklappten
   * Schrittes steht nicht im DOM (Base UI haengt ihn aus, statt ihn zu
   * verstecken). Der Effekt laeuft nach dem Commit, das Feld ist dann da.
   */
  useEffect(() => {
    if (focusTarget === null) {
      return
    }
    document.getElementById(focusTarget.field)?.focus()
  }, [focusTarget])

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

  /* Die Mitgliederliste wird mitgelesen, weil sie die Vorschlagsliste der
     Redaktion einschraenkt: Projektseite und Redaktion schliessen einander
     aus (§5 Fussnote 3). Gelesen wird der Formularstand und nicht der
     gespeicherte, sonst bekaeme eine gerade eingetragene Person erst nach dem
     Speichern ihre Sperre. */
  const members = useWatch({ control: form.control, name: "members" })
  const memberIds = useMemo(() => members.map((member) => member.id), [members])

  /* Die Gegenrichtung derselben Regel: die zugewiesene Redaktion gehoert
     nicht in die Mitgliedersuche. Der Server weist beide Richtungen ab. */
  const editors = useWatch({ control: form.control, name: "editors" })
  const editorIds = useMemo(() => editors.map((editor) => editor.id), [editors])

  /*
   * Die uebrigen vier Pflichtangaben des Einreichens (§3.3). Zusammen mit
   * facultyId, studyProgramId und editors weiter oben sind es die sieben
   * aus REQUIRED_FOR_SUBMIT.
   */
  const degree = useWatch({ control: form.control, name: "degree" })
  const semesterId = useWatch({ control: form.control, name: "semesterId" })
  const projectType = useWatch({ control: form.control, name: "projectType" })
  const categoryId = useWatch({ control: form.control, name: "categoryId" })

  /**
   * Welche der sieben Pflichtangaben im Formular noch leer sind.
   *
   * <p><strong>Gerechnet aus dem Formularstand, nicht aus der
   * Serverantwort.</strong> Das ist der Unterschied, auf den es hier
   * ankommt. 400 {@code PROJECT_INCOMPLETE} entsteht nur auf dem
   * Einreichweg {@code ?submit=1}, und dort ruft die Seite den Uebergang
   * erst nach einem erfolgreichen {@code PUT} auf. Der erhoeht die
   * {@code version}, und weil die Seite das Formular an
   * {@code key={id-version}} haengt (Ruecksetzen nach 409, §6.4), ist
   * diese Instanz beim Eintreffen der Fehlerantwort bereits ersetzt. Alles,
   * was der Fehlerzweig in den State schriebe, traefe eine weggeworfene
   * Komponente: keine Markierung, kein aufgeklappter Schritt.
   *
   * <p>Abgeleitete Werte ueberstehen den Neuaufbau dagegen von selbst, denn
   * das neu gebaute Formular rechnet sie aus den frisch geladenen
   * Ausgangswerten neu. Nebenbei loest das ein zweites Problem: eine
   * gemerkte Liste bliebe stehen, nachdem das Feld gefuellt wurde, und
   * markierte einen Schritt, an dem nichts mehr fehlt.
   */
  const missingForSubmitInForm = useMemo(() => {
    /* Dieselbe Reihenfolge und dieselben Namen wie REQUIRED_FOR_SUBMIT, nur
       aus dem Formular gelesen statt aus der Detailantwort. Ueber die Liste
       zu laufen statt sie abzuschreiben ist Absicht: kommt im Contract eine
       Pflichtangabe dazu, faellt sie hier als Typfehler auf. */
    const present: Record<RequiredSubmitField, boolean> = {
      projectType: projectType !== null,
      facultyId: facultyId !== null,
      studyProgramId: studyProgramId !== null,
      degree: degree !== null,
      categoryId: categoryId !== null,
      semesterId: semesterId !== null,
      editorIds: editors.length > 0,
    }
    return REQUIRED_FOR_SUBMIT.filter((field) => !present[field])
  }, [
    editors,
    facultyId,
    studyProgramId,
    degree,
    semesterId,
    projectType,
    categoryId,
  ])

  /*
   * Der offene Schritt. Genau einer, nie keiner. Der Zustand liegt hier und
   * nicht im Stepper, weil ein fehlgeschlagenes Absenden ihn setzen muss.
   *
   * Beim Oeffnen der Seite ist es der erste Schritt. Auf dem Einreichweg
   * dagegen der oberste, an dem noch etwas fehlt: dort steht ueber dem
   * Formular bereits der Hinweis, welche Angaben das sind, und Schritt 1
   * aufzuklappen, obwohl die Luecke in Schritt 3 sitzt, waere die falsche
   * Antwort darauf. Nur der offene Bereich wechselt, der Fokus bleibt, wo
   * er ist: ihn beim Seitenaufbau umzusetzen waere ein unerwarteter
   * Wechsel (SC 3.2.1).
   */
  const [openStep, setOpenStep] = useState<MetadataStepId>(
    () =>
      (highlightMissingForSubmit
        ? firstStepWith(missingForSubmitInForm.map(toFormField))?.id
        : undefined) ?? METADATA_STEPS[0].id
  )

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
   * Die Module eines Studiengangs, das Sammelmodul am Ende (§3.9, seit
   * Contract v84, KAN-83). Der Server sortiert nach Name und macht dabei
   * keine Ausnahme; das waere auch die falsche Stelle, denn seine Zusage
   * lautet „nach Name sortiert" und soll keine stille Ausnahme bekommen.
   * Ans Ende gehoert es trotzdem: es ist die Auffangoption fuer den Fall,
   * dass kein Fachmodul passt, und stuende mitten in der Liste wie ein
   * Fachmodul da.
   */
  const moduleOptions = useMemo(() => {
    const entries = modules.data ?? []
    const specific = entries.filter((entry) => !entry.collective)
    const collective = entries.filter((entry) => entry.collective)
    return referenceOptions([...specific, ...collective])
  }, [modules.data])

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
   * <p>Gespiegelt wird der Teil von
   * {@code ProjectPermissionService.mayAssignEditors}, der ueber dieses
   * Formular ueberhaupt erreichbar ist: die Projektseite, und nur in
   * {@code DRAFT} und {@code REVISION} (§5 Fussnote 3, §3.13.1).
   *
   * <p><strong>Der ADMIN-Zweig ist mit der Nacharbeit entfallen.</strong> Er
   * gab dem Feld frei, was {@code mayAssignEditors} einem Admin zugesteht,
   * und war schon vorher wirkungslos, seit das ganze Formular fuer alle
   * ausserhalb der Projektseite schreibgeschuetzt steht ({@code locked}
   * weiter oben, §6.1 Zeile {@code PUT /projects/{id}}): der Aufruf endete
   * ohnehin mit 403. Ein Admin verteilt fremde Zustaendigkeiten ueber
   * {@code PUT /projects/{id}/editors}, in der Administrationsseite
   * ({@code EditorAssignmentDialog}), und nicht hier.
   *
   * <p><strong>Projektmitglieder duerfen seit Contract v85 mit</strong>
   * (KAN-86). Bis v84 stand hier ein eigener Zweig fuer sie, der das Feld
   * schreibgeschuetzt zeigte, weil §3.13.1 ihnen {@code editorIds} in jedem
   * Status verwehrte. Mit dem geoeffneten Einreichen waere daraus eine
   * Sackgasse geworden: {@code editorIds} ist Pflichtfeld des Einreichens
   * (§3.3), ein Mitglied bekaeme also 400 {@code PROJECT_INCOMPLETE} und
   * koennte die Redaktion nicht nachtragen. Wer nicht zur Projektseite
   * gehoert, sieht dieses Formular ohnehin nicht: der Server gibt einen
   * Entwurf nicht heraus (§5).
   *
   * <p><strong>Die eigene Systemrolle sperrt nicht mehr</strong> (§5
   * Fussnote 3 in der Fassung von Contract v60, KAN-77). Bis dahin stand hier
   * ein Zweig fuer die Rolle EDITOR, weil der Server die Zuweisung auch am
   * eigenen Entwurf abwies. Damit war ein Projekt, dessen Autor:in selbst
   * Redakteur:in ist, unzustellbar: die Zuweisung war ihr verwehrt, und ohne
   * sie greift seit v59 das Pflichtfeld aus §3.3. Jetzt weist auch sie ihrem
   * eigenen Entwurf die Redaktion zu; nur sich selbst kann sie nicht
   * eintragen, und darum kuemmert sich die Vorschlagsliste des Feldes.
   *
   * <p>Die Oberflaeche ersetzt die Serverpruefung damit nicht, sie nimmt
   * ihr nur die Ueberraschung.
   */
  const editorsReadOnlyReason: string | undefined =
    /* Seit Contract v62 dieselbe Schranke wie jede andere
       Metadatenaenderung: die beiden Arbeitszustaende des Projekts (§4.1).
       Bis v61 endete das Recht mit dem DRAFT, und ein zurueckgegebenes
       Projekt ohne Redaktion hing an der Administration fest. */
    project.status === "DRAFT" || project.status === "REVISION"
      ? undefined
      : t("project.metadata.editors.lockedAfterSubmit")

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
    form.setError(
      toFormField(name) as Parameters<typeof form.setError>[0],
      fieldError
    )
  }

  /**
   * Kennzeichnung "erforderlich zum Einreichen" (§3.3): Symbol und Text,
   * nicht Farbe allein (SC 1.4.1). Der sichtbare Stern erklaert sich ueber
   * das „i" ueber den Schritten, der Text ueber den zugaenglichen Namen des
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
   * Klappt den obersten Schritt auf, der eines der beanstandeten Felder
   * enthaelt, und setzt den Fokus in dessen erstes beanstandetes Feld.
   *
   * <p><strong>Genau einer, nicht alle.</strong> Die Einzel-Offen-Regel
   * gilt auch im Fehlerfall; die uebrigen betroffenen Schritte tragen
   * stattdessen die Markierung im Kopf, sonst verschwaenden ihre Fehler
   * hinter einem zugeklappten Kopf.
   *
   * <p>Schlaegt das Absenden an einem Feld der linken Spalte fehl (Titel,
   * Kurzbeschreibung, Titelbild), passiert hier nichts: diese Felder stehen
   * immer sichtbar da und gehoeren zu keinem Schritt.
   */
  const revealStepFor = (flagged: readonly string[]) => {
    const step = firstStepWith(flagged)
    if (step === undefined) {
      return
    }
    setOpenStep(step.id)
    const field = firstFlaggedFieldOf(step, flagged)
    if (field !== undefined) {
      setFocusTarget((previous) => ({
        field,
        attempt: (previous?.attempt ?? 0) + 1,
      }))
    }
  }

  /**
   * Traegt der Schritt ein beanstandetes Feld?
   *
   * <p>Zwei Quellen, weil es zwei Arten von Beanstandung gibt: Feldfehler
   * aus Schema und 400 {@code VALIDATION_FAILED} stehen in
   * {@code formState.errors}; die zum Einreichen fehlenden Pflichtangaben
   * sind keine Fehler und stehen deshalb nicht dort, sondern werden aus dem
   * Formularstand gerechnet ({@code missingForSubmitInForm}).
   *
   * <p>Gelesen wird {@code formState.errors} im Rendern, und das ist
   * Absicht: der Proxy von react-hook-form meldet die Komponente damit auf
   * Fehleraenderungen an, sonst bliebe die Markierung im Kopf stehen.
   */
  const fieldErrors = form.formState.errors
  const flaggedForSubmit = highlightMissingForSubmit
    ? missingForSubmitInForm.map(toFormField)
    : []
  const stepIsFlagged = (fields: readonly string[]) =>
    fields.some(
      (field) =>
        fieldErrors[field as keyof ProjectMetadataValues] !== undefined ||
        flaggedForSubmit.includes(field)
    )

  /*
   * Welche Schaltflaeche das Absenden ausgeloest hat, steht im Ereignis:
   * {@code SubmitEvent.submitter} nennt genau sie, und ihr {@code value}
   * traegt die Absicht. Das ist der Weg, den HTML dafuer vorsieht, und er
   * kommt ohne einen Ref aus, der beim Rendern gelesen wuerde.
   *
   * <p>Der State daneben traegt nur die Beschriftung waehrend des
   * Absendens, denn die entsteht im Rendern und nicht im Ereignis.
   */
  const [pendingIntent, setPendingIntent] = useState<SubmitIntent>("primary")

  const submit = form.handleSubmit(
    async (values, event) => {
      const submitter = (event?.nativeEvent as SubmitEvent | undefined)
        ?.submitter
      const intent: SubmitIntent =
        submitter instanceof HTMLButtonElement &&
        submitter.value === "secondary"
          ? "secondary"
          : "primary"
      form.clearErrors("root.server")
      try {
        await onSubmit(toProjectUpdateRequest(project, values), intent)
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
        if (error.errorCode === "CHANGE_REQUESTS_OPEN") {
          /* Aus demselben Grund durchgereicht (KAN-37): die offenen
           Aenderungswuensche stehen im Editor, und nur die Seite kann den
           Weg dorthin anbieten. Ein zweiter Text am Formular saehe aus wie
           ein zweiter Fehler. */
          return
        }
        if (error.errorCode === "VALIDATION_FAILED") {
          /* Mitgeschrieben, welche Felder es getroffen hat: der Stepper muss
           gleich wissen, welchen Schritt er aufzuklappen hat, und
           form.formState.errors ist an dieser Stelle noch nicht gelesen. */
          const flagged: string[] = []
          applyValidationErrors(
            error,
            PROJECT_METADATA_FIELDS,
            (name, fieldError) => {
              setServerFieldError(name, fieldError)
              flagged.push(toFormField(name))
            }
          )
          revealStepFor(flagged)
          return
        }
        /*
         * PROJECT_INCOMPLETE nennt die fehlenden Angaben beim Namen.
         *
         * <p>Der Server schickt sie in seiner Meldung mit, aber als
         * Feldnamen; die uebersetzte Fassung sagte dafuer nur „das Projekt
         * ist noch unvollstaendig", was niemanden weiterbringt, der genau
         * wissen will, was fehlt. Gerechnet wird deshalb hier, und zwar
         * aus dem Formularstand (§3.3).
         *
         * <p><strong>Auf der Route ist dieser Zweig eine Rueckfallebene.</strong>
         * Dort ist die Instanz beim Eintreffen der Antwort bereits ersetzt
         * (siehe {@code missingForSubmitInForm}), die Meldung erscheint
         * also nicht; sichtbar bleibt der Hinweis, den die Seite selbst
         * ueber das Formular setzt. Stehen bleibt der Zweig fuer eine
         * aufrufende Stelle ohne diesen Neuaufbau: ohne ihn fiele die
         * Antwort in den allgemeinen Zweig darunter und saegte nur „das
         * Projekt ist noch unvollstaendig".
         */
        if (error.errorCode === "PROJECT_INCOMPLETE") {
          /* Gerechnet aus dem Formularstand und nicht aus project: der
             gerade gelaufene PUT hat dessen Angaben bereits geschrieben, die
             Detailantwort in der Hand dieser Instanz ist also aelter als
             das, was auf dem Bildschirm steht. */
          form.setError("root.server", {
            type: "server",
            message:
              missingForSubmitInForm.length === 0
                ? apiMessage(error)
                : t("project.metadata.incomplete", {
                    fields: missingForSubmitInForm
                      .map((entry) => t(`projectContent.submit.field.${entry}`))
                      .join(", "),
                  }),
          })
          /*
           * Hier wird bewusst kein Schritt aufgeklappt und nichts markiert:
           * diese Instanz ist in diesem Moment bereits ersetzt (siehe
           * missingForSubmitInForm). Beides erledigt das neu gebaute
           * Formular, und zwar aus dem Formularstand.
           */
          return
        }
        form.setError("root.server", {
          type: "server",
          message: apiMessage(error),
        })
      }
    },
    /*
     * Der zweite Zweig von handleSubmit laeuft, wenn das Schema schon vor
     * dem Request beanstandet. Ohne ihn bliebe das Absenden auf einem
     * zugeklappten Schritt scheinbar wirkungslos: der Fehler stuende an
     * einem Feld, das niemand sieht.
     */
    (errors) => {
      revealStepFor(Object.keys(errors))
    }
  )

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
          <div className="flex items-center gap-1">
            <Heading
              id="project-metadata-preview"
              className="type-h3 font-semibold text-primary"
            >
              {t("project.metadata.preview.heading")}
            </Heading>
            {/* Wofuer diese Spalte da ist, steht hinter dem „i". Als Satz
                unter den Feldern stand es zuletzt und wurde dort am
                wenigsten gelesen. Die ID bleibt: das Feld fuer die
                Kurzbeschreibung verweist darauf. */}
            <InfoHint
              label={t("project.metadata.preview.hintLabel")}
              text={t("project.metadata.preview.hint")}
              descriptionId="project-metadata-preview-hint"
            />
          </div>

          <Controller
            name="coverImageUrl"
            control={form.control}
            render={({ field }) => (
              <CoverImageField
                value={field.value}
                onChange={field.onChange}
                uploading={uploading}
                disabled={locked}
                /* Wie im Editor: die Bedienung liegt als Icon-Leiste oben
                   rechts auf dem Titelbild und nicht als Verweiszeile
                   darunter. Das Seitenverhaeltnis bleibt bei 7:4. */
                controlPlacement="overlay"
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
                  disabled={locked}
                  className="type-h3 h-auto rounded-none border-0 border-b bg-transparent px-0 py-1 font-semibold shadow-none focus-visible:border-ring focus-visible:ring-0 dark:bg-transparent"
                  placeholder={t("project.metadata.title.placeholder")}
                  aria-invalid={fieldState.invalid}
                  aria-describedby="project-metadata-title-counter"
                />
                <CharacterCounter
                  id="project-metadata-title-counter"
                  value={field.value}
                  max={TITLE_MAX_LENGTH}
                  quiet
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
                  disabled={locked}
                  className="resize-none rounded-none border-0 border-b bg-transparent px-0 py-1 shadow-none focus-visible:border-ring focus-visible:ring-0 dark:bg-transparent"
                  placeholder={t("project.metadata.summary.placeholder")}
                  aria-invalid={fieldState.invalid}
                  aria-describedby="project-metadata-summary-counter project-metadata-preview-hint"
                />
                <CharacterCounter
                  id="project-metadata-summary-counter"
                  value={field.value}
                  max={SUMMARY_MAX_LENGTH}
                  quiet
                />
                {fieldState.invalid && (
                  <FieldError
                    errors={[{ message: messageOf(fieldState.error) }]}
                  />
                )}
              </Field>
            )}
          />
        </section>

        <div className="flex flex-col gap-6">
          {/*
           * Drei Schritte statt elf Eingaben am Stueck (KAN-103). Sie
           * benennen, was zusammengehoert; die Reihenfolge und die
           * Zuordnung der Felder stehen in {@code metadataSteps} und nicht
           * hier, weil das Aufklappen im Fehlerfall dieselbe Zuordnung
           * braucht.
           *
           * Abschnittsueberschriften entstehen dabei keine: die Koepfe der
           * Schritte sind Schaltflaechen, und die {@code h1} der Route
           * bleibt die einzige Ueberschrift oberhalb der Felder.
           */}
          {/* Was der Stern bedeutet und dass nichts davon jetzt schon sein
              muss: hinter einem „i" und nicht als zwei Zeilen ueber den
              Schritten. Der Satz gilt fuer alle drei, steht also weder an
              einem einzelnen noch dreimal. */}
          <div className="flex items-center justify-end gap-0.5">
            {/* Der Stern daneben ist der sichtbare Bezug: allein stuende
                dort ein graues Symbol, dessen Anlass in den Feldern
                darunter steht, zwei davon in zugeklappten Schritten
                (Befund des frontend-reviewers). Nur fuer das Auge, den
                Namen traegt der Knopf. */}
            <span
              aria-hidden="true"
              className="type-body-sm text-muted-foreground"
            >
              *
            </span>
            <InfoHint
              label={t("project.metadata.steps.hintLabel")}
              text={t("project.metadata.steps.hint")}
            />
          </div>

          <MetadataStepper value={openStep} onValueChange={setOpenStep}>
            <MetadataStep
              value="editorial"
              number={1}
              title={t("project.metadata.steps.editorial.title")}
              flagged={stepIsFlagged(METADATA_STEPS[0].fields)}
              open={openStep === "editorial"}
            >
              <div className="flex flex-col gap-3">
                <Controller
                  name="editors"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <>
                      <ProjectEditorsField
                        value={field.value}
                        onChange={field.onChange}
                        id={field.name}
                        currentUserId={user?.id}
                        authorId={project.author.id}
                        memberIds={memberIds}
                        disabled={locked}
                        invalid={fieldState.invalid}
                        describedBy={
                          fieldState.invalid ? EDITORS_ERROR_ID : undefined
                        }
                        labelSuffix={requiredForSubmit}
                        readOnlyReason={editorsReadOnlyReason}
                      />
                      {fieldState.invalid && (
                        <FieldError
                          id={EDITORS_ERROR_ID}
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
                        id={field.name}
                        authorId={project.author.id}
                        editorIds={editorIds}
                        disabled={locked}
                        invalid={fieldState.invalid}
                        describedBy={
                          fieldState.invalid ? MEMBERS_ERROR_ID : undefined
                        }
                      />
                      {/* Ein Schemafehler an einem Array-Pfad traegt keine eigene
                        message; ohne diese Zeile bliebe das Speichern
                        wirkungslos und stumm, etwa bei einem Altdatensatz mit
                        leerer Funktionsbezeichnung (Befund des
                        frontend-reviewers). */}
                      {fieldState.invalid && (
                        <FieldError id={MEMBERS_ERROR_ID}>
                          {messageOf(fieldState.error) ??
                            t("project.metadata.members.invalid")}
                        </FieldError>
                      )}
                    </>
                  )}
                />
              </div>

              {/*
               * Die eigene Rolle der Autor:in, am Ende von Schritt 1. Sie
               * ist kein Mitglied (§3.13.1), traegt aber seit Contract v66
               * eine eigene Bezeichnung am Projekt (§3.3). Freiwillig, sie
               * kann spaeter eingetragen werden.
               *
               * <p><strong>Unten und nicht oben.</strong> Zwischen
               * Redaktion und Mitgliederliste trennte sie zwei Dinge, die
               * zusammengehoeren, und ihre Beschriftung stand unmittelbar
               * ueber einem zweiten Feld namens "Rolle". Am Ende gelesen
               * ergibt die Reihenfolge einen Satz: wer betreut, wer
               * mitgewirkt hat, und was man selbst beigetragen hat.
               *
               * <p>Beschriftung und Feld, sonst nichts. Hier standen einmal
               * eine Ueberschrift, ein Erklaerabsatz und eine Beschreibung
               * unter dem Feld; drei Saetze fuer ein freiwilliges Textfeld
               * sind mehr Text, als die Sache hergibt.
               */}
              <Controller
                name="authorRole"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="gap-2">
                    <FieldLabel
                      htmlFor={field.name}
                      className="type-label-xs text-muted-foreground uppercase"
                    >
                      {t("project.metadata.authorRole.label")}
                    </FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      /* Dieselbe Hoehe wie jedes andere Feld des
                         Formulars. Die Primitive steht auf h-8,
                         Auswahlfelder und Personensuche auf h-11; ohne
                         diese Zeile sass das Feld sichtbar niedriger als
                         seine Nachbarn. */
                      className="h-11"
                      disabled={locked}
                      placeholder={t("project.metadata.authorRole.placeholder")}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError
                        errors={[{ message: messageOf(fieldState.error) }]}
                      />
                    )}
                  </Field>
                )}
              />
            </MetadataStep>

            <MetadataStep
              value="classification"
              number={2}
              title={t("project.metadata.steps.classification.title")}
              flagged={stepIsFlagged(METADATA_STEPS[1].fields)}
              open={openStep === "classification"}
            >
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
                      disabled={locked}
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
                      disabled={locked || facultyId === null}
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
                      disabled={locked}
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
                      disabled={locked}
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
                      options={moduleOptions}
                      value={field.value}
                      disabled={locked || studyProgramId === null}
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
            </MetadataStep>

            <MetadataStep
              value="topics"
              number={3}
              title={t("project.metadata.steps.topics.title")}
              flagged={stepIsFlagged(METADATA_STEPS[2].fields)}
              open={openStep === "topics"}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                  name="projectType"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <FilterSelect
                      id={field.name}
                      label={t("project.metadata.projectType.label")}
                      labelSuffix={requiredForSubmit}
                      allLabel={t("project.metadata.select.empty")}
                      options={enumOptions(
                        FILTER_PROJECT_TYPES,
                        "project.type"
                      )}
                      value={field.value}
                      disabled={locked}
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
                      disabled={locked}
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

              {/* Die Obergrenze steht in der TagCombobox selbst; ein zweiter
                  Hinweis darueber sagte dasselbe zweimal. */}
              <Controller
                name="tags"
                control={form.control}
                render={({ field }) => (
                  <TagCombobox
                    value={field.value}
                    onChange={field.onChange}
                    id={field.name}
                    disabled={locked}
                  />
                )}
              />
            </MetadataStep>
          </MetadataStepper>

          {/* Zwei Gruende, zwei Saetze. „In diesem Status nicht bearbeitbar"
              und „nicht Ihr Projekt" sind verschiedene Auskuenfte, und wer
              die falsche liest, sucht an der falschen Stelle weiter
              (SC 3.3.1). Der Status kommt zuerst: er gilt fuer alle und ist
              der haeufigere Fall. */}
          {disabled ? (
            <Alert>
              <AlertTitle>
                {t("project.metadata.readOnly", {
                  status: t(`project.status.${project.status}`),
                })}
              </AlertTitle>
            </Alert>
          ) : (
            !projectSide && (
              <Alert>
                <AlertTitle>{t("project.metadata.readOnlyForeign")}</AlertTitle>
              </Alert>
            )
          )}

          {/*
           * Auffangmeldung: haengt das Absenden an einem Schemafehler, der
           * an keinem Feld erscheint, saehe die Person einen Knopf, der
           * nichts tut (SC 3.3.1).
           */}
          {form.formState.submitCount > 0 &&
            !form.formState.isValid &&
            form.formState.errors.root?.server === undefined && (
              <ErrorState message={t("project.metadata.invalid")} />
            )}

          {form.formState.errors.root?.server && (
            <ErrorState message={form.formState.errors.root.server.message} />
          )}

          <div className="flex flex-wrap items-center gap-4">
            <Button
              type="submit"
              name="intent"
              value="primary"
              onClick={() => setPendingIntent("primary")}
              disabled={locked || form.formState.isSubmitting || uploading}
            >
              {form.formState.isSubmitting && pendingIntent === "primary"
                ? (submitPendingLabel ?? t("project.metadata.submitPending"))
                : (submitLabel ?? t("project.metadata.submit"))}
            </Button>
            {secondarySubmit !== undefined && (
              <Button
                type="submit"
                name="intent"
                value="secondary"
                variant="secondary"
                onClick={() => setPendingIntent("secondary")}
                disabled={locked || form.formState.isSubmitting || uploading}
              >
                {form.formState.isSubmitting && pendingIntent === "secondary"
                  ? (secondarySubmit.pendingLabel ??
                    t("project.metadata.submitPending"))
                  : secondarySubmit.label}
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t("common.action.cancel")}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
