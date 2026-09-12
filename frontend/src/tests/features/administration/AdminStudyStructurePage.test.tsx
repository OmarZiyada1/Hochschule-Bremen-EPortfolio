import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it } from "vitest"

import type {
  FacultyResponse,
  ModuleResponse,
  StudyProgramResponse,
} from "@/api/types"
import AdminStudyStructurePage from "@/features/administration/AdminStudyStructurePage"
import i18n from "@/i18n"
import { apiErrorResponse, currentUserHandler } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

const FK1: FacultyResponse = {
  id: "f-1",
  name: "Fakultät Architektur, Bau und Umwelt",
  abbreviation: "FK1",
}
const FK4: FacultyResponse = {
  id: "f-4",
  name: "Fakultät Elektrotechnik und Informatik",
  abbreviation: "FK4",
}
const BAU: StudyProgramResponse = {
  id: "sp-1",
  name: "Bauingenieurwesen",
  abbreviation: "BIW",
  facultyId: "f-1",
}
const MI: StudyProgramResponse = {
  id: "sp-2",
  name: "Medieninformatik",
  abbreviation: "MI",
  facultyId: "f-4",
}
const MECHANIK: ModuleResponse = {
  id: "m-1",
  name: "Technische Mechanik",
  abbreviation: "TME",
  studyProgramId: "sp-1",
  collective: false,
}

/**
 * Stammdaten je Fakultaet beziehungsweise Studiengang, wie der Server sie
 * ueber die Filter {@code faculty} und {@code studyProgram} liefert (§6.1).
 */
function baseHandlers(
  options: {
    faculties?: FacultyResponse[]
    studyPrograms?: StudyProgramResponse[]
    modules?: ModuleResponse[]
    onStudyProgramRequest?: (url: URL) => void
    onModuleRequest?: (url: URL) => void
  } = {}
) {
  const studyPrograms = options.studyPrograms ?? []
  const modules = options.modules ?? []
  return [
    currentUserHandler({ role: "ADMIN" }),
    http.get("*/api/faculties", () =>
      HttpResponse.json(options.faculties ?? [])
    ),
    http.get("*/api/study-programs", ({ request }) => {
      const url = new URL(request.url)
      options.onStudyProgramRequest?.(url)
      const faculty = url.searchParams.get("faculty")
      return HttpResponse.json(
        faculty === null
          ? studyPrograms
          : studyPrograms.filter((entry) => entry.facultyId === faculty)
      )
    }),
    http.get("*/api/modules", ({ request }) => {
      const url = new URL(request.url)
      options.onModuleRequest?.(url)
      const studyProgram = url.searchParams.get("studyProgram")
      return HttpResponse.json(
        studyProgram === null
          ? modules
          : modules.filter((entry) => entry.studyProgramId === studyProgram)
      )
    }),
  ]
}

/**
 * Die Studienstruktur (Ticket KAN-39): drei Spalten, in denen die Auswahl
 * links die Liste rechts einschraenkt, dazu das Formular aus §3.7 bis §3.9.
 */
describe("AdminStudyStructurePage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
    signInAs("ADMIN")
  })

  it("waehlt beim Betreten die erste Fakultaet und ihren ersten Studiengang", async () => {
    server.use(
      ...baseHandlers({
        faculties: [FK1, FK4],
        studyPrograms: [BAU, MI],
        modules: [MECHANIK],
      })
    )

    renderWithProviders(
      <AdminStudyStructurePage />,
      "/administration/study-structure"
    )

    /* Ohne Vorauswahl stuenden die beiden rechten Spalten leer da und die
       Seite saehe aus, als sei nichts angelegt.

       DREI WARTEZEITEN, WEIL DREI ABFRAGEN AUFEINANDER WARTEN. Die Seite
       baut die Vorauswahl in einer Kette auf, nicht in einem Zug
       (AdminStudyStructurePage.tsx): faculties antwortet, ein Effekt
       schreibt ?faculty= in die URL, erst dadurch startet
       studyPrograms(facultyId); deren Antwort setzt ?studyProgram=, und erst
       dadurch wird modules(studyProgramId) ueberhaupt eingeschaltet
       (enabled). Zwischen je zwei Behauptungen hier liegt also ein eigener
       Umlauf ueber MSW und einen weiteren Query-Zyklus. Jede Stufe braucht
       ihre eigene Wartezeit; eine kurze an der zweiten oder dritten Stelle
       waere die knappste im ganzen Ablauf, obwohl sie am weitesten hinten
       haengt.

       Zwanzig Sekunden je Stufe sind derselbe Wert, den die Editor-Tests als
       WAIT fuehren und die Routentests als LAZY_ROUTE. Die Vorgabe von einer
       Sekunde reicht im Einzellauf, im vollstaendigen nicht immer, und der
       Test war zeitweise rot, ohne dass sich am Verhalten etwas geaendert
       haette. Seit KAN-101 haelt ein roter Lauf den Merge nach main an.

       Deshalb traegt dieser Fall ein EIGENES Zeitbudget (der dritte
       Parameter von it). Drei mal zwanzig Sekunden passen nicht in die
       dreissig aus vite.config.ts; ohne das eigene Budget stuerbe der Fall
       mit "Test timed out", bevor waitFor sagen kann, was es nicht gefunden
       hat. Aufteilen liesse er sich nicht: jede Stufe setzt die vorige
       voraus. */
    await waitFor(
      () =>
        expect(screen.getByRole("button", { name: FK1.name })).toHaveAttribute(
          "aria-pressed",
          "true"
        ),
      { timeout: 20_000 }
    )
    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: "Bauingenieurwesen" })
        ).toHaveAttribute("aria-pressed", "true"),
      { timeout: 20_000 }
    )
    /* Und die Module des vorgewaehlten Studiengangs stehen daneben. Dritte
       Stufe der Kette, also ausdruecklich dieselbe Grenze und nicht die
       Vorgabe von einer Sekunde. */
    expect(
      await screen.findByText("Technische Mechanik", undefined, {
        timeout: 20_000,
      })
    ).toBeInTheDocument()
  }, 70_000)

  it("schraenkt mit der Auswahl links die Liste rechts ein", async () => {
    const requests: URL[] = []
    server.use(
      ...baseHandlers({
        faculties: [FK1, FK4],
        studyPrograms: [BAU, MI],
        onStudyProgramRequest: (url) => requests.push(url),
      })
    )

    const user = userEvent.setup()
    renderWithProviders(
      <AdminStudyStructurePage />,
      "/administration/study-structure"
    )

    await screen.findByText("Bauingenieurwesen")
    await user.click(await screen.findByRole("button", { name: FK4.name }))

    await waitFor(() =>
      expect(requests.at(-1)?.searchParams.get("faculty")).toBe("f-4")
    )
    /* Der Fakultaetswechsel raeumt die alte Studiengangsauswahl weg und die
       neue Spalte waehlt ihren ersten Eintrag. */
    expect(await screen.findByText("Medieninformatik")).toBeInTheDocument()
    expect(screen.queryByText("Bauingenieurwesen")).not.toBeInTheDocument()
  })

  it("laesst ohne Fakultaet keinen Studiengang anlegen", async () => {
    server.use(...baseHandlers({ faculties: [] }))

    renderWithProviders(
      <AdminStudyStructurePage />,
      "/administration/study-structure"
    )

    /* Ohne facultyId ergaebe der Aufruf 400: eine fehlende ID im Koerper ist
       eine unbrauchbare Anfrage (§6.3.1). */
    expect(
      await screen.findByRole("button", { name: "Studiengang hinzufügen" })
    ).toBeDisabled()
    expect(
      screen.getByText(
        i18n.t("administration.studyStructure.selectFacultyFirst")
      )
    ).toBeInTheDocument()
  })

  it("legt eine Fakultaet ueber das Formular an, samt Pflichtkuerzel", async () => {
    const bodies: unknown[] = []
    server.use(
      ...baseHandlers({ faculties: [] }),
      http.post("*/api/admin/faculties", async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(FK4, { status: 201 })
      })
    )

    const user = userEvent.setup()
    renderWithProviders(
      <AdminStudyStructurePage />,
      "/administration/study-structure"
    )

    await user.click(
      await screen.findByRole("button", { name: "Fakultät hinzufügen" })
    )
    const dialog = await screen.findByRole("dialog")

    await user.type(
      within(dialog).getByLabelText("Name"),
      "Fakultät Natur und Technik"
    )
    /* Ohne Kuerzel geht nichts hinaus: abbreviation ist unique und not null
       (§3.8). */
    await user.click(within(dialog).getByRole("button", { name: "Speichern" }))
    expect(
      await within(dialog).findByText(
        i18n.t("validation.masterData.abbreviationRequired")
      )
    ).toBeInTheDocument()
    expect(bodies).toHaveLength(0)

    await user.type(within(dialog).getByLabelText("Kurzform"), "FK5")
    await user.click(within(dialog).getByRole("button", { name: "Speichern" }))

    await waitFor(() =>
      expect(bodies).toEqual([
        { name: "Fakultät Natur und Technik", abbreviation: "FK5" },
      ])
    )
  })

  it("legt einen Studiengang mit der vorgewaehlten Fakultaet an", async () => {
    const bodies: unknown[] = []
    server.use(
      ...baseHandlers({ faculties: [FK4], studyPrograms: [] }),
      http.post("*/api/admin/study-programs", async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(MI, { status: 201 })
      })
    )

    const user = userEvent.setup()
    renderWithProviders(
      <AdminStudyStructurePage />,
      "/administration/study-structure"
    )

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Studiengang hinzufügen" })
      ).toBeEnabled()
    )
    await user.click(
      screen.getByRole("button", { name: "Studiengang hinzufügen" })
    )

    const dialog = await screen.findByRole("dialog")
    /* Die uebergeordnete Zeile ist vorbelegt und bleibt aenderbar: so haengt
       ein Studiengang an eine andere Fakultaet um. */
    expect(within(dialog).getByLabelText("Fakultät")).toHaveTextContent(
      FK4.name
    )
    await user.type(within(dialog).getByLabelText("Name"), "Medieninformatik")

    /* Seit Contract v81 ist die Kurzform auch am Studiengang Pflicht
       (§3.7, KAN-80): ohne sie geht nichts hinaus. */
    await user.click(within(dialog).getByRole("button", { name: "Speichern" }))
    expect(
      await within(dialog).findByText(
        i18n.t("validation.masterData.abbreviationRequired")
      )
    ).toBeInTheDocument()
    expect(bodies).toHaveLength(0)

    await user.type(within(dialog).getByLabelText("Kurzform"), "MI")
    await user.click(within(dialog).getByRole("button", { name: "Speichern" }))

    await waitFor(() =>
      expect(bodies).toEqual([
        {
          name: "Medieninformatik",
          abbreviation: "MI",
          facultyId: "f-4",
        },
      ])
    )
  })

  it("zeigt die Loeschsperre einer Fakultaet mit Studiengang", async () => {
    server.use(
      ...baseHandlers({ faculties: [FK1], studyPrograms: [BAU] }),
      http.delete("*/api/admin/faculties/:id", () =>
        apiErrorResponse(409, "RESOURCE_IN_USE", "/api/admin/faculties/f-1")
      )
    )

    const user = userEvent.setup()
    renderWithProviders(
      <AdminStudyStructurePage />,
      "/administration/study-structure"
    )

    await screen.findByRole("button", { name: FK1.name })
    await user.click(
      screen.getByRole("button", { name: `Aktionen für ${FK1.name}` })
    )
    await user.click(await screen.findByRole("menuitem", { name: /Löschen/ }))

    const confirm = await screen.findByRole("alertdialog")
    /* Die Sperre greift auch durch die Ebene darunter, unabhaengig von
       Projekten (§6.1). */
    expect(confirm).toHaveTextContent("Studiengang")
    await user.click(
      within(confirm).getByRole("button", { name: "Endgültig löschen" })
    )

    /* Die Sperre greift durch die Ebene darunter, und die Meldung nennt
       welche (DoD von KAN-39). */
    const messages = await screen.findAllByText(
      i18n.t("administration.studyStructure.deleteBlocked.faculty", {
        name: FK1.name,
      })
    )
    expect(messages[0]).toBeVisible()
  })

  it("zeigt je Spalte einen Leerzustand", async () => {
    server.use(...baseHandlers({ faculties: [] }))

    renderWithProviders(
      <AdminStudyStructurePage />,
      "/administration/study-structure"
    )

    expect(
      await screen.findByRole("heading", { name: "Noch keine Fakultäten" })
    ).toBeInTheDocument()
    /* Ohne gewaehlten Studiengang zeigt die Modulspalte nicht alle Module,
       sondern sagt, dass die Auswahl fehlt. */
    expect(
      screen.getByRole("heading", { name: "Kein Studiengang gewählt" })
    ).toBeInTheDocument()
  })

  it("meldet einen Ausfall der Studiengangsliste, statt sie leer zu nennen", async () => {
    server.use(
      currentUserHandler({ role: "ADMIN" }),
      http.get("*/api/faculties", () => HttpResponse.json([FK1])),
      http.get("*/api/study-programs", () =>
        apiErrorResponse(500, "INTERNAL_ERROR", "/api/study-programs")
      ),
      http.get("*/api/modules", () => HttpResponse.json([]))
    )

    renderWithProviders(
      <AdminStudyStructurePage />,
      "/administration/study-structure"
    )

    /* „Noch keine Studiengänge" waere hier eine Falschaussage, nach der die
       Administration einen vorhandenen Eintrag ein zweites Mal anlegt
       (Befund des frontend-reviewers). */
    /* Ueber waitFor mit getByText und nicht ueber findByText: die Meldung
       steht in einer Flaeche, die noch einmal neu gerendert wird, waehrend
       die uebrigen Abfragen der Seite eintreffen. findByText liefert dann
       den Knoten von vorher, und der haengt zum Zeitpunkt der Behauptung
       nicht mehr im Dokument ("element could not be found"). getByText
       innerhalb von waitFor fragt bei jedem Durchlauf neu. */
    await waitFor(() =>
      expect(
        screen.getByText(i18n.t("apiError.INTERNAL_ERROR"))
      ).toBeInTheDocument()
    )
    expect(
      screen.queryByRole("heading", { name: "Noch keine Studiengänge" })
    ).not.toBeInTheDocument()
  })

  it("meldet einen Ausfall der Modulliste, statt sie leer zu nennen", async () => {
    server.use(
      currentUserHandler({ role: "ADMIN" }),
      http.get("*/api/faculties", () => HttpResponse.json([FK1])),
      http.get("*/api/study-programs", () => HttpResponse.json([BAU])),
      http.get("*/api/modules", () =>
        apiErrorResponse(500, "INTERNAL_ERROR", "/api/modules")
      )
    )

    renderWithProviders(
      <AdminStudyStructurePage />,
      "/administration/study-structure"
    )

    /* Ueber waitFor mit getByText und nicht ueber findByText: die Meldung
       steht in einer Flaeche, die noch einmal neu gerendert wird, waehrend
       die uebrigen Abfragen der Seite eintreffen. findByText liefert dann
       den Knoten von vorher, und der haengt zum Zeitpunkt der Behauptung
       nicht mehr im Dokument ("element could not be found"). getByText
       innerhalb von waitFor fragt bei jedem Durchlauf neu. */
    await waitFor(() =>
      expect(
        screen.getByText(i18n.t("apiError.INTERNAL_ERROR"))
      ).toBeInTheDocument()
    )
    expect(
      screen.queryByRole("heading", { name: "Noch keine Module" })
    ).not.toBeInTheDocument()
  })

  it("zeigt eine Fehlerantwort sichtbar und nicht als leere Flaeche", async () => {
    server.use(
      currentUserHandler({ role: "ADMIN" }),
      http.get("*/api/faculties", () =>
        apiErrorResponse(403, "NO_PERMISSION", "/api/faculties")
      ),
      http.get("*/api/study-programs", () => HttpResponse.json([])),
      http.get("*/api/modules", () => HttpResponse.json([]))
    )

    renderWithProviders(
      <AdminStudyStructurePage />,
      "/administration/study-structure"
    )

    /* Ueber waitFor mit getByText und nicht ueber findByText: die Meldung
       steht in einer Flaeche, die noch einmal neu gerendert wird, waehrend
       die uebrigen Abfragen der Seite eintreffen. findByText liefert dann
       den Knoten von vorher, und der haengt zum Zeitpunkt der Behauptung
       nicht mehr im Dokument ("element could not be found"). getByText
       innerhalb von waitFor fragt bei jedem Durchlauf neu. */
    await waitFor(() =>
      expect(
        screen.getByText(i18n.t("apiError.NO_PERMISSION"))
      ).toBeInTheDocument()
    )
  })
})
