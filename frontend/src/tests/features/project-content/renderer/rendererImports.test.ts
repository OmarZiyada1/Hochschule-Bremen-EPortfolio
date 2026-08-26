import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Was der Lesepfad mitbringt, und was nicht.
 *
 * <p>Die oeffentliche Detailseite ist die haeufigste Ansicht und die
 * einzige ohne Anmeldung. Zwei Buendel sollen dort nicht landen: das
 * ProseMirror-Buendel gar nicht (der Renderer ist ein eigener
 * JSON-Renderer, Risiko R7) und KaTeX nur dann, wenn ein Beitrag
 * tatsaechlich eine Formel enthaelt.
 *
 * <p><strong>Zwei Einstiege seit KAN-37.</strong> Der Waechter deckte
 * bislang allein {@code ProjectContent} ab. Der Review-Modus ist der zweite
 * Weg in denselben Lesepfad, und er liegt nicht hinter dem
 * {@code React.lazy} des Editors: zoege er ueber eine Zwischendatei etwas
 * aus {@code @tiptap/*} oder {@code prosemirror-*}, kaeme das
 * ProseMirror-Buendel ins Hauptbuendel zurueck, das mit KAN-36 gerade von
 * 1,74 MB auf 592 kB gefallen ist.
 *
 * <p>Die ESLint-Regel {@code no-restricted-imports} deckt nur den
 * <em>direkten</em> Import in {@code renderer/}. Sie saehe nicht, wenn der
 * Renderer eine Zwischendatei importierte, die ihrerseits Tiptap zieht, und
 * genau so kaeme das Buendel wieder herein. Dieser Test laeuft deshalb den
 * gesamten Importbaum ab und unterscheidet dabei statische von dynamischen
 * Importen: nur die statischen liegen im selben Chunk.
 */

const srcDir = resolve(import.meta.dirname, "..", "..", "..", "..")
const rendererDir = join(srcDir, "features", "project-content", "renderer")
const entryFile = join(rendererDir, "ProjectContent.tsx")
/* Der zweite Einstieg in den Lesepfad seit KAN-37: der Review-Modus rendert
   denselben Inhalt und liegt ausserhalb des Editor-Buendels. */
const reviewPageFile = join(
  srcDir,
  "features",
  "reviews",
  "ProjectReviewPage.tsx"
)

const FORBIDDEN_IN_READ_PATH = /^(@tiptap\/|prosemirror-|@?prosemirror)/

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name)
    return entry.isDirectory() ? filesUnder(full) : [full]
  })
}

/** Modulbezeichner, die im selben Chunk landen: import, import type, export from. */
function staticSpecifiersOf(content: string): string[] {
  const found: string[] = []
  const patterns = [
    /\bimport\s+[^"';]*?from\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bexport\s+[^"';]*?from\s*["']([^"']+)["']/g,
  ]
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      found.push(match[1])
    }
  }
  return found
}

/** Modulbezeichner hinter einem {@code import()}: eigener Chunk. */
function dynamicSpecifiersOf(content: string): string[] {
  return [...content.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)].map(
    (match) => match[1]
  )
}

/** Loest einen projekteigenen Bezeichner auf eine Datei auf, sonst null. */
function resolveLocal(specifier: string, fromFile: string): string | null {
  let base: string
  if (specifier.startsWith("@/")) {
    base = join(srcDir, specifier.slice(2))
  } else if (specifier.startsWith(".")) {
    base = resolve(dirname(fromFile), specifier)
  } else {
    return null
  }

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate
    }
  }
  return null
}

/**
 * Der Importbaum ab {@code roots}. {@code followDynamic: false} bleibt an
 * den Chunk-Grenzen stehen und beschreibt damit, was beim ersten Aufruf
 * wirklich geladen wird.
 */
function importClosure(
  roots: string[],
  followDynamic: boolean
): Map<string, string[]> {
  const seen = new Map<string, string[]>()
  const queue = [...roots]

  while (queue.length > 0) {
    const file = queue.pop()!
    if (seen.has(file)) {
      continue
    }
    const content = readFileSync(file, "utf8")
    const statics = staticSpecifiersOf(content)
    const specifiers = followDynamic
      ? [...statics, ...dynamicSpecifiersOf(content)]
      : statics
    seen.set(file, specifiers)

    for (const specifier of specifiers) {
      const target = resolveLocal(specifier, file)
      if (target !== null && /\.tsx?$/.test(target) && !seen.has(target)) {
        queue.push(target)
      }
    }
  }
  return seen
}

const rendererFiles = filesUnder(rendererDir).filter((file) =>
  /\.tsx?$/.test(file)
)

describe("Lesepfad ohne Tiptap", () => {
  const closure = importClosure(rendererFiles, true)

  it("umfasst die Renderer-Dateien und ihre Zulieferer", () => {
    /* Waere die Aufloesung kaputt, liefe der Test leer durch und beliegte
       nichts. Deshalb die untere Schranke und zwei Stichproben. */
    expect(closure.size).toBeGreaterThanOrEqual(8)
    expect(
      [...closure.keys()].some((file) => file.endsWith("ProjectContent.tsx"))
    ).toBe(true)
    expect(
      [...closure.keys()].some((file) => file.endsWith("blockSerialization.ts"))
    ).toBe(true)
  })

  it("importiert in keinem Modul des Baums aus @tiptap oder prosemirror", () => {
    for (const [file, specifiers] of closure) {
      for (const specifier of specifiers) {
        expect(
          FORBIDDEN_IN_READ_PATH.test(specifier),
          `${file} importiert ${specifier}`
        ).toBe(false)
      }
    }
  })

  it("laesst den Renderer auch nicht mittelbar an blockSchema.ts", () => {
    /* blockSchema.ts ist die eine Stelle, an der das Tiptap-Schema
       entsteht. Deshalb liegt BLOCK_SCHEMA_VERSION in
       blockSerialization.ts: ein Wertimport von dort zoege das Buendel in
       den Lesepfad. */
    for (const [file, specifiers] of closure) {
      for (const specifier of specifiers) {
        expect(specifier.endsWith("blockSchema"), `${file}`).toBe(false)
      }
    }
  })
})

describe("KaTeX erst mit der ersten Formel", () => {
  const eager = importClosure([entryFile], false)

  it("erreicht katex vom Einstieg aus nicht ohne dynamischen Import", () => {
    /* Der Befund aus dem Frontend-Review: KaTeX hing statisch am Lesepfad
       und waere mit dem ersten Aufruf der Detailseite geladen worden, auch
       ohne eine einzige Formel im Beitrag. */
    for (const [file, specifiers] of eager) {
      for (const specifier of specifiers) {
        expect(
          specifier === "katex" || specifier.startsWith("katex/"),
          `${file} importiert ${specifier} statisch`
        ).toBe(false)
      }
    }
    expect(
      [...eager.keys()].some((file) => file.endsWith("renderMath.ts")),
      "renderMath.ts liegt im statischen Baum des Einstiegs"
    ).toBe(false)
  })

  it("erreicht katex ueber den dynamischen Import sehr wohl", () => {
    /* Sonst waere der Test oben auch dann gruen, wenn die Formel gar nicht
       mehr dargestellt wuerde. */
    const withDynamic = importClosure([entryFile], true)

    expect(
      [...withDynamic.keys()].some((file) => file.endsWith("renderMath.ts"))
    ).toBe(true)
    expect([...withDynamic.values()].flat().includes("katex")).toBe(true)
  })
})

describe("Review-Modus ohne Tiptap", () => {
  /*
   * Mit dynamischen Importen, wie beim Renderer: der Review-Modus soll das
   * Buendel auf keinem Weg erreichen, auch nicht ueber einen eigenen Chunk.
   * Ein dynamischer Import auf den Editor waere ein anderer Fall, den es
   * hier aber nicht gibt.
   */
  const closure = importClosure([reviewPageFile], true)

  it("umfasst die Seite und ihre Zulieferer", () => {
    /* Waere die Aufloesung kaputt, liefe der Test leer durch. Deshalb die
       untere Schranke und zwei Stichproben aus dem, was die Seite laut
       Ticket benutzen darf. */
    expect(closure.size).toBeGreaterThanOrEqual(8)
    expect(
      [...closure.keys()].some((file) => file.endsWith("ProjectReviewPage.tsx"))
    ).toBe(true)
    expect(
      [...closure.keys()].some((file) => file.endsWith("ProjectContent.tsx"))
    ).toBe(true)
  })

  it("importiert in keinem Modul des Baums aus @tiptap oder prosemirror", () => {
    for (const [file, specifiers] of closure) {
      for (const specifier of specifiers) {
        expect(
          FORBIDDEN_IN_READ_PATH.test(specifier),
          `${file} importiert ${specifier}`
        ).toBe(false)
      }
    }
  })

  it("laesst die Seite auch nicht mittelbar an blockSchema.ts", () => {
    for (const [file, specifiers] of closure) {
      for (const specifier of specifiers) {
        expect(specifier.endsWith("blockSchema"), `${file}`).toBe(false)
      }
    }
  })
})

describe("Druckbereich ohne Tiptap", () => {
  /*
   * Der dritte Einstieg in den Lesepfad seit KAN-41. Der Druckbereich haengt
   * an der oeffentlichen Detailseite und liegt damit im Hauptbuendel: zoege
   * er ueber eine Zwischendatei etwas aus @tiptap/*, kaeme das
   * ProseMirror-Buendel dorthin zurueck. Dass er zugleich im Editor steht,
   * aendert daran nichts, denn der Editor liegt hinter einem eigenen Chunk.
   *
   * <p>Ohne printableBlocks.ts: die Datei uebersetzt das Dokument der
   * Schreibflaeche und wird allein vom Editor gebraucht, sie liegt also
   * nicht im Buendel der Detailseite.
   */
  const closure = importClosure(
    [
      join(srcDir, "features", "project-content", "print", "ProjectPrintView"),
      join(srcDir, "features", "project-content", "print", "usePrintProject"),
    ].map((base) => (existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.ts`)),
    true
  )

  it("umfasst den Druckbereich und seine Zulieferer", () => {
    expect(closure.size).toBeGreaterThanOrEqual(8)
    expect(
      [...closure.keys()].some((file) => file.endsWith("ProjectPrintView.tsx"))
    ).toBe(true)
    expect(
      [...closure.keys()].some((file) => file.endsWith("ProjectContent.tsx"))
    ).toBe(true)
  })

  it("importiert in keinem Modul des Baums aus @tiptap oder prosemirror", () => {
    for (const [file, specifiers] of closure) {
      for (const specifier of specifiers) {
        expect(
          FORBIDDEN_IN_READ_PATH.test(specifier),
          `${file} importiert ${specifier}`
        ).toBe(false)
      }
    }
  })
})
