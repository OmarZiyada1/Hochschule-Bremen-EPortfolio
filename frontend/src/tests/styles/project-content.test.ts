import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/*
 * Die Zusagen der Blockdarstellung, soweit sie an der Quelldatei haengen
 * (KAN-10 und KAN-41, Test 7).
 *
 * <p>Gelesen wird die Quelldatei und nicht gerendertes CSS. Vitest laeuft
 * mit css: false, berechnete Stile gibt es in den Komponententests also
 * gar nicht; und selbst mit ihnen liesse sich ein @media print nicht
 * messen, weil jsdom nur den Bildschirm kennt. Was hier steht, ist deshalb
 * keine Aussage ueber das Aussehen des Ausdrucks, sondern ueber die
 * Regeln, die es erzeugen: dass sie da sind, dass sie an dieser einen
 * Stelle stehen und dass keine Farbe an der Tokenschicht vorbeigeht. Ob
 * der Ausdruck lesbar ist, sagt die dokumentierte manuelle Abnahme.
 */

const cssFile = join(
  import.meta.dirname,
  "..",
  "..",
  "styles",
  "project-content.css"
)

const raw = readFileSync(cssFile, "utf8")

/* Kommentare fliegen raus, bevor irgendetwas gesucht wird: sie erklaeren
   die Regeln mit Beispielen, und die wuerden sonst als Regeln gelesen
   (dasselbe Vorgehen wie in tokens.test.ts). */
const css = raw.replace(/\/\*[\s\S]*?\*\//g, "")

/** Der Inhalt des ersten Blocks eines Selektors, mit Klammerzaehlung. */
function blockOf(source: string, marker: string): string {
  const start = source.indexOf(marker)
  expect(start, `${marker} nicht gefunden`).toBeGreaterThanOrEqual(0)

  let depth = 0
  let end = start + marker.length - 1
  for (; end < source.length; end += 1) {
    if (source[end] === "{") depth += 1
    if (source[end] === "}") {
      depth -= 1
      if (depth === 0) break
    }
  }
  return source.slice(start + marker.length, end)
}

const printBlock = blockOf(css, "@media print {")
const componentsLayer = blockOf(css, "@layer components {")

describe("Farben kommen aus der Tokenschicht", () => {
  it("fuehrt keinen Hex-Wert", () => {
    /*
     * Frontend-Regel 5 und Ticket-Test 7. Der Druckblock ist der Ort, an
     * dem die Versuchung am groessten ist: „auf Papier ist es sowieso
     * schwarz auf weiss". Die hellen Werte kommen stattdessen als Primitive
     * aus tokens/tokens.css.
     */
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it("belegt im Druckblock keine Rolle selbst", () => {
    /*
     * Dass der Ausdruck hell ist, entscheidet die Tokenschicht: dort steht
     * neben hell und dunkel eine dritte Belegung derselben Rollen fuer
     * @media print (tokens.css, geprueft in tokens.test.ts). Hier stuende
     * sie ein zweites Mal, und zwei Belegungen liefen auseinander.
     */
    const declarations = [...printBlock.matchAll(/(--[a-z0-9-]+):/g)].map(
      ([, name]) => name
    )
    expect(declarations).toEqual([])
  })
})

describe("Der Druckblock", () => {
  it("steht ausserhalb von @layer components", () => {
    /*
     * Zwei Regeln brauchen das. Die Isolierung des Druckbereichs muss ein
     * display: flex aus @layer utilities schlagen, und die helle
     * Rollenbelegung den ungeschichteten .dark-Block aus tokens.css. Eine
     * Regel in einer Ebene verliert gegen beides, egal wie spezifisch sie
     * ist.
     */
    expect(componentsLayer).not.toContain("@media print")
  })

  it("blendet alles ausser dem Druckbereich aus, und nur dort", () => {
    /* Ohne die :has-Bedingung ergaebe Strg+P auf jeder Seite ohne
       Druckbereich ein leeres Blatt. */
    expect(printBlock).toContain(
      'body:has(> [data-print="area"]) > *:not([data-print="area"])'
    )
  })

  it("verbirgt den Druckbereich am Bildschirm und zeigt ihn auf Papier", () => {
    /*
     * Ueber eine eigene Regel und nicht ueber das Attribut hidden: manche
     * Browser fuehren [hidden] in ihrem Standard-Stylesheet als
     * !important, und dann bliebe das Blatt leer.
     */
    expect(css).toMatch(/\[data-print="area"\] \{\s*display: none;\s*\}/)
    expect(printBlock).toMatch(/\[data-print="area"\] \{\s*display: block/)
  })

  it("haelt die Zusagen aus Abschnitt 3 des Tickets", () => {
    /* Tabellenkopf wiederholt sich, und kein Bildlaufrahmen schneidet auf
       Papier etwas ab. */
    expect(printBlock).toContain("display: table-header-group")
    expect(printBlock).toMatch(
      /\[data-block="table-scroll"\][\s\S]*?overflow: visible/
    )
    /* Quelltext bricht um, statt waagerecht zu rollen. */
    expect(printBlock).toMatch(/pre \{[\s\S]*?white-space: pre-wrap/)
    /* Eine Formel steht genau einmal auf dem Blatt, nicht zusaetzlich als
       MathML. */
    expect(printBlock).toMatch(/\.katex-mathml \{\s*display: none/)
    /* Video, Ton und Einbettung verschwinden; ihr Hinweis tritt an ihre
       Stelle. */
    expect(printBlock).toMatch(
      /video,[\s\S]*?audio,[\s\S]*?iframe \{\s*display: none/
    )
    expect(printBlock).toMatch(/\[data-print="only"\] \{\s*display: block/)
    /* Ueberschriften bleiben bei ihrem Absatz. */
    expect(printBlock).toContain("break-after: avoid")
    /* Die Galerie druckt hoechstens zweispaltig. */
    expect(printBlock).toMatch(
      /figure\[data-columns="3"\] ul \{\s*grid-template-columns: repeat\(2,/
    )
    /* Ein Link nennt seine Adresse. */
    expect(printBlock).toContain('content: " (" attr(href) ")"')
    /* Aber nicht am Dokumentlink: dort steht sie schon als eigene Zeile
       darunter, und sie stuende sonst zweimal untereinander, sobald die API
       auf demselben Ursprung laeuft. */
    expect(printBlock).toMatch(
      /p\[data-block="document"\] a::after \{\s*content: none/
    )
  })

  it("laesst die Druckhinweise am Bildschirm verschwinden", () => {
    /* Ausserhalb des Druckblocks, sonst waeren sie am Bildschirm sichtbar
       und ein Screenreader laese neben dem Video auch dessen Ersatztext. */
    expect(css).toMatch(
      /\.project-content \[data-print="only"\] \{\s*display: none;\s*\}/
    )
  })
})
