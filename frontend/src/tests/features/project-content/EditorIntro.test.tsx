import { act, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import type { ProjectDetailResponse } from "@/api/types"
import { EditorIntro } from "@/features/project-content/components/EditorIntro"
import type { ProjectIntroValues } from "@/features/projects/ProjectMetadataForm.schema"
import { projectDetail } from "@/tests/fixtures"
import { renderWithProviders } from "@/tests/render"

/**
 * Die Kopfpartie des Editors (KAN-36): Titelbild und Titel ueber der
 * Schreibflaeche, in der Vorschau dazu die Kurzbeschreibung (KAN-104).
 *
 * <p>Geprueft wird ueber die sichtbare Oberflaeche und ueber die beiden
 * Zusagen nach oben: dass jede Aenderung gemeldet wird und dass der
 * Speichertakt genau dann etwas zu lesen bekommt, wenn hier auch etwas
 * getippt wurde.
 */

const PROJECT_ID = "1f9d7a10-0000-0000-0000-000000000000"

/** Der zugaengliche Name der Kopfpartie (seit KAN-104). */
const REGION = "Kopfbereich des Beitrags"

/** Beschriftung und Platzhalter des Feldes, das bis KAN-104 im Editor stand. */
const SUMMARY_LABEL = "Kurzbeschreibung"
const SUMMARY_PLACEHOLDER = "Kurz, was das Projekt ausmacht"

/** Die Hoechstlaengenmeldung bei TITLE_MAX_LENGTH = 100. */
const LIMIT_MESSAGE = "Der Titel hat die Höchstlänge von 100 Zeichen erreicht."

/**
 * Die Klassen der Registry-Primitive Textarea, die Rand, Ring oder Flaeche
 * zeichnen. Keine davon darf am Titelfeld ankommen (KAN-104, Entscheidung).
 */
const PRIMITIVE_FRAME_CLASSES = [
  "border",
  "border-input",
  "dark:bg-input/30",
  "focus-visible:border-ring",
  "focus-visible:ring-3",
  "focus-visible:ring-ring/50",
  "aria-invalid:border-destructive",
  "aria-invalid:ring-3",
  "aria-invalid:ring-destructive/20",
  "dark:aria-invalid:border-destructive/50",
  "dark:aria-invalid:ring-destructive/40",
]

/** Die Gegenklassen, jede mit dem Modifikator der Klasse, die sie aufhebt. */
const BARE_CLASSES = [
  "border-0",
  "border-transparent",
  "bg-transparent",
  "dark:bg-transparent",
  "focus-visible:ring-0",
  "focus-visible:ring-transparent",
  "focus-visible:border-transparent",
  "aria-invalid:border-transparent",
  "aria-invalid:ring-0",
  "aria-invalid:ring-transparent",
  "dark:aria-invalid:border-transparent",
  "dark:aria-invalid:ring-transparent",
]

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
function setUp(
  project: Partial<ProjectDetailResponse> = {},
  {
    editable = true,
    showSummary = false,
  }: { editable?: boolean; showSummary?: boolean } = {}
) {
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
        showSummary={showSummary}
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
  it("nimmt den Titel entgegen und meldet die Aenderung", async () => {
    const user = userEvent.setup()
    const { onChange, read } = setUp()

    const title = screen.getByLabelText("Projekttitel")
    await user.clear(title)
    await user.type(title, "Neuer Titel")

    expect(onChange).toHaveBeenCalled()
    /* Ohne Kurzbeschreibung: sie wird im Editor nicht bearbeitet (KAN-104). */
    expect(read()).toEqual({
      title: "Neuer Titel",
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

  /*
   * Ein stiller Fehlschlag waere Datenverlust mit Ansage: der
   * Speicherzustand in der Kopfzeile weiss von diesem Fall nichts. Das gilt
   * nach KAN-104 unveraendert; nur die Meldung nennt jetzt den Titel statt
   * der markierten Felder.
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
        /nicht gespeichert, solange der Titel/i.test(alert.textContent ?? "")
      )
    ).toBe(true)
  })

  /*
   * Umgebaut mit KAN-104 (Entscheidung): bis dahin stand die Restanzahl
   * am fokussierten Feld. Sie ist entfallen, weder beim Lesen noch beim
   * Schreiben steht eine Zahl unter dem Titel.
   */
  it("zeigt unter dem Titel keine Restzeichenanzeige, auch nicht im Fokus", async () => {
    const user = userEvent.setup()
    setUp()

    expect(screen.queryByText(/Noch \d+ Zeichen/)).toBeNull()

    const title = screen.getByLabelText("Projekttitel")
    await user.click(title)
    await user.type(title, " ergaenzt")

    expect(title).toHaveFocus()
    expect(screen.queryByText(/Noch \d+ Zeichen/)).toBeNull()
    expect(screen.queryByText(/Zeichen zu viel/)).toBeNull()
  })

  /*
   * KAN-104, Entscheidung: statt der Restanzahl eine Meldung, sobald der
   * Titel die Hoechstlaenge erreicht hat und nichts mehr hineinpasst. Sie ist
   * ein Hinweis und kein Fehler, steht in einer Live-Region, die dauerhaft im
   * DOM ist (SC 4.1.3), und beschreibt das Feld.
   */
  it("meldet erst bei 100 Zeichen, dass nichts mehr hineinpasst, und sagt es an", async () => {
    const user = userEvent.setup()
    const { read } = setUp()

    const title = screen.getByLabelText("Projekttitel")
    const hintId = title.getAttribute("aria-describedby") ?? ""
    const hint = document.getElementById(hintId)

    /* Von Anfang an im Baum, leer und dann ohne Platzbedarf. */
    expect(hint).not.toBeNull()
    expect(hint).toHaveAttribute("role", "status")
    expect(hint).toBeEmptyDOMElement()
    expect(hint).toHaveClass("empty:sr-only")

    await user.clear(title)
    await user.click(title)
    await user.paste("a".repeat(99))
    expect(title).toHaveValue("a".repeat(99))
    expect(hint).toBeEmptyDOMElement()

    await user.type(title, "b")

    await waitFor(() => expect(hint).toHaveTextContent(LIMIT_MESSAGE))
    /* Derselbe Knoten: nur sein Text hat gewechselt. */
    expect(document.getElementById(hintId)).toBe(hint)
    /* Erreichbar und nicht nur vorhanden (Skill frontend-shadcn). */
    expect(hint?.closest("[aria-hidden]")).toBeNull()
    /* Ein Hinweis in gedaempfter Farbe, kein Fehler: der Titel ist gueltig. */
    expect(hint).toHaveClass("text-muted-foreground")
    expect(hint).not.toHaveClass("text-destructive")
    expect(title).not.toHaveAttribute("aria-invalid")
    expect(read()?.title).toHaveLength(100)
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.queryByRole("alert")).toBeNull()

    /* Mehr passt nicht hinein. */
    await user.type(title, "c")
    expect(title).toHaveValue(`${"a".repeat(99)}b`)

    /* Und unter der Grenze ist die Meldung wieder fort. */
    await user.keyboard("{Backspace}")
    await waitFor(() => expect(hint).toBeEmptyDOMElement())
  })

  /*
   * Der Server laesst 255 Zeichen zu (ProjectUpdateRequest), der Client 100.
   * Ein so geladener Titel hat die Grenze nicht erreicht, sondern
   * ueberschritten: statt des Hinweises steht sofort die Feldmeldung, die
   * den Grund fuer die Warnung zum Speicherweg nennt. Tippen koennte sie
   * nicht ausloesen, maxLength sperrt jede Eingabe (KAN-104, Befund aus dem
   * Review).
   */
  it("zeigt einen zu langen Titel vom Server sofort als Fehler und nicht als Hinweis", async () => {
    const { read, onChange } = setUp({ title: "a".repeat(101) })

    const title = screen.getByLabelText("Projekttitel")
    const hint = document.getElementById(
      title.getAttribute("aria-describedby") ?? ""
    )

    expect(hint).toBeEmptyDOMElement()
    expect(
      await screen.findByText("Der Titel darf höchstens 100 Zeichen lang sein.")
    ).toHaveAttribute("role", "alert")
    expect(title).toHaveAttribute("aria-invalid", "true")
    expect(hint).toBeEmptyDOMElement()
    expect(
      screen
        .getAllByRole("alert")
        .some((alert) =>
          /nicht gespeichert, solange der Titel/i.test(alert.textContent ?? "")
        )
    ).toBe(true)
    /* Die Pruefung ist keine Eingabe: nichts zu senden, kein Takt. */
    expect(read()).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  /* Dasselbe fuer einen Serverstand, den ein unberuehrtes Feld uebernimmt. */
  it("zeigt auch einen uebernommenen zu langen Titel sofort als Fehler", async () => {
    const { read, onChange, setProject } = setUp()

    setProject(draft({ title: "b".repeat(120) }))

    const title = screen.getByLabelText("Projekttitel")
    expect(title).toHaveValue("b".repeat(120))
    expect(
      await screen.findByText("Der Titel darf höchstens 100 Zeichen lang sein.")
    ).toHaveAttribute("role", "alert")
    expect(title).toHaveAttribute("aria-invalid", "true")
    expect(
      document.getElementById(title.getAttribute("aria-describedby") ?? "")
    ).toBeEmptyDOMElement()
    expect(read()).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  /*
   * Umgebaut mit KAN-104 (Entscheidung): bis dahin kam beim Ueberfahren und
   * im Fokus eine leichte Flaeche dazu. Jetzt traegt das Titelfeld weder
   * Rand noch Ring noch Flaeche, auch nicht rot bei ungueltigem Titel, und
   * zwar in hell und dunkel. Geprueft ueber die Klassen, weil vitest ohne
   * CSS laeuft (vite.config test.css false).
   */
  it("laesst das Titelfeld ohne Rahmen und Flaeche, auch im Fokus und bei ungueltigem Titel", async () => {
    const user = userEvent.setup()
    setUp()

    const title = screen.getByLabelText("Projekttitel")
    const expectBare = () => {
      const classes = [...title.classList]
      for (const primitiveClass of PRIMITIVE_FRAME_CLASSES) {
        expect(classes, primitiveClass).not.toContain(primitiveClass)
      }
      for (const bareClass of BARE_CLASSES) {
        expect(classes, bareClass).toContain(bareClass)
      }
      /* Keine Flaeche beim Ueberfahren oder im Fokus, hell wie dunkel. */
      expect(
        classes.filter((name) =>
          /(^|:)(hover|focus|focus-visible):bg-/.test(name)
        )
      ).toEqual([])
      /* Und kein Rollbalken: das Feld waechst mit dem Inhalt. */
      expect(classes).toContain("field-sizing-content")
      expect(classes).toContain("overflow-hidden")
    }

    expectBare()

    await user.clear(title)

    await waitFor(() => expect(title).toHaveAttribute("aria-invalid", "true"))
    expect(title).toHaveFocus()
    expectBare()
    /* Fort ist allein die Optik: die Meldung zum Titel bleibt als Text. */
    expect(
      await screen.findByText("Bitte geben Sie einen Projekttitel ein.")
    ).toHaveAttribute("role", "alert")
  })

  /*
   * Umgebaut mit KAN-104 (Entscheidung): der gestrichelte Rahmen aus KAN-105
   * um Titel und Kurzbeschreibung ist entfallen. Das Titelfeld steht
   * unmittelbar in der Kopfpartie, ohne Huelle, die einen Rahmen tragen oder
   * nach aussen versetzt sein koennte, und ohne SVG-Umrandung.
   */
  it("stellt den Titel ohne gestrichelten Rahmen unmittelbar in die Kopfpartie", async () => {
    const user = userEvent.setup()
    setUp()

    const region = screen.getByRole("region", { name: REGION })
    const title = screen.getByLabelText("Projekttitel")
    const expectUnframed = () => {
      expect(title.closest('[data-slot="field"]')?.parentElement).toBe(region)
      expect(region.querySelector('[class*="stroke-dasharray"]')).toBeNull()
      expect(region.querySelector('rect[stroke="currentColor"]')).toBeNull()
      expect(region.querySelector(".-mx-3")).toBeNull()
    }

    expectUnframed()

    /* Auch nicht, sobald Feld- und Speichermeldung dazukommen. */
    await user.clear(title)
    await screen.findAllByRole("alert")
    expectUnframed()
  })

  /* Wo die Kopfpartie nur gelesen wird, gab es den Rahmen schon vorher
     nicht; dabei bleibt es, auch mit dem Vorspann der Vorschau. */
  it("zeigt ohne Schreibrecht und in der Vorschau keinen Rahmen", () => {
    setUp(
      { title: "Veroeffentlicht", summary: "Kurzfassung", status: "PUBLISHED" },
      { editable: false, showSummary: true }
    )

    const region = screen.getByRole("region", { name: REGION })
    expect(region.querySelector('[class*="stroke-dasharray"]')).toBeNull()
    expect(screen.getByRole("heading", { level: 1 }).parentElement).toBe(region)
  })

  /*
   * Der Umschalter der Kopfzeile wechselt seit KAN-104 an Ort und Stelle
   * zwischen Schreibflaeche und Vorschau, in der die Kopfpartie als Text
   * steht. Wechselte der Titel dabei Groesse oder Farbe, sprang die Seite.
   * Vorbild ist ProjectDetailPage mit "type-title min-w-0 text-primary".
   */
  it("traegt am Titel dieselbe Rolle und Farbe wie die Detailseite", () => {
    const { view } = setUp()

    const title = screen.getByLabelText("Projekttitel")
    expect(title.className).toContain("type-title")
    expect(title.className).toContain("text-primary")
    expect(title.className).toContain("text-[length:var(--fs-title)]")

    /* Und ohne Schreibrecht ebenso, dort als sichtbare Ueberschrift. */
    view.unmount()
    setUp(
      { title: "Veroeffentlicht", status: "PUBLISHED" },
      { editable: false }
    )
    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading.className).toContain("type-title")
    expect(heading.className).toContain("text-primary")
  })

  /*
   * Ohne Schreibrecht steht die Kopfpartie auch beim Bearbeiten als Text da.
   * Die Kurzbeschreibung erscheint dort seit KAN-104 nicht mehr (Entscheidung):
   * sie gehoert allein in die Vorschau.
   */
  it("zeigt ohne Schreibrecht Text statt Feldern und beim Bearbeiten keine Kurzbeschreibung", () => {
    const { view } = setUp(
      { title: "Veroeffentlicht", summary: "Kurzfassung", status: "PUBLISHED" },
      { editable: false }
    )

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Veroeffentlicht"
    )
    expect(screen.queryByText("Kurzfassung")).toBeNull()
    expect(screen.queryByLabelText("Projekttitel")).toBeNull()
    expect(screen.queryByLabelText(SUMMARY_LABEL)).toBeNull()
    /* Ohne Schreibrecht und ohne Bild bleibt auch die Bildflaeche fort. */
    expect(view.container.querySelector(".aspect-video")).toBeNull()
  })

  /*
   * Umgebaut mit KAN-104 (Entscheidung): bis dahin stand die
   * Kurzbeschreibung als Feld mit unsichtbarer Beschriftung unter dem Titel.
   * Eingetragen wird sie jetzt allein im Metadatenformular; im Editor gibt
   * es weder Feld noch Beschriftung noch Platzhalter, und beim Bearbeiten
   * steht sie auch nicht als Text da, selbst wenn die Seite showSummary
   * setzte.
   */
  it("bietet beim Bearbeiten weder Feld noch Text fuer die Kurzbeschreibung", () => {
    setUp({ summary: "Gespeicherte Kurzfassung" }, { showSummary: true })

    expect(screen.getByLabelText("Projekttitel")).toBeInTheDocument()
    expect(screen.queryByLabelText(SUMMARY_LABEL)).toBeNull()
    expect(screen.queryByText(SUMMARY_LABEL)).toBeNull()
    expect(screen.queryByPlaceholderText(SUMMARY_PLACEHOLDER)).toBeNull()
    expect(screen.queryByText("Abstract")).toBeNull()
    expect(screen.queryByText("Gespeicherte Kurzfassung")).toBeNull()
  })

  /*
   * Umgebaut mit KAN-104: bis dahin trug das Feld der Kurzbeschreibung keine
   * Zeichengrenze. Das Feld gibt es nicht mehr, und die Kurzbeschreibung vom
   * Server wird hier clientseitig auch nicht mehr geprueft. Die Spalte
   * zaehlt Zeichen, Server (@Size auf String.length()) und JavaScript
   * zaehlen UTF-16-Einheiten: 600 Emoji sind dort 600 Zeichen, hier 1200
   * und damit ueber der Grenze des Schemas. So etwas entsteht nur per SQL.
   * Im Editor kann es niemand korrigieren, also zeigt die Kopfpartie keinen
   * Hinweis darauf und reicht den Titel an den Takt weiter. Den PUT weist
   * der Server dann trotzdem ab; das sichert dieser Test nicht zu.
   */
  it("zeigt keinen Hinweis und prueft clientseitig keine Kurzbeschreibung", async () => {
    const user = userEvent.setup()
    const { read } = setUp({ summary: "\u{1F600}".repeat(600) })

    const title = screen.getByLabelText("Projekttitel")
    await user.clear(title)
    await user.type(title, "Neuer Titel")

    expect(read()).toEqual({ title: "Neuer Titel", coverImageUrl: "" })
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.queryByRole("alert")).toBeNull()
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

  it("rahmt das Titelbild im Verhaeltnis 16:9", () => {
    const { view } = setUp()

    /* Ueber die Klasse geprueft, weil vitest ohne CSS laeuft (vite.config
       test.css false) und ein berechneter Stil deshalb nichts hergibt. Das
       Verhaeltnis ist eine ausdrueckliche Vorgabe und darf nicht
       unbemerkt zurueckfallen. */
    expect(view.container.querySelector(".aspect-video")).not.toBeNull()
    expect(view.container.querySelector(".aspect-\\[7\\/4\\]")).toBeNull()
  })

  /*
   * Auch die Platzierung ist eine ausdrueckliche Vorgabe: die Bedienung des
   * Titelbilds liegt im Editor auf der Bildflaeche und nicht darunter, und
   * sie zeigt nur Zeichen. Der Standard von CoverImageField ist das
   * Gegenteil ("below"), ein Rueckfall faellt also ohne diese Zusicherung
   * nirgends auf: die Komponente selbst ist isoliert geprueft, die
   * Uebersteuerung steht hier.
   */
  it("legt die Bedienung des Titelbilds als Zeichenleiste auf die Flaeche", () => {
    const { view } = setUp()

    const chooser = screen.getByLabelText("Titelbild wählen")
    const preview = view.container.querySelector(
      '[data-slot="cover-image-preview"]'
    )

    expect(preview).not.toBeNull()
    expect(preview).toContainElement(chooser)
    /* Nur Zeichen: der Name steht unsichtbar im Bedienelement. */
    expect(screen.getByText("Titelbild wählen")).toHaveClass("sr-only")
  })
})

/*
 * KAN-104: in der Vorschau des Editors steht die Kopfpartie mit
 * editable=false da, und zwar im eingegebenen Stand. Das Formular bleibt
 * dabei montiert: sonst waeren die Eingaben beim Zurueckwechseln fort, und
 * der Speichertakt verloere seine Lesefunktion.
 */
describe("EditorIntro in der Vorschau (KAN-104)", () => {
  function setUpToggle(project: Partial<ProjectDetailResponse> = {}) {
    let setEditable: (next: boolean) => void = () => undefined
    let read: () => ProjectIntroValues | null = () => null

    function Harness() {
      const [editable, set] = useState(true)
      setEditable = set
      return (
        <EditorIntro
          project={draft(project)}
          editable={editable}
          /* Wie EditorPage: die Kurzbeschreibung allein in der Vorschau. */
          showSummary={!editable}
          onChange={() => undefined}
          onRegisterRead={(next) => {
            read = next
          }}
        />
      )
    }

    const view = renderWithProviders(<Harness />)
    return {
      view,
      read: () => read(),
      setEditable: (next: boolean) => {
        act(() => setEditable(next))
      },
    }
  }

  it("zeigt den eingegebenen Titel und die gespeicherte Kurzbeschreibung als grauen Vorspann", async () => {
    const user = userEvent.setup()
    const { read, setEditable } = setUpToggle({
      summary: "Gespeicherte Kurzfassung",
    })

    /* Beim Bearbeiten steht sie nicht unter dem Titel (Entscheidung). */
    expect(screen.queryByText("Gespeicherte Kurzfassung")).toBeNull()

    const title = screen.getByLabelText("Projekttitel")
    await user.clear(title)
    await user.type(title, "Neuer Titel")

    setEditable(false)

    /* Genau eine h1, jetzt sichtbar, mit dem getippten Titel. */
    const headings = screen.getAllByRole("heading", { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent("Neuer Titel")
    expect(headings[0]).not.toHaveClass("sr-only")
    /* Der graue Vorspann wie auf der Detailseite. */
    const lead = screen.getByText("Gespeicherte Kurzfassung")
    expect(lead.tagName).toBe("P")
    expect(lead).toHaveClass("type-body-lg", "text-muted-foreground")
    expect(screen.queryByLabelText("Projekttitel")).toBeNull()

    /* Die Lesefunktion des Takts gilt weiter und liefert die Eingabe. */
    expect(read()).toEqual({
      title: "Neuer Titel",
      coverImageUrl: "",
    })

    /* Und zurueck: die Eingabe steht wieder im Feld, der Vorspann ist fort. */
    setEditable(true)
    expect(screen.getByLabelText("Projekttitel")).toHaveValue("Neuer Titel")
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.queryByText("Gespeicherte Kurzfassung")).toBeNull()
  })

  it("laesst den Vorspann ohne Kurzbeschreibung fort", () => {
    const { view, setEditable } = setUpToggle({ summary: null })

    setEditable(false)

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
    expect(view.container.querySelector("p.type-body-lg")).toBeNull()
  })

  it("laesst den Speicherhinweis bei ungueltiger Eingabe auch in der Vorschau stehen", async () => {
    const user = userEvent.setup()
    const { setEditable } = setUpToggle()

    await user.clear(screen.getByLabelText("Projekttitel"))
    await screen.findAllByRole("alert")

    setEditable(false)

    /* Ohne Titel steht der Platzhaltername da und nicht eine leere h1. */
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Unbenanntes Projekt"
    )
    expect(
      screen
        .getAllByRole("alert")
        .some((alert) =>
          /nicht gespeichert, solange der Titel/i.test(alert.textContent ?? "")
        )
    ).toBe(true)
  })

  it("zeigt ohne Eingabe keinen Speicherhinweis im Lesezweig", async () => {
    /* Personen ohne Schreibrecht sehen den Serverstand; der hat die Pruefung
       des Servers bestanden, eine Meldung dazu waere falsch. */
    setUp({ title: "Eingereicht", status: "SUBMITTED" }, { editable: false })

    expect(
      await screen.findByRole("heading", { level: 1, name: "Eingereicht" })
    ).toBeInTheDocument()
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.queryByRole("alert")).toBeNull()
  })
})
