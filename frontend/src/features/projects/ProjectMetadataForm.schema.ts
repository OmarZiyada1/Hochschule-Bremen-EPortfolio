import { z } from "zod"

import type {
  Degree,
  MemberRequest,
  ProjectDetailResponse,
  ProjectType,
  ProjectUpdateRequest,
} from "@/api/types"
import { MAX_TAGS } from "@/features/projects/components/TagCombobox"
import { isDegree, isProjectType } from "@/features/projects/projectFilters"

/**
 * Eingabepruefung des Metadatenformulars (KAN-35, Frontend-Regel 12).
 *
 * <p>Es gibt genau <strong>ein</strong> Metadaten-Schema im Repository.
 * Der Editor oeffnet dieselben Felder als Dialog (KAN-36) und benutzt
 * dieses hier; eine zweite Fassung waere eine zweite Wahrheit ueber
 * dieselben Felder.
 *
 * <p><strong>Pflicht ist hier nur der Titel.</strong> Klassifikation,
 * Redaktion und Semester sind Pflichtfelder des <em>Einreichens</em>, nicht
 * des Speicherns (§3.3): ein Entwurf ist ein Arbeitszustand, und
 * Vollstaendigkeit beim ersten Speichern zu verlangen hiesse, dass niemand
 * mit dem Schreiben anfangen kann, bevor alle Rahmendaten feststehen. Das
 * Formular kennzeichnet die Felder, es sperrt sie nicht.
 *
 * <p>zod prueft ausschliesslich Eingaben. Die Antworttypen kommen aus der
 * generierten schema.d.ts (Frontend-Regel 2); {@link toProjectUpdateRequest}
 * liest eine Serverantwort, prueft sie aber nicht nach.
 */

/**
 * Laengen aus dem Template "Projekt-Metadaten": die Zaehler stehen dort auf
 * 0/100 und 0/200.
 *
 * <p><strong>Der Server ist grosszuegiger</strong> (255 und 1024 Zeichen,
 * {@code ProjectCreateRequest}), und das ist kein Widerspruch, sondern
 * Absicht: Titel und Kurzbeschreibung erscheinen auf Kacheln und in Listen,
 * und was dort umbricht, ist unlesbar, lange bevor der Server es
 * beanstandet. Die engere Grenze ist eine Gestaltungsregel und steht
 * deshalb im Client. Umgekehrt gilt sie nicht: was der Server ablehnt,
 * lehnt auch dieses Schema ab.
 */
export const TITLE_MAX_LENGTH = 100
export const SUMMARY_MAX_LENGTH = 200

/** Bild-Allowlist fuer das Titelbild (§3.15). Verbindlich bleibt der Server. */
export const COVER_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const

/** Groessenlimit fuer das Titelbild (§3.15), zehn Mebibyte. */
export const COVER_IMAGE_MAX_BYTES = 10 * 1024 * 1024

/**
 * Ein Contract-Enum als Formularwert: entweder ein bekannter Wert oder
 * {@code null} fuer "noch nicht gesetzt" (§3.3).
 *
 * <p>Geprueft wird ueber die vorhandenen Typwaechter aus projectFilters.ts
 * statt ueber eine zweite Werteliste. Ein neuer Contract-Wert steht damit
 * an genau einer Stelle im Frontend; eine Liste hier daneben wuerde beim
 * naechsten Nachtrag vergessen.
 */
function contractEnum<V extends string>(
  isValue: (value: string) => value is V,
  messageKey: string
) {
  return z.custom<V | null>(
    (value) => value === null || (typeof value === "string" && isValue(value)),
    messageKey
  )
}

/**
 * Eine Person, wie das Formular sie fuehrt: die ID fuer den Request, der
 * Name fuer die Anzeige.
 *
 * <p><strong>Das ist kein Schema ueber einer Serverantwort.</strong> Es
 * beschreibt den Zustand des Formulars, der sich aus zwei Quellen speist,
 * dem geladenen Projekt und den Treffern der Personensuche. Der Name muss
 * darin stehen, weil die Pille sonst nach einem Reload eine ID zeigen
 * wuerde; in den Request geht er nicht mit.
 */
const personValueSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
})

export type PersonValue = z.infer<typeof personValueSchema>

/**
 * Ein Projektmitglied im Formular: Person plus freie Funktionsbezeichnung
 * (§3.13).
 *
 * <p><strong>Die Bezeichnung ist Pflicht.</strong> §3.13 fuehrt
 * {@code projectRole String not null}, und {@code MemberRequest} setzt das
 * mit {@code @NotBlank} durch. Dass die generierte schema.d.ts das Feld
 * optional zeigt, ist ein springdoc-Artefakt der Request-Schemas: KAN-76 hat
 * die Pflichtfelder nur an den Antwortschemas nachgezogen. Ohne diese
 * Pruefung liefe ein Mitglied ohne Bezeichnung in ein 400
 * {@code VALIDATION_FAILED}, dessen Feldname
 * ({@code members[0].projectRole}) sich keiner Formularzeile zuordnen
 * laesst und deshalb als anonyme Meldung am Formular landete.
 */
const memberValueSchema = personValueSchema.extend({
  projectRole: z.string().trim().min(1, "validation.projectRole.required"),
})

export type MemberValue = z.infer<typeof memberValueSchema>

export const projectMetadataSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "validation.title.required")
    .max(TITLE_MAX_LENGTH, "validation.title.tooLong"),
  summary: z.string().max(SUMMARY_MAX_LENGTH, "validation.summary.tooLong"),
  /* Referenz der Form /api/files/{id} (§3.15.1). Sie entsteht allein aus der
     Antwort des Uploads und wird nie getippt, deshalb ohne Formatpruefung.
     Leer heisst "kein Titelbild". */
  coverImageUrl: z.string(),
  projectType: contractEnum<ProjectType>(
    isProjectType,
    "validation.projectType.unknown"
  ),
  degree: contractEnum<Degree>(isDegree, "validation.degree.unknown"),
  facultyId: z.string().nullable(),
  studyProgramId: z.string().nullable(),
  moduleId: z.string().nullable(),
  categoryId: z.string().nullable(),
  semesterId: z.string().nullable(),
  /* Der sechste Tag faellt schon hier und nicht erst am Server (§3.3). Die
     TagCombobox verhindert ihn zusaetzlich in der Oberflaeche; das Schema
     ist die Zusage, die auch ein anderer Aufrufer nicht umgehen kann. */
  tags: z.array(z.string()).max(MAX_TAGS, "validation.tags.tooMany"),
  editors: z.array(personValueSchema),
  members: z.array(memberValueSchema),
})

export type ProjectMetadataValues = z.infer<typeof projectMetadataSchema>

/**
 * Die Felder in der Reihenfolge des Formulars, fuer die Zuordnung eines
 * 400 {@code VALIDATION_FAILED} (§6.2). Der Server nennt Feldfehler im
 * Format "feld: Text"; die Namen sind die des Requests, deshalb steht hier
 * {@code editorIds} und nicht {@code editors}.
 */
export const PROJECT_METADATA_FIELDS = [
  "title",
  "summary",
  "coverImageUrl",
  "projectType",
  "degree",
  "facultyId",
  "studyProgramId",
  "moduleId",
  "categoryId",
  "semesterId",
  "tags",
  "editorIds",
  "members",
] as const

/**
 * Fuellt das Formular aus dem zuletzt bekannten Projektstand.
 *
 * <p>Gegenstueck zu {@link toProjectUpdateRequest}: was dort in den Request
 * geht, kommt hier heraus. Beide zusammen sind der Grund, warum ein PUT nie
 * ein Feld verliert.
 */
export function toProjectMetadataValues(
  project: ProjectDetailResponse
): ProjectMetadataValues {
  return {
    title: project.title,
    summary: project.summary ?? "",
    coverImageUrl: project.coverImageUrl ?? "",
    projectType: project.projectType,
    degree: project.degree,
    facultyId: project.faculty?.id ?? null,
    studyProgramId: project.studyProgram?.id ?? null,
    moduleId: project.module?.id ?? null,
    categoryId: project.category?.id ?? null,
    semesterId: project.semester?.id ?? null,
    tags: project.tags,
    /* editors ist null, wenn die anfragende Person die Zuweisung nicht sehen
       darf (§3.3). Fuer das Formular ist das dasselbe wie "keine": es kann
       nur zeigen, was es kennt. Geschrieben wird die Liste ohnehin nur in
       DRAFT und REVISION, und wer dort schreibt, sieht sie auch. */
    editors: (project.editors ?? []).map((editor) => ({
      id: editor.id,
      firstName: editor.firstName,
      lastName: editor.lastName,
    })),
    members: project.members.map((member) => ({
      id: member.userId,
      firstName: member.firstName,
      lastName: member.lastName,
      projectRole: member.projectRole,
    })),
  }
}

/**
 * Baut den Body fuer {@code PUT /api/projects/{id}} aus dem zuletzt
 * bekannten Projektstand und den Formularwerten.
 *
 * <p><strong>Der Body traegt immer die ganze Metadatenkarte.</strong>
 * {@code ProjectUpdateRequest} hat ersetzende Semantik: ein Einzelfeld, das
 * fehlt oder auf {@code null} steht, wird geloescht. {@code null} ist der
 * einzige Ausdruck fuer "diesen Wert soll weg"; bedeutete es "unveraendert",
 * liesse sich ein Wert nie mehr entfernen. Ein PUT mit nur {@code version}
 * und {@code title} loeschte deshalb Fakultaet, Studiengang, Abschluss,
 * Kategorie, Semester, Typ, Modul, Kurzbeschreibung und Titelbild.
 *
 * <p>Bei {@code tags}, {@code editorIds} und {@code members} gilt das
 * Gegenteil: {@code null} laesst sie unveraendert, {@code []} leert sie.
 * Diese Funktion schickt sie trotzdem immer mit, denn das Formular fuehrt
 * ohnehin den vollstaendigen Stand. Ein unveraendert durchgereichtes
 * {@code editorIds} ist dabei unbedenklich: der Server prueft die
 * Berechtigung erst bei einer echten Aenderung
 * ({@code ProjectWriteService.applyEditors}), ein Speichern in
 * {@code REVISION} laeuft also nicht in ein 403.
 *
 * <p><strong>version kommt aus dem Projekt, nie aus dem Formular</strong>
 * (§6.4). Sie ist kein Eingabewert, sondern der Stand, gegen den geschrieben
 * wird; im Formular haette sie nichts zu suchen und koennte dort veralten.
 *
 * <p>Die Funktion ist rein: kein Request, kein Zustand, kein Zugriff auf
 * {@code api.*}. Genau deshalb laesst sie sich ohne Rendern pruefen.
 */
export function toProjectUpdateRequest(
  project: ProjectDetailResponse,
  values: ProjectMetadataValues
): ProjectUpdateRequest {
  return {
    version: project.version,
    title: values.title,
    /* Leer heisst "loeschen", und dafuer steht null. Ein leerer String waere
       ein Wert und stuende danach als Teaser auf jeder Kachel. */
    summary: values.summary === "" ? null : values.summary,
    coverImageUrl: values.coverImageUrl === "" ? null : values.coverImageUrl,
    projectType: values.projectType,
    degree: values.degree,
    facultyId: values.facultyId,
    studyProgramId: values.studyProgramId,
    moduleId: values.moduleId,
    categoryId: values.categoryId,
    semesterId: values.semesterId,
    tags: values.tags,
    editorIds: values.editors.map((editor) => editor.id),
    members: values.members.map((member): MemberRequest => ({
      userId: member.id,
      projectRole: member.projectRole,
    })),
  }
}
