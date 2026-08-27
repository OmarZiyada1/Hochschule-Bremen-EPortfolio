import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type {
  BlockResponse,
  ProjectDetailResponse,
  StatusHistoryResponse,
} from "@/api/types"
import ProjectDetailPage from "@/features/projects/ProjectDetailPage"
import i18n from "@/i18n"
import { person, reference } from "@/tests/fixtures"
import {
  apiErrorResponse,
  currentUserHandler,
  fileBlobHandler,
} from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { LocationProbe, signInAs } from "@/tests/routes/helpers"

/*
 * Die Detailtiefe der Blockdarstellung (data-width, data-columns, beide
 * Videoquellen, fremder Einbettungs-Host) liegt beim Renderer und ist in
 * ProjectContent.test.tsx aus KAN-10 geprueft. Hier steht der Durchstich
 * durch die Seite und alles, was diese Seite selbst beitraegt.
 *
 * jsdom laedt weder Bilder noch iframes noch Medienstroeme; geprueft werden
 * Struktur und Attribute.
 */

const PROJECT_ID = "8f14e45f-ceea-467a-9c9e-1f1e3a3d4b5c"
const FILE_A = "11111111-2222-4333-8444-555555555555"
const FILE_B = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"

function paragraph(text: string) {
  return {
    type: "paragraph",
    attrs: { textAlign: null },
    content: [{ type: "text", text }],
  }
}

/**
 * Je ein Block aller vierzehn Typen aus §2.5. LIST kommt zweimal vor
 * (bulletList und orderedList bilden beide auf LIST ab), damit jeder
 * Knotenname des Typmodells wirklich einmal durchlaeuft.
 */
const ALL_BLOCK_NODES: unknown[] = [
  {
    type: "heading",
    attrs: { level: 2 },
    content: [{ type: "text", text: "Aufbau" }],
  },
  paragraph("Ein Absatz im Fliesstext."),
  {
    type: "bulletList",
    content: [{ type: "listItem", content: [paragraph("Erster Punkt")] }],
  },
  {
    type: "orderedList",
    attrs: { start: 1 },
    content: [{ type: "listItem", content: [paragraph("Erster Schritt")] }],
  },
  { type: "blockquote", content: [paragraph("Ein Zitat.")] },
  {
    type: "codeBlock",
    attrs: { language: "java" },
    content: [{ type: "text", text: "int a = 1;" }],
  },
  { type: "mathBlock", attrs: { latex: "E = mc^2" } },
  {
    type: "table",
    attrs: { caption: "Messreihe" },
    content: [
      {
        type: "tableRow",
        content: [
          { type: "tableHeader", attrs: {}, content: [paragraph("Groesse")] },
          { type: "tableHeader", attrs: {}, content: [paragraph("Wert")] },
        ],
      },
      {
        type: "tableRow",
        content: [
          { type: "tableHeader", attrs: {}, content: [paragraph("Masse")] },
          { type: "tableCell", attrs: {}, content: [paragraph("12 kg")] },
        ],
      },
    ],
  },
  { type: "horizontalRule" },
  {
    type: "imageBlock",
    attrs: { fileId: FILE_A, alt: "Ein Messaufbau", caption: "", width: 75 },
  },
  {
    type: "galleryBlock",
    attrs: {
      items: [{ fileId: FILE_A, alt: "Erstes Bild" }],
      columns: 2,
      caption: "",
    },
  },
  { type: "videoBlock", attrs: { fileId: FILE_A, caption: "" } },
  { type: "audioBlock", attrs: { fileId: FILE_B, caption: "" } },
  {
    type: "documentBlock",
    attrs: { fileId: FILE_A, fileName: "bericht.pdf", size: 2_400_000 },
  },
  {
    type: "embedBlock",
    attrs: {
      provider: "codepen",
      /* Seit Contract v64 muss der Pfad die Einbettung sein:
         /<user>/embed/<slug> und nicht die Pen-Seite. */
      embedUrl: "https://codepen.io/a/embed/abc",
      height: 520,
    },
  },
]

function blocksOf(contents: unknown[]): BlockResponse[] {
  return contents.map((content, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    type: "TEXT",
    orderIndex: index,
    schemaVersion: 2,
    content: content as BlockResponse["content"],
  }))
}

const HISTORY: StatusHistoryResponse[] = [
  {
    /* Erster Eintrag, deshalb ohne Vorzustand (§3.12). */
    fromStatus: null,
    toStatus: "DRAFT",
    changedBy: person({ id: "u-1" }),
    timestamp: "2026-03-01T09:00:00Z",
  },
  {
    fromStatus: "SUBMITTED",
    toStatus: "PUBLISHED",
    changedBy: person({ id: "u-2", firstName: "Jo", lastName: "Schmidt" }),
    timestamp: "2026-05-02T10:30:00Z",
  },
]

/*
 * Der Server schickt die gesperrten Listenfelder ausdruecklich als null
 * (Jackson steht auf Include.ALWAYS). Seit KAN-74 sagt die generierte
 * schema.d.ts das auch: editors und statusHistory stehen dort als
 * "| null". Der eigene Testtyp, der diese Wahrheit bis dahin von Hand
 * nachtrug, ist damit entfallen; gemockt wird gegen den echten Antworttyp.
 */
type DetailResponseOverrides = Partial<ProjectDetailResponse>

function projectResponse(
  overrides: DetailResponseOverrides = {}
): ProjectDetailResponse {
  return {
    id: PROJECT_ID,
    title: "SmartCampus: IoT-gestuetztes Gebaeudemanagement",
    summary: "Ein verteiltes Sensornetzwerk mit Edge-Inferenz.",
    coverImageUrl: null,
    status: "PUBLISHED",
    projectType: "THESIS",
    degree: "BACHELOR",
    semester: reference({
      id: "s-1",
      name: "WiSe 2025/26",
      abbreviation: null,
    }),
    category: reference({
      id: "c-1",
      name: "Digitalisierung",
      abbreviation: null,
    }),
    faculty: {
      id: "f-1",
      name: "Elektrotechnik und Informatik",
      abbreviation: "FK4",
    },
    studyProgram: { id: "p-1", name: "Informatik", abbreviation: "INF" },
    module: reference({
      id: "m-1",
      name: "Bachelorarbeit",
      abbreviation: null,
    }),
    author: person({ id: "u-1", firstName: "Lena", lastName: "Mueller" }),
    /* Die Autor:in ist kein Mitglied (§3.13.1), traegt aber seit Contract
       v66 ihre eigene Funktionsbezeichnung. */
    authorRole: "Konzept",
    members: [
      {
        userId: "u-3",
        avatarUrl: null,
        firstName: "Tobias",
        lastName: "Lang",
        projectRole: "Frontend",
      },
    ],
    tags: ["IoT", "Machine Learning"],
    blocks: blocksOf(ALL_BLOCK_NODES),
    reactionCount: 142,
    /* Seit Contract v84 (§3.10): der Standardfall ist "noch nicht geklatscht";
       die Tests zum gefuellten Symbol setzen ihn ausdruecklich auf true. */
    hasReacted: false,
    /*
     * Ausdruecklich null und nicht weggelassen: Jackson steht auf
     * Include.ALWAYS, der Server schickt "statusHistory": null. Ein Mock, der
     * den Schluessel weglaesst, prueft einen Zustand, den es nie gibt, und
     * verdeckte genau den Fehler, an dem die Seite fuer jede unbeteiligte
     * Person in einen TypeError lief (Befund des contract-pruefers).
     */
    editors: null,
    statusHistory: null,
    version: 3,
    publishedAt: "2025-10-15T08:00:00Z",
    createdAt: "2025-09-01T08:00:00Z",
    updatedAt: "2025-10-15T08:00:00Z",
    ...overrides,
  }
}

function detailHandler(body: ProjectDetailResponse) {
  return http.get(`*/api/projects/${PROJECT_ID}`, () => HttpResponse.json(body))
}

function renderPage() {
  return renderWithProviders(
    <>
      <ProjectDetailPage />
      {/* Die Adresse bleibt ablesbar, wenn die Seite weiterleitet
          (Umschalter in den Editor, KAN-36). */}
      <LocationProbe />
    </>,
    `/projects/${PROJECT_ID}`
  )
}

/**
 * Der Status-Badge neben dem Titel. Gesucht wird im Kopfblock und nicht auf
 * der ganzen Seite: „Veroeffentlicht" steht auch als Zeilenname in der
 * Metadaten-Seitenleiste, ein Textabgleich ueber das Dokument traefe beide.
 */
function statusBadge(): HTMLElement | null {
  const heading = screen.queryByRole("heading", { level: 1 })
  const header = heading?.closest("div")?.parentElement
  if (!header) {
    return null
  }
  return within(header).queryByText("Veröffentlicht")
}

/*
 * useParams liest aus der Route, die Seite wird hier aber direkt gerendert.
 * Der Router-Kontext kommt aus renderWithProviders; die ID reicht der Test
 * ueber denselben Mechanismus wie die Anwendung durch.
 */
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return { ...actual, useParams: () => ({ projectId: PROJECT_ID }) }
})

/**
 * Der Veroeffentlichungsmonat in der Schreibweise, die die Seitenleiste
 * selbst benutzt.
 *
 * <p><strong>Ausgerechnet und nicht hingeschrieben.</strong> Die Zeile
 * entsteht ueber {@code Intl.DateTimeFormat} mit der Sprache der
 * Oberflaeche; deutsch trennt sie mit einem Punkt, englisch mit einem
 * Schraegstrich. Ein festes „10/2025" im Test prueft deshalb nicht die
 * Seite, sondern die Sprache, in der sie zufaellig gerendert wurde, und
 * faellt um, sobald die ICU-Daten der Laufzeit vollstaendig sind.
 */
function publishedMonth(): string {
  return new Intl.DateTimeFormat(i18n.language, {
    month: "2-digit",
    year: "numeric",
  }).format(new Date("2025-10-15T08:00:00Z"))
}

describe("Inhalt und Gliederung", () => {
  beforeEach(() => {
    server.use(detailHandler(projectResponse()))
  })

  it("stellt ein veroeffentlichtes Projekt mit Bloecken aller vierzehn Typen dar", async () => {
    const { container } = renderPage()

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "SmartCampus: IoT-gestuetztes Gebaeudemanagement",
      })
    ).toBeInTheDocument()

    /* Kein Typ faellt durch die Whitelist: der Renderer setzt an die Stelle
       eines verworfenen Blocks eine sichtbare Notiz (role="note"). Die
       Formel wird nachgeladen, deshalb erst warten.

       Fuenf Sekunden statt der voreingestellten einen: geladen wird hier
       KaTeX als eigenes Buendel, und im vollen Lauf teilen sich alle
       Testdateien dieselben Kerne. Der Fall ist einzeln stets gruen und im
       Gesamtlauf gelegentlich rot gewesen, also eine Frage der Last und
       nicht des Verhaltens. */
    await waitFor(
      () => {
        expect(container.querySelector("math")).not.toBeNull()
      },
      { timeout: 5000 }
    )
    expect(screen.queryAllByRole("note")).toHaveLength(0)

    expect(container.querySelector("ul")).not.toBeNull()
    expect(container.querySelector("ol")).not.toBeNull()
    expect(container.querySelector("blockquote")).not.toBeNull()
    expect(container.querySelector("pre")).not.toBeNull()
    expect(container.querySelector("table")).not.toBeNull()
    expect(container.querySelector("video")).not.toBeNull()
    expect(container.querySelector("audio")).not.toBeNull()
    expect(container.querySelector("iframe")).not.toBeNull()
    expect(
      screen.getByRole("img", { name: "Ein Messaufbau" })
    ).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Erstes Bild" })).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /bericht\.pdf/ })
    ).toBeInTheDocument()
  })

  it("fuehrt genau eine h1, und keine Blockueberschrift ist eine h1", async () => {
    renderPage()

    await screen.findByRole("heading", { level: 1 })
    const level1 = screen.getAllByRole("heading", { level: 1 })
    expect(level1).toHaveLength(1)
    expect(level1[0]).toHaveTextContent(
      "SmartCampus: IoT-gestuetztes Gebaeudemanagement"
    )

    /* Die Blockueberschrift aus dem Dokument steht auf Ebene 2 (§2.5). */
    expect(
      screen.getByRole("heading", { level: 2, name: "Aufbau" })
    ).toBeInTheDocument()
  })

  it("fuehrt den Beitrag ohne sichtbare Rubrik und ohne Trennlinie", async () => {
    renderPage()

    const title = await screen.findByRole("heading", { level: 1 })

    /*
     * „Projektbeschreibung" bleibt im Dokument, aber nur fuer Hilfsmittel
     * (KAN-83): sichtbar sollen Titel, Kurzbeschreibung und Beitrag
     * ineinander uebergehen, in der Ueberschriftenliste eines Screenreaders
     * dagegen braucht der Hauptteil der Seite eine Sprungmarke zwischen der
     * h1 und der ersten Blockueberschrift (SC 1.3.1).
     *
     * Geprueft wird die Klasse und nicht toBeVisible: sr-only versteckt
     * ueber clip, und jsdom laedt kein Tailwind.
     */
    const rubric = screen.getByRole("heading", {
      level: 2,
      name: i18n.t("project.detail.content"),
    })
    expect(rubric).toHaveClass("sr-only")
    expect(rubric).not.toHaveClass("type-h2")

    /* Sie benennt zugleich den Abschnitt. Eine Ueberschrift <em>in</em>
       einem section benennt ihn naemlich nicht, und ohne Namen faellt er
       aus der Landmark-Liste. */
    const region = screen.getByRole("region", {
      name: i18n.t("project.detail.content"),
    })
    expect(region).toContainElement(rubric)

    /* Zwischen Kurzbeschreibung und Beitrag steht nichts mehr: kein
       Trennstrich und keine sichtbare Rubrik. Geprueft werden nur die
       unmittelbaren Kinder des Beitrags, denn der Beitrag selbst fuehrt
       einen horizontalRule-Block und damit eine eigene hr. */
    const summary = screen.getByText(
      "Ein verteiltes Sensornetzwerk mit Edge-Inferenz."
    )
    expect(summary.nextElementSibling).toBe(region)
    const article = title.closest("article") as HTMLElement
    expect(article.querySelector(":scope > hr")).toBeNull()
  })

  it("oeffnet die Projektdaten schmal als Schublade von rechts", async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByRole("heading", { level: 1 })
    expect(screen.queryByRole("dialog")).toBeNull()

    /*
     * jsdom laedt kein Tailwind, lg:hidden und hidden lg:block greifen hier
     * also nicht: Karte und Knopf stehen beide im Dokument. Geprueft wird
     * deshalb die Mechanik, nicht der Umbruch. Dass die Karte ab lg steht
     * und der Knopf darunter, entscheidet CSS und keine Bedingung im Code.
     */
    /* Der Aufklapper der Karte, festgehalten vor dem Oeffnen: sobald die
       Schublade modal aufgeht, liegt der Rest des Dokuments unter
       aria-hidden und ist ueber die Rolle nicht mehr auffindbar. */
    const cardInfo = screen.getByRole("button", {
      name: i18n.t("projectContent.sidebar.projectInfo"),
    })

    await user.click(
      screen.getByRole("button", { name: "Projektdaten anzeigen" })
    )

    /* Derselbe Baustein wie in der Karte: die Schublade fuehrt keine zweite
       Fassung der Projektdaten, sondern ProjectInfoPanel. */
    const drawer = await screen.findByRole("dialog")
    /* Der Titel der Schublade, nicht der Aufklapper darin: „Projektdaten"
       benennt die Flaeche, „Projektinformationen" den Kasten. */
    expect(within(drawer).getByText("Projektdaten")).toBeInTheDocument()

    /*
     * Auch hier ein Aufklapper und nicht die nackte Liste (KAN-83): die
     * beiden Orte der Projektinformationen muessen gleich funktionieren,
     * sonst haengt die Bedienbarkeit an der Fensterbreite.
     */
    const drawerInfo = within(drawer).getByRole("button", {
      name: i18n.t("projectContent.sidebar.projectInfo"),
    })
    expect(drawerInfo).toHaveAttribute("aria-expanded", "true")

    expect(within(drawer).getByText("Digitalisierung")).toBeInTheDocument()
    expect(within(drawer).getByText("WiSe 2025/26")).toBeInTheDocument()
    expect(within(drawer).getByText(publishedMonth())).toBeInTheDocument()
    /* Nicht nur die Metadaten: die Reaktionen sind Teil desselben Panels
       und waeren schmal sonst gar nicht erreichbar. */
    expect(within(drawer).getByText("Reaktionen")).toBeInTheDocument()

    /*
     * Die beiden Orte fuehren je einen eigenen Zustand und kommen sich
     * nicht in die Quere: sichtbar ist immer nur einer von beiden, und ein
     * geteilter Zustand verknuepfte zwei Flaechen, die einander nie
     * begegnen. Geprueft in jsdom, wo lg:hidden nicht greift und deshalb
     * beide im Dokument stehen.
     */
    expect(drawer).not.toContainElement(cardInfo)
    await user.click(drawerInfo)
    expect(drawerInfo).toHaveAttribute("aria-expanded", "false")
    expect(cardInfo).toHaveAttribute("aria-expanded", "true")
  })

  it("zeigt die Metadaten der Seitenleiste mit der Autor:in vor den Mitgliedern", async () => {
    renderPage()

    await screen.findByRole("heading", { level: 1 })

    expect(screen.getByText("Digitalisierung")).toBeInTheDocument()
    expect(screen.getByText("WiSe 2025/26")).toBeInTheDocument()
    expect(screen.getByText(publishedMonth())).toBeInTheDocument()

    /* Der Studiengang steht mit vollem Namen und dem Kuerzel in Klammern
       (Entscheidung zu KAN-80): auf der Kachel ist aus Platzgruenden nur die
       Kurzform zu sehen, und hier steht ihre Aufloesung. Bis dahin fehlte
       das Kuerzel hier ganz (Vorgabe zur Abnahme von KAN-32). */
    expect(screen.getByText("Informatik (INF)")).toBeInTheDocument()

    const members = screen.getByText("Projektmitglieder").parentElement
    const names = within(members as HTMLElement).getAllByRole("listitem")
    expect(names).toHaveLength(2)
    /* Die Autor:in steht vorn und traegt seit Contract v66 ihre eigene
       Funktionsbezeichnung. */
    expect(names[0]).toHaveTextContent("Lena Mueller · Konzept")
    expect(names[1]).toHaveTextContent("Tobias Lang · Frontend")
  })
})

describe("Titelbild", () => {
  it("zeigt es nur, wenn coverImageUrl gesetzt ist", async () => {
    server.use(detailHandler(projectResponse({ coverImageUrl: undefined })))
    const { container, unmount } = renderPage()

    await screen.findByRole("heading", { level: 1 })
    /* Nur die Bilder aus dem Blockinhalt, keine Titelbildflaeche. */
    const withoutCover = container.querySelectorAll("img").length
    unmount()

    server.use(
      detailHandler(projectResponse({ coverImageUrl: `/api/files/${FILE_B}` }))
    )
    const second = renderPage()

    await screen.findByRole("heading", { level: 1 })
    expect(second.container.querySelectorAll("img")).toHaveLength(
      withoutCover + 1
    )
  })
})

describe("Reaktionen", () => {
  it("zeigt das gefuellte Symbol, wenn die Person schon reagiert hat", async () => {
    /*
     * §3.10 seit Contract v84 (KAN-83): hasReacted kommt vom Server, der
     * gedrueckte Zustand ueberlebt damit ein Neuladen. Vorher merkte die
     * Schaltflaeche sich nur die eigene Aktion innerhalb der geoeffneten
     * Seite; mit zwei verschiedenen Symbolen waere das eine falsche
     * Auskunft gewesen.
     */
    signInAs("STUDENT")
    server.use(detailHandler(projectResponse({ hasReacted: true })))

    renderPage()
    await screen.findByRole("heading", { level: 1 })

    /* Der Name der Schaltflaeche sagt, was ein Klick tut: zuruecknehmen,
       nicht reagieren. */
    expect(
      screen.getByRole("button", { name: /zurücknehmen/i })
    ).toBeInTheDocument()
  })

  it("zeigt ohne eigene Reaktion die Handlung an", async () => {
    signInAs("STUDENT")
    server.use(detailHandler(projectResponse({ hasReacted: false })))

    renderPage()
    await screen.findByRole("heading", { level: 1 })

    expect(
      screen.getByRole("button", { name: /Reagieren/ })
    ).toBeInTheDocument()
  })

  it("aktualisiert den Zaehler aus der Antwort, ohne Reload, und vertraegt zwei Klicks", async () => {
    signInAs("STUDENT")
    const user = userEvent.setup()
    let posted = 0
    let deleted = 0

    server.use(
      detailHandler(projectResponse()),
      http.post(`*/api/projects/${PROJECT_ID}/reaction`, () => {
        posted += 1
        return HttpResponse.json({ count: 143 })
      }),
      http.delete(`*/api/projects/${PROJECT_ID}/reaction`, () => {
        deleted += 1
        return HttpResponse.json({ count: 142 })
      })
    )

    renderPage()
    await screen.findByRole("heading", { level: 1 })
    expect(screen.getByText("142")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Reagieren/ }))
    expect(await screen.findByText("143")).toBeInTheDocument()

    /* Zweiter Klick nimmt zurueck; beide Richtungen sind idempotent und der
       Zaehler folgt immer der Antwort, er wird nie im Client gezaehlt. */
    await user.click(screen.getByRole("button", { name: /zurücknehmen/i }))
    expect(await screen.findByText("142")).toBeInTheDocument()

    expect(posted).toBe(1)
    expect(deleted).toBe(1)
    /* Kein Neuladen der Seite: der Titel steht unveraendert, ohne dass die
       Ansicht durch den Ladezustand gelaufen waere. */
    expect(
      screen.getByRole("heading", { level: 1, name: /SmartCampus/ })
    ).toBeInTheDocument()
  })

  it("ist an einem nicht veroeffentlichten Projekt gesperrt und nennt den Grund", async () => {
    signInAs("STUDENT")
    const user = userEvent.setup()
    /* Kein Handler fuer die Reaktionspfade: onUnhandledRequest steht auf
       "error", ein hinausgehender Request waere damit ein Testfehler. §3.10
       fuehrt Reaktionen ausdruecklich auf ein veroeffentlichtes Projekt, der
       Server antwortete sonst mit 403 NO_PERMISSION. */
    server.use(
      detailHandler(
        projectResponse({ status: "DRAFT", statusHistory: HISTORY })
      )
    )

    renderPage()
    await screen.findByRole("heading", { level: 1 })

    const button = screen.getByRole("button", { name: /Reagieren/ })
    expect(button).toBeDisabled()
    expect(
      screen.getByText(
        "Auf dieses Projekt lässt sich nicht reagieren, solange es nicht veröffentlicht ist."
      )
    ).toBeInTheDocument()

    await user.click(button)
    expect(screen.getByText("142")).toBeInTheDocument()
  })

  it("macht einen 403 aus der Mutation sichtbar", async () => {
    signInAs("STUDENT")
    const user = userEvent.setup()
    server.use(
      detailHandler(projectResponse()),
      http.post(`*/api/projects/${PROJECT_ID}/reaction`, () =>
        apiErrorResponse(
          403,
          "NO_PERMISSION",
          `/api/projects/${PROJECT_ID}/reaction`
        )
      )
    )

    renderPage()
    await screen.findByRole("heading", { level: 1 })
    await user.click(screen.getByRole("button", { name: /Reagieren/ }))

    /* Nie stumm scheitern (Frontend-Regel 4). */
    expect(await screen.findByRole("alert")).toBeInTheDocument()
    expect(screen.getByText("142")).toBeInTheDocument()
  })

  it("ist ohne Anmeldung nicht bedienbar, nennt den Grund und schickt keinen Request", async () => {
    const user = userEvent.setup()
    /*
     * Kein Handler fuer die Reaktionspfade: server.use laeuft mit
     * onUnhandledRequest "error", ein Request waere damit ein Testfehler.
     */
    server.use(detailHandler(projectResponse()))

    renderPage()
    await screen.findByRole("heading", { level: 1 })

    const button = screen.getByRole("button", { name: /Reagieren/ })
    expect(button).toBeDisabled()
    expect(
      screen.getByText(
        "Melden Sie sich an, um auf dieses Projekt zu reagieren."
      )
    ).toBeInTheDocument()

    await user.click(button)
    expect(screen.getByText("142")).toBeInTheDocument()
  })
})

describe("Sichtbarkeitsunterschiede", () => {
  it("zeigt ohne statusHistory keinen Status-Badge", async () => {
    server.use(detailHandler(projectResponse()))
    renderPage()

    await screen.findByRole("heading", { level: 1 })
    /* Oeffentlich ist ohnehin alles PUBLISHED, dort unterschiede der Badge
       nichts (Klaerungsrunde zu KAN-32). Gesucht wird der Badge, nicht der
       Text: "Veroeffentlicht" ist zugleich die Beschriftung der Zeile
       "Veroeffentlicht 10.2025" in der Seitenleiste. */
    expect(statusBadge()).toBeNull()
  })

  it("zeigt mit statusHistory den Status-Badge, aber keinen Verlauf", async () => {
    signInAs("STUDENT")
    server.use(detailHandler(projectResponse({ statusHistory: HISTORY })))

    renderPage()
    await screen.findByRole("heading", { level: 1 })

    expect(statusBadge()).not.toBeNull()

    /* statusHistory bleibt das Kennzeichen der Beteiligten und steuert den
       Badge, wird aber nicht mehr ausgegeben: der Aktivitaetsverlauf gehoert
       in den Editor (KAN-36) und nicht in die Leseansicht (Vorgabe zur
       Abnahme von KAN-32). */
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByText("Aktivitätsverlauf")).toBeNull()
    expect(screen.queryByText(/Jo Schmidt/)).toBeNull()
  })

  it("laesst den Redaktionsabschnitt weg, wenn editors fehlt", async () => {
    server.use(detailHandler(projectResponse({ editors: null })))
    renderPage()

    await screen.findByRole("heading", { level: 1 })
    expect(screen.queryByText("Redakteur:innen")).toBeNull()
  })

  it('zeigt den Satz "im Rahmen des Studiengangs" nirgends mehr (KAN-83)', async () => {
    server.use(detailHandler(projectResponse()))
    renderPage()

    await screen.findByRole("heading", { level: 1 })
    /*
     * Der Redaktionshinweis ist ersatzlos entfallen. Er wiederholte, was
     * die Metadatenspalte daneben ohnehin als eigene Rubriken fuehrt
     * (Studiengang, Semester, Redaktion), und las sich als Aussage des
     * Beitrags, obwohl ihn niemand geschrieben hatte.
     */
    expect(screen.queryByText(/im Rahmen des Studiengangs/)).toBeNull()
    expect(screen.queryByText(/durchgeführt/)).toBeNull()
    expect(screen.queryByText(/redigiert/)).toBeNull()
  })

  it("zeigt die Redaktion, sobald der Server sie liefert (§3.3, seit Contract v55)", async () => {
    server.use(
      detailHandler(
        projectResponse({
          editors: [
            person({ id: "u-9", firstName: "Jo", lastName: "Schmidt" }),
          ],
        })
      )
    )
    renderPage()

    await screen.findByRole("heading", { level: 1 })
    /* Nur noch die Rubrik in der Metadatenspalte; den Redaktionshinweis
       im Beitrag gibt es seit KAN-83 nicht mehr. */
    expect(screen.getByText("Redakteur:innen")).toBeInTheDocument()
    expect(screen.getByText(/Jo Schmidt/)).toBeInTheDocument()
  })
})

describe("Fehlerfaelle", () => {
  it("landet bei 404 PROJECT_NOT_FOUND sichtbar auf der Auffangroute", async () => {
    server.use(
      http.get(`*/api/projects/${PROJECT_ID}`, () =>
        apiErrorResponse(
          404,
          "PROJECT_NOT_FOUND",
          `/api/projects/${PROJECT_ID}`
        )
      )
    )

    renderPage()

    /* Bewusst nicht NotFoundPage: die liegt ausserhalb der Layout-Route und
       braechte hier ein zweites main und eine zweite Fusszeile mit. Geprueft
       wird deshalb der Leerzustand dieser Seite samt Weg hinaus. */
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Projekt nicht gefunden",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Zur Projektbibliothek" })
    ).toBeInTheDocument()
    expect(document.querySelectorAll("main")).toHaveLength(0)
  })

  it("zeigt bei 403 NO_PERMISSION einen Leerzustand statt einer leeren Seite", async () => {
    signInAs("STUDENT")
    server.use(
      http.get(`*/api/projects/${PROJECT_ID}`, () =>
        apiErrorResponse(403, "NO_PERMISSION", `/api/projects/${PROJECT_ID}`)
      )
    )

    renderPage()

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Kein Zugriff auf dieses Projekt",
      })
    ).toBeInTheDocument()
    /* Die Handlung ist ein Link im Knopfgewand: Button rendert mit
       nativeButton={false} ein a mit role="button". */
    expect(
      screen.getByRole("button", { name: "Zur Projektbibliothek" })
    ).toBeInTheDocument()
  })
})

describe("Weg zurueck in den Editor (KAN-36)", () => {
  /*
   * Die zweite Haelfte des Umschalters: im Editor fuehrt er auf diese
   * Seite, hier zurueck. Eine Vorschau ohne Weg zurueck waere eine
   * Sackgasse.
   */
  const SIGNED_IN_ID = "00000000-0000-0000-0000-000000000001"

  it("zeigt der Autor:in im Entwurf den Schalter und fuehrt in den Editor", async () => {
    const user = userEvent.setup()
    server.use(
      fileBlobHandler(),
      detailHandler(
        projectResponse({
          status: "DRAFT",
          author: person({ id: SIGNED_IN_ID, firstName: "Mira" }),
        })
      )
    )
    signInAs("STUDENT")
    renderPage()

    await screen.findByRole("heading", { level: 1 })
    await user.click(screen.getByRole("switch", { name: "Bearbeiten" }))

    await waitFor(() =>
      expect(screen.getByTestId("pathname")).toHaveTextContent(
        `/projects/${PROJECT_ID}/editor`
      )
    )
  })

  it("zeigt ihn nicht bei einem veroeffentlichten Projekt", async () => {
    /* Inhaltsbearbeitung gibt es nur in DRAFT und REVISION (§4.1); ein
       Schalter „Bearbeiten" waere hier ein Weg, der mit 409 endet. */
    server.use(
      detailHandler(
        projectResponse({
          status: "PUBLISHED",
          author: person({ id: SIGNED_IN_ID, firstName: "Mira" }),
        })
      )
    )
    signInAs("STUDENT")
    renderPage()

    await screen.findByRole("heading", { level: 1 })
    expect(
      screen.queryByRole("switch", { name: "Bearbeiten" })
    ).not.toBeInTheDocument()
  })

  it("zeigt ihn einer unbeteiligten Person nicht", async () => {
    server.use(
      fileBlobHandler(),
      detailHandler(projectResponse({ status: "DRAFT" }))
    )
    signInAs("STUDENT")
    renderPage()

    await screen.findByRole("heading", { level: 1 })
    expect(
      screen.queryByRole("switch", { name: "Bearbeiten" })
    ).not.toBeInTheDocument()
  })
})

describe("Medien eines noch nicht veroeffentlichten Beitrags (KAN-36)", () => {
  /*
   * GET /api/files/{id} ist erst oeffentlich, wenn das Projekt PUBLISHED
   * ist (§3.15, §5). Ein img, video oder audio weist nichts nach, das
   * Token liegt im Store: in der Vorschau eines Entwurfs beantwortete der
   * Server deshalb jede Medienanfrage mit 401, und die Seite zeigte leere
   * Stellen, ohne Fehler und ohne Meldung. Seit KAN-36 loest die Seite
   * jede Datei eines nicht veroeffentlichten Beitrags ueber den
   * angemeldeten Weg auf.
   */
  function firstImage(): HTMLImageElement {
    return screen.getAllByRole("img")[0] as HTMLImageElement
  }

  it("holt die Bilder eines Entwurfs mit Token und zeigt sie", async () => {
    server.use(
      fileBlobHandler(),
      detailHandler(projectResponse({ status: "DRAFT" }))
    )
    signInAs("STUDENT")
    renderPage()

    await screen.findByRole("heading", { level: 1 })
    await waitFor(() =>
      expect(firstImage().getAttribute("src")).toMatch(/^blob:/)
    )
  })

  it("holt auch Video, Ton und Dokument eines Entwurfs mit Token", async () => {
    /* Die Vorschau ist die echte Seite und keine Nachbildung: ein Beitrag,
       in dem das Video fehlt, beantwortet die Frage nicht, um derentwillen
       jemand sie oeffnet. */
    server.use(
      fileBlobHandler(),
      detailHandler(projectResponse({ status: "DRAFT" }))
    )
    signInAs("STUDENT")
    const { container } = renderPage()

    await screen.findByRole("heading", { level: 1 })
    await waitFor(() => {
      expect(container.querySelector("video")?.getAttribute("src")).toMatch(
        /^blob:/
      )
      expect(container.querySelector("audio")?.getAttribute("src")).toMatch(
        /^blob:/
      )
      const link = container.querySelector('[data-block="document"] a')
      expect(link?.getAttribute("href")).toMatch(/^blob:/)
      /* Eine Object-URL traegt keinen Dateinamen; ohne download hiesse die
         gespeicherte Datei nach einer zufaelligen Kennung. */
      expect(link).toHaveAttribute("download")
    })
  })

  it("laesst ein veroeffentlichtes Projekt beim blossen Pfad", async () => {
    /* Dort ist die Datei oeffentlich und obendrein zwischenspeicherbar;
       ein Blob-Abruf naehme dem Browser genau das. */
    server.use(detailHandler(projectResponse({ status: "PUBLISHED" })))
    renderPage()

    await screen.findByRole("heading", { level: 1 })
    const src = firstImage().getAttribute("src") ?? ""
    expect(src).not.toMatch(/^blob:/)
    expect(src.endsWith(`/api/files/${FILE_A}`)).toBe(true)
  })

  it(
    "zeigt die Kommentarspalte im Arbeitszustand, damit die Autor:in ihre " +
      "Aenderungswuensche findet",
    async () => {
      /*
       * Die Luecke, die dieser Fall schliesst: bei SUBMITTED erreicht die
       * Autor:in weder den Editor (kein Stift, kein Umschalter) noch den
       * Review-Modus (rollengesperrt). Ihre Aenderungswuensche standen damit
       * an keiner Stelle, an die sie kommt, obwohl §2.3 sie jeder Person
       * zeigt, die das Projekt lesen darf.
       */
      signInAs("STUDENT")
      server.use(
        http.get("*/api/projects/:projectId/comments", () =>
          HttpResponse.json([
            {
              id: "c-1",
              author: person({ firstName: "Rita", lastName: "Redakteurin" }),
              type: "CHANGE_REQUEST",
              text: "Bitte die Quellen ergaenzen.",
              status: "OPEN",
              createdAt: "2026-02-01T10:00:00Z",
              updatedAt: "2026-02-01T10:00:00Z",
            },
          ])
        ),
        detailHandler(projectResponse({ status: "SUBMITTED" }))
      )

      renderPage()

      expect(
        await screen.findByText("Bitte die Quellen ergaenzen.")
      ).toBeInTheDocument()
    }
  )

  it("zeigt sie bei einem veroeffentlichten Projekt nicht", async () => {
    /* Dort ist die Seite die oeffentliche Ansicht; die Rueckmeldungen der
       Redaktion gehen die Oeffentlichkeit nichts an. */
    signInAs("STUDENT")
    server.use(
      currentUserHandler(),
      http.get("*/api/projects/:projectId/comments", () =>
        HttpResponse.json([])
      ),
      detailHandler(projectResponse({ status: "PUBLISHED" }))
    )

    renderPage()
    await screen.findByRole("heading", { level: 1 })

    expect(
      screen.queryByRole("region", { name: i18n.t("comment.panel.label") })
    ).toBeNull()
  })
})

describe("Die Aktion PDF", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  it("druckt die Seite, auch ohne Anmeldung", async () => {
    /*
     * Der Ausdruck (KAN-41) ist clientseitig und braucht keinen Endpoint:
     * wer die Seite sehen darf, darf sie drucken. Gedruckt wird der
     * Druckbereich, den ProjectPrintView an body haengt; hier steht nur der
     * Durchstich von der Schaltflaeche zu window.print.
     */
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined)
    /*
     * Ein Beitrag ohne Bild: die Aktion holt vor dem Druck die Bilder des
     * Druckbereichs, und in jsdom laedt kein Bild je fertig. Der Lauf
     * wartete sonst bis zur Obergrenze aus usePrintProject. Dass Bild und
     * Galerie im Ausdruck stehen, prueft ProjectPrintView.test.tsx.
     */
    server.use(
      detailHandler(
        projectResponse({ blocks: blocksOf([paragraph("Nur Text")]) })
      )
    )

    renderPage()
    const trigger = await screen.findByRole("button", {
      name: i18n.t("projectContent.print.actionLabel"),
    })

    await userEvent.click(trigger)
    await waitFor(() => {
      expect(print).toHaveBeenCalledTimes(1)
    })
  })
})

/**
 * Die Projektinformationen als Aufklapper (KAN-83).
 *
 * <p>Bis dahin stand hier die nackte {@code ProjectMetaSidebar}: die lange
 * Liste liess sich nicht wegklappen, obwohl der Kommentarkasten unmittelbar
 * darunter es konnte und obwohl der Review-Modus dasselbe Paar laengst
 * aufklappbar zeigte. Kein Test deckte diese Seite darauf ab, deshalb wurde
 * die Luecke nie rot.
 */
describe("Die Projektinformationen", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  /** Der Aufklapper der Karte; die Schublade ist dabei geschlossen. */
  function infoTrigger(): HTMLElement {
    return screen.getByRole("button", {
      name: i18n.t("projectContent.sidebar.projectInfo"),
    })
  }

  it("liegt in einer Ueberschrift und steht aufgeklappt da", async () => {
    server.use(detailHandler(projectResponse()))
    renderPage()

    await screen.findByRole("heading", { level: 1 })

    /* Der Ausloeser liegt <em>in</em> der Ueberschrift (APG-Muster
       Disclosure), sonst haette die Spalte keinen Sprungpunkt. */
    const heading = screen.getByRole("heading", {
      name: i18n.t("projectContent.sidebar.projectInfo"),
    })
    expect(heading).toContainElement(infoTrigger())

    /* Aufgeklappt als Vorgabe: auf dieser Seite gehoeren die Angaben zur
       Auskunft ueber das Projekt und sind kein Nachschlagefall wie im
       Review-Modus. Der Anblick bleibt damit derselbe wie zuvor. */
    expect(infoTrigger()).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Digitalisierung")).toBeInTheDocument()
  })

  it("laesst sie als Studierende auch bei SUBMITTED zu- und wieder aufklappen", async () => {
    /*
     * Der gemeldete Fall. Bei SUBMITTED erreicht die Autor:in weder den
     * Editor (kein Stift auf der Kachel, kein Umschalter) noch den
     * Review-Modus (rollengesperrt); diese Seite ist der Ort, an den sie
     * gefuehrt wird, und dort blieb die Liste stehen.
     */
    const user = userEvent.setup()
    signInAs("STUDENT")
    server.use(
      http.get("*/api/projects/:projectId/comments", () =>
        HttpResponse.json([])
      ),
      detailHandler(projectResponse({ status: "SUBMITTED" }))
    )

    renderPage()
    await screen.findByRole("heading", { level: 1 })

    expect(infoTrigger()).toHaveAttribute("aria-expanded", "true")

    await user.click(infoTrigger())
    expect(infoTrigger()).toHaveAttribute("aria-expanded", "false")
    await waitFor(() => {
      expect(screen.queryByText("Digitalisierung")).toBeNull()
    })

    await user.click(infoTrigger())
    expect(infoTrigger()).toHaveAttribute("aria-expanded", "true")
    expect(await screen.findByText("Digitalisierung")).toBeInTheDocument()
  })

  it("laesst den Kommentarkasten dabei offen", async () => {
    /*
     * Kein Akkordeon wie in Editor und Review-Modus: diese Seite ist fuer
     * die Autor:in eines eingereichten Projekts der einzige Ort mit ihren
     * Aenderungswuenschen, und die sollen nicht zugehen, weil jemand die
     * Angaben einklappt. Zwischen beiden stehen ausserdem der Umschalter
     * und die Reaktionen, sie sind also gar kein Paar.
     */
    const user = userEvent.setup()
    signInAs("STUDENT")
    server.use(
      http.get("*/api/projects/:projectId/comments", () =>
        HttpResponse.json([])
      ),
      detailHandler(projectResponse({ status: "SUBMITTED" }))
    )

    renderPage()
    await screen.findByRole("heading", { level: 1 })

    const comments = screen.getByRole("button", {
      name: new RegExp(i18n.t("comment.panel.title")),
    })
    expect(comments).toHaveAttribute("aria-expanded", "true")

    await user.click(infoTrigger())

    expect(infoTrigger()).toHaveAttribute("aria-expanded", "false")
    expect(comments).toHaveAttribute("aria-expanded", "true")
  })
})
