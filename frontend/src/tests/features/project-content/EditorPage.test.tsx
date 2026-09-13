import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Editor } from "@tiptap/react"
import { HttpResponse, delay, http } from "msw"
import { Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type {
  BlockResponse,
  CommentResponse,
  ProjectDetailResponse,
} from "@/api/types"
import EditorPage from "@/features/project-content/EditorPage"
import { slashCommandPluginKey } from "@/features/project-content/extensions/SlashCommand"
import i18n from "@/i18n"
import { comment, person, projectDetail } from "@/tests/fixtures"
import {
  apiErrorResponse,
  currentUserHandler,
  projectBlocksHandler,
  projectCommentsHandler,
  projectDetailHandler,
} from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { LocationProbe, signInAs } from "@/tests/routes/helpers"

/*
 * Die Seite wird direkt gerendert und nicht ueber den Routenbaum: sonst
 * zoege jeder Fall NavBar, Fusszeile und das Portfolio der Kopfleiste mit,
 * und jeder braeuchte Handler fuer Dinge, um die es ihm nicht geht. Dass die
 * Route selbst erreichbar ist, prueft routes/index.test.tsx.
 *
 * <p>Die Grenzen sind grosszuegig: die Schreibflaeche baut ein vollstaendiges
 * ProseMirror-Schema auf, und der Rechner, auf dem hier gearbeitet wird, ist
 * langsam.
 */

const PROJECT_ID = "1f9d7a10-0000-0000-0000-000000000000"
const USER_ID = "00000000-0000-0000-0000-000000000001"
const WAIT = { timeout: 20000 }

function textBlock(text: string, id = "b1"): BlockResponse {
  return {
    id: `aaaaaaaa-bbbb-4ccc-8ddd-00000000000${id.slice(-1)}`,
    type: "TEXT",
    orderIndex: 0,
    schemaVersion: 3,
    content: {
      type: "paragraph",
      attrs: { textAlign: null },
      content: [{ type: "text", text }],
    },
  } as unknown as BlockResponse
}

/** Ein Block, den diese Ansicht nicht lesen kann (kuenftige Schemaversion). */
function unreadableBlock(): BlockResponse {
  return {
    id: "aaaaaaaa-bbbb-4ccc-8ddd-999999999999",
    type: "TEXT",
    orderIndex: 1,
    schemaVersion: 99,
    content: { type: "somethingNew" },
  } as unknown as BlockResponse
}

/** Ein Absatz als Tabellenzelle; dieselbe Form wie im Lesepfad. */
function cellParagraph(text: string) {
  return {
    type: "paragraph",
    attrs: { textAlign: null },
    content: [{ type: "text", text }],
  }
}

/**
 * Eine Tabelle an zweiter Stelle (KAN-104): an ihr haengt die
 * Tabellenbedienung, die in der Vorschau nicht erreichbar sein darf.
 * Schemaversion 2 wie in ProjectDetailPage.test.tsx, dort laeuft dieselbe
 * Form bereits durch den Lesepfad.
 */
function tableBlock(): BlockResponse {
  return {
    id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000007",
    type: "TABLE",
    orderIndex: 1,
    schemaVersion: 2,
    content: {
      type: "table",
      attrs: { caption: "Messreihe" },
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableHeader",
              attrs: {},
              content: [cellParagraph("Groesse")],
            },
            {
              type: "tableHeader",
              attrs: {},
              content: [cellParagraph("Wert")],
            },
          ],
        },
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              attrs: {},
              content: [cellParagraph("Masse")],
            },
            {
              type: "tableCell",
              attrs: {},
              content: [cellParagraph("12 kg")],
            },
          ],
        },
      ],
    },
  } as unknown as BlockResponse
}

function ownDraft(
  overrides: Partial<ProjectDetailResponse> = {}
): ProjectDetailResponse {
  return projectDetail({
    id: PROJECT_ID,
    title: "Beitrag im Entwurf",
    status: "DRAFT",
    author: person({ id: USER_ID, firstName: "Mira", lastName: "Beispiel" }),
    ...overrides,
  })
}

function renderEditor(
  project: ProjectDetailResponse,
  blocks: BlockResponse[] = [],
  comments: CommentResponse[] = []
) {
  server.use(
    currentUserHandler({ id: USER_ID }),
    /* Bloecke vor dem Detail: das Muster /projects/:projectId faengt sonst
       den laengeren Pfad zuerst ab. */
    projectCommentsHandler(comments),
    projectBlocksHandler(blocks),
    projectDetailHandler(project),
    http.put("*/api/projects/:projectId/blocks", () =>
      HttpResponse.json({ version: 2, blocks })
    )
  )
  signInAs("STUDENT")
  return renderWithProviders(
    <Routes>
      <Route path="/projects/:projectId/editor" element={<EditorPage />} />
      <Route path="*" element={<LocationProbe />} />
    </Routes>,
    `/projects/${PROJECT_ID}/editor`
  )
}

describe("EditorPage", () => {
  beforeEach(() => {
    signInAs("STUDENT")
  })

  it("zeigt den Projekttitel als einzige h1 und die Schreibflaeche", async () => {
    renderEditor(ownDraft(), [textBlock("Ein erster Absatz.")])

    expect(
      await screen.findByRole("heading", { level: 1 }, WAIT)
    ).toHaveTextContent("Beitrag im Entwurf")
    expect(
      await screen.findByText("Ein erster Absatz.", undefined, WAIT)
    ).toBeInTheDocument()
  })

  it("gibt eine Ueberschrift auf der Schreibflaeche versetzt aus", async () => {
    const heading = {
      id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000009",
      type: "HEADING",
      orderIndex: 0,
      schemaVersion: 3,
      content: {
        type: "heading",
        attrs: { level: 1, textAlign: null },
        content: [{ type: "text", text: "Erste Gliederungsebene" }],
      },
    } as unknown as BlockResponse

    renderEditor(ownDraft(), [heading])

    /* Gespeichert ist die Ebene 1, angezeigt wird sie eine Stufe tiefer:
       die einzige h1 der Seite bleibt der Projekttitel (Contract 2.5, 3.3).
       Ohne die Knotenansicht stuende hier ein zweites h1. */
    expect(
      await screen.findByRole(
        "heading",
        { level: 2, name: "Erste Gliederungsebene" },
        WAIT
      )
    ).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  })

  it("ist in PUBLISHED read-only und sagt sichtbar warum", async () => {
    renderEditor(ownDraft({ status: "PUBLISHED" }), [textBlock("Fertig.")])

    expect(
      await screen.findByText(
        /laesst sich gerade nicht bearbeiten|lässt sich gerade nicht bearbeiten/i,
        undefined,
        WAIT
      )
    ).toBeInTheDocument()

    /* Keine Blockbedienung und keine Workflow-Aktion, die ins Leere fuehrt:
       aus PUBLISHED liegen beide Uebergaenge bei der Redaktion (§4.1). */
    expect(
      screen.queryByRole("button", { name: /Block einfügen/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Einreichen" })
    ).not.toBeInTheDocument()
  })

  it("speichert nicht, wenn ein Block nicht gelesen werden konnte", async () => {
    let puts = 0
    server.use(
      http.put("*/api/projects/:projectId/blocks", () => {
        puts = puts + 1
        return HttpResponse.json({ version: 2, blocks: [] })
      })
    )
    renderEditor(ownDraft(), [textBlock("Lesbar."), unreadableBlock()])

    /* Die Meldung nennt die Zahl und die Position: der PUT ersetzt die
       gesamte Liste und loeschte genau den Block, den diese Ansicht nicht
       lesen kann. */
    expect(
      await screen.findByText(/wird nicht gespeichert/i, undefined, WAIT)
    ).toBeInTheDocument()
    expect(screen.getByText(/Position(en)? 2/)).toBeInTheDocument()
    expect(puts).toBe(0)
  })

  it("oeffnet am Plus die Einfuegeleiste mit den zehn Blocktypen", async () => {
    const user = userEvent.setup()
    renderEditor(ownDraft(), [textBlock("Ein Absatz.")])

    const plus = await screen.findByRole(
      "button",
      { name: "Block einfügen" },
      WAIT
    )
    await user.click(plus)

    const bar = await screen.findByRole(
      "group",
      { name: "Block einfügen" },
      WAIT
    )
    for (const label of [
      "Bild",
      "Galerie",
      "Video",
      "Audio",
      "Dokument",
      "Einbettung",
      "Formel",
      "Tabelle",
      "Quelltext",
      "Trenner",
    ]) {
      expect(
        within(bar).getByRole("button", { name: label }),
        label
      ).toBeInTheDocument()
    }

    /* Aufgabenlisten sind nicht Teil des Schemas (Contract 2.5); der alte
       Prototyp zeichnet an dieser Stelle noch ein Kaestchen. */
    expect(
      within(bar).queryByRole("button", { name: /Aufgabe|Checkliste/i })
    ).not.toBeInTheDocument()
  })

  /*
   * Der Zeigerweg laeuft seit KAN-36 ueber
   * @tiptap/extension-drag-handle-react. Die Erweiterung blendet ihren
   * Griff aus, solange niemand zeigt, und zwar mit visibility: hidden; ein
   * so verstecktes Element nimmt keinen Fokus an. Ohne einen zweiten,
   * erreichbaren Weg waeren Einfuegen, Verschieben und Loeschen fuer
   * Tastatur- und Sprachbedienung unerreichbar (SC 2.1.1).
   */
  it("haelt die Blockbedienung auch ohne Zeiger erreichbar", async () => {
    renderEditor(ownDraft(), [textBlock("Ein Absatz.")])

    const bar = await screen.findByRole(
      "group",
      { name: /Blockbedienung, Block 1 von/ },
      WAIT
    )
    /* Die drei Bedienelemente stehen darin und sind echte Schaltflaechen,
       also mit Tab erreichbar. */
    expect(
      within(bar).getByRole("button", { name: "Block einfügen" })
    ).toBeInTheDocument()
    expect(
      within(bar).getByRole("button", { name: /anheben|ablegen/i })
    ).toBeInTheDocument()
    expect(
      within(bar).getByRole("button", { name: /löschen/i })
    ).toBeInTheDocument()
  })

  it("legt einen Medienblock als leeren Platzhalter im Text an", async () => {
    const user = userEvent.setup()
    renderEditor(ownDraft(), [textBlock("Ein Absatz.")])

    await user.click(
      await screen.findByRole("button", { name: "Block einfügen" }, WAIT)
    )
    await user.click(await screen.findByRole("button", { name: "Bild" }, WAIT))

    /* Kein Dialog, sondern eine Ablageflaeche an Ort und Stelle. */
    expect(
      await screen.findByText(
        /Bild hochladen oder hierher ziehen/i,
        undefined,
        WAIT
      )
    ).toBeInTheDocument()

    /*
     * Die Einfuegeleiste bleibt nach dem Einfuegen offen: wer zwei Bloecke
     * untereinander setzt, soll nicht zweimal auf das Plus klicken.
     * Geschlossen wird ueber Escape, das Kreuz oder einen Klick daneben.
     */
    expect(
      screen.getByRole("group", { name: "Block einfügen" })
    ).toBeInTheDocument()
    await user.keyboard("{Escape}")
    await waitFor(
      () =>
        expect(
          screen.queryByRole("group", { name: "Block einfügen" })
        ).not.toBeInTheDocument(),
      WAIT
    )
    /* Und danach steht kein Dialog offen, der nach etwas fragt. */
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("fuehrt Einreichen auf die Metadatenseite und nicht in ein Seitenpanel", async () => {
    const user = userEvent.setup()
    renderEditor(ownDraft(), [textBlock("Ein Absatz.")])

    await user.click(
      await screen.findByRole("button", { name: "Einreichen" }, WAIT)
    )

    /*
     * §3.3 verlangt sieben Angaben, die im Editor nicht sichtbar sind. Sie
     * stehen auf der Metadatenseite, und dorthin fuehrt der Weg: der
     * Merker in der Adresse sagt ihr, dass danach eingereicht wird.
     */
    await waitFor(() => {
      expect(screen.getByTestId("pathname")).toHaveTextContent(
        `/projects/${PROJECT_ID}/metadata`
      )
      expect(screen.getByTestId("search")).toHaveTextContent("?submit=1")
    }, WAIT)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("oeffnet aus der Seitenleiste die Metadaten, ohne einzureichen", async () => {
    const user = userEvent.setup()
    renderEditor(ownDraft(), [textBlock("Ein Absatz.")])

    /* Die Karte zeigte die Angaben, bot aber keinen Weg, sie zu aendern:
       dafuer musste man ins Portfolio zurueck. Seit KAN-104 stehen die
       Angaben voreingestellt zugeklappt, der Weg liegt darin. */
    await user.click(
      await screen.findByRole("button", { name: "Projektinformationen" }, WAIT)
    )
    await user.click(
      await screen.findByRole("button", { name: "Metadaten bearbeiten" }, WAIT)
    )

    await waitFor(() => {
      expect(screen.getByTestId("pathname")).toHaveTextContent(
        `/projects/${PROJECT_ID}/metadata`
      )
      /* Ohne den Merker: hier wird bearbeitet und nicht eingereicht. */
      expect(screen.getByTestId("search")).toHaveTextContent("")
    }, WAIT)
  })

  it("oeffnet die Projektinformationen als Schublade und schliesst sie wieder", async () => {
    const user = userEvent.setup()
    renderEditor(ownDraft(), [textBlock("Ein Absatz.")])

    /*
     * Schmal steht die Seitenleiste nicht neben der Schreibflaeche, sondern
     * hinter dem Menue der Kopfzeile. Es ist dieselbe Leiste: eine zweite
     * Fassung derselben Angaben liefe beim naechsten neuen Feld
     * auseinander. (jsdom wertet kein CSS aus, die breite Fassung steht im
     * Test also daneben; geprueft wird der Weg, nicht die Breite.)
     */
    await user.click(
      await screen.findByRole("button", { name: "Weitere Aktionen" }, WAIT)
    )
    await user.click(
      within(await screen.findByRole("menu", {}, WAIT)).getByRole("menuitem", {
        name: "Projektinformationen",
      })
    )

    const drawer = await screen.findByRole("dialog", {}, WAIT)
    /* Die Schublade traegt seit KAN-37 den Namen der ganzen Leiste: darin
       stehen Status, Projektinformationen und Kommentare, und der
       Aufklapper der Projektinformationen bringt seine eigene Ueberschrift
       mit. */
    expect(
      within(drawer).getByRole("heading", { name: "Projektangaben" })
    ).toBeInTheDocument()
    expect(
      within(drawer).getByRole("heading", { name: "Projektinformationen" })
    ).toBeInTheDocument()
    /* Derselbe Inhalt wie in der Leiste, einschliesslich ihrer Wege. Die
       Angaben stehen seit KAN-104 auch hier zugeklappt. */
    await user.click(
      within(drawer).getByRole("button", { name: "Projektinformationen" })
    )
    expect(
      await within(drawer).findByRole("button", {
        name: "Metadaten bearbeiten",
      })
    ).toBeInTheDocument()
    expect(within(drawer).getByText("Entwurf")).toBeInTheDocument()

    await user.click(within(drawer).getByRole("button", { name: "Schließen" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )

    /* Der Fokus kehrt auf den Ausloeser zurueck. Die Schublade hat keinen
       eigenen Trigger mehr, sobald das Menue zu ist; ohne Rueckgabeziel
       fiele er auf den Seitenanfang (SC 2.4.3). */
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Weitere Aktionen" })
      ).toHaveFocus()
    )
  })

  /*
   * KAN-104: die Vorschau entsteht an Ort und Stelle. Bis dahin fuehrte
   * „Vorschau" auf die oeffentliche Detailseite, mit eigenem Ladevorgang,
   * eigener Scrollposition und einem Rueckweg, den es nur dort gab.
   */
  it("schaltet an Ort und Stelle in die Vorschau und zurueck, ohne die Route zu wechseln", async () => {
    const user = userEvent.setup()
    const scrollTo = vi
      .spyOn(window, "scrollTo")
      .mockImplementation(() => undefined)
    renderEditor(ownDraft(), [textBlock("Ein Absatz.")])

    const toggle = await screen.findByRole("button", { name: "Vorschau" }, WAIT)
    await screen.findByText("Ein Absatz.", undefined, WAIT)
    const surface = document.querySelector<HTMLElement>(".ProseMirror")
    expect(surface).not.toBeNull()

    await user.click(toggle)

    const region = await screen.findByRole(
      "region",
      { name: i18n.t("project.detail.content") },
      WAIT
    )
    /* Der Beitrag durch den Renderer, nicht durch die Schreibflaeche. */
    expect(within(region).getByText("Ein Absatz.")).toBeInTheDocument()
    expect(region.querySelector("[contenteditable]")).toBeNull()

    /* Dieselbe Route: die Sonde fuer jede andere Adresse erscheint nicht,
       und gescrollt wird nicht. */
    expect(screen.queryByTestId("pathname")).toBeNull()
    expect(scrollTo).not.toHaveBeenCalled()

    /* Die Schreibflaeche bleibt im Baum, ausgeblendet und nicht abgebaut. */
    expect(document.querySelector(".ProseMirror")).toBe(surface)
    expect(surface).not.toBeVisible()

    await user.click(screen.getByRole("button", { name: "Bearbeiten" }))

    await waitFor(() => expect(surface).toBeVisible(), WAIT)
    expect(
      screen.queryByRole("region", { name: i18n.t("project.detail.content") })
    ).toBeNull()
    expect(screen.queryByTestId("pathname")).toBeNull()
    expect(scrollTo).not.toHaveBeenCalled()
    scrollTo.mockRestore()
  })

  it("nimmt der Vorschau Formatierungsleiste, Blockbedienung und Tabellenbedienung, auch fuer die Tastatur", async () => {
    const user = userEvent.setup()
    renderEditor(ownDraft(), [textBlock("Ein Absatz."), tableBlock()])

    /* Auf der Schreibflaeche stehen alle drei. */
    await screen.findByRole(
      "group",
      { name: /Blockbedienung, Block 1 von/ },
      WAIT
    )
    expect(document.querySelector("[data-selection-toolbar]")).not.toBeNull()
    await waitFor(
      () =>
        expect(document.querySelector("[data-table-controls]")).not.toBeNull(),
      WAIT
    )

    await user.click(screen.getByRole("button", { name: "Vorschau" }))
    await screen.findByRole("button", { name: "Bearbeiten" }, WAIT)

    expect(document.querySelector("[data-selection-toolbar]")).toBeNull()
    expect(screen.queryByRole("button", { name: "Fett" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Rückgängig" })).toBeNull()
    expect(screen.queryByRole("group", { name: /Blockbedienung/ })).toBeNull()
    expect(document.querySelector("[data-table-controls]")).toBeNull()

    /* Und kein Tabulatorschritt fuehrt in die ausgeblendete Schreibflaeche. */
    const surface = document.querySelector<HTMLElement>(".ProseMirror")
    for (let step = 0; step < 40; step++) {
      await user.tab()
      expect(surface?.contains(document.activeElement) ?? false).toBe(false)
    }
  })

  it("laesst Zurueckziehen bei SUBMITTED in beiden Modi sichtbar und bedienbar", async () => {
    const user = userEvent.setup()
    renderEditor(ownDraft({ status: "SUBMITTED" }), [textBlock("Eingereicht.")])

    expect(
      await screen.findByRole("button", { name: "Zurückziehen" }, WAIT)
    ).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Vorschau" }))
    await screen.findByRole("button", { name: "Bearbeiten" }, WAIT)

    const withdraw = screen.getByRole("button", { name: "Zurückziehen" })
    expect(withdraw).toBeVisible()
    await user.click(withdraw)
    expect(await screen.findByRole("alertdialog", {}, WAIT)).toBeInTheDocument()
    await user.keyboard("{Escape}")
  })

  it("zeigt in der Vorschau den ungespeicherten Stand von Beitrag und Titel", async () => {
    const user = userEvent.setup()
    renderEditor(ownDraft(), [])
    /* Kein Takt kommt zurueck: was die Vorschau zeigt, kann dann nur aus
       dem Dokument und dem Formular stammen und nicht aus einer Antwort. */
    server.use(
      http.put("*/api/projects/:projectId/blocks", async () => {
        await delay("infinite")
        return HttpResponse.json({})
      }),
      http.put("*/api/projects/:projectId", async () => {
        await delay("infinite")
        return HttpResponse.json({})
      })
    )

    const title = await screen.findByLabelText("Projekttitel", {}, WAIT)
    await user.clear(title)
    await user.type(title, "Titel von eben")

    const surface = document.querySelector<HTMLElement>(".ProseMirror")
    expect(surface).not.toBeNull()
    await user.click(surface as HTMLElement)
    await user.keyboard("Frisch getippt")

    await user.click(screen.getByRole("button", { name: "Vorschau" }))

    const region = await screen.findByRole(
      "region",
      { name: i18n.t("project.detail.content") },
      WAIT
    )
    expect(within(region).getByText("Frisch getippt")).toBeInTheDocument()
    const headings = screen.getAllByRole("heading", { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent("Titel von eben")
  })

  /*
   * KAN-104, Entscheidung: die Kurzbeschreibung wird allein im
   * Metadatenformular eingetragen. Beim Bearbeiten steht sie in der
   * Kopfpartie weder als Feld noch als Text; in der Vorschau erscheint sie
   * als grauer Vorspann wie auf der Detailseite. Gesucht wird in der
   * Kopfpartie und nicht auf der ganzen Seite, damit die Seitenleiste nicht
   * mitzaehlt.
   */
  it("zeigt die Kurzbeschreibung beim Bearbeiten nicht und in der Vorschau als grauen Vorspann", async () => {
    const user = userEvent.setup()
    renderEditor(ownDraft({ summary: "Gespeicherte Kurzfassung" }), [
      textBlock("Ein Absatz."),
    ])

    const intro = await screen.findByRole(
      "region",
      { name: "Kopfbereich des Beitrags" },
      WAIT
    )
    expect(
      await within(intro).findByLabelText("Projekttitel", {}, WAIT)
    ).toBeInTheDocument()
    expect(within(intro).queryByLabelText("Kurzbeschreibung")).toBeNull()
    expect(within(intro).queryByText("Gespeicherte Kurzfassung")).toBeNull()

    await user.click(screen.getByRole("button", { name: "Vorschau" }))

    const lead = await within(intro).findByText(
      "Gespeicherte Kurzfassung",
      undefined,
      WAIT
    )
    expect(lead.tagName).toBe("P")
    expect(lead).toHaveClass("type-body-lg", "text-muted-foreground")
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)

    await user.click(screen.getByRole("button", { name: "Bearbeiten" }))

    await waitFor(
      () =>
        expect(
          within(intro).queryByText("Gespeicherte Kurzfassung")
        ).toBeNull(),
      WAIT
    )
  })

  it("zeigt die Kurzbeschreibung auch ohne Schreibrecht erst in der Vorschau", async () => {
    const user = userEvent.setup()
    renderEditor(
      ownDraft({ status: "SUBMITTED", summary: "Gespeicherte Kurzfassung" }),
      [textBlock("Eingereicht.")]
    )

    await screen.findByRole(
      "heading",
      { level: 1, name: "Beitrag im Entwurf" },
      WAIT
    )
    const intro = screen.getByRole("region", {
      name: "Kopfbereich des Beitrags",
    })
    expect(within(intro).queryByText("Gespeicherte Kurzfassung")).toBeNull()

    await user.click(
      await screen.findByRole("button", { name: "Vorschau" }, WAIT)
    )

    expect(
      await within(intro).findByText(
        "Gespeicherte Kurzfassung",
        undefined,
        WAIT
      )
    ).toHaveClass("type-body-lg", "text-muted-foreground")
  })

  /*
   * Die Schreibflaeche ist in der Vorschau nur ausgeblendet, ihre
   * Knotenansichten laufen weiter: ein Upload, der erst dort fertig wird,
   * traegt seine Datei per updateAttributes nach. Nachgestellt mit einer
   * Transaktion am Editor der ausgeblendeten Flaeche, denn bedienbar ist
   * dort mit Absicht nichts.
   */
  it("zieht die Vorschau nach, wenn sich das Dokument dort noch aendert", async () => {
    const user = userEvent.setup()
    renderEditor(ownDraft(), [textBlock("Erster Absatz")])

    await screen.findByText("Erster Absatz", undefined, WAIT)
    await user.click(screen.getByRole("button", { name: "Vorschau" }))
    const region = await screen.findByRole(
      "region",
      { name: i18n.t("project.detail.content") },
      WAIT
    )
    expect(within(region).queryByText("Spaeter fertig")).toBeNull()

    const surface = document.querySelector(".ProseMirror") as unknown as {
      editor: Editor
    }
    act(() => {
      const { editor } = surface
      editor.commands.insertContentAt(editor.state.doc.content.size, {
        type: "paragraph",
        content: [{ type: "text", text: "Spaeter fertig" }],
      })
    })

    expect(
      await within(region).findByText("Spaeter fertig", undefined, WAIT)
    ).toBeInTheDocument()
  })

  /*
   * Der Takt laeuft in der Vorschau weiter und kann dort auf 409 stossen.
   * „Serverstand laden" verwirft dann die eigenen Bloecke, und die Vorschau
   * darf sie nicht weiter unter dem Titel vom Server zeigen (§6.4).
   */
  it("zeigt nach Serverstand laden aus der Vorschau den Serverinhalt und nicht den verworfenen", async () => {
    const user = userEvent.setup()
    renderEditor(ownDraft(), [textBlock("Erster Absatz")])
    server.use(
      http.put("*/api/projects/:projectId/blocks", () =>
        apiErrorResponse(
          409,
          "PROJECT_VERSION_CONFLICT",
          `/api/projects/${PROJECT_ID}/blocks`
        )
      )
    )

    await screen.findByText("Erster Absatz", undefined, WAIT)
    const surface = document.querySelector<HTMLElement>(".ProseMirror")
    expect(surface).not.toBeNull()
    await user.click(surface as HTMLElement)
    await user.keyboard("Verworfen")

    /* Umgeschaltet, bevor der Takt gelaufen ist: er geht in der Vorschau
       hinaus und kommt mit dem Konflikt zurueck. */
    await user.click(screen.getByRole("button", { name: "Vorschau" }))
    const region = await screen.findByRole(
      "region",
      { name: i18n.t("project.detail.content") },
      WAIT
    )
    expect(within(region).getByText(/Verworfen/)).toBeInTheDocument()

    /* Inzwischen steht auf dem Server eine fremde Fassung. */
    server.use(projectBlocksHandler([textBlock("Fremde Fassung")], 2))
    await user.click(
      await screen.findByRole("button", { name: "Serverstand laden" }, WAIT)
    )

    /* hidden: true, damit die Pruefung allein den Inhalt der Vorschau
       betrifft und nicht, ob der Dialog in diesem Augenblick noch ueber der
       Seite steht und sie fuer Hilfsmittel verdeckt. */
    await waitFor(() => {
      const current = screen.getByRole("region", {
        name: i18n.t("project.detail.content"),
        hidden: true,
      })
      expect(within(current).getByText("Fremde Fassung")).toBeInTheDocument()
      expect(within(current).queryByText(/Verworfen/)).toBeNull()
    }, WAIT)
    /* Der Modus bleibt die Vorschau. */
    expect(
      screen.getByRole("button", { name: "Bearbeiten", hidden: true })
    ).toBeInTheDocument()
  })

  it("zeigt einen Beitrag ohne Bloecke in der Vorschau als Leerzustand", async () => {
    const user = userEvent.setup()
    renderEditor(ownDraft(), [])

    await user.click(
      await screen.findByRole("button", { name: "Vorschau" }, WAIT)
    )

    expect(
      await screen.findByRole(
        "heading",
        { level: 3, name: i18n.t("project.detail.empty.title") },
        WAIT
      )
    ).toBeInTheDocument()
  })

  it("sagt den Wechsel an und laesst den Fokus am Umschalter", async () => {
    const user = userEvent.setup()
    renderEditor(ownDraft(), [textBlock("Ein Absatz.")])

    const toggle = await screen.findByRole("button", { name: "Vorschau" }, WAIT)
    await user.click(toggle)

    /* Derselbe Knoten mit neuer Beschriftung, der Fokus bleibt darauf
       (SC 2.4.3). Kein aria-pressed an einem Knopf, dessen Name wechselt. */
    const edit = await screen.findByRole("button", { name: "Bearbeiten" }, WAIT)
    expect(edit).toBe(toggle)
    expect(edit).toHaveFocus()
    expect(edit).not.toHaveAttribute("aria-pressed")

    /* Die Live-Region der Seite, die dauerhaft steht (SC 4.1.3). */
    const notice = screen.getByText(
      i18n.t("projectContent.mode.announce.preview")
    )
    expect(notice).toHaveAttribute("aria-live", "polite")

    await user.click(edit)
    expect(screen.getByText(i18n.t("projectContent.mode.announce.edit"))).toBe(
      notice
    )
    expect(toggle).toHaveFocus()
  })

  /*
   * Das Slash-Menue haengt ueber props.mount an body und damit ausserhalb
   * der ausgeblendeten Schreibflaeche. Per Tastatur ist der Umschalter
   * erreichbar, waehrend es offen steht (Alt+F10 und weiter mit Tab); ein
   * Klick daneben schloesse es dagegen von selbst. Ohne Abbruch beim
   * Umschalten bliebe die Suche aktiv, die Liste stuende in der Vorschau
   * weiter da und fuegte dort noch einen Block ein (Befund des Reviews zu
   * KAN-104).
   *
   * <p>Geprueft wird der Zustand der Suche und nicht die Liste im DOM. Im
   * Test nimmt schon das naechste Rendern des Ziehgriffs die Liste mit: er
   * meldet sein Plugin dabei ab und wieder an, ProseMirror baut alle
   * Plugin-Ansichten neu auf, und die Suche bleibt trotzdem aktiv. Die Liste
   * haengt an genau diesem Zustand, und nur er sagt, ob der Wechsel sie
   * beendet hat.
   */
  it("beendet beim Wechsel in die Vorschau ein offenes Slash-Menue", async () => {
    const user = userEvent.setup()
    renderEditor(ownDraft(), [])

    const toggle = await screen.findByRole("button", { name: "Vorschau" }, WAIT)
    const surface = document.querySelector<HTMLElement>(".ProseMirror")
    expect(surface).not.toBeNull()
    await user.click(surface as HTMLElement)
    await user.keyboard("/")

    const { editor } = surface as unknown as { editor: Editor }
    await waitFor(
      () =>
        expect(slashCommandPluginKey.getState(editor.state)?.active).toBe(true),
      WAIT
    )

    /* Per Tastatur und nicht per Klick: ein pointerdown ausserhalb der Liste
       schloesse sie schon selbst, und der Befund ginge im Test unter. */
    act(() => toggle.focus())
    await user.keyboard("{Enter}")

    await screen.findByRole("button", { name: "Bearbeiten" }, WAIT)
    expect(slashCommandPluginKey.getState(editor.state)?.active).toBe(false)
    /* Beendet wird nur die Suche: der getippte Schraegstrich bleibt stehen,
       am Dokument aendert der Wechsel nichts. */
    expect(editor.state.doc.textContent).toBe("/")
  })

  it("oeffnet die Seitenleiste mit offener Kommentarspalte und zugeklappten Projektinformationen", async () => {
    /* KAN-104: auch im Entwurf, nicht mehr nur in REVISION. */
    renderEditor(
      ownDraft(),
      [],
      [
        comment({
          id: "c-1",
          type: "REPLY",
          text: "Eine Rueckfrage im Entwurf.",
        }),
      ]
    )

    expect(
      await screen.findByText("Eine Rueckfrage im Entwurf.", undefined, WAIT)
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Projektinformationen" })
    ).toHaveAttribute("aria-expanded", "false")
  })

  it("oeffnet bei PUBLISHED die Projektinformationen", async () => {
    /* Dort gibt es keine Kommentarspalte, sonst stuende eine Karte ohne
       offenen Kasten da. */
    renderEditor(ownDraft({ status: "PUBLISHED" }), [textBlock("Fertig.")])

    expect(
      await screen.findByRole("button", { name: "Projektinformationen" }, WAIT)
    ).toHaveAttribute("aria-expanded", "true")
  })

  it("traegt den Wechsel zwischen hellem und dunklem Modus im Editorkopf", async () => {
    /*
     * KAN-86: der Editor liegt ausserhalb des Anwendungsrahmens, NavBar und
     * Fusszeile entfallen dort. Ohne diesen Knopf gaebe es auf genau dieser
     * einen Route keinen Weg, die Darstellung zu wechseln.
     */
    const user = userEvent.setup()
    renderEditor(ownDraft(), [textBlock("Ein Absatz.")])

    await user.click(
      await screen.findByRole(
        "button",
        { name: "Dunklen Modus einschalten" },
        WAIT
      )
    )

    expect(document.documentElement).toHaveClass("dark")
    /* Der Name wechselt mit dem Modus: er ist der zugaengliche Name des
       Knopfes und nicht nur Schmuck. */
    expect(
      screen.getByRole("button", { name: "Hellen Modus einschalten" })
    ).toBeInTheDocument()
  })

  it("Alt+F10 fuehrt aus dem Text in die Formatierungsleiste im Header", async () => {
    /* Der Sprung sucht dokumentweit nach [data-selection-toolbar]; genau
       dieser Selektor haette beim Umzug der Leiste in die Kopfzeile
       brechen koennen, deshalb steht die Zusage hier fest. */
    const { container } = renderEditor(ownDraft(), [textBlock("Ein Absatz.")])
    await screen.findByText("Ein Absatz.", undefined, WAIT)

    const surface = container.querySelector<HTMLElement>(".ProseMirror")
    if (surface === null) {
      throw new Error("Schreibflaeche nicht gefunden")
    }
    surface.focus()
    fireEvent.keyDown(surface, { key: "F10", altKey: true })

    await waitFor(() => {
      const toolbar = container.querySelector("[data-selection-toolbar]")
      expect(toolbar).not.toBeNull()
      expect(toolbar?.contains(document.activeElement)).toBe(true)
    }, WAIT)
  })

  it("zeigt einem fremden Konto keine Workflow-Aktion", async () => {
    /* §5 und §4.1: Einreichen und Zurueckziehen fuehrt die Projektseite aus.
       Dieses Konto gehoert nicht dazu, es ist weder Autor:in noch in
       members; eine Schaltflaeche, die mit 403 endet, waere ein Weg ins
       Leere. */
    renderEditor(
      ownDraft({
        author: person({ id: "99999999-9999-4999-8999-999999999999" }),
      }),
      [textBlock("Ein Absatz.")]
    )

    await screen.findByRole("heading", { level: 1 }, WAIT)
    expect(
      screen.queryByRole("button", { name: "Einreichen" })
    ).not.toBeInTheDocument()
  })

  it("gibt einem Projektmitglied den Weg zum Einreichen", async () => {
    /*
     * §4.1 seit Contract v85 (KAN-86): Einreichen liegt bei der ganzen
     * Projektseite. Bis v84 sah ein Mitglied im eigenen Editor keinen Weg
     * nach vorn, obwohl es denselben Text geschrieben hat.
     */
    renderEditor(
      ownDraft({
        author: person({ id: "99999999-9999-4999-8999-999999999999" }),
        members: [
          {
            userId: USER_ID,
            firstName: "Mira",
            lastName: "Beispiel",
            avatarUrl: null,
            projectRole: "Frontend",
          },
        ],
      }),
      [textBlock("Ein Absatz.")]
    )

    expect(
      await screen.findByRole("button", { name: "Einreichen" }, WAIT)
    ).toBeVisible()
  })

  /*
   * Titelbild und Titel sind Metadaten und laufen ueber PUT /projects/{id},
   * der Inhalt ueber PUT /projects/{id}/blocks (§6.1). Beide erhoehen
   * dieselbe Project.version (§6.4), deshalb fuehrt sie ein Takt
   * nacheinander.
   */
  it("schreibt eine Titelaenderung ueber den Metadatenweg und nicht ueber den Inhaltsweg", async () => {
    const user = userEvent.setup()
    const cards: { version: number; title?: string }[] = []
    const project = ownDraft()

    renderEditor(project, [textBlock("Erster Absatz")])
    server.use(
      http.put("*/api/projects/:projectId", async ({ request }) => {
        const body = (await request.json()) as {
          version: number
          title?: string
        }
        cards.push(body)
        return HttpResponse.json({
          ...project,
          title: body.title ?? project.title,
          version: body.version + 1,
        })
      })
    )

    const title = await screen.findByLabelText("Projekttitel", {}, WAIT)
    await user.clear(title)
    await user.type(title, "Anderer Titel")

    await waitFor(() => expect(cards).toHaveLength(1), WAIT)
    expect(cards[0].title).toBe("Anderer Titel")
    /* Die Karte traegt die uebrigen Angaben mit: ProjectUpdateRequest hat
       ersetzende Semantik, ein PUT mit nur dem Titel loeschte Fakultaet,
       Studiengang und alles Weitere. */
    expect(cards[0]).toHaveProperty("summary")
    expect(cards[0]).toHaveProperty("coverImageUrl")
  })

  /*
   * KAN-104: die Kurzbeschreibung wird im Editor nicht bearbeitet, steht
   * aber in der Karte, weil ProjectUpdateRequest ersetzende Semantik hat.
   * Sie geht so hinaus, wie der Server sie zuletzt bestaetigt hat: beim
   * ersten Titel-PUT der geladene Wert, danach der aus der letzten Antwort.
   * Die Antwort mit anderer Kurzbeschreibung stellt einen inzwischen
   * geaenderten Serverstand nach; ueber sie landet ein neuer Stand in
   * metadataRef. Ein Formularwert von vorhin darf ihn nicht ueberschreiben.
   */
  it("laesst die gespeicherte Kurzbeschreibung beim Speichern des Titels unveraendert", async () => {
    const user = userEvent.setup()
    const cards: {
      version: number
      title?: string
      summary?: string | null
    }[] = []
    const project = ownDraft({ summary: "Gespeicherte Kurzfassung" })

    renderEditor(project, [textBlock("Erster Absatz")])
    server.use(
      http.put("*/api/projects/:projectId", async ({ request }) => {
        const body = (await request.json()) as {
          version: number
          title?: string
          summary?: string | null
        }
        cards.push(body)
        return HttpResponse.json({
          ...project,
          title: body.title ?? project.title,
          summary: "Inzwischen geaendert",
          version: body.version + 1,
        })
      })
    )

    const title = await screen.findByLabelText("Projekttitel", {}, WAIT)
    await user.clear(title)
    await user.type(title, "Anderer Titel")

    await waitFor(() => expect(cards).toHaveLength(1), WAIT)
    expect(cards[0].title).toBe("Anderer Titel")
    expect(cards[0].summary).toBe("Gespeicherte Kurzfassung")

    await user.type(title, " zwei")

    await waitFor(
      () => expect(cards.at(-1)?.title).toBe("Anderer Titel zwei"),
      WAIT
    )
    for (const card of cards.slice(1)) {
      expect(card.summary).toBe("Inzwischen geaendert")
    }
  })

  it("laesst die Kopfangaben auch dann schreiben, wenn ein Block nicht lesbar ist", async () => {
    const user = userEvent.setup()
    let blockPuts = 0
    let projectPuts = 0
    const project = ownDraft()

    renderEditor(project, [textBlock("Erster Absatz"), unreadableBlock()])
    server.use(
      http.put("*/api/projects/:projectId/blocks", () => {
        blockPuts = blockPuts + 1
        return HttpResponse.json({ version: 2, blocks: [] })
      }),
      http.put("*/api/projects/:projectId", async ({ request }) => {
        projectPuts = projectPuts + 1
        const body = (await request.json()) as { version: number }
        return HttpResponse.json({ ...project, version: body.version + 1 })
      })
    )

    const title = await screen.findByLabelText("Projekttitel", {}, WAIT)
    await user.type(title, " ergaenzt")

    await waitFor(() => expect(projectPuts).toBe(1), WAIT)
    /* Der Inhalt bleibt aussen vor: der PUT ersetzt die ganze Liste und
       loeschte damit den Block, den diese Ansicht nicht lesen kann. */
    expect(blockPuts).toBe(0)
  })

  /*
   * Ein Beitrag darf nicht allein vom Ansehen eine neue Project.version
   * bekommen (§6.4). Der Takt vergleicht die Kopfangaben deshalb gegen
   * den zuletzt vom Server bestaetigten Stand, und ohne Eingabe gibt es
   * dort nichts zu senden.
   */
  it("schickt beim blossen Ansehen keinen Metadaten-Request", async () => {
    const user = userEvent.setup()
    let projectPuts = 0
    const project = ownDraft()

    let blockPuts = 0

    renderEditor(project, [textBlock("Erster Absatz")])
    server.use(
      http.put("*/api/projects/:projectId/blocks", () => {
        blockPuts = blockPuts + 1
        return HttpResponse.json({ version: 2, blocks: [] })
      }),
      http.put("*/api/projects/:projectId", async ({ request }) => {
        projectPuts = projectPuts + 1
        const body = (await request.json()) as { version: number }
        return HttpResponse.json({ ...project, version: body.version + 1 })
      })
    )

    /* Im Inhalt getippt, an den Kopfangaben nichts angeruehrt. */
    await screen.findByLabelText("Projekttitel", {}, WAIT)
    const surface = document.querySelector<HTMLElement>(".ProseMirror")
    expect(surface).not.toBeNull()
    await user.click(surface as HTMLElement)
    await user.keyboard("weiter")

    /* Der Inhalt geht hinaus, die Kopfangaben nicht. */
    await waitFor(() => expect(blockPuts).toBeGreaterThanOrEqual(1), WAIT)
    expect(projectPuts).toBe(0)
  })

  it("zeigt die Kommentarspalte und bietet der Autor:in allein die Antwort an", async () => {
    /*
     * Die Kommentarspalte aus KAN-37 steht seit diesem Ticket auch im
     * Editor; ohne sie saehe die Autor:in ihre Aenderungswuensche nirgends
     * (Ticket-Ziel). Erstellbar ist hier allein eine Antwort, auch wenn der
     * Server mehr zuliesse: der Editor ist der Schreibplatz am eigenen
     * Beitrag.
     */
    renderEditor(
      ownDraft({ status: "REVISION" }),
      [],
      [
        comment({
          id: "c-1",
          type: "CHANGE_REQUEST",
          status: "OPEN",
          text: "Bitte die Quellen ergaenzen.",
        }),
      ]
    )

    /* Die Spalte beginnt aufgeklappt, seit KAN-104 in jedem Status; in
       REVISION sind die offenen Aenderungswuensche der Arbeitsauftrag. */
    expect(
      await screen.findByText("Bitte die Quellen ergaenzen.")
    ).toBeInTheDocument()
    /* Den Stand traegt seit der Nacharbeit die Kopfzeile des Eintrags, und
       unten steht die Handlung. Die Autor:in darf sie ausloesen: die
       Projektseite hakt den an sie gerichteten Wunsch selbst ab (§2.4). */
    expect(
      screen.getByText(i18n.t("comment.type.CHANGE_REQUEST"))
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: i18n.t("comment.action.resolve") })
    ).toBeInTheDocument()

    expect(
      screen.getByLabelText(i18n.t("comment.form.textLabel"))
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("group", { name: i18n.t("comment.form.typeLabel") })
    ).not.toBeInTheDocument()
  })

  it("zeigt die Projektinformationen als Aufklapper mit Ueberschrift", async () => {
    renderEditor(ownDraft())

    /* Gemeinsamer Baustein mit dem Review-Modus (ProjectInfoSection); der
       Aufklapper liegt in einer Ueberschrift, damit die Seitenleiste einen
       Sprungpunkt hat. */
    expect(
      await screen.findByRole("heading", {
        name: new RegExp(i18n.t("projectContent.sidebar.projectInfo")),
      })
    ).toBeInTheDocument()
  })

  it("zeigt die Kommentarspalte bei PUBLISHED nicht", async () => {
    renderEditor(
      ownDraft({ status: "PUBLISHED" }),
      [],
      [comment({ id: "c-1", type: "REPLY", text: "Sollte nicht erscheinen." })]
    )

    await screen.findByRole("heading", {
      name: new RegExp(i18n.t("projectContent.sidebar.projectInfo")),
    })
    /* Dort ist die redaktionelle Arbeit vorbei und der Beitrag
       oeffentlich (Nutzerentscheidung zur Nacharbeit an KAN-37). */
    expect(
      screen.queryByRole("region", { name: i18n.t("comment.panel.label") })
    ).not.toBeInTheDocument()
  })
})
