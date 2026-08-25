import { HttpResponse, http } from "msw"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { getAuthState } from "@/api/auth/authStore"
import type { ProjectCardResponse } from "@/api/types"
import { setAuthNavigate } from "@/api/auth/redirect"
import ProjectListPage from "@/features/projects/ProjectListPage"
import i18n from "@/i18n"
import { projectCard, reference } from "@/tests/fixtures"
import { apiErrorResponse } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

/*
 * Typisiert und nicht unknown[]: seit KAN-76 fuehrt ProjectCardResponse
 * seine Pflichtfelder, und eine unvollstaendige Antwort im Mock soll hier
 * auffallen und nicht erst als TypeError in der Kachel.
 */
function pageOf(
  content: ProjectCardResponse[],
  totalElements = content.length,
  page = 0,
  size = 20
) {
  return {
    content,
    page,
    size,
    totalElements,
    totalPages: totalElements === 0 ? 0 : Math.ceil(totalElements / size),
  }
}

/* Stammdaten der Filter-Seitenleiste (KAN-64), als Konstanten, damit die
   Tests URL, Checkbox und Request ueber dieselben IDs verknuepfen. */
const FACULTY_FK1 = "f0000000-0000-4000-8000-000000000001"
const FACULTY_FK4 = "f0000000-0000-4000-8000-000000000004"
const PROGRAM_ARCHITECTURE = "a0000000-0000-4000-8000-000000000001"
const PROGRAM_INFORMATICS = "a0000000-0000-4000-8000-000000000002"
const CATEGORY_WEB = "c0000000-0000-4000-8000-000000000001"
const SEMESTER_WISE = "5e000000-0000-4000-8000-000000000001"
const SEMESTER_SOSE = "5e000000-0000-4000-8000-000000000002"

/**
 * Projektliste des Durchstichs (Ticket KAN-8): die drei Zustaende Laden,
 * Leere und Fehler, die sichtbare 401-Reaktion und der fest verdrahtete
 * Filter status=PUBLISHED (Klaerungsrunde im Review zu KAN-8, Contract v42).
 * Seit KAN-64 dazu die Filter-Seitenleiste mit Mehrfachauswahl.
 */
describe("ProjectListPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
    /* Die Seitenleiste laedt ihre Optionslisten bei jedem Rendern der
       Seite; die Handler stehen deshalb fuer alle Tests bereit und
       einzelne Tests ueberschreiben sie bei Bedarf per server.use. */
    server.use(
      http.get("*/api/faculties", () =>
        HttpResponse.json([
          {
            id: FACULTY_FK1,
            name: "Fakultät Architektur, Bau und Umwelt",
            abbreviation: "FK1",
          },
          {
            id: FACULTY_FK4,
            name: "Fakultät Elektrotechnik und Informatik",
            abbreviation: "FK4",
          },
        ])
      ),
      http.get("*/api/study-programs", () =>
        HttpResponse.json([
          {
            id: PROGRAM_ARCHITECTURE,
            name: "Architektur",
            facultyId: FACULTY_FK1,
          },
          {
            id: PROGRAM_INFORMATICS,
            name: "Informatik",
            facultyId: FACULTY_FK4,
          },
        ])
      ),
      http.get("*/api/categories", () =>
        HttpResponse.json([{ id: CATEGORY_WEB, name: "Webentwicklung" }])
      ),
      http.get("*/api/semesters", () =>
        HttpResponse.json([
          {
            id: SEMESTER_WISE,
            name: "WiSe 2025/26",
            active: true,
            sortOrder: 1,
          },
          { id: SEMESTER_SOSE, name: "SoSe 2025", active: true, sortOrder: 2 },
        ])
      )
    )
  })

  it("zeigt echte Daten aus PageResponse, ohne Status-Badge", async () => {
    server.use(
      http.get("*/api/projects", () =>
        HttpResponse.json(
          pageOf([
            projectCard({
              id: "10000000-0000-0000-0000-000000000001",
              title: "Campus-Garten an der Werderstraße",
              summary: "Freifläche als offener Lernort.",
              semester: reference({
                id: "s-1",
                name: "SoSe 2026",
                abbreviation: null,
              }),
              reactionCount: 3,
            }),
            projectCard({
              id: "10000000-0000-0000-0000-000000000002",
              title: "Barrierefreie Navigation im Hochschulportal",
            }),
          ])
        )
      )
    )
    const { container } = renderWithProviders(<ProjectListPage />)

    /* Ladezustand in der Form des Ergebnisses, kein Spinner. */
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)

    /* Kacheltitel als h2 direkt unter dem Seiten-h1, kein Sprung auf h3
       (SC 1.3.1); nachgewiesen ueber die Rolle, nicht den Text. */
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Campus-Garten an der Werderstraße",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Barrierefreie Navigation im Hochschulportal",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText("2 studentische Projekte gefunden")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 1, name: "Studentische Projekte" })
    ).toBeInTheDocument()
    /* Die Bibliothek zeigt nur PUBLISHED; ein Badge unterschiede nichts
       und bleibt deshalb weg. */
    expect(screen.queryByText("Veröffentlicht")).not.toBeInTheDocument()
  })

  it("fragt fest mit status=PUBLISHED ab, auch angemeldet ohne Badge", async () => {
    signInAs("STUDENT")
    let requestedStatus: string | null = null
    server.use(
      http.get("*/api/projects", ({ request }) => {
        requestedStatus = new URL(request.url).searchParams.get("status")
        return HttpResponse.json(
          pageOf([
            projectCard({
              id: "10000000-0000-0000-0000-000000000003",
              title: "Veröffentlichtes Projekt",
            }),
          ])
        )
      })
    )
    renderWithProviders(<ProjectListPage />)

    expect(
      await screen.findByText("Veröffentlichtes Projekt")
    ).toBeInTheDocument()
    /* Der Filter ist in der Query-Fabrik fest verdrahtet und nicht
       waehlbar: eigene Entwuerfe gehoeren in "Mein Portfolio" (KAN-34),
       nicht in die oeffentliche Bibliothek. */
    expect(requestedStatus).toBe("PUBLISHED")
    expect(screen.queryByText("Veröffentlicht")).not.toBeInTheDocument()
  })

  it("zeigt den Leerzustand statt einer leeren Flaeche", async () => {
    server.use(http.get("*/api/projects", () => HttpResponse.json(pageOf([]))))
    renderWithProviders(<ProjectListPage />)

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Keine Projekte vorhanden",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Sobald Projekte veröffentlicht sind, erscheinen sie hier."
      )
    ).toBeInTheDocument()
  })

  it("macht eine Fehlerantwort aus dem 6.2-Envelope sichtbar", async () => {
    server.use(
      http.get("*/api/projects", () =>
        apiErrorResponse(500, "INTERNAL_ERROR", "/api/projects")
      )
    )
    renderWithProviders(<ProjectListPage />)

    expect(
      await screen.findByText(
        "Etwas ist schiefgelaufen. Bitte versuchen Sie es später erneut."
      )
    ).toBeInTheDocument()
  })

  it("401 beendet die Sitzung sichtbar und fuehrt zum Login", async () => {
    signInAs("STUDENT")
    const navigate = vi.fn()
    setAuthNavigate(navigate)
    server.use(
      http.get("*/api/projects", () =>
        apiErrorResponse(401, "TOKEN_EXPIRED", "/api/projects")
      )
    )
    renderWithProviders(<ProjectListPage />)

    /* Nie eine leere Seite: die Meldung erscheint auf der Liste, waehrend
       die zentrale Reaktion aus KAN-30 Sitzung und Ziel umsetzt. */
    expect(
      await screen.findByText(
        "Die Sitzung ist abgelaufen. Bitte melden Sie sich erneut an."
      )
    ).toBeInTheDocument()
    expect(navigate).toHaveBeenCalledWith("/login")
    expect(getAuthState().session).toBeNull()
    expect(getAuthState().sessionNotice).toBe("TOKEN_EXPIRED")
  })

  it("liest Suche und Seite aus der URL und uebersteht so einen Reload", async () => {
    const requests: URLSearchParams[] = []
    server.use(
      http.get("*/api/projects", ({ request }) => {
        requests.push(new URL(request.url).searchParams)
        return HttpResponse.json(
          pageOf(
            [
              projectCard({
                id: "10000000-0000-0000-0000-000000000004",
                title: "Campus-Garten an der Werderstraße",
              }),
            ],
            21,
            1
          )
        )
      })
    )
    renderWithProviders(<ProjectListPage />, "/projects?q=garten&page=2")

    await screen.findByText("Campus-Garten an der Werderstraße")
    /* Die URL ist der einzige Zustand: q geht unveraendert in den Request,
       die sichtbare Seite 2 wird zur 0-basierten Seite 1 (§6.6), status
       bleibt fest verdrahtet. */
    const requested = requests.at(-1)
    expect(requested?.get("q")).toBe("garten")
    expect(requested?.get("page")).toBe("1")
    expect(requested?.get("status")).toBe("PUBLISHED")
    /* Das Suchfeld zeigt den URL-Zustand an. */
    expect(screen.getByRole("searchbox")).toHaveValue("garten")
  })

  it("entprellt die Suche und schreibt sie als q in URL und Request", async () => {
    const requestedQ: (string | null)[] = []
    server.use(
      http.get("*/api/projects", ({ request }) => {
        requestedQ.push(new URL(request.url).searchParams.get("q"))
        return HttpResponse.json(pageOf([]))
      })
    )
    renderWithProviders(<ProjectListPage />)
    await screen.findByRole("searchbox")

    await userEvent.type(screen.getByRole("searchbox"), "garten")

    await waitFor(
      () => {
        expect(requestedQ).toContain("garten")
      },
      { timeout: 2000 }
    )
    /* Kein Request je Tastenanschlag: zwischen leerem Start und fertigem
       Begriff liegen keine Teilbegriffe fuer jeden Buchstaben. */
    expect(
      requestedQ.filter((value) => value !== null && value !== "garten")
    ).toHaveLength(0)
  })

  it("findet Projekte ueber den Namen der Autor:in, Platzhalter im Template-Wortlaut", async () => {
    /* Der Handler beantwortet q wie der Server seit Contract v47 (KAN-66):
       der Suchbegriff trifft auch den vollen Namen der Autor:in. */
    server.use(
      http.get("*/api/projects", ({ request }) => {
        const q = new URL(request.url).searchParams.get("q") ?? ""
        const matchesAuthor =
          q !== "" && "mira beispiel".includes(q.toLowerCase())
        return HttpResponse.json(
          pageOf(
            matchesAuthor
              ? [
                  projectCard({
                    id: "10000000-0000-0000-0000-000000000007",
                    title: "Campus-Garten an der Werderstraße",
                  }),
                ]
              : []
          )
        )
      })
    )
    renderWithProviders(<ProjectListPage />)

    /* Der Platzhalter traegt wieder den Template-Wortlaut aus "Projekte
       (Oeffentlich)"; KAN-31 hatte ihn verkuerzt, weil der Server die
       Personensuche noch nicht einloeste. */
    const searchbox = await screen.findByRole("searchbox")
    expect(searchbox).toHaveAttribute(
      "placeholder",
      "Projekt oder Studierende/n suchen …"
    )

    await userEvent.type(searchbox, "Mira Beispiel")

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Campus-Garten an der Werderstraße",
      })
    ).toBeInTheDocument()
  })

  it("blaettert ueber die Paginierung und fragt die naechste Seite an", async () => {
    const requestedPages: (string | null)[] = []
    server.use(
      http.get("*/api/projects", ({ request }) => {
        const url = new URL(request.url)
        requestedPages.push(url.searchParams.get("page"))
        return HttpResponse.json(
          pageOf(
            [
              projectCard({
                id: "10000000-0000-0000-0000-000000000005",
                title: "Barrierefreie Navigation im Hochschulportal",
              }),
            ],
            40,
            url.searchParams.get("page") === "1" ? 1 : 0
          )
        )
      })
    )
    renderWithProviders(<ProjectListPage />)

    await screen.findByText("Barrierefreie Navigation im Hochschulportal")
    expect(
      screen.getByRole("navigation", { name: "Seitennummerierung" })
    ).toBeInTheDocument()

    /* Base UI rendert die Anker der Paginierung mit role="button"
       (Registry-Fassung aus KAN-29); abgefragt wird die tatsaechliche
       Rolle. */
    await userEvent.click(
      screen.getByRole("button", { name: "Zur nächsten Seite" })
    )

    await waitFor(() => {
      expect(requestedPages).toContain("1")
    })
  })

  it("zeigt die sechs Filtergruppen als aufklappbare Checkbox-Gruppen", async () => {
    server.use(http.get("*/api/projects", () => HttpResponse.json(pageOf([]))))
    renderWithProviders(<ProjectListPage />)

    expect(
      screen.getByRole("heading", { level: 2, name: "Filter" })
    ).toBeInTheDocument()
    /* Jede Gruppe ist ein echter Aufklappknopf (Template "Projekte
       (Oeffentlich)"), keine tote Beschriftung wie im Kommt-bald-Rahmen
       aus KAN-31. */
    for (const group of [
      "Fakultät/Institution",
      "Studiengang",
      "Abschluss",
      "Semester",
      "Projekttyp",
      "Kategorie",
    ]) {
      expect(screen.getByRole("button", { name: group })).toBeInTheDocument()
    }
    /* Genau eine Gruppe steht offen (Akkordeon seit KAN-80): die
       Fakultaet. Ihre Optionen kommen aus den Stammdaten. */
    expect(
      await screen.findByRole("checkbox", {
        name: "Fakultät Elektrotechnik und Informatik",
      })
    ).not.toBeChecked()
    expect(
      screen.queryByRole("checkbox", { name: "Bachelor" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("checkbox", { name: "Webentwicklung" })
    ).not.toBeInTheDocument()

    /* Aufklappen zeigt die Optionen der neuen Gruppe und schliesst die
       vorige: mehr als eine offen gibt es nicht mehr. */
    await userEvent.click(screen.getByRole("button", { name: "Kategorie" }))
    expect(
      await screen.findByRole("checkbox", { name: "Webentwicklung" })
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByRole("checkbox", {
          name: "Fakultät Elektrotechnik und Informatik",
        })
      ).not.toBeInTheDocument()
    )
  })

  /*
   * Punkt 11 aus KAN-80: Jede Gruppe zaehlt ihre gesetzten Werte, offen wie
   * zugeklappt, und oben rechts steht der Weg zurueck auf null mit der
   * Gesamtzahl. Ohne gesetzten Filter gibt es ihn nicht.
   */
  it("zeigt je Gruppe die Zahl der gesetzten Werte und einen Weg zurueck auf null", async () => {
    const requests: URLSearchParams[] = []
    server.use(
      http.get("*/api/projects", ({ request }) => {
        requests.push(new URL(request.url).searchParams)
        return HttpResponse.json(pageOf([]))
      })
    )
    renderWithProviders(
      <ProjectListPage />,
      `/projects?faculty=${FACULTY_FK1}&faculty=${FACULTY_FK4}&degree=BACHELOR`
    )

    /* Zwei Fakultaeten, ein Abschluss: die Gruppe zaehlt ihre eigenen
       Werte, der Weg zurueck alle drei. */
    const facultyGroup = await screen.findByRole("button", {
      name: /Fakultät\/Institution/,
    })
    expect(facultyGroup).toHaveTextContent("2")
    expect(screen.getByRole("button", { name: /Abschluss/ })).toHaveTextContent(
      "1"
    )

    await userEvent.click(
      screen.getByRole("button", { name: "Zurücksetzen (3)" })
    )
    await waitFor(() => {
      expect(requests.at(-1)?.getAll("faculty")).toEqual([])
    })
    expect(requests.at(-1)?.getAll("degree")).toEqual([])
    expect(
      screen.queryByRole("button", { name: /Zurücksetzen/ })
    ).not.toBeInTheDocument()
  })

  it("zeigt den Weg zurueck auf null erst, wenn ein Filter gesetzt ist", async () => {
    server.use(http.get("*/api/projects", () => HttpResponse.json(pageOf([]))))
    renderWithProviders(<ProjectListPage />)

    expect(
      await screen.findByRole("heading", { level: 2, name: "Filter" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Zurücksetzen/ })
    ).not.toBeInTheDocument()
  })

  it("liest die Mehrfachauswahl aus der URL: Haekchen gesetzt, Parameter wiederholt im Request", async () => {
    const requests: URLSearchParams[] = []
    server.use(
      http.get("*/api/projects", ({ request }) => {
        requests.push(new URL(request.url).searchParams)
        return HttpResponse.json(pageOf([]))
      })
    )
    renderWithProviders(
      <ProjectListPage />,
      `/projects?faculty=${FACULTY_FK1}&faculty=${FACULTY_FK4}&degree=BACHELOR`
    )

    /* Der Reload-Fall: die Auswahl kommt vollstaendig aus der URL zurueck. */
    expect(
      await screen.findByRole("checkbox", {
        name: "Fakultät Architektur, Bau und Umwelt",
      })
    ).toBeChecked()
    expect(
      screen.getByRole("checkbox", {
        name: "Fakultät Elektrotechnik und Informatik",
      })
    ).toBeChecked()
    /* Offen steht die erste Gruppe mit Auswahl, hier die Fakultaet; der
       Abschluss ist zugeklappt und zeigt seine Zahl (KAN-80). */
    await userEvent.click(screen.getByRole("button", { name: /Abschluss/ }))
    expect(
      await screen.findByRole("checkbox", { name: "Bachelor" })
    ).toBeChecked()
    /* Zum Server geht die wiederholte Parameterform aus §6.1 (v43). */
    await waitFor(() => {
      expect(requests.at(-1)?.getAll("faculty")).toEqual([
        FACULTY_FK1,
        FACULTY_FK4,
      ])
    })
    expect(requests.at(-1)?.getAll("degree")).toEqual(["BACHELOR"])
  })

  it("waehlt per Checkbox an und ab und haelt URL-Parameter und Request synchron", async () => {
    const requests: URLSearchParams[] = []
    server.use(
      http.get("*/api/projects", ({ request }) => {
        requests.push(new URL(request.url).searchParams)
        return HttpResponse.json(pageOf([]))
      })
    )
    renderWithProviders(<ProjectListPage />, `/projects?type=PAPER&page=3`)

    /* Offen ist die Gruppe mit Auswahl, hier der Projekttyp (KAN-80).
       Anwahl ergaenzt den zweiten Wert desselben Parameters und setzt die
       Seite zurueck: die alte Seitenzahl gehoerte zur alten Treffermenge. */
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Thesis" })
    )
    await waitFor(() => {
      expect(requests.at(-1)?.getAll("type")).toEqual(["PAPER", "THESIS"])
    })
    expect(requests.at(-1)?.get("page")).toBeNull()

    /* Abwahl entfernt genau diesen Wert wieder aus URL und Request. */
    await userEvent.click(screen.getByRole("checkbox", { name: "Paper" }))
    await waitFor(() => {
      expect(requests.at(-1)?.getAll("type")).toEqual(["THESIS"])
    })
  })

  it("schraenkt die Studiengang-Optionen auf die gewaehlten Fakultaeten ein", async () => {
    server.use(http.get("*/api/projects", () => HttpResponse.json(pageOf([]))))
    renderWithProviders(<ProjectListPage />, `/projects?faculty=${FACULTY_FK4}`)

    await userEvent.click(
      await screen.findByRole("button", { name: "Studiengang" })
    )
    /* Nur die Studiengaenge der gewaehlten Fakultaet sind Optionen. */
    expect(
      await screen.findByRole("checkbox", { name: "Informatik" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("checkbox", { name: "Architektur" })
    ).not.toBeInTheDocument()
  })

  it("entfernt bei der Abwahl einer Fakultaet deren unsichtbar werdende Studiengaenge", async () => {
    const requests: URLSearchParams[] = []
    server.use(
      http.get("*/api/projects", ({ request }) => {
        requests.push(new URL(request.url).searchParams)
        return HttpResponse.json(pageOf([]))
      })
    )
    renderWithProviders(
      <ProjectListPage />,
      `/projects?faculty=${FACULTY_FK1}&faculty=${FACULTY_FK4}&studyProgram=${PROGRAM_INFORMATICS}`
    )

    /* Abwahl von FK4: Informatik verschwindet aus der Optionsliste und
       darf deshalb nicht weiter filtern (Klaerungsrunde zu KAN-64). */
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Fakultät Elektrotechnik und Informatik",
      })
    )
    await waitFor(() => {
      expect(requests.at(-1)?.getAll("faculty")).toEqual([FACULTY_FK1])
    })
    expect(requests.at(-1)?.getAll("studyProgram")).toEqual([])
  })

  it("oeffnet eine per Template zugeklappte Gruppe, wenn die URL eine Auswahl traegt", async () => {
    server.use(http.get("*/api/projects", () => HttpResponse.json(pageOf([]))))
    renderWithProviders(
      <ProjectListPage />,
      `/projects?category=${CATEGORY_WEB}`
    )

    /* Offen steht die erste Gruppe mit Auswahl; ohne diese Regel waere die
       wirksame Filterung nach einem Reload unsichtbar. */
    expect(
      await screen.findByRole("checkbox", { name: "Webentwicklung" })
    ).toBeChecked()
  })

  it("zeigt einen Fehler der Optionsliste aus dem Envelope in der Gruppe an", async () => {
    server.use(
      http.get("*/api/projects", () => HttpResponse.json(pageOf([]))),
      http.get("*/api/faculties", () =>
        apiErrorResponse(500, "INTERNAL_ERROR", "/api/faculties")
      )
    )
    renderWithProviders(<ProjectListPage />)

    /* Alle vier Optionslisten teilen denselben OptionsState; der
       Fehlerzweig ist damit einmal belegt. */
    expect(
      await screen.findByText(
        "Etwas ist schiefgelaufen. Bitte versuchen Sie es später erneut."
      )
    ).toBeInTheDocument()
  })

  it("zeigt die Leermeldung, wenn eine Gruppe keine Optionen hat", async () => {
    server.use(
      http.get("*/api/projects", () => HttpResponse.json(pageOf([]))),
      http.get("*/api/categories", () => HttpResponse.json([]))
    )
    renderWithProviders(<ProjectListPage />)

    await userEvent.click(
      await screen.findByRole("button", { name: "Kategorie" })
    )
    expect(
      await screen.findByText("Keine Optionen verfügbar.")
    ).toBeInTheDocument()
  })

  it("filtert die Semester-Gruppe ueber die IDs aus GET /api/semesters", async () => {
    const requests: URLSearchParams[] = []
    server.use(
      http.get("*/api/projects", ({ request }) => {
        requests.push(new URL(request.url).searchParams)
        return HttpResponse.json(pageOf([]))
      })
    )
    renderWithProviders(<ProjectListPage />)

    /* Die Semester-Gruppe steht seit KAN-80 zugeklappt: offen ist beim Start
       nur die Fakultaet. */
    await userEvent.click(
      await screen.findByRole("button", { name: /Semester/ })
    )
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "WiSe 2025/26" })
    )
    /* Gewaehlt wird die ID der Stammdatenzeile, nicht die Schreibweise
       (§3.18, Contract v45). */
    await waitFor(() => {
      expect(requests.at(-1)?.getAll("semester")).toEqual([SEMESTER_WISE])
    })
  })

  it("bietet bei einer Seite jenseits von totalPages den Weg zur letzten Seite", async () => {
    server.use(
      http.get("*/api/projects", ({ request }) =>
        HttpResponse.json(
          /* Seite 99 existiert nicht: leerer Inhalt, aber 40 Treffer auf
             zwei Seiten. Ein veralteter geteilter Link ist hier das
             Kernszenario. */
          new URL(request.url).searchParams.get("page") === null
            ? pageOf(
                [
                  projectCard({
                    id: "10000000-0000-0000-0000-000000000006",
                    title: "Campus-Garten an der Werderstraße",
                  }),
                ],
                40
              )
            : pageOf([], 40, 98)
        )
      )
    )
    renderWithProviders(<ProjectListPage />, "/projects?page=99")

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Diese Seite gibt es nicht mehr",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Zur letzten Seite" })
    ).toHaveAttribute("href", "/projects?page=2")
  })

  it("reicht einen sort-Parameter aus der URL nicht an den Server weiter", async () => {
    const requests: URLSearchParams[] = []
    server.use(
      http.get("*/api/projects", ({ request }) => {
        requests.push(new URL(request.url).searchParams)
        return HttpResponse.json(pageOf([]))
      })
    )
    renderWithProviders(<ProjectListPage />, "/projects?sort=passwortHash,asc")

    await screen.findByRole("heading", {
      level: 2,
      name: "Keine Projekte vorhanden",
    })
    /* Die Bibliothek bietet kein Sortier-Element an (Entscheidung zu
       KAN-31): es gilt der Server-Standard updatedAt,desc, und eine von
       Hand geschriebene URL kann kein Feld ausserhalb der Positivliste
       (§6.6) zum Server durchreichen. */
    expect(requests.at(-1)?.get("sort")).toBeNull()
  })

  it("nennt eine leere Treffermenge bei aktiver Suche Keine Treffer", async () => {
    server.use(http.get("*/api/projects", () => HttpResponse.json(pageOf([]))))
    renderWithProviders(<ProjectListPage />, "/projects?q=unbekannt")

    expect(
      await screen.findByRole("heading", { level: 2, name: "Keine Treffer" })
    ).toBeInTheDocument()
  })
})
