import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it } from "vitest"

import type {
  CategoryResponse,
  FacultyResponse,
  ModuleResponse,
  ProjectDetailResponse,
  SemesterResponse,
  StudyProgramResponse,
  UserLookupResponse,
} from "@/api/types"
import ProjectMetadataPage from "@/features/projects/ProjectMetadataPage"
import i18n from "@/i18n"
import { projectDetail, reference } from "@/tests/fixtures"
import {
  apiErrorResponse,
  currentUserHandler,
  ownPortfolioHandler,
} from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { AppUnderTest, LocationProbe, signInAs } from "@/tests/routes/helpers"

/*
 * Zwei Zugaenge in dieser Datei, und das ist Absicht:
 *
 * - Die Route wird ueber den echten Routenbaum geprueft (AppUnderTest), wo
 *   Brotkrume, Rollenwaechter und Weiterleitung zusammenspielen.
 * - Alles Uebrige rendert die Seite direkt. Sie zieht sonst NavBar, Footer
 *   und das Portfolio der Kopfleiste mit, und jeder Testfall braeuchte
 *   Handler fuer Dinge, um die es ihm nicht geht.
 */

const PROJECT_ID = "8f14e45f-ceea-467a-9c9e-1f1e3a3d4b5c"

const FACULTIES: FacultyResponse[] = [
  { id: "f-4", name: "Fakultät 4", abbreviation: "FK4" },
  { id: "f-1", name: "Fakultät 1", abbreviation: "FK1" },
]

const STUDY_PROGRAMS: StudyProgramResponse[] = [
  { id: "sp-1", name: "Informatik", abbreviation: "INF", facultyId: "f-4" },
  {
    id: "sp-2",
    name: "Systems Engineering",
    abbreviation: "SE",
    facultyId: "f-4",
  },
]

const MODULES: ModuleResponse[] = [
  {
    id: "m-1",
    name: "Softwaretechnik",
    abbreviation: "SWT",
    studyProgramId: "sp-1",
  },
]

/* Kategorien fuehren kein Kuerzel (§3.6), anders als Fakultaet und Modul. */
const CATEGORIES: CategoryResponse[] = [{ id: "c-1", name: "Forschung" }]

const SEMESTERS: SemesterResponse[] = [
  { id: "s-1", name: "WiSe 2026/27", active: true, sortOrder: 1 },
]

/** Die eigene Person aus signInAs, damit die Redaktionsauswahl sie ausblenden kann. */
const OWN_ID = "00000000-0000-0000-0000-000000000001"

const EDITORS: UserLookupResponse[] = [
  { id: "e-1", firstName: "Rana", lastName: "Adler" },
  { id: "e-2", firstName: "Tom", lastName: "Busch" },
]

/** Jeder Request, der hinausgeht, damit "ohne Request" pruefbar bleibt. */
let requests: { method: string; url: URL; body?: unknown }[] = []

function masterDataHandlers() {
  return [
    http.get("*/api/faculties", () => HttpResponse.json(FACULTIES)),
    http.get("*/api/categories", () => HttpResponse.json(CATEGORIES)),
    http.get("*/api/semesters", () => HttpResponse.json(SEMESTERS)),
    http.get("*/api/study-programs", ({ request }) => {
      const faculty = new URL(request.url).searchParams.get("faculty")
      return HttpResponse.json(
        faculty === null
          ? STUDY_PROGRAMS
          : STUDY_PROGRAMS.filter((entry) => entry.facultyId === faculty)
      )
    }),
    http.get("*/api/modules", ({ request }) => {
      const studyProgram = new URL(request.url).searchParams.get("studyProgram")
      return HttpResponse.json(
        studyProgram === null
          ? MODULES
          : MODULES.filter((entry) => entry.studyProgramId === studyProgram)
      )
    }),
    http.get("*/api/tags", () => HttpResponse.json([])),
    http.get("*/api/users/lookup", ({ request }) => {
      const url = new URL(request.url)
      requests.push({ method: "GET", url })
      const q = (url.searchParams.get("q") ?? "").toLocaleLowerCase()
      return HttpResponse.json(
        EDITORS.filter((person) =>
          `${person.firstName} ${person.lastName}`
            .toLocaleLowerCase()
            .includes(q)
        )
      )
    }),
  ]
}

function detailHandler(project: ProjectDetailResponse) {
  return http.get(`*/api/projects/${project.id}`, () =>
    HttpResponse.json(project)
  )
}

/** Ein Entwurf mit allem Noetigen, aber ohne Klassifikation. */
function draft(overrides: Partial<ProjectDetailResponse> = {}) {
  return projectDetail({
    id: PROJECT_ID,
    title: "Campus-Garten",
    status: "DRAFT",
    editors: [],
    author: {
      id: OWN_ID,
      firstName: "Mira",
      lastName: "Beispiel",
      avatarUrl: null,
    },
    version: 3,
    ...overrides,
  })
}

/**
 * Rendert die Seite unter ihren echten Routenpfaden. Ohne Route-Definition
 * liefert useParams ein leeres Objekt, und die Seite haelt jede Adresse
 * fuer die Anlege-Route.
 */
function ProbedPage() {
  return (
    <>
      <ProjectMetadataPage />
      <LocationProbe />
    </>
  )
}

function renderPage(path: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/projects/:projectId/metadata" element={<ProbedPage />} />
      {/* Auffangroute, damit die Adresse nach einer Weiterleitung noch
          ablesbar ist: ohne sie verschwindet LocationProbe mit der
          verlassenen Route. */}
      <Route path="*" element={<LocationProbe />} />
    </Routes>,
    path
  )
}

/** Rendert die Seite als Bearbeiten-Route, ohne den Anwendungsrahmen. */
function renderEditRoute(project: ProjectDetailResponse) {
  server.use(detailHandler(project), ...masterDataHandlers())
  signInAs("STUDENT")
  return renderPage(`/projects/${project.id}/metadata`)
}

describe("ProjectMetadataPage", () => {
  beforeEach(() => {
    requests = []
  })

  it("zeigt das dreistufige Brotkrumenband, dessen letzte Stufe nicht verlinkt ist", async () => {
    signInAs("STUDENT")
    server.use(
      ...masterDataHandlers(),
      ownPortfolioHandler(),
      currentUserHandler(),
      detailHandler(draft())
    )

    renderWithProviders(<AppUnderTest />, `/projects/${PROJECT_ID}/metadata`)

    const crumbs = await screen.findByRole("navigation", { name: "Seitenpfad" })
    expect(
      within(crumbs).getByRole("link", { name: "Startseite" })
    ).toBeVisible()
    expect(
      within(crumbs).getByRole("link", { name: "Mein Portfolio" })
    ).toBeVisible()
    /*
     * Die aktuelle Ebene ist die Seite selbst und fuehrt nirgendwohin. Die
     * Primitive rendert sie als span mit role="link", aria-current="page"
     * und aria-disabled; geprueft wird deshalb, dass kein Anker darunter
     * liegt, nicht dass die Rolle fehlt.
     */
    const current = within(crumbs).getByText("Projekt-Metadaten")
    expect(current).toBeVisible()
    expect(current).toHaveAttribute("aria-current", "page")
    expect(current).toHaveAttribute("aria-disabled", "true")
    expect(current.closest("a")).toBeNull()
  })

  it("laesst ein Admin-Konto auf /projects/new (§5, seit KAN-82)", async () => {
    signInAs("ADMIN")
    /* Die Anlage antwortet mit dem fertigen Entwurf, damit der Test den
       ganzen Weg belegt: Route offen, Anlage angenommen, Formular da. */
    const created = draft()
    server.use(
      ...masterDataHandlers(),
      ownPortfolioHandler(),
      currentUserHandler(),
      detailHandler(created),
      http.post("*/api/projects", () =>
        HttpResponse.json(created, { status: 201 })
      )
    )

    renderWithProviders(<AppUnderTest />, "/projects/new")

    /* Bis KAN-82 stand hier die Meldung „Kein Zugriff" und das Formular
       entstand gar nicht erst. */
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Projekt-Metadaten",
      })
    ).toBeVisible()
    expect(await screen.findByLabelText("Projekttitel")).toBeInTheDocument()
  })

  it("setzt Studiengang und Fach zurueck, wenn die Fakultaet wechselt, und sagt es an", async () => {
    const user = userEvent.setup()
    renderEditRoute(
      draft({
        faculty: reference({ id: "f-4", name: "Fakultät 4" }),
        studyProgram: reference({ id: "sp-1", name: "Informatik" }),
        module: reference({ id: "m-1", name: "Softwaretechnik" }),
      })
    )

    const studyProgram = await screen.findByLabelText(/Studiengang/)
    await waitFor(() => expect(studyProgram).toHaveTextContent("Informatik"))

    await user.click(screen.getByLabelText(/Fakultät/))
    await user.click(await screen.findByRole("option", { name: "Fakultät 1" }))

    await waitFor(() =>
      expect(screen.getByLabelText(/Studiengang/)).toHaveTextContent(
        "Bitte wählen"
      )
    )
    expect(screen.getByLabelText(/^Fach/)).toHaveTextContent(
      "Erst Studiengang wählen"
    )
    /* SC 3.2.2: eine uebergeordnete Auswahl aendert eine untergeordnete mit,
       und das wird gemeldet statt still getan. */
    expect(
      screen.getByText(
        "Die Fakultät wurde geändert. Studiengang und Fach wurden zurückgesetzt."
      )
    ).toBeVisible()
  })

  it("nimmt mehrere Redakteur:innen auf, blendet die eigene Person aus und zeigt keine Adresse", async () => {
    const user = userEvent.setup()
    renderEditRoute(draft())

    const search = await screen.findByLabelText(/Redakteur:in/)
    await user.click(search)
    await user.click(await screen.findByRole("option", { name: "Rana Adler" }))

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Rana Adler aus der Redaktion entfernen",
        })
      ).toBeVisible()
    )

    /* Wiederholbar: die Auswahl ist eine Mehrfachauswahl (§3.3, N:M). */
    await user.click(screen.getByLabelText(/Redakteur:in/))
    await user.click(await screen.findByRole("option", { name: "Tom Busch" }))

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Tom Busch aus der Redaktion entfernen",
        })
      ).toBeVisible()
    )

    /* GET /api/users/lookup filtert auf EDITOR und sucht nur ueber die
       Namen (§6.1); Adressen liefert der Endpoint gar nicht erst. */
    const lookups = requests.filter((entry) =>
      entry.url.pathname.endsWith("/lookup")
    )
    expect(lookups.length).toBeGreaterThan(0)
    expect(lookups[0]?.url.searchParams.get("role")).toBe("EDITOR")
    expect(document.body.textContent).not.toMatch(/@/)
  })

  it("nimmt ein Projektmitglied mit Funktionsbezeichnung auf und sendet userId und projectRole", async () => {
    const user = userEvent.setup()
    let putBody: unknown = null
    const project = draft()
    server.use(
      detailHandler(project),
      ...masterDataHandlers(),
      http.put(`*/api/projects/${PROJECT_ID}`, async ({ request }) => {
        putBody = await request.json()
        return HttpResponse.json({ ...project, version: 4 })
      })
    )
    signInAs("STUDENT")
    renderPage(`/projects/${PROJECT_ID}/metadata`)

    await user.click(await screen.findByLabelText(/^Mitglied/))
    await user.click(await screen.findByRole("option", { name: "Tom Busch" }))
    await user.type(screen.getByLabelText(/^Rolle/), "Frontend")
    await user.click(screen.getByRole("button", { name: "Mitglied aufnehmen" }))

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Tom Busch aus den Projektmitgliedern entfernen",
        })
      ).toBeVisible()
    )

    await user.click(
      screen.getByRole("button", { name: "Speichern & weiter zum Editor" })
    )

    await waitFor(() => expect(putBody).not.toBeNull())
    expect(putBody).toMatchObject({
      members: [{ userId: "e-2", projectRole: "Frontend" }],
      version: 3,
    })
  })

  it("zeigt bei 409 PROJECT_VERSION_CONFLICT den Dialog mit genau zwei Wegen und wiederholt nichts", async () => {
    const user = userEvent.setup()
    let puts = 0
    const project = draft()
    server.use(
      detailHandler(project),
      ...masterDataHandlers(),
      http.put(`*/api/projects/${PROJECT_ID}`, () => {
        puts += 1
        return apiErrorResponse(
          409,
          "PROJECT_VERSION_CONFLICT",
          `/api/projects/${PROJECT_ID}`
        )
      })
    )
    signInAs("STUDENT")
    renderPage(`/projects/${PROJECT_ID}/metadata`)

    await user.click(
      await screen.findByRole("button", {
        name: "Speichern & weiter zum Editor",
      })
    )

    const dialog = await screen.findByRole("alertdialog")
    expect(
      within(dialog).getByRole("button", { name: "Serverstand laden" })
    ).toBeVisible()
    expect(
      within(dialog).getByRole("button", { name: "Eigene Fassung behalten" })
    ).toBeVisible()
    /* "Ueberschreiben" gibt es nicht: §6.4 sieht es nicht vor, und die
       Antwort traegt weder Serverstand noch Merge-Weg. */
    expect(
      within(dialog).queryByRole("button", { name: /überschreiben/i })
    ).not.toBeInTheDocument()

    /* Kein automatischer zweiter Versuch: er ueberschriebe genau die fremde
       Aenderung, vor der die Versionspruefung schuetzt. */
    expect(puts).toBe(1)
  })

  it("fuehrt bei 409 CHANGE_REQUESTS_OPEN sichtbar auf die offenen Aenderungswuensche", async () => {
    const user = userEvent.setup()
    let submits = 0
    const project = draft({ status: "REVISION" })
    server.use(
      detailHandler(project),
      ...masterDataHandlers(),
      http.put(`*/api/projects/${PROJECT_ID}`, () =>
        HttpResponse.json({ ...project, version: 2 })
      ),
      http.post(`*/api/projects/${PROJECT_ID}/submit`, () => {
        submits += 1
        return apiErrorResponse(
          409,
          "CHANGE_REQUESTS_OPEN",
          `/api/projects/${PROJECT_ID}/submit`
        )
      })
    )
    signInAs("STUDENT")
    renderPage(`/projects/${PROJECT_ID}/metadata?submit=1`)

    await user.click(
      await screen.findByRole("button", {
        name: i18n.t("project.metadata.saveAndSubmit"),
      })
    )

    /*
     * Ohne einen Weg dorthin waere die Meldung eine Sackgasse: die offenen
     * Aenderungswuensche stehen im Editor, in der Kommentarspalte aus
     * KAN-37.
     */
    const link = await screen.findByRole("link", {
      name: i18n.t("project.metadata.changeRequestsOpenAction"),
    })
    expect(link).toHaveAttribute("href", `/projects/${PROJECT_ID}/editor`)
    expect(
      screen.getByText(i18n.t("apiError.CHANGE_REQUESTS_OPEN"))
    ).toBeInTheDocument()
    /* Kein zweiter Versuch. */
    expect(submits).toBe(1)
  })

  it("stellt ein Projekt ausserhalb von DRAFT und REVISION schreibgeschuetzt dar", async () => {
    renderEditRoute(draft({ status: "PUBLISHED" }))

    expect(
      await screen.findByText(
        /Dieses Projekt ist im Status Veröffentlicht nicht bearbeitbar/
      )
    ).toBeVisible()
    /* §4.1 sperrt PUT /projects/{id} vollstaendig, den Titel eingeschlossen. */
    expect(screen.getByLabelText("Projekttitel")).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Speichern & weiter zum Editor" })
    ).toBeDisabled()
  })

  it("laesst die Redaktion in REVISION weiterhin aendern (§5, Fussnote 3 seit v62)", async () => {
    renderEditRoute(
      draft({
        status: "REVISION",
        editors: [
          { id: "e-1", firstName: "Rana", lastName: "Adler", avatarUrl: null },
        ],
      })
    )

    /*
     * REVISION ist wie DRAFT ein Arbeitszustand des Projekts (§4.1). Bis v61
     * endete das Recht mit dem DRAFT, und weil editorIds seit v59 zum
     * Einreichen gehoert, hing ein zurueckgegebenes Projekt ohne Redaktion an
     * der Administration fest.
     */
    expect(await screen.findByLabelText(/^Redakteur:in/)).toBeEnabled()
    expect(
      screen.getByRole("button", {
        name: "Rana Adler aus der Redaktion entfernen",
      })
    ).toBeVisible()
  })

  it("zeigt die Redaktion ab der Einreichung schreibgeschuetzt und nennt den Grund", async () => {
    renderEditRoute(
      draft({
        status: "SUBMITTED",
        editors: [
          { id: "e-1", firstName: "Rana", lastName: "Adler", avatarUrl: null },
        ],
      })
    )

    expect(await screen.findByText("Rana Adler")).toBeVisible()
    /* §5, Fussnote 3: ab da nimmt die Administration die Zuweisung vor. */
    expect(
      screen.getByText(
        "Die Redaktion lässt sich nur während der Bearbeitung ändern, also im Entwurf und in der Überarbeitung. Ab der Einreichung nimmt die Administration die Zuweisung vor."
      )
    ).toBeVisible()
    expect(screen.queryByLabelText(/Redakteur:in/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: "Rana Adler aus der Redaktion entfernen",
      })
    ).not.toBeInTheDocument()
  })

  it("beanstandet ein zu grosses Titelbild am Feld, ohne einen Request abzusetzen", async () => {
    const user = userEvent.setup()
    let uploads = 0
    const project = draft()
    server.use(
      detailHandler(project),
      ...masterDataHandlers(),
      http.post("*/api/files", () => {
        uploads += 1
        return HttpResponse.json({}, { status: 201 })
      })
    )
    signInAs("STUDENT")
    renderPage(`/projects/${PROJECT_ID}/metadata`)

    const input = await screen.findByLabelText("Titelbild wählen")
    const tooLarge = new File([new Uint8Array(11 * 1024 * 1024)], "gross.png", {
      type: "image/png",
    })
    await user.upload(input, tooLarge)

    expect(
      await screen.findByText("Die Datei ist größer als 10 MB.")
    ).toBeVisible()
    expect(uploads).toBe(0)
  })

  it("beanstandet einen unzulaessigen MIME-Typ am Feld, ohne einen Request abzusetzen", async () => {
    const user = userEvent.setup({ applyAccept: false })
    let uploads = 0
    const project = draft()
    server.use(
      detailHandler(project),
      ...masterDataHandlers(),
      http.post("*/api/files", () => {
        uploads += 1
        return HttpResponse.json({}, { status: 201 })
      })
    )
    signInAs("STUDENT")
    renderPage(`/projects/${PROJECT_ID}/metadata`)

    const input = await screen.findByLabelText("Titelbild wählen")
    /*
     * applyAccept: false umgeht die Vorfilterung des Dateidialogs. Das
     * accept-Attribut ist eine Bequemlichkeit des Auswahlfensters und keine
     * Zusage: per Drag-and-drop oder in einem Browser, der es ignoriert,
     * kommt die Datei trotzdem an. Geprueft wird hier genau die Pruefung
     * dahinter (§3.15).
     */
    await user.upload(
      input,
      new File(["%PDF-1.7"], "bericht.pdf", { type: "application/pdf" })
    )

    expect(
      await screen.findByText("Erlaubt sind die Formate PNG, JPEG und WebP.")
    ).toBeVisible()
    expect(uploads).toBe(0)
  })

  it("zeigt bei 404 PROJECT_NOT_FOUND eine Meldung statt einer leeren Seite", async () => {
    signInAs("STUDENT")
    server.use(
      ...masterDataHandlers(),
      http.get(`*/api/projects/${PROJECT_ID}`, () =>
        apiErrorResponse(
          404,
          "PROJECT_NOT_FOUND",
          `/api/projects/${PROJECT_ID}`
        )
      )
    )

    renderPage(`/projects/${PROJECT_ID}/metadata`)

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Projekt nicht gefunden",
      })
    ).toBeVisible()
    /* Die Adresse bleibt stehen, der Weg zurueck ist erreichbar. */
    expect(
      screen.getByRole("link", { name: "Zurück zum Portfolio" })
    ).toBeVisible()
  })

  it("legt ein 400 VALIDATION_FAILED an das betroffene Feld", async () => {
    const user = userEvent.setup()
    const project = draft()
    server.use(
      detailHandler(project),
      ...masterDataHandlers(),
      http.put(`*/api/projects/${PROJECT_ID}`, () =>
        apiErrorResponse(
          400,
          "VALIDATION_FAILED",
          `/api/projects/${PROJECT_ID}`,
          "title: Titel ist zu lang (hoechstens 255 Zeichen)."
        )
      )
    )
    signInAs("STUDENT")
    renderPage(`/projects/${PROJECT_ID}/metadata`)

    await user.click(
      await screen.findByRole("button", {
        name: "Speichern & weiter zum Editor",
      })
    )

    /* Der Server nennt Feldfehler als "feld: Text" (§6.2); der Teil vor dem
       Doppelpunkt landet ueber setError am Feld und nicht in einer
       Sammelleiste. */
    expect(
      await screen.findByText("Titel ist zu lang (hoechstens 255 Zeichen).")
    ).toBeVisible()
    expect(screen.getByLabelText("Projekttitel")).toHaveAttribute(
      "aria-invalid",
      "true"
    )
  })

  it("nimmt ein Projektmitglied schon ohne Funktionsbezeichnung auf (§3.13 seit v65)", async () => {
    const user = userEvent.setup()
    renderEditRoute(draft())

    const add = await screen.findByRole("button", {
      name: "Mitglied aufnehmen",
    })
    /* Ohne Person und ohne Rolle geht nichts. */
    expect(add).toBeDisabled()

    await user.click(screen.getByLabelText(/^Mitglied/))
    await user.click(await screen.findByRole("option", { name: "Tom Busch" }))

    /*
     * Die gewaehlte Person bleibt im Feld stehen, statt sofort nach unten zu
     * wandern (Vorgabe zu KAN-35).
     */
    await waitFor(() =>
      expect(screen.getByLabelText(/^Mitglied/)).toHaveValue("Tom Busch")
    )

    /*
     * Die Bezeichnung ist seit Contract v65 freiwillig und laesst sich in
     * der Liste nachtragen; sie hier zu verlangen hiesse, beim Aufnehmen
     * eine Angabe zu erzwingen, die das Datenmodell nicht verlangt.
     */
    await waitFor(() => expect(add).toBeEnabled())

    /*
     * Nur die Person traegt die Pflichtkennzeichnung, und zwar als Text und
     * nicht nur als Zeichen (SC 1.4.1). Der Text muss erreichbar sein: ein
     * sr-only unter aria-hidden besteht getByText und wird trotzdem nie
     * vorgelesen (Befund aus KAN-29).
     */
    const markers = screen.getAllByText("Pflichtangabe")
    expect(markers).toHaveLength(1)
    expect(markers[0].closest("[aria-hidden]")).toBeNull()
  })

  it("oeffnet die Redaktionszuweisung auch fuer eine Autor:in mit der Rolle EDITOR (§5, Fussnote 3 seit v60)", async () => {
    server.use(detailHandler(draft()), ...masterDataHandlers())
    signInAs("EDITOR")
    renderPage(`/projects/${PROJECT_ID}/metadata`)

    /*
     * mayAssignEditors sperrt seit Contract v60 nicht mehr an der eigenen
     * Systemrolle. Bis dahin stand hier ein Hinweis statt eines Suchfelds,
     * und weil editorIds seit v59 zum Einreichen gehoert, waere ihr Projekt
     * damit unzustellbar gewesen: die Zuweisung verwehrt, das Einreichen an
     * der fehlenden Zuweisung gescheitert (§3.3).
     */
    expect(await screen.findByLabelText(/^Redakteur:in/)).toBeEnabled()
    expect(
      screen.queryByText(
        /Die zuständige Redaktion wird von der Autor:in|Die Redaktion lässt sich nur während der Bearbeitung ändern/
      )
    ).not.toBeInTheDocument()
  })

  it("fragt vor dem Verwerfen ungespeicherter Angaben nach", async () => {
    const user = userEvent.setup()
    renderEditRoute(draft())

    /* Ohne Aenderung geht es direkt: ein Klick mehr ohne Grund ist auch
       keine Freundlichkeit (Skill frontend-design, Abschnitt 5). */
    await user.type(await screen.findByLabelText("Projekttitel"), "!")
    await user.click(screen.getByRole("button", { name: "Abbrechen" }))

    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText(/Campus-Garten/)).toBeVisible()
    expect(
      within(dialog).getByRole("button", { name: "Weiter bearbeiten" })
    ).toBeVisible()
    /* Solange nicht bestaetigt ist, bleibt die Seite stehen. */
    expect(screen.getByTestId("pathname")).toHaveTextContent(
      `/projects/${PROJECT_ID}/metadata`
    )

    await user.click(
      within(dialog).getByRole("button", { name: "Verwerfen und zurück" })
    )

    await waitFor(() =>
      expect(screen.getByTestId("pathname")).toHaveTextContent("/my-portfolio")
    )
  })

  it("holt das Titelbild eines Entwurfs mit Token statt ueber die blosse Adresse", async () => {
    const fileId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
    let authorization: string | null = null
    server.use(
      detailHandler(draft({ coverImageUrl: `/api/files/${fileId}` })),
      ...masterDataHandlers(),
      http.get(`*/api/files/${fileId}`, ({ request }) => {
        authorization = request.headers.get("Authorization")
        return HttpResponse.arrayBuffer(new ArrayBuffer(8), {
          headers: { "Content-Type": "image/png" },
        })
      })
    )
    signInAs("STUDENT")
    renderPage(`/projects/${PROJECT_ID}/metadata`)

    /*
     * Eine Datei an einem nicht veroeffentlichten Projekt darf nur lesen,
     * wer das Projekt lesen darf (§5, Zeile „Datei lesen"). Ein
     * <img src="/api/files/…"> schickt kein Token und bekaeme 403, ohne dass
     * irgendetwas davon sichtbar waere.
     */
    await waitFor(() => expect(authorization).toBe("Bearer test-token"))
  })
})

/*
 * Der Einreichweg fuehrt seit KAN-36 hierher und nicht mehr in ein
 * Seitenpanel im Editor. Diese Seite muss deshalb drei Enden anbieten und
 * sie unterscheidbar machen: nur speichern, speichern und einreichen, oder
 * zurueck ohne zu speichern.
 */
describe("ProjectMetadataPage auf dem Einreichweg (?submit=1)", () => {
  /** Rendert die Seite so, wie der Editor sie oeffnet. */
  function renderSubmitRoute(project: ProjectDetailResponse) {
    server.use(detailHandler(project), ...masterDataHandlers())
    signInAs("STUDENT")
    return renderPage(`/projects/${project.id}/metadata?submit=1`)
  }

  it("nennt oben, welche der sieben Pflichtangaben noch fehlen", async () => {
    renderSubmitRoute(draft())

    expect(
      await screen.findByText(/Es fehlen noch Angaben/i, undefined, {
        timeout: 20000,
      })
    ).toBeInTheDocument()
    expect(screen.getByText(/Redaktionszuweisung/)).toBeInTheDocument()
  })

  it("bietet drei Enden und benennt sie unterscheidbar", async () => {
    renderSubmitRoute(draft())

    /*
     * Zuvor stand hier nur „Speichern & weiter zum Editor", und genau
     * diese Schaltflaeche reichte ein: eine falsche Zusage. Jetzt sagt
     * jede, was sie tut.
     */
    expect(
      await screen.findByRole(
        "button",
        { name: "Speichern und einreichen" },
        { timeout: 20000 }
      )
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Nur speichern, zurück zum Editor" })
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Abbrechen" })).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Speichern & weiter zum Editor" })
    ).not.toBeInTheDocument()
  })

  it("fuehrt der Weg zurueck in den Editor und nicht ins Portfolio", async () => {
    const user = userEvent.setup()
    renderSubmitRoute(draft())

    await user.click(
      await screen.findByRole(
        "button",
        { name: "Abbrechen" },
        { timeout: 20000 }
      )
    )
    await waitFor(() =>
      expect(screen.getByTestId("pathname")).toHaveTextContent(
        `/projects/${PROJECT_ID}/editor`
      )
    )
  })
})
