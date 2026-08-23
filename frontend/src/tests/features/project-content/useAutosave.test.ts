import { act, renderHook, waitFor } from "@testing-library/react"
import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ProjectDetailResponse, ProjectUpdateRequest } from "@/api/types"
import type { ProjectDocument } from "@/features/project-content/blockTypes"
import { useAutosave } from "@/features/project-content/hooks/useAutosave"
import { apiErrorResponse } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"

/**
 * Der Speichertakt gegen einen echten Endpoint (MSW), nicht gegen einen
 * nachgebauten Client: geprueft wird, was ueber die Leitung geht.
 */

const PROJECT_ID = "1f9d7a10-0000-0000-0000-000000000000"
const BLOCK_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"

const PATH = "*/api/projects/:projectId/blocks"
/** Der Metadatenweg (§6.1), getrennt vom Inhalt und mit derselben version. */
const PROJECT_PATH = "*/api/projects/:projectId"

function documentWith(text: string): ProjectDocument {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: { textAlign: null },
        content: [{ type: "text", text }],
      },
      /* Der leere Schlussabsatz, den Tiptap anhaengt; docToBlocks laesst
         ihn weg, und genau das soll der Takt nicht als Aenderung sehen. */
      { type: "paragraph", attrs: { textAlign: null } },
    ],
  }
}

/**
 * Der Hook mit einem Dokument, das der Test von aussen wechseln kann.
 *
 * <p>Die Kopfangaben sind vorbelegt mit „nichts zu tun": die aelteren
 * Faelle pruefen allein den Inhaltsweg, und ein Metadaten-Request wuerde
 * dort nur stoeren.
 */
function setUp(
  initial = "erste Fassung",
  options: {
    enabled?: boolean
    readMetadata?: () => Omit<ProjectUpdateRequest, "version"> | null
    onMetadataSaved?: (project: ProjectDetailResponse) => void
  } = {}
) {
  const state = { text: initial }
  const view = renderHook(() =>
    useAutosave({
      projectId: PROJECT_ID,
      enabled: options.enabled ?? true,
      version: 3,
      blocks: [{ id: BLOCK_ID, type: "TEXT" }],
      readDocument: () => documentWith(state.text),
      readMetadata: options.readMetadata ?? (() => null),
      onMetadataSaved: options.onMetadataSaved ?? (() => undefined),
    })
  )
  return { view, state }
}

describe("useAutosave", () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it("sendet entprellt und nicht bei jedem Anschlag", async () => {
    const requests: unknown[] = []
    server.use(
      http.put(PATH, async ({ request }) => {
        requests.push(await request.json())
        return HttpResponse.json({ version: 4, blocks: [] })
      })
    )

    const { view, state } = setUp()

    act(() => {
      state.text = "a"
      view.result.current.schedule()
      state.text = "ab"
      view.result.current.schedule()
      state.text = "abc"
      view.result.current.schedule()
    })

    await waitFor(() => expect(requests).toHaveLength(1), { timeout: 20000 })
    /* Der Zustand wird abgewartet und nicht sofort gelesen: der Handler
       zaehlt den Request, wenn er hereinkommt, der Takt setzt „saved" erst
       nach der Antwort. Dazwischen liegt ein Rendern. */
    await waitFor(() => expect(view.result.current.state).toBe("saved"), {
      timeout: 20000,
    })
  })

  /*
   * Eine reine Entprellung hat eine Luecke, die beim Schreiben leicht
   * auftritt: jeder Anschlag setzt den Wecker zurueck, und wer ohne Pause
   * tippt, speichert nie. Deshalb die Obergrenze von zehn Sekunden.
   */
  it("sendet spaetestens nach der Obergrenze, auch ohne jede Schreibpause", async () => {
    const requests: unknown[] = []
    server.use(
      http.put(PATH, async ({ request }) => {
        requests.push(await request.json())
        return HttpResponse.json({ version: 4, blocks: [] })
      })
    )

    vi.useFakeTimers()
    const { view, state } = setUp()

    /* Alle 900 ms ein Anschlag: die Entprellung von 1200 ms kommt damit
       nie zum Zug. */
    const anschlag = async (nummer: number) => {
      act(() => {
        state.text = `Fassung ${nummer}`
        view.result.current.schedule()
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(900)
      })
    }

    for (let i = 0; i < 5; i += 1) {
      await anschlag(i)
    }
    /* Nach viereinhalb Sekunden ist die Obergrenze noch nicht erreicht. */
    expect(requests).toHaveLength(0)

    for (let i = 5; i < 12; i += 1) {
      await anschlag(i)
    }

    vi.useRealTimers()
    await waitFor(() => expect(requests.length).toBeGreaterThanOrEqual(1), {
      timeout: 20000,
    })
  })

  it("uebernimmt version und IDs aus der Antwort", async () => {
    const sent: { version: number; blocks: { id?: string }[] }[] = []
    server.use(
      http.put(PATH, async ({ request }) => {
        const body = (await request.json()) as {
          version: number
          blocks: { id?: string }[]
        }
        sent.push(body)
        return HttpResponse.json({
          version: 4 + sent.length,
          blocks: [
            {
              id: BLOCK_ID,
              type: "TEXT",
              orderIndex: 0,
              content: {},
              schemaVersion: 3,
            },
          ],
        })
      })
    )

    const { view, state } = setUp()

    await act(async () => {
      state.text = "erste Aenderung"
      await view.result.current.flush()
    })
    await act(async () => {
      state.text = "zweite Aenderung"
      await view.result.current.flush()
    })

    expect(sent).toHaveLength(2)
    /* Die zweite Runde geht mit der Version aus der ersten Antwort los;
       ohne das ergaebe der naechste Takt 409 gegen sich selbst. */
    expect(sent[0].version).toBe(3)
    expect(sent[1].version).toBe(5)
    /* Und mit der ID, sonst legte der Server bei jedem Takt neue Bloecke
       an, und blockbezogene Kommentare waeren dauerhaft unmoeglich. */
    expect(sent[1].blocks[0].id).toBe(BLOCK_ID)
  })

  it("laesst nur einen Takt gleichzeitig laufen", async () => {
    let open = 0
    let maxOpen = 0
    server.use(
      http.put(PATH, async () => {
        open = open + 1
        maxOpen = Math.max(maxOpen, open)
        await new Promise((resolve) => setTimeout(resolve, 50))
        open = open - 1
        return HttpResponse.json({ version: 4, blocks: [] })
      })
    )

    const { view, state } = setUp()

    await act(async () => {
      state.text = "eins"
      const first = view.result.current.flush()
      state.text = "zwei"
      const second = view.result.current.flush()
      await Promise.all([first, second])
    })

    expect(maxOpen).toBe(1)
  })

  it("wiederholt einen Versionskonflikt nicht und haelt danach an", async () => {
    let calls = 0
    server.use(
      http.put(PATH, () => {
        calls = calls + 1
        return apiErrorResponse(
          409,
          "PROJECT_VERSION_CONFLICT",
          `/api/projects/${PROJECT_ID}/blocks`
        )
      })
    )

    const { view, state } = setUp()

    await act(async () => {
      state.text = "Aenderung"
      await view.result.current.flush()
    })

    expect(calls).toBe(1)
    expect(view.result.current.state).toBe("conflict")
    expect(view.result.current.error?.errorCode).toBe(
      "PROJECT_VERSION_CONFLICT"
    )

    /* Jeder weitere Takt traefe denselben Konflikt (§6.4). */
    await act(async () => {
      state.text = "noch eine Aenderung"
      await view.result.current.flush()
    })
    expect(calls).toBe(1)
  })

  it("macht einen Fehlschlag sichtbar, statt ihn zu verschlucken", async () => {
    server.use(
      http.put(PATH, () =>
        apiErrorResponse(
          409,
          "PROJECT_STATUS_NOT_EDITABLE",
          `/api/projects/${PROJECT_ID}/blocks`
        )
      )
    )

    const { view, state } = setUp()

    await act(async () => {
      state.text = "Aenderung"
      await view.result.current.flush()
    })

    expect(view.result.current.state).toBe("error")
    expect(view.result.current.error?.errorCode).toBe(
      "PROJECT_STATUS_NOT_EDITABLE"
    )
  })

  it("meldet das Ergebnis von flush zurueck", async () => {
    server.use(
      http.put(PATH, () => HttpResponse.json({ version: 4, blocks: [] }))
    )
    const { view, state } = setUp()

    let result = false
    await act(async () => {
      state.text = "Aenderung"
      result = await view.result.current.flush()
    })

    /* Ueber den Rueckgabewert und nicht ueber den Zustand: wer danach
       einreicht, muss wissen, ob der letzte Stand drin ist. */
    expect(result).toBe(true)
  })

  it("sendet nichts, wenn sich am Dokument nichts geaendert hat", async () => {
    let calls = 0
    server.use(
      http.put(PATH, () => {
        calls = calls + 1
        /* Die Antwort traegt die gespeicherte Liste, wie der echte
           Endpoint: der naechste Takt baut aus ihr dieselben Bloecke mit
           denselben IDs, und genau dieser Vergleich haelt ihn an. */
        return HttpResponse.json({
          version: 4,
          blocks: [
            {
              id: BLOCK_ID,
              type: "TEXT",
              orderIndex: 0,
              content: {},
              schemaVersion: 3,
            },
          ],
        })
      })
    )

    const { view, state } = setUp()

    await act(async () => {
      state.text = "einmal"
      await view.result.current.flush()
    })
    await act(async () => {
      await view.result.current.flush()
    })

    expect(calls).toBe(1)
  })

  /*
   * Inhalt und Kopfangaben laufen ueber zwei Endpoints (§6.1), erhoehen
   * aber dieselbe Project.version (§6.4). Nebeneinander gaebe das einen
   * 409 gegen die eigene vorige Speicherung.
   */
  it("schickt Inhalt und Kopfangaben nacheinander und reicht die version weiter", async () => {
    const calls: { ziel: string; version: number }[] = []
    server.use(
      http.put(PATH, async ({ request }) => {
        const body = (await request.json()) as { version: number }
        calls.push({ ziel: "blocks", version: body.version })
        return HttpResponse.json({ version: 4, blocks: [] })
      }),
      http.put(PROJECT_PATH, async ({ request }) => {
        const body = (await request.json()) as { version: number }
        calls.push({ ziel: "project", version: body.version })
        return HttpResponse.json({ version: 5 })
      })
    )

    const { view, state } = setUp("erste Fassung", {
      readMetadata: () => ({ title: "Neuer Titel" }),
    })

    await act(async () => {
      state.text = "geaenderter Text"
      await view.result.current.flush()
    })

    expect(calls).toEqual([
      { ziel: "blocks", version: 3 },
      { ziel: "project", version: 4 },
    ])
  })

  it("uebergibt die Antwort der Kopfangaben nach oben", async () => {
    const saved: { version: number }[] = []
    server.use(
      http.put(PATH, () => HttpResponse.json({ version: 4, blocks: [] })),
      http.put(PROJECT_PATH, () => HttpResponse.json({ version: 9 }))
    )

    const { view } = setUp("erste Fassung", {
      readMetadata: () => ({ title: "Neuer Titel" }),
      onMetadataSaved: (project) => saved.push(project),
    })

    await act(async () => {
      await view.result.current.flush()
    })

    expect(saved).toHaveLength(1)
    expect(saved[0].version).toBe(9)
  })

  it("sendet nichts, solange sich an den Kopfangaben nichts geaendert hat", async () => {
    let projectPuts = 0
    server.use(
      http.put(PATH, () => HttpResponse.json({ version: 4, blocks: [] })),
      http.put(PROJECT_PATH, () => {
        projectPuts = projectPuts + 1
        return HttpResponse.json({ version: 5 })
      })
    )

    /* null heisst: der Aufrufer hat verglichen, es gibt nichts zu tun. */
    const { view, state } = setUp("erste Fassung", { readMetadata: () => null })

    await act(async () => {
      state.text = "geaenderter Text"
      await view.result.current.flush()
    })

    expect(projectPuts).toBe(0)
  })

  /*
   * Ein Block, den die Ansicht nicht lesen kann, sperrt die Schreibflaeche
   * (der PUT ersetzt die ganze Liste). Der Titel darf trotzdem gespeichert
   * werden, er laeuft ueber einen anderen Endpoint.
   */
  it("speichert die Kopfangaben auch bei gesperrter Schreibflaeche", async () => {
    let blockPuts = 0
    let projectPuts = 0
    server.use(
      http.put(PATH, () => {
        blockPuts = blockPuts + 1
        return HttpResponse.json({ version: 4, blocks: [] })
      }),
      http.put(PROJECT_PATH, () => {
        projectPuts = projectPuts + 1
        return HttpResponse.json({ version: 5 })
      })
    )

    const { view } = setUp("erste Fassung", {
      enabled: false,
      readMetadata: () => ({ title: "Neuer Titel" }),
    })

    await act(async () => {
      await view.result.current.flush()
    })

    expect(blockPuts).toBe(0)
    expect(projectPuts).toBe(1)
  })

  it("haelt den ganzen Takt an, wenn die Kopfangaben mit 409 antworten", async () => {
    let projectPuts = 0
    server.use(
      http.put(PATH, () => HttpResponse.json({ version: 4, blocks: [] })),
      http.put(PROJECT_PATH, () => {
        projectPuts = projectPuts + 1
        return apiErrorResponse(
          409,
          "PROJECT_VERSION_CONFLICT",
          `/api/projects/${PROJECT_ID}`
        )
      })
    )

    const { view, state } = setUp("erste Fassung", {
      readMetadata: () => ({ title: "Neuer Titel" }),
    })

    await act(async () => {
      state.text = "geaenderter Text"
      await view.result.current.flush()
    })

    expect(view.result.current.state).toBe("conflict")

    /* Auch der Inhaltsweg steht danach: beide teilen sich die version. */
    await act(async () => {
      state.text = "noch eine Aenderung"
      await view.result.current.flush()
    })
    expect(projectPuts).toBe(1)
  })
})
