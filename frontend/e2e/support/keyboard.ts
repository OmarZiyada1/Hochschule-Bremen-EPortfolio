import { expect, type Page } from "@playwright/test"

/**
 * Der Tastaturdurchgang (KAN-42, Umfang 1).
 *
 * <p>Er beantwortet die Frage der Definition of Done: ist jede Aktion einer
 * Seite ohne Maus erreichbar, ist der Fokus dabei zu sehen, und kommt man
 * wieder heraus. Nichts davon misst axe: axe liest den Zustand des
 * Dokuments, hier wird die Seite tatsaechlich durchgetabbt.
 */

/**
 * Was als Bedienelement zaehlt. Ueber die Rollen und nicht ueber eine
 * Klassenliste: Base UI baut Schalter und Auswahlfelder aus
 * {@code div}-Elementen mit {@code role}, eine Suche nach {@code button}
 * allein liesse genau die aus.
 */
const INTERACTIVE = [
  "a[href]",
  "button",
  "input:not([type=hidden])",
  "select",
  "textarea",
  "summary",
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="menuitem"]',
  '[role="combobox"]',
].join(",")

/** Hoechstzahl der Tabschritte je Seite, damit eine Fokusfalle abbricht. */
const MAX_STOPS = 250

/**
 * Zeichnet dieses Element seinen Fokus woanders?
 *
 * <p>Die Pruefung der berechneten Stile am fokussierten Element allein
 * reicht in diesem Projekt nicht. Die Kopfleiste etwa legt die Kontur
 * bewusst auf ein Kindelement ({@code group-focus-visible/navlink:outline-*}
 * in NavBar.tsx), damit sie um die Beschriftung und nicht um die ganze
 * Zelle laeuft; der Link selbst traegt dann {@code outline-none}. Wer nur
 * ihn misst, meldet einen Verstoss, den es nicht gibt, und wer daraufhin die
 * Pruefung lockert, meldet keinen mehr, auch dort nicht, wo einer ist.
 *
 * <p>Entschieden wird deshalb am Bild: derselbe Ausschnitt einmal mit und
 * einmal ohne Fokus. Sind die Bytes gleich, aendert sich nichts auf dem
 * Schirm, und das ist genau die Frage von SC 2.4.7.
 *
 * <p>Der Vergleich kostet zwei Bildschirmfotos und laeuft nur fuer die
 * Faelle, die der billige Stilvergleich nicht bereits bestanden hat. Sein
 * Ergebnis wird je Bauart gemerkt (Elementname plus Klassenliste): die fuenf
 * Links der Kopfleiste sind ein Fall und nicht fuenf.
 */
async function drawsFocusElsewhere(
  page: Page,
  stop: {
    art: string
    kasten: { x: number; y: number; width: number; height: number }
  },
  cache: Map<string, boolean>
): Promise<boolean> {
  const cached = cache.get(stop.art)
  if (cached !== undefined) {
    return cached
  }

  /* Auf den sichtbaren Bereich beschneiden, mit etwas Luft fuer die Kontur. */
  const viewport = page.viewportSize()
  if (viewport === null) {
    return false
  }
  const margin = 6
  const x = Math.max(0, stop.kasten.x - margin)
  const y = Math.max(0, stop.kasten.y - margin)
  const width = Math.min(viewport.width - x, stop.kasten.width + 2 * margin)
  const height = Math.min(viewport.height - y, stop.kasten.height + 2 * margin)
  if (width <= 0 || height <= 0) {
    /* Ausserhalb des Bildes: hier ist nichts zu vergleichen. */
    return false
  }

  /*
   * animations: "disabled" haelt laufende Uebergaenge an und setzt sie auf
   * ihren Endzustand. Ohne das entscheidet der Zufall mit: eine Farbe, die
   * gerade weich wechselt, macht zwei Bilder verschieden, ohne dass es am
   * Fokus laege, und ein blinkender Schreibcursor macht sie mal gleich und
   * mal nicht. Genau daran war dieser Lauf zwischenzeitlich wackelig, mit
   * wechselnden Seiten im Befund.
   */
  const options = {
    clip: { x, y, width, height },
    animations: "disabled",
  } as const

  /*
   * Das aktive Element wird eigens markiert, bevor der Fokus faellt: der
   * Durchgang muss anschliessend an genau dieser Stelle weitergehen. Ein
   * Selektor wie "[data-e2e-stop]:last-of-type" traf dafuer den falschen
   * Knoten, denn :last-of-type zaehlt Geschwister eines Elementtyps und
   * nicht die Reihenfolge der Markierungen.
   */
  await page.evaluate(() =>
    document.activeElement?.setAttribute("data-e2e-focus", "")
  )
  const withFocus = await page.screenshot(options)
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur()
  )
  const withoutFocus = await page.screenshot(options)
  await page.evaluate(() => {
    const element = document.querySelector("[data-e2e-focus]")
    element?.removeAttribute("data-e2e-focus")
    if (element instanceof HTMLElement) {
      element.focus()
    }
  })

  const different = Buffer.compare(withFocus, withoutFocus) !== 0
  cache.set(stop.art, different)
  return different
}

/**
 * Tabbt einmal durch die Seite und prueft drei Zusagen:
 *
 * <ol>
 *   <li>der Durchgang kommt herum, ohne haengenzubleiben (SC 2.1.2),</li>
 *   <li>jeder Tabstopp zeigt einen sichtbaren Fokus (SC 2.4.7),</li>
 *   <li>jedes Bedienelement, das ein Tabstopp sein will, ist auch
 *       erreichbar (SC 2.1.1).</li>
 * </ol>
 *
 * <p><strong>Was ausdruecklich kein Tabstopp sein will.</strong> Drei
 * Muster dieses Projekts tragen {@code tabindex="-1"} mit Absicht, und alle
 * drei waeren ohne diese Ausnahme Fehlalarme:
 *
 * <ul>
 *   <li>der Kartenueberzug ({@code CardLinkOverlay}), der die ganze Kachel
 *       klickbar macht, waehrend der Titel der eigentliche Link bleibt: er
 *       ist zusaetzlich {@code aria-hidden}, damit die Kachel nicht zweimal
 *       angesagt wird,</li>
 *   <li>die Mitglieder einer Leiste mit Roving-Tabindex, etwa die
 *       Auswahlleiste des Editors: dort ist genau ein Tabstopp richtig, in
 *       die Leiste hinein geht es mit Alt+F10 und mit den Pfeiltasten
 *       weiter (KAN-36),</li>
 *   <li>die verborgenen Formularfelder, die Base UI hinter einem Select
 *       oder einem Schalter mitfuehrt.</li>
 * </ul>
 *
 * <p>Gemessen wird der Ausgangszustand der Seite. Was erst hinter einem
 * Dialog oder einem Aufklappmenue liegt, gehoert zum Prueffall des
 * jeweiligen Tickets; hier geht es um die Seite, wie sie sich oeffnet.
 */
export async function expectKeyboardReachable(
  page: Page,
  label: string
): Promise<void> {
  await page.evaluate(() => {
    document.body.setAttribute("tabindex", "-1")
    document.body.focus()
  })

  const withoutFocusRing: string[] = []
  const seenKinds = new Map<string, boolean>()
  let stops = 0
  let outsideInARow = 0

  for (let step = 0; step < MAX_STOPS; step += 1) {
    await page.keyboard.press("Tab")
    const stop = await page.evaluate(() => {
      const active = document.activeElement
      if (active === null || active === document.body) {
        return null
      }
      /*
       * Der erste Tabstopp wird eigens markiert: erst seine Wiederkehr sagt,
       * dass der Durchgang herum ist. Ein blosses "schon einmal gesehen"
       * greift zu frueh, weil zwei Faelle denselben Knoten mehrfach melden,
       * ohne dass die Reihe zu Ende waere: ein iframe (der Fokus wandert
       * darin weiter, document.activeElement bleibt das iframe) und ein
       * Datumsfeld (Tab springt zwischen Tag, Monat und Jahr). Genau daran
       * endete die Messung auf der Projektdetailseite und im
       * Top-10-Protokoll vorzeitig, und alles dahinter galt als
       * unerreichbar.
       */
      const seen = active.hasAttribute("data-e2e-stop")
      const first = active.hasAttribute("data-e2e-first")
      if (seen) {
        return { known: true as const, first, ring: true, beschreibung: "" }
      }
      active.setAttribute("data-e2e-stop", "")
      if (document.querySelector("[data-e2e-first]") === null) {
        active.setAttribute("data-e2e-first", "")
      }

      /*
       * Ein iframe wird als Tabstopp gezaehlt, aber nur einmal betreten. Der
       * Fokus wandert sonst durch das eingebettete Dokument weiter, waehrend
       * document.activeElement das iframe bleibt, und wie viele Stationen das
       * sind, entscheidet der Anbieter und der Ladezustand: der Abspieler von
       * YouTube brachte mal ein Dutzend, mal ueber zweihundert. Der Durchgang
       * war damit wechselnd zu Ende, bevor er die Fusszeile erreichte, und
       * meldete Elemente als unerreichbar, die es nicht sind. Ein
       * tabindex="-1" am bereits gezaehlten iframe laesst den naechsten
       * Tabulator daran vorbeigehen, ohne dass der Stopp selbst verloren
       * geht.
       */
      if (active.tagName === "IFRAME") {
        active.setAttribute("tabindex", "-1")
      }

      const style = window.getComputedStyle(active)

      /**
       * Ist diese Farbangabe ueberhaupt zu sehen? Tailwind legt an jedes
       * Element mit Ring-Klassen fuenf Schattenebenen, und im Ruhezustand
       * sind alle durchsichtig ({@code rgba(0, 0, 0, 0)}). Eine Pruefung auf
       * {@code boxShadow !== "none"} ginge deshalb ueberall durch, auch dort,
       * wo gar nichts zu sehen ist: sie hat in der ersten Fassung dieses
       * Laufs jeden Fokusring bestaetigt, den es nicht gab.
       */
      const opaque = (value: string): boolean =>
        !/\/\s*0\s*\)/.test(value) && !/,\s*0\s*\)/.test(value)

      /**
       * Sichtbar ist eine Schattenebene, wenn sie eine Farbe mit Deckkraft
       * hat und wenigstens ein Mass ungleich null: erst beides zusammen
       * zeichnet etwas.
       */
      const visibleShadow = (shadow: string): boolean => {
        if (shadow === "none" || shadow === "") {
          return false
        }
        /*
         * An Kommas trennen, die nicht in einer Farbklammer stehen. Von Hand
         * und nicht ueber einen regulaeren Ausdruck: eine Zerlegung mit
         * Vorausschau laeuft auf langen Schattenlisten in Rueckverfolgung
         * (Regel S8786).
         */
        const layers: string[] = []
        let depth = 0
        let current = ""
        for (const character of shadow) {
          if (character === "(") {
            depth += 1
          } else if (character === ")") {
            depth -= 1
          }
          if (character === "," && depth === 0) {
            layers.push(current)
            current = ""
          } else {
            current += character
          }
        }
        layers.push(current)
        /* Ein Mass ungleich null: irgendeine Zahl vor "px", die nicht 0 ist. */
        const hasExtent = (layer: string): boolean =>
          layer
            .split(/\s+/)
            .some(
              (part) => part.endsWith("px") && Number.parseFloat(part) !== 0
            )
        return layers.some((layer) => opaque(layer) && hasExtent(layer))
      }

      /*
       * Zwei Tabstopps zeigen ihren Fokus zu Recht nicht als Ring:
       *
       * - ein iframe reicht den Fokus in das eingebettete Dokument weiter.
       *   Der Ring gehoert dann dorthin, und der Inhalt kommt bei uns
       *   ausschliesslich von den Anbietern der Allowlist aus Contract 2.5.
       *   Dieselbe Grenze wie beim axe-Lauf (support/page.ts).
       * - eine Schreibflaeche mit contenteditable zeigt den Fokus als
       *   Textcursor. Das ist der uebliche und ausreichende Hinweis fuer
       *   eine Texteingabe; ein Ring um die ganze Flaeche waere hier eher
       *   Stoerung als Hilfe.
       */
      const delegatesRing =
        active.tagName === "IFRAME" ||
        active.getAttribute("contenteditable") === "true"

      const ring =
        delegatesRing ||
        (style.outlineStyle !== "none" &&
          Number.parseFloat(style.outlineWidth) > 0 &&
          opaque(style.outlineColor)) ||
        visibleShadow(style.boxShadow)
      const rect = active.getBoundingClientRect()
      return {
        known: false as const,
        ring,
        /*
         * Die Klassenliste dient als Kennung gleichartiger Elemente: die
         * fuenf Links der Kopfleiste sind derselbe Fall, und der teure
         * Bildvergleich soll nicht fuenfmal laufen.
         */
        art:
          active.tagName.toLowerCase() +
          "|" +
          (typeof active.className === "string" ? active.className : ""),
        kasten: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
        beschreibung:
          active.tagName.toLowerCase() +
          (active.getAttribute("aria-label") !== null
            ? `[${active.getAttribute("aria-label")}]`
            : "") +
          ` "${(active.textContent ?? "").trim().slice(0, 40)}"`,
      }
    })

    if (stop === null) {
      /*
       * Der Fokus steht ausserhalb des Dokuments, im Kopf des Browsers. Ein
       * weiterer Tabulator fuehrt ueblicherweise wieder hinein; erst wenn er
       * das zweimal nacheinander nicht tut, ist der Durchgang herum. Ohne
       * diese zweite Chance endete die Messung bereits an der Grenze
       * zwischen Dokument und Browser, und alles dahinter galte faelschlich
       * als unerreichbar.
       */
      outsideInARow += 1
      if (outsideInARow >= 2) {
        break
      }
      continue
    }
    outsideInARow = 0
    if (stop.known) {
      if (stop.first) {
        /* Wieder am ersten Stopp: der Durchgang ist herum. */
        break
      }
      /* Derselbe Knoten, aber nicht der erste: iframe oder Datumsfeld. */
      continue
    }
    stops += 1
    if (!stop.ring && !(await drawsFocusElsewhere(page, stop, seenKinds))) {
      withoutFocusRing.push(stop.beschreibung)
    }
  }

  expect(
    stops,
    `${label}: der Fokus lief ${MAX_STOPS} Schritte, ohne herumzukommen ` +
      "(Verdacht auf Fokusfalle, SC 2.1.2)"
  ).toBeLessThan(MAX_STOPS)
  expect(stops, `${label}: kein einziger Tabstopp gefunden`).toBeGreaterThan(0)

  expect(
    withoutFocusRing,
    `${label}: Tabstopp ohne sichtbaren Fokus (SC 2.4.7)`
  ).toEqual([])

  const unreachable = await page.evaluate((interactive) => {
    const missed: string[] = []
    for (const element of Array.from(document.querySelectorAll(interactive))) {
      if (element.hasAttribute("data-e2e-stop")) {
        continue
      }
      /* Will gar kein Tabstopp sein, siehe die drei Muster im Kopf. */
      if (element.getAttribute("tabindex") === "-1") {
        continue
      }
      if (element.closest('[aria-hidden="true"], [inert]') !== null) {
        continue
      }
      if (
        element.hasAttribute("disabled") ||
        element.getAttribute("aria-disabled") === "true"
      ) {
        continue
      }
      const style = window.getComputedStyle(element)
      const box = element.getBoundingClientRect()
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        box.width === 0 ||
        box.height === 0
      ) {
        continue
      }
      const id = element.id === "" ? "" : `#${element.id}`
      missed.push(
        `${element.tagName.toLowerCase()}${id} ` +
          `"${(element.textContent ?? "").trim().slice(0, 40)}"`
      )
    }
    return missed.slice(0, 10)
  }, INTERACTIVE)

  expect(
    unreachable,
    `${label}: mit der Tastatur nicht erreichbar (SC 2.1.1)`
  ).toEqual([])
}
