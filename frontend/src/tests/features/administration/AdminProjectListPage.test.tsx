import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it } from "vitest"

import type {
  ProjectCardResponse,
  Top10EntryResponse,
  UserLookupResponse,
} from "@/api/types"
import AdminProjectListPage from "@/features/administration/AdminProjectListPage"
import i18n from "@/i18n"
import {
  person,
  projectCard,
  projectDetail,
  reference,
  top10Entry,
} from "@/tests/fixtures"
import { apiErrorResponse, currentUserHandler } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

function pageOf(
  content: ProjectCardResponse[],
  totalElements = content.length
) {
  return {
    content,
    page: 0,
    size: 20,
    totalElements,
    totalPages: totalElements === 0 ? 0 : Math.ceil(totalElements / 20),
  }
}

const DRAFT = projectCard({
  id: "pr-1",
  title: "AITutor",
  status: "DRAFT",
  author: person({ id: "u-9", firstName: "Tim", lastName: "Wagner" }),
  studyProgram: reference({ id: "sp-1", name: "Informatik M. Sc." }),
  semester: reference({ id: "se-1", name: "WiSe 2025/26" }),
  module: reference({ id: "m-1", name: "Informatik" }),
})

const APPROVED = projectCard({
  id: "pr-2",
  title: "EcoHaus",
  status: "APPROVED",
  author: person({ id: "u-8", firstName: "Maria", lastName: "Braun" }),
})

const PUBLISHED = projectCard({
  id: "pr-3",
  title: "SmartCampus",
  status: "PUBLISHED",
  author: person({ id: "u-7", firstName: "Jonas", lastName: "Roth" }),
})

/* Ein zweites veroeffentlichtes Projekt, das einen Platz der Top-10 belegt:
   damit laesst sich pruefen, dass der Aufnahme-Dialog nur die freien Plaetze
   anbietet, ohne dass SmartCampus selbst schon in der Liste stuende. */
const OTHER_PUBLISHED = projectCard({
  id: "pr-4",
  title: "BremenConnect",
  status: "PUBLISHED",
  author: person({ id: "u-9", firstName: "Lena", lastName: "Vogt" }),
})

/**
 * Die Anfragen, die die Seite beim Betreten stellt: die Liste und die drei
 * Optionslisten. Sie stehen als eine Funktion beisammen, damit jeder Test nur
 * das ueberschreibt, worum es ihm geht.
 */
function baseHandlers(
  options: {
    projects?: ProjectCardResponse[]
    onProjectsRequest?: (url: URL) => void
    /** Besetzte Plaetze der Top-10, fuer die Sperre „Bereits in Top 10". */
    top10?: Top10EntryResponse[]
    /** Treffer der Personensuche im Zuweisungsdialog. */
    people?: UserLookupResponse[]
    onLookupRequest?: (url: URL) => void
  } = {}
) {
  const projects = options.projects ?? []
  return [
    currentUserHandler({ role: "ADMIN" }),
    http.get("*/api/projects", ({ request }) => {
      options.onProjectsRequest?.(new URL(request.url))
      return HttpResponse.json(pageOf(projects))
    }),
    http.get("*/api/study-programs", () => HttpResponse.json([])),
    http.get("*/api/semesters", () => HttpResponse.json([])),
    http.get("*/api/modules", () => HttpResponse.json([])),
    /* Seit KAN-87 traegt das Zeilenmenue den Nominierungseintrag. Ob das
       Projekt einen Platz belegt, sagt diese Liste; ob ein Vorschlag offen
       ist, steht seit Contract v90 an der Kachel selbst (§3.11). */
    http.get("*/api/top10", () => HttpResponse.json(options.top10 ?? [])),
    /* Der Zuweisungsdialog fragt die Personensuche ab, sobald er aufgeht
       (§6.1, KAN-44). Ohne Handler liefe der Aufruf in
       onUnhandledRequest. */
    http.get("*/api/users/lookup", ({ request }) => {
      options.onLookupRequest?.(new URL(request.url))
      return HttpResponse.json(options.people ?? [])
    }),
  ]
}

/**
 * Die Projektverwaltung der Administrationsseite (Ticket KAN-38): der
 * Zuschnitt ohne Statusfilter, die Spalten des Templates, die Mehrfachauswahl
 * samt Ergebnisliste und die Zeilenaktionen.
 */
describe("AdminProjectListPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
    signInAs("ADMIN")
  })

  it("fragt die Liste ohne Statuseinschraenkung ab und zeigt auch Entwuerfe", async () => {
    const requests: URL[] = []
    server.use(
      ...baseHandlers({
        projects: [DRAFT],
        onProjectsRequest: (url) => requests.push(url),
      })
    )

    renderWithProviders(<AdminProjectListPage />, "/administration/projects")

    expect(await screen.findByText("AITutor")).toBeInTheDocument()
    /* Kein fester Statusfilter: ADMIN sieht alle Projekte in allen Status
       (§5 Fussnote 11), waehrend die Bibliothek auf PUBLISHED steht. */
    expect(requests.length).toBeGreaterThan(0)
    for (const url of requests) {
      expect(url.searchParams.get("status")).toBeNull()
      expect(url.searchParams.get("editor")).toBeNull()
    }
    /* „Entwurf" steht zweimal auf der Seite: als Segment der Statusleiste
       und als Badge in der Zeile. Gemeint ist das Badge. */
    const row = screen.getByText("AITutor").closest("tr")!
    expect(within(row).getByText("Entwurf")).toBeInTheDocument()
  })

  it("zeigt die Spalten des Templates in der Zeile", async () => {
    server.use(...baseHandlers({ projects: [DRAFT] }))

    renderWithProviders(<AdminProjectListPage />, "/administration/projects")

    const row = (await screen.findByText("AITutor")).closest("tr")
    expect(row).not.toBeNull()
    expect(within(row!).getByText("Tim Wagner")).toBeInTheDocument()
    expect(within(row!).getByText("Informatik M. Sc.")).toBeInTheDocument()
    expect(within(row!).getByText("WiSe 2025/26")).toBeInTheDocument()
  })

  it("zeigt den Leerzustand, wenn nichts gefunden wird", async () => {
    server.use(...baseHandlers({ projects: [] }))

    renderWithProviders(<AdminProjectListPage />, "/administration/projects")

    expect(
      await screen.findByRole("heading", { name: "Keine Projekte" })
    ).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("administration.projects.empty.description"))
    ).toBeInTheDocument()
  })

  it("unterscheidet im Leerzustand einen gesetzten Filter von einem leeren Bestand", async () => {
    server.use(...baseHandlers({ projects: [] }))

    renderWithProviders(
      <AdminProjectListPage />,
      "/administration/projects?studyProgram=sp-1"
    )

    /* Mit gesetztem Studiengang waere „Im System ist noch kein Projekt
       angelegt" schlicht falsch. */
    await screen.findByRole("heading", { name: "Keine Projekte" })
    expect(
      screen.getByText(i18n.t("administration.projects.empty.filtered"))
    ).toBeInTheDocument()
  })

  it("zeigt eine Fehlerantwort sichtbar und nicht als leere Flaeche", async () => {
    server.use(
      currentUserHandler({ role: "ADMIN" }),
      http.get("*/api/projects", () =>
        apiErrorResponse(403, "NO_PERMISSION", "/api/projects")
      ),
      http.get("*/api/study-programs", () => HttpResponse.json([])),
      http.get("*/api/semesters", () => HttpResponse.json([])),
      http.get("*/api/modules", () => HttpResponse.json([]))
    )

    renderWithProviders(<AdminProjectListPage />, "/administration/projects")

    expect(
      await screen.findByText(i18n.t("apiError.NO_PERMISSION"))
    ).toBeInTheDocument()
  })

  it("uebernimmt Suche und Statusfilter aus der Adresse in die Anfrage", async () => {
    const requests: URL[] = []
    server.use(
      ...baseHandlers({
        projects: [DRAFT],
        onProjectsRequest: (url) => requests.push(url),
      })
    )

    renderWithProviders(
      <AdminProjectListPage />,
      "/administration/projects?q=Robo&status=DRAFT&page=2"
    )

    await screen.findByText("AITutor")
    const last = requests.at(-1)!
    expect(last.searchParams.get("q")).toBe("Robo")
    expect(last.searchParams.get("status")).toBe("DRAFT")
    /* Die Adresse zaehlt ab 1, der Server ab 0 (§6.6). */
    expect(last.searchParams.get("page")).toBe("1")
  })

  it("schickt beim Sammelwechsel die Begruendung und zeigt die Ergebnisliste", async () => {
    const bodies: unknown[] = []
    server.use(
      ...baseHandlers({ projects: [DRAFT, APPROVED] }),
      http.post("*/api/admin/projects/status", async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({
          results: [
            {
              projectId: "pr-1",
              success: false,
              errorCode: "PROJECT_STATUS_TRANSITION_INVALID",
            },
            { projectId: "pr-2", success: true, errorCode: null },
          ],
        })
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminProjectListPage />, "/administration/projects")

    await screen.findByText("AITutor")
    await user.click(
      screen.getByRole("checkbox", {
        name: "Alle Projekte dieser Seite auswählen",
      })
    )
    await user.click(screen.getByRole("button", { name: /Zur Überarbeitung/ }))

    const dialog = await screen.findByRole("dialog")
    await user.type(
      within(dialog).getByLabelText("Begründung"),
      "Bitte Quellen ergänzen."
    )
    await user.click(
      within(dialog).getByRole("button", { name: /Zur Überarbeitung/ })
    )

    /* Die Begruendung ist Pflicht bei request-revision und geht einmal fuer
       die ganze Auswahl hinaus (§6.1). */
    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).toEqual({
      projectIds: ["pr-1", "pr-2"],
      action: "request-revision",
      reason: "Bitte Quellen ergänzen.",
    })

    /* Die Antwort ist eine Ergebnisliste, kein Sammelerfolg: die
       fehlgeschlagene Zeile erscheint mit ihrem uebersetzten Fehlercode. */
    /* Die Zusammenfassung steht im Dialog und noch einmal in der
       Live-Region; geprueft wird die sichtbare im Dialog. */
    expect(
      await within(dialog).findByText("1 von 2 Projekten geändert.")
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        new RegExp(i18n.t("apiError.PROJECT_STATUS_TRANSITION_INVALID"))
      )
    ).toBeInTheDocument()
  })

  it("laesst den Sammelwechsel ohne Begruendung nicht hinaus", async () => {
    let calls = 0
    server.use(
      ...baseHandlers({ projects: [APPROVED] }),
      http.post("*/api/admin/projects/status", () => {
        calls += 1
        return HttpResponse.json({ results: [] })
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminProjectListPage />, "/administration/projects")

    await screen.findByText("EcoHaus")
    await user.click(
      screen.getByRole("checkbox", { name: "EcoHaus auswählen" })
    )
    await user.click(screen.getByRole("button", { name: /Zur Überarbeitung/ }))

    const dialog = await screen.findByRole("dialog")
    await user.click(
      within(dialog).getByRole("button", { name: /Zur Überarbeitung/ })
    )

    /* Das zod-Schema haelt ihn auf; verbindlich bliebe der Server mit 400
       VALIDATION_FAILED fuer die ganze Anfrage. */
    expect(
      await within(dialog).findByText(
        i18n.t("administration.projects.statusDialog.reasonRequired")
      )
    ).toBeInTheDocument()
    expect(calls).toBe(0)
  })

  it("fragt beim Veroeffentlichen keine Begruendung ab", async () => {
    const bodies: unknown[] = []
    server.use(
      ...baseHandlers({ projects: [APPROVED] }),
      http.post("*/api/admin/projects/status", async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({
          results: [{ projectId: "pr-2", success: true, errorCode: null }],
        })
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminProjectListPage />, "/administration/projects")

    await screen.findByText("EcoHaus")
    await user.click(
      screen.getByRole("checkbox", { name: "EcoHaus auswählen" })
    )
    await user.click(screen.getByRole("button", { name: /Veröffentlichen/ }))

    /* Veroeffentlichen aendert die fremde Sicht und fragt deshalb als
       alertdialog zurueck (Skill frontend-design, Abschnitt 5). */
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveAccessibleName("Projekt veröffentlichen")
    /* Bei publish ist reason nicht bloss wirkungslos, sondern unzulaessig
       (§6.1): das Feld erscheint gar nicht erst. */
    expect(within(dialog).queryByLabelText("Begründung")).toBeNull()

    await user.click(
      within(dialog).getByRole("button", { name: /Veröffentlichen/ })
    )

    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).toEqual({
      projectIds: ["pr-2"],
      action: "publish",
    })
  })

  it("fuehrt die Zeilenaktion Oeffnen in den Review-Modus, nicht in den Editor", async () => {
    server.use(...baseHandlers({ projects: [DRAFT] }))

    const user = userEvent.setup()
    renderWithProviders(<AdminProjectListPage />, "/administration/projects")

    await screen.findByText("AITutor")
    await user.click(
      screen.getByRole("button", { name: "Aktionen für AITutor" })
    )

    /* Der Admin darf Inhalte fremder Projekte nicht bearbeiten, nur lesen
       und den Status wechseln (§7, offener Punkt 2). */
    const open = await screen.findByRole("menuitem", {
      name: "Im Review-Modus öffnen",
    })
    expect(open).toHaveAttribute("href", "/projects/pr-1/review")
  })

  it("loescht erst nach Rueckfrage und meldet einen Fehler sichtbar", async () => {
    server.use(
      ...baseHandlers({ projects: [DRAFT] }),
      http.delete("*/api/projects/pr-1", () =>
        apiErrorResponse(409, "RESOURCE_IN_USE", "/api/projects/pr-1")
      )
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminProjectListPage />, "/administration/projects")

    await screen.findByText("AITutor")
    await user.click(
      screen.getByRole("button", { name: "Aktionen für AITutor" })
    )
    await user.click(
      await screen.findByRole("menuitem", { name: "Projekt löschen" })
    )

    const confirm = await screen.findByRole("alertdialog")
    /* Die Rueckfrage nennt, dass Bloecke und Dateien per Cascade mitgehen. */
    expect(confirm).toHaveTextContent(/Inhaltsblöcken/)
    await user.click(
      within(confirm).getByRole("button", { name: "Endgültig löschen" })
    )

    /* Sichtbar ueber der Tabelle und zusaetzlich angesagt: die Live-Region
       allein erreicht sehende Personen nicht. */
    const shown = await screen.findAllByText(i18n.t("apiError.RESOURCE_IN_USE"))
    expect(shown.length).toBeGreaterThan(0)
  })

  it("schickt die neue Redaktionszuweisung als vollstaendige Liste", async () => {
    const bodies: unknown[] = []
    server.use(
      ...baseHandlers({ projects: [DRAFT] }),
      http.get("*/api/projects/pr-1", () =>
        HttpResponse.json(
          projectDetail({
            id: "pr-1",
            title: "AITutor",
            author: person({ id: "u-9" }),
            editors: [
              {
                id: "e-1",
                firstName: "Ida",
                lastName: "Klein",
                avatarUrl: null,
              },
            ],
          })
        )
      ),
      http.put("*/api/projects/pr-1/editors", async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(projectDetail({ id: "pr-1" }))
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminProjectListPage />, "/administration/projects")

    await screen.findByText("AITutor")
    await user.click(
      screen.getByRole("button", { name: "Aktionen für AITutor" })
    )
    await user.click(
      await screen.findByRole("menuitem", { name: "Redaktion zuweisen" })
    )

    const dialog = await screen.findByRole("dialog")
    /* Der Stand kommt aus dem Projektdetail: ProjectCardResponse fuehrt
       editors nicht (§6.1). */
    expect(await within(dialog).findByText("Ida Klein")).toBeInTheDocument()

    await user.click(
      within(dialog).getByRole("button", {
        name: "Ida Klein aus der Redaktion entfernen",
      })
    )
    await user.click(within(dialog).getByRole("button", { name: "Speichern" }))

    /* Die Liste ersetzt die bisherige vollstaendig; [] hebt die Zuweisung
       auf (§6.1). */
    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).toEqual({ editorIds: [] })
  })

  it("bietet im Zuweisungsdialog auch Admin-Konten an und traegt sie ein", async () => {
    /*
     * §5 Fussnoten 3 und 5 seit Contract v89 (KAN-87): zugewiesen wird ein
     * Konto mit EDITOR oder ADMIN. Bis v88 fragte das Feld fest mit
     * role=EDITOR ab, ein Admin-Konto liess sich ueber die Oberflaeche also
     * nicht eintragen, obwohl der Server es annahm.
     */
    const lookups: URL[] = []
    const bodies: unknown[] = []
    server.use(
      ...baseHandlers({
        projects: [DRAFT],
        onLookupRequest: (url) => lookups.push(url),
        people: [{ id: "ad-1", firstName: "Nina", lastName: "Ehlers" }],
      }),
      http.get("*/api/projects/pr-1", () =>
        HttpResponse.json(
          projectDetail({
            id: "pr-1",
            title: "AITutor",
            author: person({ id: "u-9" }),
            editors: [],
          })
        )
      ),
      http.put("*/api/projects/pr-1/editors", async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(projectDetail({ id: "pr-1" }))
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminProjectListPage />, "/administration/projects")

    await screen.findByText("AITutor")
    await user.click(
      screen.getByRole("button", { name: "Aktionen für AITutor" })
    )
    await user.click(
      await screen.findByRole("menuitem", { name: "Redaktion zuweisen" })
    )

    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByLabelText(/Redakteur:in/))
    /* Die Vorschlagsliste haengt als Portal am body und nicht im Dialog. */
    await user.click(await screen.findByRole("option", { name: "Nina Ehlers" }))
    await user.click(within(dialog).getByRole("button", { name: "Speichern" }))

    await waitFor(() => expect(bodies).toEqual([{ editorIds: ["ad-1"] }]))

    /* Beide Rollen in einer Abfrage: getAll und nicht get, sonst bliebe ein
       weggefallenes ADMIN unbemerkt (§6.1, mehrwertig seit v89). */
    expect(lookups.length).toBeGreaterThan(0)
    expect(lookups[0]?.searchParams.getAll("role")).toEqual(["EDITOR", "ADMIN"])
  })

  /*
   * Der Aufnahme-Eintrag im Zeilenmenue (§3.11, §3.11.1; Nacharbeit an
   * KAN-87). KAN-87 hatte hier zunächst den Nominierungseintrag gesetzt,
   * damit ein Admin auch ohne Zuweisung vorschlagen kann. In der
   * Administration entscheidet er aber, statt vorzuschlagen: der Eintrag
   * nimmt unmittelbar auf. Der Nominierungsweg bleibt ihm in „Meine
   * Reviews" und auf der Projektdetailseite.
   */

  it("nimmt ein veroeffentlichtes Projekt aus der Zeile heraus in die Top 10 auf", async () => {
    let body: unknown = null
    server.use(
      ...baseHandlers({ projects: [PUBLISHED] }),
      http.put("*/api/admin/top10", async ({ request }) => {
        body = await request.json()
        return HttpResponse.json([
          top10Entry({ position: 1, project: PUBLISHED }),
        ])
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminProjectListPage />, "/administration/projects")

    await screen.findByText("SmartCampus")
    await user.click(
      screen.getByRole("button", { name: "Aktionen für SmartCampus" })
    )
    await user.click(
      await screen.findByRole("menuitem", { name: "In die Top 10 aufnehmen" })
    )

    const dialog = await screen.findByRole("dialog")
    /* Vorbelegt ist der erste freie Platz, hier Platz 1: die Liste ist leer.
       Eine vorgeschlagene Stufe gibt es nicht, aus der sich ein Bereich
       ableiten liesse (§2.13) — niemand hat etwas vorgeschlagen. */
    expect(within(dialog).getByRole("combobox")).toHaveTextContent("Platz 1")

    await user.click(within(dialog).getByRole("button", { name: "Aufnehmen" }))

    /* Die ganze Belegung und keine Stufe: aufgenommen wird unmittelbar
       (§3.11.1 Regel 3), nicht vorgeschlagen. */
    await waitFor(() => expect(body).toEqual({ projectIds: ["pr-3"] }))
  })

  it("bietet nur die freien Plaetze an", async () => {
    server.use(
      ...baseHandlers({
        projects: [PUBLISHED],
        top10: [top10Entry({ position: 1, project: OTHER_PUBLISHED })],
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminProjectListPage />, "/administration/projects")

    await screen.findByText("SmartCampus")
    await user.click(
      screen.getByRole("button", { name: "Aktionen für SmartCampus" })
    )
    await user.click(
      await screen.findByRole("menuitem", { name: "In die Top 10 aufnehmen" })
    )

    /* Platz 1 ist belegt, also ist Platz 2 der erste freie. PUT /admin/top10
       raeumt keinen belegten Platz; wer umsortieren will, tut das in der
       Top-10-Verwaltung. */
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("combobox")).toHaveTextContent("Platz 2")
  })

  it("blendet den Eintrag aus, solange das Projekt nicht veroeffentlicht ist", async () => {
    server.use(...baseHandlers({ projects: [APPROVED] }))

    const user = userEvent.setup()
    renderWithProviders(<AdminProjectListPage />, "/administration/projects")

    await screen.findByText("EcoHaus")
    await user.click(
      screen.getByRole("button", { name: "Aktionen für EcoHaus" })
    )

    /* Kein gesperrter Eintrag: in dieser Liste stehen ueberwiegend
       unveroeffentlichte Projekte, und eine dauerhaft gesperrte Zeile
       erklaerte nichts. Die Statuswechsel daneben stehen aber, sonst
       pruefte der Test ein leeres Menue. */
    expect(
      await screen.findByRole("menuitem", { name: "Redaktion zuweisen" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("menuitem", { name: "In die Top 10 aufnehmen" })
    ).not.toBeInTheDocument()
  })

  it("sperrt den Eintrag, wenn das Projekt bereits in der Top 10 steht", async () => {
    server.use(
      ...baseHandlers({
        projects: [PUBLISHED],
        top10: [top10Entry({ position: 1, project: PUBLISHED })],
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminProjectListPage />, "/administration/projects")

    await screen.findByText("SmartCampus")
    await user.click(
      screen.getByRole("button", { name: "Aktionen für SmartCampus" })
    )

    /* Sichtbar und begruendet statt ausgeblendet (SC 3.3.2). Die
       Beschriftung sagt den Grund bereits, deshalb traegt dieser Fall
       keinen Kurzhinweis. Gesperrt heisst aria-disabled, damit der Eintrag
       mit der Tastatur erreichbar bleibt. */
    const item = await screen.findByRole("menuitem", {
      name: "Steht bereits in der Top 10",
    })
    expect(item).toHaveAttribute("aria-disabled", "true")
  })

  it("sperrt den Eintrag mit Begruendung, wenn alle zehn Plaetze belegt sind", async () => {
    server.use(
      ...baseHandlers({
        projects: [PUBLISHED],
        top10: Array.from({ length: 10 }, (_unused, index) =>
          top10Entry({
            position: index + 1,
            project: projectCard({
              id: `pr-full-${index}`,
              title: `Platzhalter ${index}`,
              status: "PUBLISHED",
            }),
          })
        ),
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminProjectListPage />, "/administration/projects")

    await screen.findByText("SmartCampus")
    await user.click(
      screen.getByRole("button", { name: "Aktionen für SmartCampus" })
    )

    const item = await screen.findByRole("menuitem", {
      name: "In die Top 10 aufnehmen",
    })
    expect(item).toHaveAttribute("aria-disabled", "true")

    await user.hover(item)
    expect(
      await screen.findByText(
        "Alle zehn Plätze sind belegt. Erst einen Platz räumen, dann kommt ein weiteres Projekt hinein."
      )
    ).toBeInTheDocument()
  })

  it("nimmt ein Projekt mit offenem Vorschlag trotzdem auf", async () => {
    /*
     * §3.11.1 Regel 2 verbietet den zweiten Vorschlag zu einem
     * Projekt, nicht die Aufnahme. Nimmt die Administration ein
     * vorgeschlagenes Projekt unmittelbar auf, gilt der offene Vorschlag
     * damit als angenommen (Regel 5); er verfällt also nicht, er wird
     * eingelöst. Beim Nominierungseintrag war derselbe Fall eine Sperre.
     */
    server.use(
      ...baseHandlers({
        projects: [projectCard({ ...PUBLISHED, hasOpenNomination: true })],
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminProjectListPage />, "/administration/projects")

    await screen.findByText("SmartCampus")
    await user.click(
      screen.getByRole("button", { name: "Aktionen für SmartCampus" })
    )

    const item = await screen.findByRole("menuitem", {
      name: "In die Top 10 aufnehmen",
    })
    expect(item).toHaveAttribute("aria-disabled", "false")
  })
})
