import { act, renderHook, waitFor } from "@testing-library/react"
import { HttpResponse, http } from "msw"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ProjectDocument } from "@/features/project-content/blockTypes"
import { useAutosave } from "@/features/project-content/hooks/useAutosave"
import { apiErrorResponse } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"

/**
 * Der Speichertakt (KAN-36), unmittelbar am Hook geprueft.
 *
 * <p><strong>Warum nicht ueber die Seite.</strong> Die vier Zusagen des
 * Takts haengen an Zeit und Reihenfolge: entprellt, immer nur einer
 * gleichzeitig, version und IDs aus der Antwort, und nach 409 kein zweiter
 * Versuch. Ueber die Oberflaeche liefen sie durch die Schreibflaeche von
 * ProseMirror, und die haengt in jsdom an {@code beforeinput} und einem
 * MutationObserver, die dort nur teilweise vorhanden sind: ein Testfall
 * scheiterte dann an der Umgebung und nicht an der Zusage. Dass die Seite
 * den Hook richtig verdrahtet, prueft {@code EditorPage.test.tsx} an den
 * sichtbaren Zustaenden.
 */

const PROJECT_ID = "1f9d7a10-0000-0000-0000-000000000000"
const PATH = `/api/projects/${PROJECT_ID}/blocks`

const DOCUMENT: ProjectDocument = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      attrs: { textAlign: null },
      content: [{ type: "text", text: "Ein Absatz." }],
    },
  ],
}

type PutBody = {
  version: number
  blocks: { id?: string | null; type: string }[]
}

function setup(options: { enabled?: boolean; version?: number } = {}) {
  return renderHook(() =>
    useAutosave({
      projectId: PROJECT_ID,
      enabled: options.enabled ?? true,
      version: options.version ?? 4,
      blocks: [{ id: "00000000-0000-4000-8000-000000000001", type: "TEXT" }],
      readDocument: () => DOCUMENT,
    })
  )
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("Entprellung", () => {
  it("sendet erst nach der Wartezeit und nur einmal", async () => {
    const bodies: PutBody[] = []
    server.use(
      http.put(`*${PATH}`, async ({ request }) => {
        bodies.push((await request.json()) as PutBody)
        return HttpResponse.json({ version: 5, blocks: [] })
      })
    )
    const { result } = setup()

    act(() => {
      result.current.schedule()
      result.current.schedule()
      result.current.schedule()
    })

    expect(result.current.state).toBe("pending")
    expect(bodies).toHaveLength(0)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })

    /* Drei Aenderungen, ein Takt: genau das ist der Zweck der Entprellung. */
    await waitFor(() => expect(bodies).toHaveLength(1))
    await waitFor(() => expect(result.current.state).toBe("saved"))
  })

  it("sendet nichts, solange enabled falsch ist", async () => {
    let calls = 0
    server.use(
      http.put(`*${PATH}`, () => {
        calls += 1
        return HttpResponse.json({ version: 5, blocks: [] })
      })
    )
    const { result } = setup({ enabled: false })

    act(() => result.current.schedule())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(calls).toBe(0)
    expect(result.current.state).toBe("idle")
  })
})

describe("version und IDs kommen aus der Antwort", () => {
  it("schickt die zuletzt bekannte version und uebernimmt die neue", async () => {
    const bodies: PutBody[] = []
    server.use(
      http.put(`*${PATH}`, async ({ request }) => {
        bodies.push((await request.json()) as PutBody)
        return HttpResponse.json({
          version: 9,
          blocks: [
            {
              id: "00000000-0000-4000-8000-0000000000aa",
              type: "TEXT",
              orderIndex: 0,
              schemaVersion: 3,
              content: {},
            },
          ],
        })
      })
    )
    const { result } = setup({ version: 4 })

    act(() => result.current.schedule())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })
    await waitFor(() => expect(bodies).toHaveLength(1))

    expect(bodies[0].version).toBe(4)
    /* Die ID des vorhandenen Blocks geht mit: ohne sie legte der Server ihn
       neu an, und blockbezogene Kommentare waeren dauerhaft unmoeglich. */
    expect(bodies[0].blocks[0].id).toBe(
      "00000000-0000-4000-8000-000000000001"
    )

    act(() => result.current.schedule())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })
    await waitFor(() => expect(bodies).toHaveLength(2))

    /* Der zweite Takt tritt mit der Version aus der ersten Antwort an, und
       mit der ID, die der Server vergeben hat. */
    expect(bodies[1].version).toBe(9)
    expect(bodies[1].blocks[0].id).toBe("00000000-0000-4000-8000-0000000000aa")
  })
})

describe("Nur ein Takt gleichzeitig", () => {
  /*
   * Zwei ueberlappende Takte erzeugen zuverlaessig einen Versionskonflikt
   * gegen die eigene Sitzung: der zweite traete mit der Version an, die der
   * erste gerade erhoeht.
   */
  it("startet waehrend eines laufenden Takts keinen zweiten", async () => {
    let inFlight = 0
    let maxInFlight = 0
    server.use(
      http.put(`*${PATH}`, async () => {
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 50))
        inFlight -= 1
        return HttpResponse.json({ version: 5, blocks: [] })
      })
    )
    const { result } = setup()

    act(() => result.current.schedule())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })
    /* Waehrend der erste laeuft, kommt eine weitere Aenderung herein. */
    act(() => result.current.schedule())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    await waitFor(() => expect(result.current.state).toBe("saved"))
    expect(maxInFlight).toBe(1)
  })
})

describe("409 PROJECT_VERSION_CONFLICT", () => {
  /*
   * §6.4 und Frontend-Regel 4: ein zweiter Versuch mit der frischen Version
   * ueberschriebe genau die fremde Aenderung, vor der das Locking schuetzt.
   */
  it("wird nie automatisch wiederholt und haelt den Takt an", async () => {
    let calls = 0
    server.use(
      http.put(`*${PATH}`, () => {
        calls += 1
        return apiErrorResponse(409, "PROJECT_VERSION_CONFLICT", PATH)
      })
    )
    const { result } = setup()

    act(() => result.current.schedule())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })

    await waitFor(() => expect(result.current.state).toBe("conflict"))
    expect(calls).toBe(1)

    /* Weiterschreiben startet keinen neuen Takt. */
    act(() => result.current.schedule())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(calls).toBe(1)

    /* Erst das Neuladen ueber reset() gibt den Takt wieder frei. */
    act(() =>
      result.current.reset({
        version: 12,
        blocks: [{ id: "00000000-0000-4000-8000-0000000000bb", type: "TEXT" }],
      })
    )
    expect(result.current.state).toBe("idle")

    act(() => result.current.schedule())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })
    expect(calls).toBe(2)
  })
})

describe("reset nach dem Neuladen", () => {
  /*
   * Ein noch offener Zeitgeber schickte sonst gleich nach dem Neuladen den
   * verworfenen Stand hinterher und erzeugte eine ueberfluessige neue
   * Project.version (6.4).
   */
  it("loescht einen offenen Entprell-Timer", async () => {
    let calls = 0
    server.use(
      http.put(`*${PATH}`, () => {
        calls += 1
        return HttpResponse.json({ version: 5, blocks: [] })
      })
    )
    const { result } = setup()

    /* Takt armiert, aber noch nicht gefeuert. */
    act(() => result.current.schedule())
    expect(calls).toBe(0)

    act(() =>
      result.current.reset({
        version: 12,
        blocks: [{ id: "00000000-0000-4000-8000-0000000000bb", type: "TEXT" }],
      })
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(calls).toBe(0)
    expect(result.current.state).toBe("idle")
  })
})

describe("hasUnsavedChanges", () => {
  /*
   * Der bewachte Weg zurueck haengt daran. Nach einem Fehlschlag ist der
   * Verlust wahrscheinlicher als im Normalfall, denn der letzte
   * Speichervorgang ist gerade misslungen.
   */
  it("meldet nach einem Fehlschlag weiterhin Ungespeichertes", async () => {
    server.use(
      http.put(`*${PATH}`, () =>
        apiErrorResponse(400, "BLOCK_CONTENT_INVALID", PATH)
      )
    )
    const { result } = setup()

    act(() => result.current.schedule())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })

    await waitFor(() => expect(result.current.state).toBe("error"))
    expect(result.current.hasUnsavedChanges).toBe(true)
  })

  it("meldet nach einem erfolgreichen Takt nichts Offenes", async () => {
    server.use(
      http.put(`*${PATH}`, () => HttpResponse.json({ version: 5, blocks: [] }))
    )
    const { result } = setup()

    act(() => result.current.schedule())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })

    await waitFor(() => expect(result.current.state).toBe("saved"))
    expect(result.current.hasUnsavedChanges).toBe(false)
  })
})

describe("Sonstige Fehlschlaege", () => {
  it("meldet den Fehler und laesst einen weiteren Versuch zu", async () => {
    let calls = 0
    server.use(
      http.put(`*${PATH}`, () => {
        calls += 1
        return apiErrorResponse(400, "BLOCK_CONTENT_INVALID", PATH)
      })
    )
    const { result } = setup()

    act(() => result.current.schedule())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })

    await waitFor(() => expect(result.current.state).toBe("error"))
    expect(result.current.error?.errorCode).toBe("BLOCK_CONTENT_INVALID")

    /* Anders als beim Konflikt haelt der Takt hier nicht an: ein 400 kann
       an einem Block liegen, der gerade berichtigt wird. */
    act(() => result.current.schedule())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })
    await waitFor(() => expect(calls).toBe(2))
  })
})

describe("flush", () => {
  /*
   * Daran haengt das Einreichen: EditorPage ruft flush und schickt danach
   * den Statuswechsel. Kaeme flush zurueck, waehrend noch ein Takt unterwegs
   * ist, traefe der Statuswechsel den Server womoeglich vor dem letzten
   * Speichervorgang, und eingereicht waere ein Stand, den niemand so gesehen
   * hat (Befund des Frontend-Reviews zu KAN-36).
   */
  it("wartet einen bereits laufenden Takt ab", async () => {
    let started = 0
    let finished = 0
    /* Ein Tor statt einer Wartezeit: mit gefaelschten Zeitgebern liefe ein
       setTimeout im Handler mit dem Vorspulen mit, und der erste Takt waere
       schon fertig, bevor der Fall ueberhaupt beginnt. */
    let openGate: (() => void) | null = null
    const gate = new Promise<void>((resolve) => {
      openGate = resolve
    })
    server.use(
      http.put(`*${PATH}`, async () => {
        started += 1
        if (started === 1) {
          await gate
        }
        finished += 1
        return HttpResponse.json({ version: 5, blocks: [] })
      })
    )
    const { result } = setup()

    /* Erster Takt laeuft los und haengt am Tor. */
    act(() => result.current.schedule())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })
    await waitFor(() => expect(started).toBe(1))
    expect(finished).toBe(0)

    /* Waehrenddessen wird weitergeschrieben und dann eingereicht. */
    act(() => result.current.schedule())

    let resolved = false
    await act(async () => {
      const pending = result.current.flush().then(() => {
        resolved = true
      })
      /* Solange das Tor zu ist, kommt flush nicht zurueck. */
      await vi.advanceTimersByTimeAsync(50)
      expect(resolved).toBe(false)

      openGate?.()
      await pending
    })

    expect(resolved).toBe(true)
    /* Der zweite Takt ist mitgelaufen und ebenfalls fertig. */
    expect(started).toBeGreaterThanOrEqual(2)
    expect(finished).toBe(started)
  })

  /*
   * Sonst schriebe jedes Einreichen die komplette Blockliste neu und
   * erhoehte Project.version ohne fachlichen Anlass (6.4).
   */
  it("sendet nichts, wenn seit dem Laden nichts geaendert wurde", async () => {
    let calls = 0
    server.use(
      http.put(`*${PATH}`, () => {
        calls += 1
        return HttpResponse.json({ version: 5, blocks: [] })
      })
    )
    const { result } = setup()

    await act(async () => {
      await result.current.flush()
    })

    expect(calls).toBe(0)
  })

  it("sendet sofort, ohne auf die Entprellung zu warten", async () => {
    let calls = 0
    server.use(
      http.put(`*${PATH}`, () => {
        calls += 1
        return HttpResponse.json({ version: 5, blocks: [] })
      })
    )
    const { result } = setup()

    act(() => result.current.schedule())
    await act(async () => {
      await result.current.flush()
    })

    expect(calls).toBe(1)
    await waitFor(() => expect(result.current.state).toBe("saved"))
  })
})
