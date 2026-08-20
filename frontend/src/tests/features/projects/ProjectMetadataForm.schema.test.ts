import { describe, expect, it } from "vitest"

import {
  projectMetadataSchema,
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

  it("beanstandet eine Kurzbeschreibung ueber 200 Zeichen", () => {
    const result = projectMetadataSchema.safeParse(
      values({ summary: "x".repeat(201) })
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
