import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/*
 * Prueft die Zusagen der Tokenschicht aus KAN-6, Abschnitt 4 und der
 * Definition of Done. Gelesen wird die Quelldatei, nicht gerendertes CSS:
 * die Zusagen betreffen den Aufbau der Schicht, und ein Test gegen den
 * Browser wuerde nur belegen, dass Tailwind uebersetzen kann.
 */

const tokensDir = import.meta.dirname
const srcDir = join(tokensDir, "..", "..")

/* Kommentare fliegen vor dem Zerlegen raus: sie erklaeren die Schicht mit
   Beispielen wie "--color-card: var(--card)", und die wuerden sonst als
   echte Deklarationen gelesen. */
function withoutComments(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "")
}

const tokensCss = withoutComments(
  readFileSync(join(tokensDir, "tokens.css"), "utf8")
)
const typographyCss = withoutComments(
  readFileSync(join(tokensDir, "typography-tokens.css"), "utf8")
)

/** Liefert den Inhalt aller Bloecke eines Selektors, mit Klammerzaehlung. */
function blocksOf(css: string, selector: string): string[] {
  const found: string[] = []
  const marker = `${selector} {`
  let index = css.indexOf(marker)

  while (index !== -1) {
    let depth = 0
    let end = index + marker.length - 1

    for (; end < css.length; end += 1) {
      if (css[end] === "{") depth += 1
      if (css[end] === "}") {
        depth -= 1
        if (depth === 0) break
      }
    }

    found.push(css.slice(index + marker.length, end))
    index = css.indexOf(marker, end)
  }

  return found
}

/** Alle Deklarationen eines Blocks als Paar aus Name und Wert. */
function declarationsOf(block: string): Map<string, string> {
  const declarations = new Map<string, string>()

  for (const match of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    declarations.set(match[1], match[2].trim())
  }

  return declarations
}

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name)
    return entry.isDirectory() ? filesUnder(full) : [full]
  })
}

const [primitiveBlock, semanticLightBlock] = blocksOf(tokensCss, ":root")
const primitives = declarationsOf(primitiveBlock)
const semanticLight = declarationsOf(semanticLightBlock)
const semanticDark = declarationsOf(blocksOf(tokensCss, ".dark")[0])
const themeInline = declarationsOf(blocksOf(tokensCss, "@theme inline")[0])

/* Die Radien stehen im Block "@theme static" und nicht unter :root:
   Tailwinds Namensraum --radius-* und die Namen der Figma-Collection fallen
   zusammen, ein Alias waere ein Verweis auf sich selbst. "static" sorgt
   dafuer, dass auch die gerade unbenutzten Stufen im gebauten CSS stehen
   (siehe tokens.css). */
const radius = declarationsOf(blocksOf(tokensCss, "@theme static")[0])

describe("Primitives (Foundation, Abschnitt 2)", () => {
  it("fuehrt 38 Stufen: 36 aus dem Abgleich vom 07.08.2026 plus die zwei transparenten", () => {
    expect(primitives.size).toBe(38)
  })

  it("enthaelt ausschliesslich Rohwerte, keine Aliase", () => {
    /* Acht Stellen sind erlaubt, sechs bleiben die Regel: die letzten beiden
       Ziffern sind der Alphakanal, und den tragen nur die beiden Stufen aus
       Foundation 2.5. Ein Alias kann Transparenz nicht ausdruecken, deshalb
       liegt sie hier im Rohwert und nicht in der Semantic-Ebene. */
    for (const value of primitives.values()) {
      expect(value).toMatch(/^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/)
    }
  })

  it("traegt Transparenz nur in den beiden Stufen, die overlay bedienen", () => {
    const transparent = [...primitives.entries()]
      .filter(([, value]) => value.length === 9)
      .map(([name]) => name)

    expect(transparent.sort()).toEqual(["neutral-950-a50", "neutral-950-a70"])
    expect(semanticLight.get("overlay")).toBe("var(--neutral-950-a50)")
    expect(semanticDark.get("overlay")).toBe("var(--neutral-950-a70)")
  })

  it("laesst keine Stufe ohne Semantic-Referenz zurueck", () => {
    const referenced = [...semanticLight.values(), ...semanticDark.values()]

    for (const name of primitives.keys()) {
      expect(
        referenced.some((value) => value.includes(`var(--${name})`)),
        `${name} wird von keiner Semantic-Rolle referenziert`
      ).toBe(true)
    }
  })

  it("fuehrt die entfernten Stufen nicht wieder ein", () => {
    for (const removed of [
      "blau-50",
      "blau-500",
      "neutral-500",
      "basis-schwarz",
    ]) {
      expect(primitives.has(removed)).toBe(false)
    }
  })
})

describe("Semantic-Rollen (Foundation, Abschnitt 3)", () => {
  it("fuehrt 55 Rollen je Modus", () => {
    expect(semanticLight.size).toBe(55)
    expect(semanticDark.size).toBe(55)
  })

  it("nutzt in beiden Modi dieselben Rollennamen", () => {
    expect([...semanticDark.keys()].sort()).toEqual(
      [...semanticLight.keys()].sort()
    )
  })

  it("besteht ausschliesslich aus Aliasen auf Primitives", () => {
    for (const [name, value] of [...semanticLight, ...semanticDark]) {
      expect(value, `${name} ist kein Alias`).toMatch(/^var\(--[\w-]+\)$/)
      expect(primitives.has(value.slice(6, -1))).toBe(true)
    }
  })

  it("bindet jede Rolle ueber @theme inline an Tailwind an", () => {
    for (const name of semanticLight.keys()) {
      expect(themeInline.get(`color-${name}`)).toBe(`var(--${name})`)
    }
  })

  it("dreht die Vordergrundrolle im dunklen Modus mit", () => {
    expect(semanticLight.get("primary")).toBe("var(--blau-600)")
    expect(semanticDark.get("primary")).toBe("var(--blau-400)")
    expect(semanticLight.get("primary-foreground")).toBe("var(--basis-weiss)")
    expect(semanticDark.get("primary-foreground")).toBe("var(--neutral-950)")
  })

  it("fuehrt die Enum-Werte aus dem API-Contract als Rollennamen", () => {
    for (const status of [
      "draft",
      "submitted",
      "approved",
      "published",
      "revision",
    ]) {
      expect(semanticLight.has(`status-${status}-bg`)).toBe(true)
      expect(semanticLight.has(`status-${status}-fg`)).toBe(true)
    }

    for (const role of ["student", "editor", "admin"]) {
      expect(semanticLight.has(`role-${role}-bg`)).toBe(true)
      expect(semanticLight.has(`role-${role}-fg`)).toBe(true)
    }

    /* "Oeffentlich" ist keine Rolle, sondern der Zustand "nicht
       angemeldet": Contract 2.1 kennt genau drei Werte. */
    expect(semanticLight.has("role-public-bg")).toBe(false)
  })
})

describe("Radien (Foundation, Abschnitt 7)", () => {
  it("fuehrt genau sechs benannte Stufen", () => {
    const named = [...radius.keys()].filter((name) =>
      name.startsWith("radius-")
    )
    const steps = named.filter(
      (name) =>
        ![
          "radius-sm",
          "radius-md",
          "radius-lg",
          "radius-xl",
          "radius-4xl",
        ].includes(name)
    )

    expect(steps).toEqual([
      "radius-none",
      "radius-selection",
      "radius-control",
      "radius-card",
      "radius-modal",
      "radius-pill",
    ])
  })

  it("haelt die shadcn-Bruecke auf den Figma-Stufen", () => {
    expect(radius.get("radius-sm")).toBe("var(--radius-selection)")
    expect(radius.get("radius-md")).toBe("var(--radius-control)")
    expect(radius.get("radius-lg")).toBe("var(--radius-card)")
    expect(radius.get("radius-xl")).toBe("var(--radius-modal)")
    /* Befund aus KAN-29: badge.tsx nutzt rounded-4xl, das Badge ist in
       Figma eine Pille. 2xl und 3xl bleiben bewusst ohne Bruecke. */
    expect(radius.get("radius-4xl")).toBe("var(--radius-pill)")
    expect(radius.has("radius-2xl")).toBe(false)
    expect(radius.has("radius-3xl")).toBe(false)
  })

  it("fuehrt keinen Radius als Verweis auf sich selbst", () => {
    /* --radius-card: var(--radius-card) im Block @theme inline waere ein
       Zyklus: die Variable wuerde ungueltig, und jede abgerundete Flaeche
       haette wieder eckige Ecken, ohne dass etwas es meldet. */
    for (const name of radius.keys()) {
      expect(themeInline.has(name)).toBe(false)
      expect(radius.get(name)).not.toBe(`var(--${name})`)
    }
  })
})

describe("Schrift (Foundation, Abschnitt 5)", () => {
  it("haelt Numeral/Rank auf normal statt auf einer gemessenen Metrik", () => {
    expect(typographyCss).toMatch(/--lh-num-rank:\s*normal;/)
  })

  it("setzt die Display-Zeilenhoehe fluide, bis das Design nachzieht", () => {
    expect(typographyCss).toMatch(/--lh-display:\s*clamp\(/)
  })

  it("laedt beide Schriftfamilien ueber Variablen", () => {
    expect(typographyCss).toMatch(/--font-heading:\s*"Zilla Slab"/)
    expect(typographyCss).toMatch(/--font-body:\s*"Source Sans 3"/)
  })

  /*
   * Der schmalste vorgesehene Viewport ist 360px, und dort steht jede
   * clamp()-Formel auf ihrem ersten Argument. Ist die Zeilenhoehe dort
   * kleiner als die Schriftgroesse, laufen umbrechende Zeilen ineinander.
   * Genau das war der Befund an Heading/Display (Foundation 5.3).
   */
  const typography = declarationsOf(typographyCss)

  function mobileRem(name: string) {
    const value = typography.get(name)!
    const clampMinimum = /^clamp\(\s*([\d.]+)rem/.exec(value)

    return Number.parseFloat(clampMinimum ? clampMinimum[1] : value)
  }

  it("laesst Display bei 360px nicht ineinanderlaufen", () => {
    expect(mobileRem("lh-display")).toBeGreaterThanOrEqual(
      mobileRem("fs-display")
    )
  })

  it("haelt jede als Verhaeltnis gefuehrte Zeilenhoehe bei mindestens 1", () => {
    for (const role of [
      "lh-title",
      "lh-h1",
      "lh-h2",
      "lh-num-stat",
      "lh-body",
    ]) {
      expect(mobileRem(role), role).toBeGreaterThanOrEqual(1)
    }
  })
})

describe("Grenzen der Tokenschicht", () => {
  const sourceFiles = filesUnder(srcDir).filter((file) =>
    /\.(ts|tsx|css)$/.test(file)
  )

  it("haelt jeden Hex-Wert in styles/tokens", () => {
    for (const file of sourceFiles) {
      if (file.startsWith(tokensDir)) continue

      const hits = readFileSync(file, "utf8").match(/#[0-9a-fA-F]{3,8}\b/g)
      expect(hits, `${file} enthaelt einen Hex-Wert`).toBeNull()
    }
  })

  /*
   * Die drei folgenden Zusicherungen stammen aus dem Review zu KAN-29. Alle
   * drei Befunde hatten denselben Fehlermodus: eine Klasse oder eine Variable
   * greift ins Leere, und weder Typecheck noch Lint noch ein Test sagen etwas.
   * Sichtbar wird das erst im Browser, und dort nur, wenn jemand gezielt
   * hinsieht. Deshalb stehen sie hier und nicht auf einer Merkliste.
   */
  const uiFiles = filesUnder(join(srcDir, "components", "ui"))

  it("laesst keine Registry-Datei auf eine undefinierte Variable zeigen", () => {
    const indexCss = withoutComments(
      readFileSync(join(srcDir, "index.css"), "utf8")
    )
    const defined = new Set([
      ...primitives.keys(),
      ...semanticLight.keys(),
      ...radius.keys(),
      ...themeInline.keys(),
      ...declarationsOf(indexCss).keys(),
    ])

    for (const file of uiFiles) {
      const content = readFileSync(file, "utf8")

      for (const [, name] of content.matchAll(/var\(--([\w-]+)/g)) {
        /* In der Datei selbst gesetzte Variablen und Tailwinds eigene sind
           nicht unsere Adresse; alles andere muss die Tokenschicht oder
           index.css definieren. Befund aus KAN-29: input-group.tsx leitete
           seine Innenradien aus --radius ab, das nirgends stand.

           Zwei Schreibweisen zaehlen als "gesetzt": die CSS-Deklaration
           (--cell-radius: … in calendar.tsx) und die style-Prop in JSX
           ("--gap": spacing in toggle-group.tsx). Wer nur die erste prueft,
           meldet die zweite faelschlich als Befund. */
        const setInFile = new RegExp(`["']?--${name}["']?\\s*:`).test(content)
        if (setInFile || name.startsWith("tw-")) continue

        expect(
          defined.has(name),
          `${file}: --${name} ist nirgends definiert`
        ).toBe(true)
      }
    }
  })

  it("laesst keine Registry-Datei eine Farbe an der Rolle vorbei setzen", () => {
    for (const file of uiFiles) {
      /* Befund aus KAN-29: die Overlays von dialog, alert-dialog und sheet
         setzten bg-black/10, waehrend die Rolle overlay mit ihren geprueften
         50 bzw. 70 Prozent daneben ungenutzt lag. Im dunklen Modus ist ein
         Film aus 10 Prozent Schwarz ueber dunklem Grund praktisch keiner. */
      const hits = readFileSync(file, "utf8").match(
        /\b(bg|text|border|ring|fill|stroke)-(black|white)(\/\d+)?\b/g
      )

      expect(
        hits,
        `${file} setzt eine Farbe an der Tokenschicht vorbei`
      ).toBeNull()
    }
  })

  it("deckt jede Zustandsregel auch in der ARIA-Schreibweise ab", () => {
    /* Base UI meldet inaktive Zustaende ueber aria-disabled, nicht ueber
       :disabled: das gibt es nur an Formularelementen. Eine Regel, die nur
       auf :disabled hoert, laesst abgeblendete Schaltflaechen den
       Zeigefinger behalten (Befund aus KAN-29 an calendar.tsx). */
    for (const rule of tokensCss.split("}")) {
      if (!rule.includes(":disabled")) continue

      expect(rule, `Regel hoert nur auf :disabled: ${rule.trim()}`).toMatch(
        /aria-disabled/
      )
    }
  })

  it("verwendet kein Primitive in einer Komponente", () => {
    for (const file of sourceFiles) {
      if (file.startsWith(tokensDir)) continue

      const content = readFileSync(file, "utf8")

      for (const name of primitives.keys()) {
        /* Weder als Variable (var(--blau-600)) noch als Utility-Klasse
           (bg-blau-600): wer eine Farbe braucht, fuer die es keine Rolle
           gibt, legt eine Rolle an und keinen Rohwert. */
        expect(
          content.includes(`--${name}`),
          `${file} liest das Primitive --${name}`
        ).toBe(false)

        expect(
          new RegExp(
            `\\b(bg|text|border|ring|fill|stroke|from|via|to)-${name}\\b`
          ).test(content),
          `${file} nutzt eine Utility-Klasse auf ${name}`
        ).toBe(false)
      }
    }
  })
})
