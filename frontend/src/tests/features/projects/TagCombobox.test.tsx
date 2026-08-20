import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { TagResponse } from "@/api/types"
import { TagCombobox } from "@/features/projects/components/TagCombobox"
import { apiErrorResponse } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"

/*
 * Die Combobox kennt kein Projekt und setzt keine Mutation ab (KAN-75). Sie
 * bekommt value und onChange, deshalb steht hier eine kleine Huelle mit
 * eigenem Zustand: geprueft wird, was die Komponente nach aussen meldet, und
 * nicht, wie sie es intern haelt.
 */
function Harness({ initial = [] as string[] }) {
  const [value, setValue] = useState(initial)
  return <TagCombobox value={value} onChange={setValue} />
}

const SUGGESTIONS: TagResponse[] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Nachhaltigkeit", usageCount: 12 },
  { id: "22222222-2222-4222-8222-222222222222", name: "Robotik", usageCount: 7 },
  { id: "33333333-3333-4333-8333-333333333333", name: "Green IT", usageCount: 3 },
]

/** Zaehlt die Aufrufe mit, damit "es geht kein Request hinaus" pruefbar ist. */
let requests: URL[] = []

function tagsHandler(body: TagResponse[] = SUGGESTIONS) {
  return http.get("*/api/tags", ({ request }) => {
    const url = new URL(request.url)
    requests.push(url)
    const q = url.searchParams.get("q")
    if (q === null || q === "") {
      return HttpResponse.json(body)
    }
    return HttpResponse.json(
      body.filter((tag) =>
        (tag.name ?? "").toLocaleLowerCase().includes(q.toLocaleLowerCase())
      )
    )
  })
}

/** Oeffnet das Feld und wartet, bis die Vorschlagsliste steht. */
async function openList(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText("Schlagwörter"))
  return screen.findByRole("listbox")
}

describe("TagCombobox", () => {
  beforeEach(() => {
    requests = []
    server.use(tagsHandler())
    vi.useRealTimers()
  })

  it("zeigt ohne Eingabe die Vorschlaege des Endpoints, ohne die bereits gewaehlten", async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness initial={["Robotik"]} />)

    const listbox = await openList(user)

    await waitFor(() =>
      expect(within(listbox).getByRole("option", { name: "Nachhaltigkeit" })).toBeInTheDocument()
    )
    expect(within(listbox).getByRole("option", { name: "Green IT" })).toBeInTheDocument()
    expect(
      within(listbox).queryByRole("option", { name: "Robotik" })
    ).not.toBeInTheDocument()
  })

  it("bietet ein unbekanntes Wort sichtbar zum Anlegen an und uebernimmt es", async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)

    const input = screen.getByLabelText("Schlagwörter")
    await user.click(input)
    await user.type(input, "Quantenoptik")

    const anlegen = await screen.findByRole(
      "option",
      { name: "„Quantenoptik“ hinzufügen" },
      { timeout: 3000 }
    )
    await user.click(anlegen)

    // Nach der Auswahl steht das Wort als gewaehlter Tag da, mit einer
    // eigenen Schaltflaeche zum Entfernen.
    expect(
      await screen.findByRole("button", { name: "Quantenoptik entfernen" })
    ).toBeInTheDocument()
  })

  it("laesst den Anlege-Eintrag auch mit der Tastatur waehlen", async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)

    const input = screen.getByLabelText("Schlagwörter")
    await user.click(input)
    // Ein Wort, das der Server nicht kennt: die Liste besteht dann allein
    // aus dem Anlege-Eintrag. Steht er nicht in items, ist er fuer die
    // Pfeiltasten unsichtbar und nur klickbar (SC 2.1.1).
    await user.type(input, "Quantenoptik")
    // Abwarten, bis die entprellte Antwort da ist: bis dahin stehen noch die
    // Vorschlaege zum leeren Suchbegriff in der Liste, und die Pfeiltaste
    // traefe den falschen Eintrag.
    await waitFor(
      () => expect(screen.getAllByRole("option")).toHaveLength(1),
      { timeout: 3000 }
    )
    expect(
      screen.getByRole("option", { name: "„Quantenoptik“ hinzufügen" })
    ).toBeInTheDocument()

    await user.keyboard("{ArrowDown}{Enter}")

    expect(
      await screen.findByRole("button", { name: "Quantenoptik entfernen" })
    ).toBeInTheDocument()
  })

  it("meldet bei einem unbekannten Wort nicht zugleich, es gebe keinen Treffer", async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)

    const input = screen.getByLabelText("Schlagwörter")
    await user.click(input)
    await user.type(input, "Quantenoptik")
    await screen.findByRole(
      "option",
      { name: "„Quantenoptik“ hinzufügen" },
      { timeout: 3000 }
    )

    // Der Leerzustand der Primitive ist selbst eine Live-Region; stuende er
    // ueber einem waehlbaren Eintrag, saegte er die Ansage entzwei.
    expect(screen.queryByText("Kein Schlagwort gefunden.")).not.toBeInTheDocument()
  })

  it("nimmt keinen sechsten Tag an, sagt warum und schickt keinen Request", async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <Harness initial={["Eins", "Zwei", "Drei", "Vier", "Fünf"]} />
    )

    const grund =
      "Mehr als 5 Schlagwörter sind nicht möglich. Entfernen Sie eines, um ein anderes hinzuzufügen."
    expect(await screen.findByText(grund)).toBeInTheDocument()

    /*
     * Das Feld bleibt bedienbar: es abzuschalten naehme dem Browser das
     * fokussierte Element unter den Fingern weg, und wer den fuenften Tag
     * mit der Tastatur gewaehlt hat, staende danach am Seitenanfang.
     * Angeboten wird trotzdem nichts, und es geht kein Request hinaus.
     */
    const input = screen.getByLabelText("Schlagwörter")
    expect(input).not.toBeDisabled()

    await user.click(input)
    await user.type(input, "Sechstes")

    await waitFor(() => expect(screen.getAllByText(grund).length).toBeGreaterThan(0))
    expect(screen.queryAllByRole("option")).toHaveLength(0)
    expect(requests).toHaveLength(0)
  })

  it("meldet die Obergrenze ueber eine Live-Region", async () => {
    renderWithProviders(
      <Harness initial={["Eins", "Zwei", "Drei", "Vier", "Fünf"]} />
    )

    const meldung = await screen.findByText(/Mehr als 5 Schlagwörter/)
    expect(meldung).toHaveAttribute("aria-live", "polite")
    // Der Text ist erreichbar und nicht nur vorhanden (Skill frontend-shadcn).
    expect(meldung.closest("[aria-hidden]")).toBeNull()
  })

  it("ist vollstaendig mit der Tastatur bedienbar, einschliesslich Entfernen", async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)

    const input = screen.getByLabelText("Schlagwörter")
    await user.click(input)
    await screen.findByRole("listbox")
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Nachhaltigkeit" })).toBeInTheDocument()
    )

    await user.keyboard("{ArrowDown}{Enter}")

    const entfernen = await screen.findByRole("button", {
      name: "Nachhaltigkeit entfernen",
    })

    // Die Schaltflaeche ist per Tab erreichbar und mit Enter ausloesbar.
    entfernen.focus()
    expect(entfernen).toHaveFocus()
    await user.keyboard("{Enter}")

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Nachhaltigkeit entfernen" })
      ).not.toBeInTheDocument()
    )
  })

  it("filtert waehrend des Tippens ueber q und nicht im Browser", async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)

    const input = screen.getByLabelText("Schlagwörter")
    await user.click(input)
    await user.type(input, "green")

    await waitFor(
      () => expect(requests.some((url) => url.searchParams.get("q") === "green")).toBe(true),
      { timeout: 3000 }
    )

    const listbox = await screen.findByRole("listbox")
    await waitFor(() =>
      expect(within(listbox).getByRole("option", { name: "Green IT" })).toBeInTheDocument()
    )
    expect(
      within(listbox).queryByRole("option", { name: "Robotik" })
    ).not.toBeInTheDocument()
  })

  it("zeigt den Leerzustand, wenn der Endpoint nichts liefert", async () => {
    const user = userEvent.setup()
    server.use(tagsHandler([]))
    renderWithProviders(<Harness />)

    await user.click(screen.getByLabelText("Schlagwörter"))

    expect(
      await screen.findByText("Kein Schlagwort gefunden.")
    ).toBeInTheDocument()
  })

  it("zeigt einen Ladefehler aus dem Fehler-Envelope an, entschieden ueber errorCode", async () => {
    const user = userEvent.setup()
    server.use(
      http.get("*/api/tags", () =>
        apiErrorResponse(500, "INTERNAL_ERROR", "/api/tags")
      )
    )
    renderWithProviders(<Harness />)

    await user.click(screen.getByLabelText("Schlagwörter"))

    const meldung = await screen.findByText(/schiefgelaufen/, {}, { timeout: 3000 })
    expect(meldung).toHaveAttribute("role", "alert")
  })
})
