import { act, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import type { ProjectDetailResponse } from "@/api/types"
import { EditorIntro } from "@/features/project-content/components/EditorIntro"
import type { ProjectIntroValues } from "@/features/projects/ProjectMetadataForm.schema"
import { projectDetail } from "@/tests/fixtures"
import { renderWithProviders } from "@/tests/render"

/**
 * Die Kopfpartie des Editors (KAN-36): Titelbild, Titel und
 * Kurzbeschreibung ueber der Schreibflaeche.
 *
 * <p>Geprueft wird ueber die sichtbare Oberflaeche und ueber die beiden
 * Zusagen nach oben: dass jede Aenderung gemeldet wird und dass der
 * Speichertakt genau dann etwas zu lesen bekommt, wenn hier auch etwas
 * getippt wurde.
 */

const PROJECT_ID = "1f9d7a10-0000-0000-0000-000000000000"

function draft(overrides: Partial<ProjectDetailResponse> = {}) {
  return projectDetail({
    id: PROJECT_ID,
    title: "Beitrag im Entwurf",
    status: "DRAFT",
    ...overrides,
  })
}

/**
 * Die Huelle haelt das Projekt im Zustand, damit ein Test einen neuen
 * Serverstand hereingeben kann: genau das passiert nach dem Neuladen im
 * Konfliktdialog und nach jeder eigenen Speicherung.
 */
function setUp(project: Partial<ProjectDetailResponse> = {}, editable = true) {
  const onChange = vi.fn()
  let read: () => ProjectIntroValues | null = () => null
  let setProject: (next: ProjectDetailResponse) => void = () => undefined

  function Harness() {
    const [current, set] = useState(draft(project))
    setProject = set
    return (
      <EditorIntro
        project={current}
        editable={editable}
        onChange={onChange}
        onRegisterRead={(next) => {
          read = next
        }}
      />
    )
  }

  const view = renderWithProviders(<Harness />)
  return {
    view,
    onChange,
    read: () => read(),
    setProject: (next: ProjectDetailResponse) => {
      act(() => setProject(next))
    },
  }
}

describe("EditorIntro", () => {
  it("nimmt Titel und Kurzbeschreibung entgegen und meldet die Aenderung", async () => {
    const user = userEvent.setup()
    const { onChange, read } = setUp()

    const title = screen.getByLabelText("Projekttitel")
    await user.clear(title)
    await user.type(title, "Neuer Titel")

    const summary = screen.getByLabelText("Abstract")
    await user.type(summary, "Kurz gesagt")

    expect(onChange).toHaveBeenCalled()
    expect(read()).toEqual({
      title: "Neuer Titel",
      summary: "Kurz gesagt",
      coverImageUrl: "",
    })
  })

  /*
   * Ohne Eingabe gibt es nichts zu speichern. Der blosse Unterschied zum
   * Serverstand darf kein Grund sein: sonst schriebe ein unberuehrtes Feld
   * die Aenderung einer anderen Person zurueck (§6.4).
   */
  it("liefert nichts zum Speichern, solange nichts getippt wurde", () => {
    const { read } = setUp()

    expect(read()).toBeNull()
  })

  it("uebernimmt einen neuen Serverstand, solange das Feld unberuehrt ist", () => {
    const { read, setProject } = setUp()

    setProject(draft({ title: "Von jemand anderem geaendert" }))

    expect(screen.getByLabelText("Projekttitel")).toHaveValue(
      "Von jemand anderem geaendert"
    )
    /* Und es gibt weiterhin nichts zu senden: der fremde Stand wird
       uebernommen, nicht ueberschrieben. */
    expect(read()).toBeNull()
  })

  it("behaelt die eigene Eingabe, wenn waehrenddessen ein neuer Serverstand kommt", async () => {
    const user = userEvent.setup()
    const { read, setProject } = setUp()

    const title = screen.getByLabelText("Projekttitel")
    await user.clear(title)
    await user.type(title, "Meine Fassung")

    setProject(draft({ title: "Fremde Fassung" }))

    expect(screen.getByLabelText("Projekttitel")).toHaveValue("Meine Fassung")
    expect(read()?.title).toBe("Meine Fassung")
  })

  /*
   * Nach der eigenen Speicherung kommt die Antwort als neuer Serverstand
   * zurueck. Danach darf dieselbe Karte nicht noch einmal hinausgehen.
   */
  it("hat nach der eigenen Speicherung nichts mehr zu senden", async () => {
    const user = userEvent.setup()
    const { read, setProject } = setUp()

    const title = screen.getByLabelText("Projekttitel")
    await user.clear(title)
    await user.type(title, "Gespeicherte Fassung")
    expect(read()).not.toBeNull()

    setProject(draft({ title: "Gespeicherte Fassung" }))

    expect(read()).toBeNull()
  })

  /*
   * Der Projekttitel ist die einzige Ueberschrift erster Ebene der Seite
   * (§3.3, §2.5). Weil er beschreibbar ist, traegt die Gliederung eine
   * verborgene Fassung daneben: der Wert eines Eingabefeldes ist kein
   * Textinhalt einer Ueberschrift.
   */
  it("fuehrt den Titel weiterhin als einzige h1", async () => {
    const user = userEvent.setup()
    setUp()

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)

    const title = screen.getByLabelText("Projekttitel")
    await user.clear(title)
    await user.type(title, "Frisch getippt")

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Frisch getippt"
    )
  })

  it("erzeugt im Titel keinen Zeilenumbruch", async () => {
    const user = userEvent.setup()
    const { read } = setUp()

    const title = screen.getByLabelText("Projekttitel")
    await user.clear(title)
    await user.type(title, "Erste Zeile")
    await user.keyboard("{Enter}")
    await user.type(title, "und weiter")

    expect(read()?.title).toBe("Erste Zeileund weiter")
  })

  /* Eingefuegter Text bringt Umbrueche mit, die die Taste nicht abfaengt. */
  it("glaettet einen eingefuegten Zeilenumbruch", async () => {
    const user = userEvent.setup()
    const { read } = setUp()

    const title = screen.getByLabelText("Projekttitel")
    await user.clear(title)
    await user.click(title)
    await user.paste("Erste Zeile\nZweite Zeile")

    expect(read()?.title).toBe("Erste Zeile Zweite Zeile")
  })

  /* Wunsch aus der Sitzung: die Restanzahl steht nur am Feld, in dem
     gerade geschrieben wird. */
  it("zeigt den Zeichenzaehler nur am fokussierten Feld", async () => {
    const user = userEvent.setup()
    setUp()

    const counter = () => screen.getByText(/Noch \d+ Zeichen/)

    /*
     * Dauerhaft im Baum, aber nur am fokussierten Feld sichtbar. Ausgebaut
     * waere er nicht: aria-describedby zeigte beim Betreten sonst auf ein
     * Element, das es noch nicht gibt.
     */
    expect(counter()).toHaveClass("sr-only")
    expect(screen.getByLabelText("Projekttitel")).toHaveAttribute(
      "aria-describedby"
    )

    await user.click(screen.getByLabelText("Projekttitel"))
    expect(counter()).not.toHaveClass("sr-only")

    /* Der Abstract hat gar keinen: er ist Fliesstext ohne Zeichengrenze
       ausser der des Servers. */
    await user.click(screen.getByLabelText("Abstract"))
    expect(counter()).toHaveClass("sr-only")
    expect(screen.getByLabelText("Abstract")).not.toHaveAttribute(
      "aria-describedby"
    )
  })

  /*
   * Ein stiller Fehlschlag waere Datenverlust mit Ansage: der
   * Speicherzustand in der Kopfzeile weiss von diesem Fall nichts.
   */
  it("liefert nichts zum Speichern, solange der Titel fehlt, und sagt es", async () => {
    const user = userEvent.setup()
    const { read } = setUp()

    await user.clear(screen.getByLabelText("Projekttitel"))

    expect(read()).toBeNull()
    /* Mehrere role=alert auf der Flaeche: die Feldmeldung und diese hier.
       Gesucht ist die, die den Speicherweg erklaert. */
    const alerts = await screen.findAllByRole("alert")
    expect(
      alerts.some((alert) =>
        /nicht gespeichert, solange/i.test(alert.textContent ?? "")
      )
    ).toBe(true)
  })

  it("rahmt das Titelbild im Verhaeltnis 16:9", () => {
    const { view } = setUp()

    /* Ueber die Klasse geprueft, weil vitest ohne CSS laeuft (vite.config
       test.css false) und ein berechneter Stil deshalb nichts hergibt. Das
       Verhaeltnis ist eine ausdrueckliche Vorgabe und darf nicht
       unbemerkt zurueckfallen. */
    expect(view.container.querySelector(".aspect-video")).not.toBeNull()
    expect(view.container.querySelector(".aspect-\\[7\\/4\\]")).toBeNull()
  })

  /* Wunsch aus der Sitzung: kein Rahmen um die beiden Felder, und zwar
     auch nicht im dunklen Modus, wo die Primitive eine Flaeche mitbringt. */
  it("laesst die beiden Felder ohne Rahmen und ohne dunkle Flaeche", () => {
    setUp()

    for (const label of ["Projekttitel", "Abstract"]) {
      const field = screen.getByLabelText(label)
      expect(field.className).toContain("border-0")
      expect(field.className).toContain("dark:bg-transparent")
      expect(field.className).not.toContain("dark:bg-input")
      /* Auch im Fokus kein Rahmen: der Ring der Primitive ist genommen.
         Sichtbar bleibt der Fokus ueber die Schreibmarke und die leichte
         Flaeche, die beim Tastatursprung mit erscheint (SC 2.4.7). */
      expect(field.className).toContain("focus-visible:ring-0")
      expect(field.className).not.toContain("focus-visible:ring-3")
      expect(field.className).toContain("focus:bg-muted/40")
      /* Auch dunkel: dark:bg-transparent schlaegt sonst die Flaeche. */
      expect(field.className).toContain("dark:focus:bg-muted/40")
      expect(field.className).toContain("dark:hover:bg-muted/40")
      /* Und kein Rollbalken: das Feld waechst mit dem Inhalt. */
      expect(field.className).toContain("field-sizing-content")
      expect(field.className).toContain("overflow-hidden")
    }
  })

  /*
   * Der Umschalter der Kopfzeile fuehrt unmittelbar zwischen Editor und
   * oeffentlicher Detailseite. Wechselte der Titel dabei Groesse oder
   * Farbe, saehe der Wechsel wie ein Seitenwechsel aus. Vorbild ist
   * ProjectDetailPage mit "type-title min-w-0 text-primary".
   */
  it("traegt am Titel dieselbe Rolle und Farbe wie die Detailseite", () => {
    const { view } = setUp()

    const title = screen.getByLabelText("Projekttitel")
    expect(title.className).toContain("type-title")
    expect(title.className).toContain("text-primary")
    expect(title.className).toContain("text-[length:var(--fs-title)]")

    /* Und ohne Schreibrecht ebenso, dort als sichtbare Ueberschrift. */
    view.unmount()
    setUp({ title: "Veroeffentlicht", status: "PUBLISHED" }, false)
    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading.className).toContain("type-title")
    expect(heading.className).toContain("text-primary")
  })

  it("zeigt ohne Schreibrecht Text statt Feldern", () => {
    const { view } = setUp(
      { title: "Veroeffentlicht", summary: "Kurzfassung", status: "PUBLISHED" },
      false
    )

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Veroeffentlicht"
    )
    expect(screen.getByText("Kurzfassung")).toBeInTheDocument()
    expect(screen.queryByLabelText("Projekttitel")).toBeNull()
    expect(screen.queryByLabelText("Abstract")).toBeNull()
    /* Ohne Schreibrecht und ohne Bild bleibt auch die Bildflaeche fort. */
    expect(view.container.querySelector(".aspect-video")).toBeNull()
  })

  /* Wunsch aus der Sitzung: feste Ueberschrift ueber dem Abstract-Feld. */
  it("beschriftet den Abstract sichtbar und in Ueberschriftengroesse", () => {
    setUp()

    const label = screen.getByText("Abstract")
    expect(label).toBeVisible()
    /* Wie ein Heading-1-Block der Schreibflaeche, also die Inhaltsskala,
       und in der Farbe des Fliesstextes statt im Markenblau. */
    expect(label.className).toContain("type-content-h1")
    expect(label.className).toContain("text-[length:var(--fs-content-h1)]")
    expect(label.className).not.toContain("text-primary")
    /* Und es ist zugleich das Label des Feldes, keine Ueberschrift daneben:
       ein Feld ohne zugaenglichen Namen waere ein Befund (SC 4.1.2). */
    expect(label.tagName).toBe("LABEL")
    expect(screen.getByLabelText("Abstract")).toBeInTheDocument()
  })

  it("setzt dem Abstract keine Zeichengrenze im Feld", () => {
    setUp()

    expect(screen.getByLabelText("Abstract")).not.toHaveAttribute("maxlength")
  })

  /*
   * Wer eine Aenderung zuruecknimmt, waehrend sie noch unterwegs ist, hat
   * damit eine neue Absicht geaeussert. Sie darf nicht verschluckt werden,
   * nur weil der zurueckgenommene Wert zufaellig dem zuletzt gelesenen
   * Serverstand entspricht (Befund des Frontend-Reviews).
   */
  it("meldet eine zurueckgenommene Eingabe weiter, bis der Server sie bestaetigt", async () => {
    const user = userEvent.setup()
    const { read } = setUp()

    const title = screen.getByLabelText("Projekttitel")
    await user.clear(title)
    await user.type(title, "Zwischenfassung")
    await user.clear(title)
    await user.type(title, "Beitrag im Entwurf")

    expect(read()?.title).toBe("Beitrag im Entwurf")
  })

  /*
   * Ein Randleerzeichen darf das Formular nicht dauerhaft als veraendert
   * gelten lassen: gespeichert wird der getrimmte Wert, und danach ist
   * Gleichstand.
   */
  it("gilt nach dem Trimmen als bestaetigt", async () => {
    const user = userEvent.setup()
    const { read, setProject } = setUp()

    const title = screen.getByLabelText("Projekttitel")
    await user.clear(title)
    await user.type(title, "Mit Leerzeichen   ")
    expect(read()?.title).toBe("Mit Leerzeichen")

    setProject(draft({ title: "Mit Leerzeichen" }))

    expect(read()).toBeNull()
  })
})
