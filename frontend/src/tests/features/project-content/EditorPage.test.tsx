import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HttpResponse, http } from "msw"
import { Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { BlockResponse } from "@/api/types"
import EditorPage from "@/features/project-content/EditorPage"
import { BLOCK_SCHEMA_VERSION } from "@/features/project-content/blockSerialization"
import { person, projectDetail } from "@/tests/fixtures"
import {
  apiErrorResponse,
  projectBlocksHandler,
  projectDetailHandler,
} from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

/**
 * Der Editor als Seite (KAN-36): Autosave, Statussperre, verworfene
 * Bloecke und die Workflow-Aktionen.
 *
 * <p>Geprueft wird ueber die sichtbare Oberflaeche und die tatsaechlich
 * gestellten Anfragen, nicht ueber Interna des Editors. Die Feinheiten des
 * Schemas liegen in {@code blockSchema.test.ts}, die der Blockliste in
 * {@code blockCommands.test.ts}.
 */

const PROJECT_ID = "1f9d7a10-0000-0000-0000-000000000000"

/**
 * Die ID, die {@code signInAs} in die Sitzung legt. Wer im Editor was darf,
 * haengt seit dem Contract-Abgleich zu KAN-36 an der Beteiligung am Projekt
 * (§5) und nicht mehr am Status allein; die Faelle setzen die Autor:in
 * deshalb ausdruecklich auf diese Person.
 */
const SIGNED_IN_ID = "00000000-0000-0000-0000-000000000001"

/** Ein Projekt, dessen Autor:in die angemeldete Person ist. */
function ownProject(
  overrides: Parameters<typeof projectDetailHandler>[0] = {}
) {
  return projectDetailHandler({
    author: person({ id: SIGNED_IN_ID }),
    ...overrides,
  })
}

function paragraphBlock(text: string, index = 0): BlockResponse {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    type: "TEXT",
    orderIndex: index,
    schemaVersion: BLOCK_SCHEMA_VERSION,
    content: {
      type: "paragraph",
      attrs: { textAlign: null },
      content: [{ type: "text", text }],
    } as unknown as BlockResponse["content"],
  }
}

/*
 * Die Seite wird unmittelbar gerendert und nicht ueber den Routenbaum: sie
 * zoege sonst NavBar, Footer und das Portfolio der Kopfleiste mit, und jeder
 * Fall braeuchte Handler fuer Dinge, um die es ihm nicht geht. Dass die
 * Route erreichbar ist, prueft routes/index.test.tsx. Die Route drumherum
 * bleibt trotzdem noetig, weil die Seite ihre projectId aus useParams holt.
 */
function renderEditor() {
  return renderWithProviders(
    <Routes>
      <Route path="/projects/:projectId/editor" element={<EditorPage />} />
    </Routes>,
    `/projects/${PROJECT_ID}/editor`
  )
}

/**
 * Schreibt in die Schreibflaeche, ohne zu tippen.
 *
 * <p>Tippen laeuft in jsdom nicht durch ProseMirror: dessen Eingabeweg
 * haengt an {@code beforeinput} und einem MutationObserver, die dort nur
 * teilweise vorhanden sind. Tiptap haengt seine Instanz an das DOM der
 * Schreibflaeche; ueber sie entsteht dieselbe Transaktion wie bei einem
 * Tastendruck, einschliesslich {@code onUpdate} und damit des
 * Speichertakts.
 */
function editEditorContent(text: string): void {
  const dom = document.querySelector(".ProseMirror") as
    | (HTMLElement & { editor?: { commands: { insertContent: (value: string) => boolean } } })
    | null
  if (dom?.editor === undefined) {
    throw new Error("Keine Schreibflaeche mit Editor gefunden.")
  }
  dom.editor.commands.insertContent(text)
}

beforeEach(() => {
  signInAs("STUDENT")
})

describe("Laden und Sperren", () => {
  it("zeigt den Projekttitel als einzige h1", async () => {
    server.use(
      ownProject({ title: "AI in Zukunft", status: "DRAFT" }),
      projectBlocksHandler([paragraphBlock("Ein Absatz.")])
    )
    renderEditor()

    expect(
      await screen.findByRole("heading", { level: 1, name: "AI in Zukunft" })
    ).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  })

  /*
   * §4.1: Inhaltsbearbeitung nur in DRAFT und REVISION. Die Oberflaeche
   * spiegelt die Regel, sie ersetzt sie nicht; der Server sperrt ohnehin.
   */
  it("sperrt die Schreibflaeche in PUBLISHED und nennt den Grund", async () => {
    server.use(
      ownProject({ status: "PUBLISHED" }),
      projectBlocksHandler([paragraphBlock("Fertig.")])
    )
    renderEditor()

    expect(
      await screen.findByText(/Der Inhalt ist gesperrt/)
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(
        document.querySelector("[contenteditable='true']")
      ).not.toBeInTheDocument()
    })
  })

  it("bietet in DRAFT das Einreichen und in SUBMITTED das Zurueckziehen", async () => {
    server.use(ownProject({ status: "DRAFT" }), projectBlocksHandler())
    const view = renderEditor()

    expect(
      await screen.findByRole("button", { name: "Einreichen" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Zurückziehen" })
    ).not.toBeInTheDocument()

    view.unmount()
    server.use(ownProject({ status: "SUBMITTED" }), projectBlocksHandler())
    renderEditor()

    expect(
      await screen.findByRole("button", { name: "Zurückziehen" })
    ).toBeInTheDocument()
  })

  /*
   * §5 fuehrt Einreichen und Zurueckziehen als eigene Ressource, §4.1 nennt
   * dafuer die Autor:in. Ein Projektmitglied darf den Inhalt bearbeiten,
   * aber nicht einreichen; ihm die Schaltflaeche zu zeigen hiesse, einen Weg
   * anzubieten, den der Server mit 403 beendet.
   */
  it("zeigt einem Projektmitglied keine Workflow-Aktion, aber eine Schreibflaeche", async () => {
    server.use(
      projectDetailHandler({
        status: "DRAFT",
        author: person({ id: "eine-andere-person" }),
        members: [
          {
            userId: SIGNED_IN_ID,
            firstName: "Mira",
            lastName: "Beispiel",
            projectRole: "Frontend",
          },
        ],
      }),
      projectBlocksHandler([paragraphBlock("Text.")])
    )
    renderEditor()

    expect(
      await screen.findByRole("textbox", {
        name: "Inhalt des Projekts bearbeiten",
      })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Einreichen" })
    ).not.toBeInTheDocument()
  })

  /*
   * Die zugewiesene Redaktion darf ein Projekt in REVISION lesen (§5), aber
   * nicht seinen Inhalt bearbeiten. Ohne die Schranke stuende dort eine
   * beschreibbare Flaeche, und jeder Autosave endete im Fehlerzustand.
   */
  it("sperrt die Flaeche fuer eine unbeteiligte Person, auch in REVISION", async () => {
    server.use(
      projectDetailHandler({
        status: "REVISION",
        author: person({ id: "eine-andere-person" }),
        members: [],
      }),
      projectBlocksHandler([paragraphBlock("Text.")])
    )
    renderEditor()

    await screen.findByRole("heading", { level: 1 })
    await waitFor(() => {
      expect(
        document.querySelector("[contenteditable='true']")
      ).not.toBeInTheDocument()
    })
    expect(
      screen.queryByRole("button", { name: "Einreichen" })
    ).not.toBeInTheDocument()
  })

  /*
   * Frontend-Regel 10: keine Attrappe im ausgelieferten Code. Den
   * PDF-Export gibt es noch nicht (KAN-41), also gibt es auch die
   * Schaltflaeche nicht.
   */
  it("zeigt keine PDF-Schaltflaeche, solange KAN-41 offen ist", async () => {
    server.use(ownProject({ status: "DRAFT" }), projectBlocksHandler())
    renderEditor()

    await screen.findByRole("heading", { level: 1 })
    expect(screen.queryByRole("button", { name: /PDF/i })).not.toBeInTheDocument()
  })
})

describe("Verworfene Bloecke blockieren das Speichern", () => {
  /*
   * Der PUT ersetzt die Blockliste vollstaendig (§6.1). Was der Client
   * nicht lesen konnte, stuende nicht im Rumpf und waere danach geloescht.
   */
  it("nennt die betroffenen Positionen und speichert nicht", async () => {
    const unreadable: BlockResponse = {
      id: "00000000-0000-4000-8000-00000000000f",
      type: "TEXT",
      orderIndex: 1,
      schemaVersion: BLOCK_SCHEMA_VERSION,
      content: { type: "unbekannt" } as unknown as BlockResponse["content"],
    }
    const put = vi.fn()
    server.use(
      ownProject({ status: "DRAFT" }),
      projectBlocksHandler([paragraphBlock("Lesbar."), unreadable]),
      http.put("*/api/projects/:projectId/blocks", () => {
        put()
        return HttpResponse.json({ version: 2, blocks: [] })
      })
    )
    renderEditor()

    expect(
      await screen.findByText(/Ein Block konnte nicht gelesen werden/)
    ).toBeInTheDocument()
    /* Die Position steht im Text, damit die Person weiss, wo es klemmt. */
    expect(screen.getByText(/Positionen 2/)).toBeInTheDocument()

    await waitFor(() => {
      expect(
        document.querySelector("[contenteditable='true']")
      ).not.toBeInTheDocument()
    })
    expect(put).not.toHaveBeenCalled()
  })
})

describe("Das blosse Oeffnen schreibt nicht", () => {
  /*
   * Ein Projekt ohne Bloecke ergibt ein Dokument ohne Kinder, und das Schema
   * verlangt block+: ProseMirror ergaenzte beim Aufbau einen Absatz, feuerte
   * onUpdate, und der Speichertakt lief an. Ein frisch angelegter Entwurf
   * bekaeme so allein vom Ansehen eine neue Project.version (6.4), und beim
   * Einreichen haette der Takt seinerseits nichts zu melden.
   */
  it("speichert einen leeren Entwurf nicht schon beim Laden", async () => {
    const put = vi.fn()
    server.use(
      ownProject({ status: "DRAFT" }),
      projectBlocksHandler([]),
      http.put("*/api/projects/:projectId/blocks", () => {
        put()
        return HttpResponse.json({ version: 2, blocks: [] })
      })
    )
    renderEditor()

    await screen.findByRole("textbox", {
      name: "Inhalt des Projekts bearbeiten",
    })
    /* Deutlich ueber der Entprellung von 1500 ms. */
    await new Promise((resolve) => setTimeout(resolve, 2000))

    expect(put).not.toHaveBeenCalled()
    expect(screen.queryByText("Nicht gespeichert")).not.toBeInTheDocument()
  })
})

/*
 * Der Speichertakt selbst steht in useAutosave.test.ts: seine vier Zusagen
 * haengen an Zeit und Reihenfolge, und ueber die Schreibflaeche liefen sie
 * durch ProseMirror, dessen Eingabeweg in jsdom nur teilweise vorhanden
 * ist. Hier bleibt, was die Seite daraus sichtbar macht.
 */
describe("Workflow-Aktionen", () => {
  /*
   * Skill frontend-design, Abschnitt 5: jeder Statuswechsel, der fremde
   * Sicht aendert, fragt vorher nach. Ein Fehlklick schickte den Beitrag
   * sonst in die Redaktion.
   */
  it("schickt ohne Bestaetigung keinen Submit", async () => {
    let posts = 0
    server.use(
      ownProject({ status: "DRAFT" }),
      projectBlocksHandler(),
      http.post("*/api/projects/:projectId/submit", () => {
        posts += 1
        return HttpResponse.json({})
      })
    )
    const user = userEvent.setup()
    renderEditor()

    await user.click(await screen.findByRole("button", { name: "Einreichen" }))

    /* Der Dialog steht, aber nichts ist unterwegs. */
    expect(
      await screen.findByRole("heading", { name: "Projekt einreichen?" })
    ).toBeInTheDocument()
    expect(posts).toBe(0)

    await user.click(screen.getByRole("button", { name: "Abbrechen" }))
    expect(posts).toBe(0)
  })

  it("schickt nach der Bestaetigung genau einen Submit", async () => {
    let posts = 0
    server.use(
      ownProject({ status: "DRAFT" }),
      projectBlocksHandler(),
      http.post("*/api/projects/:projectId/submit", () => {
        posts += 1
        return HttpResponse.json(projectDetail({ status: "SUBMITTED" }))
      })
    )
    const user = userEvent.setup()
    renderEditor()

    await user.click(await screen.findByRole("button", { name: "Einreichen" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Einreichen" }))

    await waitFor(() => expect(posts).toBe(1))
  })

  /*
   * 400 PROJECT_INCOMPLETE nennt die Pflichtfelder aus §3.3, die noch
   * fehlen. Der Client zeigt den Fehler an, statt ihn zu verschlucken.
   */
  it("zeigt 400 PROJECT_INCOMPLETE sichtbar an", async () => {
    server.use(
      ownProject({ status: "DRAFT" }),
      projectBlocksHandler(),
      http.post("*/api/projects/:projectId/submit", () =>
        apiErrorResponse(
          400,
          "PROJECT_INCOMPLETE",
          `/api/projects/${PROJECT_ID}/submit`
        )
      )
    )
    const user = userEvent.setup()
    renderEditor()

    await user.click(await screen.findByRole("button", { name: "Einreichen" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Einreichen" }))

    expect(
      await screen.findByText(/Das Projekt ist noch unvollständig/)
    ).toBeInTheDocument()
  })
})

describe("Versionskonflikt des Speichertakts", () => {
  /*
   * §6.4 und Frontend-Regel 4: ein 409 wird nie automatisch wiederholt.
   * Ohne Dialog waere er aber eine Sackgasse: der Takt haelt an, in der
   * Kopfzeile stuenden zwei Woerter, und jeder weitere Tastenanschlag liefe
   * ins Nichts, ohne dass jemand die Wahl bekaeme (Befund des
   * Frontend-Reviews zu KAN-36).
   *
   * Ausgeloest wird der Takt hier ueber das Einreichen: runWorkflow ruft
   * zuerst flush(), und das schickt den PUT. Damit laeuft der Fall ueber
   * die sichtbare Oberflaeche, ohne von der Eingabemechanik von ProseMirror
   * in jsdom abzuhaengen.
   */
  it("fuehrt ein 409 des Autosave in den Konfliktdialog", async () => {
    server.use(
      ownProject({ status: "DRAFT" }),
      projectBlocksHandler([paragraphBlock("Start.")]),
      http.put("*/api/projects/:projectId/blocks", () =>
        apiErrorResponse(
          409,
          "PROJECT_VERSION_CONFLICT",
          `/api/projects/${PROJECT_ID}/blocks`
        )
      ),
      http.post("*/api/projects/:projectId/submit", () =>
        HttpResponse.json(projectDetail({ status: "SUBMITTED" }))
      )
    )
    const user = userEvent.setup()
    renderEditor()

    await screen.findByRole("textbox", {
      name: "Inhalt des Projekts bearbeiten",
    })
    /*
     * Eine echte Aenderung ueber die Editor-API. Tippen ginge in jsdom
     * nicht: ProseMirror haengt dort an beforeinput und einem
     * MutationObserver, die nur teilweise vorhanden sind. Tiptap haengt
     * seine Instanz an das DOM der Schreibflaeche, und darueber laeuft
     * dieselbe Transaktion wie bei einem Tastendruck, samt onUpdate und
     * damit samt Speichertakt. Ohne eine Aenderung schickt flush() bewusst
     * nichts.
     */
    editEditorContent(" mehr Text")

    await user.click(await screen.findByRole("button", { name: "Einreichen" }))
    const confirm = await screen.findByRole("alertdialog")
    await user.click(
      within(confirm).getByRole("button", { name: "Einreichen" })
    )

    expect(
      await screen.findByRole("heading", {
        name: "Das Projekt wurde inzwischen geändert",
      })
    ).toBeInTheDocument()
    /* Genau zwei Wege, und Ueberschreiben ist keiner davon (§6.4). */
    expect(
      screen.getByRole("button", { name: "Serverstand laden" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Eigene Fassung behalten" })
    ).toBeInTheDocument()
  })
})

describe("Der Konfliktdialog schliesst in jedem Ausgang", () => {
  /*
   * Skill frontend-design, Abschnitt 5. Der AlertDialog ist modal und faengt
   * den Fokus: liesse er sich nicht schliessen, waere aus der Sackgasse des
   * 409 eine schlimmere geworden, denn an den eigenen Text kaeme niemand
   * mehr heran.
   */
  it("laesst sich ueber „Eigene Fassung behalten“ schliessen", async () => {
    server.use(
      ownProject({ status: "DRAFT" }),
      projectBlocksHandler([paragraphBlock("Start.")]),
      http.put("*/api/projects/:projectId/blocks", () =>
        apiErrorResponse(
          409,
          "PROJECT_VERSION_CONFLICT",
          `/api/projects/${PROJECT_ID}/blocks`
        )
      ),
      http.post("*/api/projects/:projectId/submit", () =>
        HttpResponse.json(projectDetail({ status: "SUBMITTED" }))
      )
    )
    const user = userEvent.setup()
    renderEditor()

    await screen.findByRole("textbox", {
      name: "Inhalt des Projekts bearbeiten",
    })
    editEditorContent(" mehr Text")

    await user.click(await screen.findByRole("button", { name: "Einreichen" }))
    const confirm = await screen.findByRole("alertdialog")
    await user.click(
      within(confirm).getByRole("button", { name: "Einreichen" })
    )

    await screen.findByRole("heading", {
      name: "Das Projekt wurde inzwischen geändert",
    })

    await user.click(
      screen.getByRole("button", { name: "Eigene Fassung behalten" })
    )

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", {
          name: "Das Projekt wurde inzwischen geändert",
        })
      ).not.toBeInTheDocument()
    })
    /* Und der Speicherzustand sagt weiter, dass nichts mehr gespeichert
       wird. */
    expect(screen.getByText("Gleichzeitig geändert")).toBeInTheDocument()
  })

  /*
   * Der Kern: flush() wirft nicht, sondern meldet den Fehlschlag ueber
   * seinen Zustand. Ohne die Schranke ginge der Beitrag mit dem alten
   * Serverinhalt an die Redaktion, sichtbar fuer andere.
   */
  it("reicht nach einem misslungenen Speichertakt nicht ein", async () => {
    let posts = 0
    server.use(
      ownProject({ status: "DRAFT" }),
      projectBlocksHandler([paragraphBlock("Start.")]),
      http.put("*/api/projects/:projectId/blocks", () =>
        apiErrorResponse(
          400,
          "BLOCK_CONTENT_INVALID",
          `/api/projects/${PROJECT_ID}/blocks`
        )
      ),
      http.post("*/api/projects/:projectId/submit", () => {
        posts += 1
        return HttpResponse.json(projectDetail({ status: "SUBMITTED" }))
      })
    )
    const user = userEvent.setup()
    renderEditor()

    await screen.findByRole("textbox", {
      name: "Inhalt des Projekts bearbeiten",
    })
    editEditorContent(" mehr Text")

    await user.click(await screen.findByRole("button", { name: "Einreichen" }))
    const confirm = await screen.findByRole("alertdialog")
    await user.click(
      within(confirm).getByRole("button", { name: "Einreichen" })
    )

    expect(
      await screen.findByText(/Der letzte Speichervorgang ist fehlgeschlagen/)
    ).toBeInTheDocument()
    expect(posts).toBe(0)
  })
})

describe("Der Weg zurueck", () => {
  /*
   * Innerhalb des Entprellfensters sind bis zu anderthalb Sekunden Arbeit
   * noch nicht beim Server, und der Zeitgeber verschwindet beim Verlassen
   * (Skill frontend-design, Abschnitt 5).
   */
  it("fragt bei ungespeichertem Stand nach, statt zu gehen", async () => {
    server.use(
      ownProject({ status: "DRAFT" }),
      projectBlocksHandler([paragraphBlock("Start.")])
    )
    const user = userEvent.setup()
    renderEditor()

    await screen.findByRole("textbox", {
      name: "Inhalt des Projekts bearbeiten",
    })
    editEditorContent(" mehr Text")

    await user.click(screen.getByRole("button", { name: "Zurück" }))

    expect(
      await screen.findByRole("heading", {
        name: "Es sind noch Änderungen offen",
      })
    ).toBeInTheDocument()
  })

  it("geht ohne Rueckfrage, wenn nichts offen ist", async () => {
    server.use(
      ownProject({ status: "DRAFT" }),
      projectBlocksHandler([paragraphBlock("Start.")])
    )
    const user = userEvent.setup()
    renderEditor()

    await screen.findByRole("textbox", {
      name: "Inhalt des Projekts bearbeiten",
    })

    await user.click(screen.getByRole("button", { name: "Zurück" }))

    expect(
      screen.queryByRole("heading", { name: "Es sind noch Änderungen offen" })
    ).not.toBeInTheDocument()
  })
})

describe("Seitenleiste", () => {
  it("zeigt die Statushistorie, wenn der Server sie mitliefert", async () => {
    server.use(
      projectDetailHandler({
        statusHistory: [
          {
            fromStatus: null,
            toStatus: "DRAFT",
            changedBy: person({ firstName: "Mira", lastName: "Beispiel" }),
            timestamp: "2026-01-01T10:00:00Z",
          },
        ],
      }),
      projectBlocksHandler()
    )
    const user = userEvent.setup()
    renderEditor()

    await user.click(await screen.findByRole("button", { name: "Historie" }))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText(/Mira Beispiel/)).toBeInTheDocument()
  })

  /*
   * §3.12: null heisst „nicht sichtbar", die leere Liste „noch kein
   * Wechsel". Zwei verschiedene Aussagen, zwei verschiedene Meldungen.
   */
  it("unterscheidet nicht sichtbar von noch kein Wechsel", async () => {
    server.use(
      projectDetailHandler({ statusHistory: null }),
      projectBlocksHandler()
    )
    const user = userEvent.setup()
    const view = renderEditor()

    await user.click(await screen.findByRole("button", { name: "Historie" }))
    expect(
      await screen.findByText("Der Verlauf ist nicht sichtbar")
    ).toBeInTheDocument()

    view.unmount()
    server.use(
      projectDetailHandler({ statusHistory: [] }),
      projectBlocksHandler()
    )
    renderEditor()

    await user.click(await screen.findByRole("button", { name: "Historie" }))
    expect(
      await screen.findByText("Noch kein Statuswechsel")
    ).toBeInTheDocument()
  })

  it("schaltet zwischen Schreibflaeche und Vorschau um", async () => {
    server.use(
      ownProject({ status: "DRAFT" }),
      projectBlocksHandler([paragraphBlock("Sichtbarer Absatz.")])
    )
    const user = userEvent.setup()
    renderEditor()

    await screen.findByRole("textbox", {
      name: "Inhalt des Projekts bearbeiten",
    })

    await user.click(screen.getByRole("switch", { name: "Vorschau anzeigen" }))

    await waitFor(() => {
      expect(
        screen.queryByRole("textbox", {
          name: "Inhalt des Projekts bearbeiten",
        })
      ).not.toBeInTheDocument()
    })
    /* Die Vorschau laeuft ueber denselben Renderer wie die Detailseite. */
    expect(screen.getByText("Sichtbarer Absatz.")).toBeInTheDocument()
  })
})

describe("Fehlerzustaende der Route", () => {
  it("zeigt 404 PROJECT_NOT_FOUND als Meldung mit Weg zurueck", async () => {
    server.use(
      http.get("*/api/projects/:projectId", () =>
        apiErrorResponse(
          404,
          "PROJECT_NOT_FOUND",
          `/api/projects/${PROJECT_ID}`
        )
      ),
      projectBlocksHandler()
    )
    renderEditor()

    expect(
      await screen.findByRole("heading", { name: "Dieses Projekt gibt es nicht" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Zu meinem Portfolio" })
    ).toBeInTheDocument()
  })

  it("zeigt 403 NO_PERMISSION als Meldung und leitet nicht um", async () => {
    server.use(
      http.get("*/api/projects/:projectId", () =>
        apiErrorResponse(403, "NO_PERMISSION", `/api/projects/${PROJECT_ID}`)
      ),
      projectBlocksHandler()
    )
    renderEditor()

    expect(
      await screen.findByRole("heading", {
        name: "Kein Zugriff auf dieses Projekt",
      })
    ).toBeInTheDocument()
  })
})
