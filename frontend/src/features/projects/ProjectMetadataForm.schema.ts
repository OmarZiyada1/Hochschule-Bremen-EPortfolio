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

/**
 * Die Kurzbeschreibung reicht bis an die Servergrenze, also 1024 Zeichen
 * ({@code ProjectCreateRequest}, DB-Spalte {@code length = 1024}).
 *
 * <p><strong>Sie stand einmal auf 200</strong>, nach dem Zaehler im
 * Template. Die Zahl war eine Gestaltungsregel und keine fachliche Grenze:
 * was auf einer Kachel umbricht, ist unlesbar. Genau das loest die Kachel
 * aber selbst, sie kuerzt mit {@code line-clamp-3}
 * ({@code components/common/ProjectCard.tsx}). Was blieb, war eine Huerde
 * beim Schreiben: bis KAN-104 stand die Kurzbeschreibung im Editor als
 * Abstract ueber dem Beitrag und war dort Fliesstext, kein Kachel-Teaser.
 * Seitdem wird sie allein im Metadatenformular eingetragen; an der Zahl
 * aendert das nichts.
 *
 * <p>Client und Server sagen damit dasselbe. Eine engere Zahl im Client
 * waere eine zweite Wahrheit ueber dasselbe Feld, und sie schlaege genau
 * bei einer gespeicherten langen Kurzbeschreibung zu, etwa aus der Zeit,
 * als sie im Editor entstand: auf der Metadatenseite liesse sie sich dann
 * nicht mehr speichern.
 */
export const SUMMARY_MAX_LENGTH = 1024

/**
 * Freie Funktionsbezeichnung, 255 Zeichen: die Servergrenze und keine
 * engere Gestaltungsregel daneben. Sie gilt fuer beide Felder, die eine
 * solche Bezeichnung tragen, {@code MemberRequest.projectRole} (§3.13) und
 * {@code ProjectUpdateRequest.authorRole} (§3.3), und beide fuehren dort
 * {@code @Size(max = 255)}.
 *
 * <p>Die Zahl steht auch am Eingabefeld der Mitgliederzeile
 * ({@code ProjectMembersField}) als natives {@code maxLength}: dort ist sie
 * keine zweite Pruefung neben dem Schema, sondern verhindert einen Zustand,
 * der sich nachtraeglich nicht mehr berichtigen liesse.
 */
export const PROJECT_ROLE_MAX_LENGTH = 255

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
 * <p><strong>Die Bezeichnung ist seit Contract v65 freiwillig.</strong> Sie
 * kann spaeter eingetragen werden und ist keine Huerde beim Anlegen; die
 * Autor:in, die seit derselben Version als Zeile in dieser Liste steht,
 * traegt anfangs gar keine. Leerraum gilt als keine Angabe und wird zu
 * einer leeren Zeichenkette getrimmt; der Server macht daraus {@code null}.
 */
const memberValueSchema = personValueSchema.extend({
  projectRole: z
    .string()
    .trim()
    .max(PROJECT_ROLE_MAX_LENGTH, "validation.projectRole.tooLong"),
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
  /* Funktionsbezeichnung der Autor:in (§3.3 seit Contract v66), freiwillig.
     Sie ist keine Mitgliedszeile: die Autor:in bleibt Autor:in (§3.13.1). */
  authorRole: z
    .string()
    .trim()
    .max(PROJECT_ROLE_MAX_LENGTH, "validation.projectRole.tooLong"),
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
    authorRole: project.authorRole ?? "",
    members: project.members.map((member) => ({
      id: member.userId,
      firstName: member.firstName,
      lastName: member.lastName,
      /* Die Antwort kennt null fuer "keine Bezeichnung", das Formular nicht:
         memberValueSchema fuehrt projectRole als z.string(). */
      projectRole: member.projectRole ?? "",
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
    authorRole:
      values.authorRole.trim() === "" ? undefined : values.authorRole.trim(),
    editorIds: values.editors.map((editor) => editor.id),
    members: values.members.map((member): MemberRequest => ({
      userId: member.id,
      /* Ohne ?? "": memberValueSchema fuehrt projectRole als z.string(),
           hier kann kein null ankommen. Leer heisst "keine Bezeichnung",
           der Server macht daraus null. */
      projectRole: member.projectRole,
    })),
  }
}

/**
 * Der Ausschnitt, den die Kopfpartie des Editors bearbeitet: Titelbild und
 * Titel (KAN-36).
 *
 * <p><strong>Abgeleitet und nicht danebengeschrieben.</strong> Es gibt
 * genau ein Metadaten-Schema im Repository; ein zweites mit eigenen
 * Laengengrenzen liefe beim naechsten Nachtrag auseinander, und dann
 * beanstandete der Editor einen Titel, den das Formular durchliess. Was
 * hier fehlt, ist nicht erlaubt-und-ungeprueft, sondern schlicht nicht
 * Gegenstand dieser Flaeche: die uebrigen Angaben stehen auf der
 * Metadatenseite.
 *
 * <p><strong>Ohne Kurzbeschreibung</strong> (KAN-104, Entscheidung). Sie
 * wird im Editor nicht mehr bearbeitet, sondern allein im
 * Metadatenformular, und gehoert deshalb auch nicht in diesen Ausschnitt.
 * Zwei Gruende sprechen dagegen, sie trotzdem im Formular des Editors
 * mitzufuehren:
 *
 * <ul>
 *   <li><strong>Sie koennte die Pruefung verletzen, ohne dass sie hier
 *       jemand korrigieren kann.</strong> Ueber die API entsteht das nicht:
 *       der Server prueft {@code summary} mit {@code @Size(max = 1024)}
 *       ({@code ProjectUpdateRequest}) und zaehlt dabei wie JavaScript
 *       UTF-16-Einheiten ({@code String.length()}). Die Spalte ist aber
 *       {@code varchar(1024)} und zaehlt Zeichen; per SQL geschrieben, etwa
 *       von den Seeder-Skripten im Wurzelverzeichnis, passt dort eine
 *       Kurzbeschreibung mit Emoji, die laenger als
 *       {@link SUMMARY_MAX_LENGTH} Einheiten ist. Stuende sie im Formular
 *       des Editors, zeigte er einen Hinweis auf ein Feld, das es dort nicht
 *       gibt. Mehr leistet das Weglassen nicht: den Speichertakt haelt ein
 *       solcher Datensatz trotzdem auf, denn die Karte traegt die
 *       Kurzbeschreibung unveraendert mit, und der Server weist jeden PUT
 *       mit 400 {@code VALIDATION_FAILED} ab. Das erscheint als Fehlschlag
 *       des Takts ueber dem Beitrag ({@code EditorPage}); kuerzen laesst
 *       sich die Kurzbeschreibung im Metadatenformular, dort beanstandet
 *       das Schema sie am Feld.</li>
 *   <li><strong>Sie koennte veralten.</strong> Ein Formular haelt seinen
 *       Stand, solange darin getippt wurde; kaeme waehrenddessen eine andere
 *       Kurzbeschreibung vom Server, schriebe der naechste Takt die alte
 *       zurueck. {@link toProjectIntroUpdateRequest} nimmt sie deshalb aus
 *       dem Projekt, gegen das geschrieben wird.</li>
 * </ul>
 */
export const projectIntroSchema = projectMetadataSchema.pick({
  title: true,
  coverImageUrl: true,
})

export type ProjectIntroValues = z.infer<typeof projectIntroSchema>

/** Fuellt die Kopfpartie aus dem zuletzt bekannten Projektstand. */
export function toProjectIntroValues(
  project: ProjectDetailResponse
): ProjectIntroValues {
  const values = toProjectMetadataValues(project)
  return {
    title: values.title,
    coverImageUrl: values.coverImageUrl,
  }
}

/**
 * Baut aus dem Projektstand und den beiden Feldern der Kopfpartie die
 * vollstaendige Metadatenkarte fuer {@code PUT /api/projects/{id}},
 * <strong>ohne</strong> {@code version}.
 *
 * <p><strong>Die ganze Karte, nicht die beiden Felder.</strong>
 * {@code ProjectUpdateRequest} hat ersetzende Semantik (siehe
 * {@link toProjectUpdateRequest}): ein PUT mit nur Titel und Titelbild
 * loeschte Kurzbeschreibung, Fakultaet, Studiengang, Abschluss, Kategorie,
 * Semester, Typ und Modul. Der Editor schreibt deshalb dieselbe Karte wie
 * das Formular und tauscht darin nur aus, was er bearbeitet.
 *
 * <p><strong>Die Kurzbeschreibung kommt aus {@code project}</strong>
 * (KAN-104). Sie steht in der Karte, weil ein fehlendes Feld sie loeschte,
 * und zwar genau so, wie der Server sie zuletzt bestaetigt hat: im Editor
 * aendert sie niemand, und ein PUT darf sie weder leeren noch mit einem
 * aelteren Wert ueberschreiben (siehe {@link projectIntroSchema}).
 *
 * <p><strong>Ohne version, und das mit Absicht.</strong> Im Editor
 * schreiben zwei Wege gegen dasselbe Projekt, der Inhalt ueber
 * {@code PUT /projects/{id}/blocks} und die Kopfpartie hierueber, und
 * beide erhoehen dieselbe {@code Project.version} (§6.4;
 * {@code BlockService.replace} ruft {@code project.touch()}). Die Version
 * gehoert deshalb dem Speichertakt, der beide Wege nacheinander fuehrt,
 * und nicht dem zuletzt gelesenen Projekt: das waere hier regelmaessig
 * einen Schritt zurueck und ergaebe einen 409 gegen die eigene vorige
 * Speicherung.
 *
 * <p><strong>Eine unsichtbare Redaktionszuweisung bleibt unberuehrt.</strong>
 * {@code editors} ist {@code null}, wenn die anfragende Person die
 * Zuweisung nicht sehen darf (§3.3). Eine leere Liste wuerde sie loeschen,
 * {@code null} laesst sie unveraendert (§6.1); nur was sichtbar ist, wird
 * geschrieben.
 */
export function toProjectIntroUpdateRequest(
  project: ProjectDetailResponse,
  intro: ProjectIntroValues
): Omit<ProjectUpdateRequest, "version"> {
  const card: Omit<ProjectUpdateRequest, "version"> & { version?: number } = {
    ...toProjectUpdateRequest(project, {
      ...toProjectMetadataValues(project),
      ...intro,
    }),
  }
  /* Weggenommen und nicht ausgelassen: so faellt eine kuenftig neue Angabe
     der Karte hier nicht still unter den Tisch. */
  delete card.version
  return {
    ...card,
    editorIds: project.editors == null ? null : card.editorIds,
  }
}
