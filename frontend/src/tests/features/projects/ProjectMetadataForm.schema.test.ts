import { describe, expect, it } from "vitest"

import {
  projectMetadataSchema,
  toProjectIntroUpdateRequest,
  toProjectIntroValues,
  toProjectMetadataValues,
  toProjectUpdateRequest,
  type ProjectMetadataValues,
} from "@/features/projects/ProjectMetadataForm.schema"
import { projectDetail, reference } from "@/tests/fixtures"

/*
 * Das Schema und die beiden Body-Bauer sind reine Funktionen und werden
 * ohne Rendern geprueft: genau dafuer liegen sie neben der Komponente und
 * nicht in ihr (Skill frontend-modul, Abschnitt 3).
 */

/** Ein vollstaendig ausgefuelltes Projekt, wie es kurz vor dem Einreichen steht. */
function fullProject() {
  return projectDetail({
    id: "p-42",
    title: "Campus-Garten",
    summary: "Ein Beet auf dem Dach.",
    coverImageUrl: "/api/files/cover-1",
    status: "DRAFT",
    projectType: "REGULAR",
    degree: "BACHELOR",
    faculty: reference({ id: "f-4", name: "Fakultät 4" }),
    studyProgram: reference({ id: "sp-1", name: "Informatik" }),
    module: reference({ id: "m-1", name: "Softwaretechnik" }),
    category: reference({ id: "c-1", name: "Forschung" }),
    semester: reference({ id: "s-1", name: "WiSe 2026/27" }),
    tags: ["Garten", "Nachhaltigkeit"],
    editors: [
      { id: "e-1", firstName: "Rana", lastName: "Adler", avatarUrl: null },
    ],
    members: [
      {
        userId: "u-9",
        avatarUrl: null,
        firstName: "Jonas",
        lastName: "Berg",
        projectRole: "Frontend",
      },
    ],
    version: 7,
  })
}

describe("toProjectMetadataValues", () => {
  it("uebernimmt jeden Bezug als ID und jede fehlende Angabe als null", () => {
    const values = toProjectMetadataValues(fullProject())

    expect(values).toMatchObject({
      title: "Campus-Garten",
      summary: "Ein Beet auf dem Dach.",
      coverImageUrl: "/api/files/cover-1",
      projectType: "REGULAR",
      degree: "BACHELOR",
      facultyId: "f-4",
      studyProgramId: "sp-1",
      moduleId: "m-1",
      categoryId: "c-1",
      semesterId: "s-1",
      tags: ["Garten", "Nachhaltigkeit"],
    })
    expect(values.editors).toEqual([
      { id: "e-1", firstName: "Rana", lastName: "Adler" },
    ])
    expect(values.members).toEqual([
      {
        id: "u-9",
        firstName: "Jonas",
        lastName: "Berg",
        projectRole: "Frontend",
      },
    ])
  })

  it("macht aus fehlenden Texten leere Felder, nicht aus null ein 'null'", () => {
    const values = toProjectMetadataValues(
      projectDetail({ summary: null, coverImageUrl: null })
    )

    expect(values.summary).toBe("")
    expect(values.coverImageUrl).toBe("")
  })

  it("behandelt eine nicht sichtbare Redaktion wie eine leere (§3.3)", () => {
    /* editors ist null, wenn die anfragende Person die Zuweisung nicht
       sehen darf. Das Formular kann nur zeigen, was es kennt. */
    const values = toProjectMetadataValues(projectDetail({ editors: null }))

    expect(values.editors).toEqual([])
  })
})

describe("toProjectUpdateRequest", () => {
  it("traegt die vollstaendige Metadatenkarte samt version", () => {
    const project = fullProject()
    const request = toProjectUpdateRequest(
      project,
      toProjectMetadataValues(project)
    )

    expect(request).toEqual({
      version: 7,
      title: "Campus-Garten",
      summary: "Ein Beet auf dem Dach.",
      coverImageUrl: "/api/files/cover-1",
      projectType: "REGULAR",
      degree: "BACHELOR",
      facultyId: "f-4",
      studyProgramId: "sp-1",
      moduleId: "m-1",
      categoryId: "c-1",
      semesterId: "s-1",
      tags: ["Garten", "Nachhaltigkeit"],
      editorIds: ["e-1"],
      members: [{ userId: "u-9", projectRole: "Frontend" }],
    })
  })

  it("setzt bei einer reinen Titelaenderung kein Klassifikationsfeld auf null", () => {
    const project = fullProject()
    const values: ProjectMetadataValues = {
      ...toProjectMetadataValues(project),
      title: "Campus-Garten, zweite Auflage",
    }

    const request = toProjectUpdateRequest(project, values)

    /*
     * Der eigentliche Fallstrick dieses Endpoints: ProjectUpdateRequest hat
     * ersetzende Semantik, ein fehlendes Einzelfeld loescht den Wert. Ein
     * PUT mit nur version und title raeumte die halbe Metadatenkarte ab.
     */
    expect(request.title).toBe("Campus-Garten, zweite Auflage")
    for (const field of [
      "facultyId",
      "studyProgramId",
      "moduleId",
      "categoryId",
      "semesterId",
      "projectType",
      "degree",
      "summary",
      "coverImageUrl",
    ] as const) {
      expect(request[field], field).not.toBeNull()
    }
    expect(request.version).toBe(7)
  })

  it("uebersetzt geleerte Textfelder nach null, damit der Wert wirklich weggeht", () => {
    const project = fullProject()
    const request = toProjectUpdateRequest(project, {
      ...toProjectMetadataValues(project),
      summary: "",
      coverImageUrl: "",
    })

    /* Ein leerer String waere ein Wert und stuende danach als Teaser auf
       jeder Kachel; null ist der einzige Ausdruck fuer "weg" (§6.1). */
    expect(request.summary).toBeNull()
    expect(request.coverImageUrl).toBeNull()
  })

  it("leert Listen ueber [] und nicht ueber null", () => {
    const project = fullProject()
    const request = toProjectUpdateRequest(project, {
      ...toProjectMetadataValues(project),
      tags: [],
      editors: [],
      members: [],
    })

    /* Bei diesen dreien ist es umgekehrt: null hiesse "unveraendert
       lassen", und die Liste liesse sich nie mehr leeren (§6.1). */
    expect(request.tags).toEqual([])
    expect(request.editorIds).toEqual([])
    expect(request.members).toEqual([])
  })
})

describe("projectMetadataSchema", () => {
  const values = (overrides: Partial<ProjectMetadataValues> = {}) => ({
    ...toProjectMetadataValues(projectDetail({ title: "Ein Titel" })),
    ...overrides,
  })

  it("beanstandet einen leeren Titel", () => {
    const result = projectMetadataSchema.safeParse(values({ title: "   " }))

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe("validation.title.required")
  })

  it("beanstandet einen Titel ueber 100 Zeichen", () => {
    const result = projectMetadataSchema.safeParse(
      values({ title: "x".repeat(101) })
    )

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe("validation.title.tooLong")
  })

  /*
   * Die Grenze ist die des Servers (1024 Zeichen, @Size an
   * ProjectCreateRequest), nicht mehr die 200 aus dem Template. Die 200
   * waren eine Gestaltungsregel fuer die Kachel, und die kuerzt selbst
   * (line-clamp-3); im Editor steht dasselbe Feld als Abstract und ist
   * dort Fliesstext.
   */
  it("laesst eine lange Kurzbeschreibung durch und beanstandet erst ueber 1024 Zeichen", () => {
    expect(
      projectMetadataSchema.safeParse(values({ summary: "x".repeat(600) }))
        .success
    ).toBe(true)

    const result = projectMetadataSchema.safeParse(
      values({ summary: "x".repeat(1025) })
    )

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe("validation.summary.tooLong")
  })

  it("laesst einen Entwurf ohne Klassifikation und ohne Redaktion durch", () => {
    /*
     * Die Pflicht dieser Felder gilt dem Einreichen, nicht dem Speichern
     * (§3.3). Ein Schema, das sie hier verlangte, machte den Entwurf als
     * Arbeitszustand unbrauchbar.
     */
    const result = projectMetadataSchema.safeParse(
      values({
        facultyId: null,
        studyProgramId: null,
        moduleId: null,
        categoryId: null,
        semesterId: null,
        projectType: null,
        degree: null,
        editors: [],
      })
    )

    expect(result.success).toBe(true)
  })

  it("laesst den sechsten Tag nicht durch (§3.3)", () => {
    const result = projectMetadataSchema.safeParse(
      values({ tags: ["a", "b", "c", "d", "e", "f"] })
    )

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe("validation.tags.tooMany")
  })

  it("beanstandet einen Contract-Enum-Wert, den es nicht gibt", () => {
    const result = projectMetadataSchema.safeParse(
      values({
        projectType: "DIPLOMARBEIT" as ProjectMetadataValues["projectType"],
      })
    )

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      "validation.projectType.unknown"
    )
  })
})

/*
 * Der Ausschnitt, den die Kopfpartie des Editors bearbeitet (KAN-36).
 * Zwei Feinheiten verhindern hier Datenverlust und sind deshalb
 * ausdruecklich abgesichert.
 */
describe("Kopfpartie des Editors", () => {
  it("liest genau die drei Felder aus dem Projekt", () => {
    expect(toProjectIntroValues(fullProject())).toEqual({
      title: "Campus-Garten",
      summary: "Ein Beet auf dem Dach.",
      coverImageUrl: "/api/files/cover-1",
    })
  })

  /*
   * Der Body traegt die ganze Metadatenkarte: ProjectUpdateRequest hat
   * ersetzende Semantik, ein PUT mit nur dem Titel loeschte Fakultaet,
   * Studiengang, Abschluss, Kategorie, Semester, Typ und Modul (§3.3).
   */
  it("traegt die ganze Karte und tauscht nur die drei Felder aus", () => {
    const project = fullProject()
    const card = toProjectIntroUpdateRequest(project, {
      title: "Anderer Titel",
      summary: "",
      coverImageUrl: "",
    })

    expect(card.title).toBe("Anderer Titel")
    /* Leer heisst loeschen, und dafuer steht null. */
    expect(card.summary).toBeNull()
    expect(card.coverImageUrl).toBeNull()
    /* Und alles Uebrige bleibt unangetastet. */
    expect(card.facultyId).toBe("f-4")
    expect(card.studyProgramId).toBe("sp-1")
    expect(card.moduleId).toBe("m-1")
    expect(card.categoryId).toBe("c-1")
    expect(card.projectType).toBe("REGULAR")
    expect(card.degree).toBe("BACHELOR")
  })

  /*
   * Die Version gehoert dem Speichertakt und nicht dem zuletzt gelesenen
   * Projekt: im Editor schreiben zwei Wege gegen dieselbe Project.version
   * (§6.4), und der Cache-Stand waere nach einem reinen Blockspeichern
   * einen Schritt zurueck.
   */
  it("laesst die version ausdruecklich weg", () => {
    const card = toProjectIntroUpdateRequest(
      fullProject(),
      toProjectIntroValues(fullProject())
    )

    expect("version" in card).toBe(false)
  })

  /*
   * editors ist null, wenn die anfragende Person die Zuweisung nicht sehen
   * darf (§3.3). Eine leere Liste wuerde sie loeschen, null laesst sie
   * unveraendert (§6.1).
   */
  it("laesst eine unsichtbare Redaktionszuweisung unveraendert", () => {
    const project = fullProject()
    project.editors = null

    const card = toProjectIntroUpdateRequest(
      project,
      toProjectIntroValues(project)
    )

    expect(card.editorIds).toBeNull()
  })

  it("schreibt eine sichtbare Redaktionszuweisung mit", () => {
    const project = fullProject()

    const card = toProjectIntroUpdateRequest(
      project,
      toProjectIntroValues(project)
    )

    expect(card.editorIds).toEqual((project.editors ?? []).map((e) => e.id))
  })
})
