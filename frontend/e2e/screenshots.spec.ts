import { createHash } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test"

import { settle } from "./support/page"
import {
  discoverFixtures,
  login,
  prepare,
  type DevRole,
  type Fixtures,
} from "./support/session"

/**
 * Die Bilder der Hilfeseite (KAN-93).
 *
 * <p><strong>Warum ein Lauf und keine Handaufnahme.</strong> Eine Hilfeseite
 * mit Bildschirmfotos veraltet an dem Tag, an dem sich die Oberflaeche
 * aendert, und von Hand geschossene Bilder sind dann nicht nachzuziehen:
 * niemand weiss mehr, welche Rolle, welcher Datensatz, welche Fenstergroesse.
 * Hier steht jede dieser Angaben im Code, und ein `pnpm screenshots` erzeugt
 * den ganzen Satz neu.
 *
 * <p><strong>Ein Satz, vier moegliche.</strong> Ausgeliefert wird heller
 * Modus mit englischer Oberflaeche (Entscheidung in der Klaerungsrunde zu
 * KAN-93). Modus und Sprache sind Umgebungsvariablen, die drei uebrigen
 * Kombinationen also ein Kommando: `SHOT_THEME=dark SHOT_LANG=de pnpm
 * screenshots`. Die Bilder landen dann unter demselben Namen; wer beide
 * Saetze will, legt vorher ein anderes `SHOT_OUT` fest.
 *
 * <p><strong>Keine Behauptungen ueber die Oberflaeche.</strong> Dieser Lauf
 * prueft nichts, er nimmt auf. Die einzigen `expect` hier sichern die
 * Aufnahme selbst: dass der Ausschnitt eindeutig ist, dass eine Interaktion
 * tatsaechlich stattgefunden hat und dass keine zwei Bilder byteweise gleich
 * sind. Ein Bild vom falschen Element faellt sonst erst auf der fertigen
 * Hilfeseite auf, und zwei gleiche Dateien fielen gar nicht auf: genau das
 * war `review-comments` im ersten Durchgang.
 *
 * <p><strong>Nur gegen eine Umgebung mit Demodaten laufen lassen.</strong>
 * Die Bilder liegen anschliessend als statische Dateien im Auslieferungsstand
 * und sind ohne Anmeldung abrufbar. Was auf ihnen steht, ist damit
 * oeffentlich, und die Nutzerverwaltung zeigt Adressen. Solange die Konten
 * aus `DevTestUserSeeder` und `var/demodaten/` stammen, ist das
 * unproblematisch; gegen eine Umgebung mit echten Konten waeren es echte
 * Adressen in einem oeffentlich erreichbaren Bild (Contract §3.1).
 */

const THEME = (process.env.SHOT_THEME ?? "light") as "light" | "dark"
const LANGUAGE = process.env.SHOT_LANG ?? "en"

/*
 * Die Bilder gehoeren zur Anwendung und nicht zum Testlauf: sie werden von
 * `features/help/screenshots.ts` importiert und von Vite mitgebaut.
 * `frontend/.gitignore` schliesst `test-results/` aus, dort waeren sie also
 * bei der naechsten Aufnahme weg und im Build gar nicht vorhanden. Ein
 * `public/`-Verzeichnis gibt es in diesem Frontend nicht.
 */
const OUT_DIR =
  process.env.SHOT_OUT ??
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "assets", "help")

/*
 * JPEG und nicht PNG. Derselbe Satz wog als PNG 16 MB, weil die Demodaten
 * grossflaechige Fotos tragen; jede Neuaufnahme legte dieselbe Menge noch
 * einmal in die Historie. Bei doppelter Punktdichte und einer Anzeige in
 * einer Spalte von hoechstens 48rem ist der Unterschied zu PNG nicht zu
 * sehen, die Datei aber rund ein Fuenftel so gross. Die Zahl steht hier und
 * nicht in der Konfiguration, weil sie zum Bild und nicht zum Lauf gehoert.
 */
const QUALITY = 88

/** Eine Aufnahme: wo, als wer, und was genau ins Bild kommt. */
type Shot = {
  /** Dateiname ohne Endung; zugleich der Schluessel in `screenshots.ts`. */
  name: string
  /** Ohne Angabe nicht angemeldet (Contract §2.1, PUBLIC). */
  as?: DevRole
  path: (fixtures: ShotFixtures) => string
  /**
   * CSS-Auswahl des Ausschnitts. Ohne Angabe das ganze Sichtfeld.
   *
   * <p>Gewaehlt wird ueber Rollen und benannte Klassen, nie ueber
   * Beschriftungen: die Oberflaeche laeuft in diesem Durchgang auf Englisch,
   * ein deutscher Text als Anker waere hier nie zu finden.
   */
  clip?: string
  /** Vor der Aufnahme in den Blick ruecken (dann Sichtfeld, kein Ausschnitt). */
  scrollTo?: string
  /** Vorbereitung auf der geladenen Seite, etwa ein Menue oeffnen. */
  act?: (page: Page) => Promise<void>
  /** Danach wieder in den Ausgangszustand, damit der Bestand bleibt. */
  undo?: (page: Page) => Promise<void>
}

/**
 * Die Testdaten des Barrierefreiheitslaufs, erweitert um den Entwurf, den
 * dieser Lauf zeigen soll.
 */
type ShotFixtures = Fixtures & {
  /** Der Entwurf mit dem meisten Inhalt (siehe {@link richestDraft}). */
  contentDraftId: string
}

/**
 * Der Entwurf des studentischen Kontos mit den meisten Bloecken.
 *
 * <p><strong>Warum nicht der aus {@code discoverFixtures}.</strong> Der nimmt
 * den ersten Entwurf, den die Liste hergibt, und das genuegt fuer eine
 * Barrierefreiheitsmessung: gemessen wird die Seite, nicht ihr Inhalt. Fuer
 * ein Bild ist es das Gegenteil. Die Route {@code /projects/new} legt beim
 * Aufruf ein Projekt an, das ist ihre Aufgabe; nach ein paar e2e-Laeufen
 * liegen deshalb Entwuerfe mit dem Titel „Unbenanntes Projekt" und ohne eine
 * Zeile Inhalt im Bestand, und genau einer davon stand im ersten Durchgang
 * auf dem Bild der Schreibflaeche.
 *
 * <p>Gewaehlt wird deshalb nach Inhalt und nicht nach Reihenfolge: der
 * Entwurf mit den meisten Bloecken. Das ist ohne Kenntnis der Demodaten
 * richtig und bleibt es auch, wenn jemand einen zweiten anlegt.
 */
async function richestDraft(request: APIRequestContext): Promise<string> {
  const student = await login(request, "student")
  const headers = { Authorization: `Bearer ${student.token}` }
  const own = await request.get("/api/projects", {
    headers,
    params: { participant: student.user.id, size: 50 },
  })
  const page = (await own.json()) as {
    content?: { id: string; status: string }[]
  }
  /* DRAFT und REVISION sind die beiden bearbeitbaren Staende (§4.1). */
  const editable = (page.content ?? []).filter(
    (entry) => entry.status === "DRAFT" || entry.status === "REVISION"
  )
  if (editable.length === 0) {
    throw new Error(
      "Kein bearbeitbares Projekt des Kontos dev-studi gefunden. " +
        "Demodaten einspielen: var/demodaten/demo-daten-komplett.sh"
    )
  }

  let best = { id: editable[0].id, blocks: -1 }
  for (const entry of editable) {
    const response = await request.get(`/api/projects/${entry.id}/blocks`, {
      headers,
    })
    if (!response.ok()) {
      continue
    }
    /* GET /projects/{id}/blocks liefert { version, blocks: [...] }, nicht
       die nackte Liste (Contract §6.1). Die Form steht hier von Hand, wie
       in discoverFixtures: tsconfig.e2e.json kennt den @/-Alias nicht. */
    const payload = (await response.json()) as { blocks?: unknown[] }
    const count = payload.blocks?.length ?? 0
    if (count > best.blocks) {
      best = { id: entry.id, blocks: count }
    }
  }
  if (best.blocks <= 0) {
    throw new Error(
      "Alle Entwuerfe des Kontos dev-studi sind leer. Ein Bild der " +
        "Schreibflaeche braucht Inhalt: Demodaten einspielen " +
        "(var/demodaten/demo-daten-komplett.sh)."
    )
  }
  return best.id
}

let shotFixtures: ShotFixtures | null = null

async function fixturesFor(request: APIRequestContext): Promise<ShotFixtures> {
  if (shotFixtures === null) {
    const base = await discoverFixtures(request)
    shotFixtures = { ...base, contentDraftId: await richestDraft(request) }
  }
  return shotFixtures
}

/*
 * Die Reihenfolge folgt den vier Bereichen der Hilfeseite. Ein Bild ohne
 * Verwendung in `features/help/helpSections.ts` ist ein Befund und kein
 * Vorrat: es waere Ballast im Repository, den niemand mehr zuordnet.
 */
const SHOTS: readonly Shot[] = [
  /* --- Portal entdecken (nicht angemeldet) --- */
  { name: "project-list", path: () => "/projects" },
  {
    name: "project-detail",
    path: (f) => `/projects/${f.publishedProjectId}`,
  },
  /* Die Top-10-Liste liegt weit unter dem Hero; ohne das Rollen zeigte das
     Bild die Startseite und nicht die Bestenliste. */
  { name: "top10", path: () => "/", scrollTo: "#top10" },
  {
    name: "public-portfolio",
    path: (f) => `/portfolios/${f.portfolioUserId}`,
  },
  { name: "register", path: () => "/register/details" },
  /* Die Kopfleiste als Ausschnitt: sie traegt Sprache, Modus und das
     Fragezeichen, und die drei sind der Gegenstand des Punktes. Das
     header-Element der Anwendung ist die einzige banner-Landmarke. */
  { name: "navigation", path: () => "/", clip: "header" },
  { name: "support", path: () => "/support" },

  /* --- Eigenes Portfolio und der Editor (angemeldet) --- */
  { name: "my-portfolio", as: "student", path: () => "/my-portfolio" },
  {
    name: "project-metadata",
    as: "student",
    path: (f) => `/projects/${f.contentDraftId}/metadata`,
  },
  {
    name: "editor",
    as: "student",
    path: (f) => `/projects/${f.contentDraftId}/editor`,
  },
  {
    name: "editor-toolbar",
    as: "student",
    path: (f) => `/projects/${f.contentDraftId}/editor`,
    /* Benannte Klasse aus EditorHeader.tsx. Die Kopfzeile liegt in main und
       ist deshalb keine banner-Landmarke, ueber die Rolle also nicht zu
       finden. */
    clip: "header.editor-header",
  },
  {
    name: "editor-insert",
    as: "student",
    path: (f) => `/projects/${f.contentDraftId}/editor`,
    act: openInsertBar,
    undo: closeMenu,
  },
  {
    name: "editor-sidebar",
    as: "student",
    path: (f) => `/projects/${f.contentDraftId}/editor`,
    /*
     * Die Karte in der Seitenleiste, nicht die Seitenleiste selbst:
     * EditorSidebar ist die einzige complementary-Landmarke der Seite
     * (aside mit aria-label), streckt sich aber ueber die volle Hoehe des
     * Beitrags. Ihr Ausschnitt waere ein 720 mal 4116 Pixel hoher Streifen,
     * fast ganz leer.
     */
    clip: "aside[aria-label] > div",
  },

  /* --- Redaktion (EDITOR, ADMIN) --- */
  { name: "review-list", as: "editor", path: () => "/reviews" },
  {
    name: "review-detail",
    as: "editor",
    path: (f) => `/projects/${f.reviewProjectId}/review`,
  },
  {
    name: "review-status-menu",
    as: "editor",
    path: (f) => `/projects/${f.reviewProjectId}/review`,
    act: openStatusMenu,
    undo: closeMenu,
  },
  {
    name: "review-comments",
    as: "editor",
    path: (f) => `/projects/${f.reviewProjectId}/review`,
    /*
     * Der Ausschnitt und nicht das Sichtfeld: CommentPanel ist die einzige
     * section mit eigenem aria-label auf dieser Seite und steht ohnehin
     * schon im Bild. Ein `scrollTo` darauf war deshalb wirkungslos, und die
     * Datei wurde byteweise dieselbe wie `review-detail`: zwei Punkte der
     * Hilfeseite zeigten dasselbe Bild (Befund aus dem Review).
     */
    clip: "section[aria-label]",
  },

  /* --- Administrationsseite (ADMIN) --- */
  { name: "admin-dashboard", as: "admin", path: () => "/administration" },
  {
    name: "admin-projects",
    as: "admin",
    path: () => "/administration/projects",
  },
  { name: "admin-users", as: "admin", path: () => "/administration/users" },
  {
    name: "admin-study-structure",
    as: "admin",
    path: () => "/administration/study-structure",
  },
  { name: "admin-top10", as: "admin", path: () => "/administration/top10" },
  { name: "admin-support", as: "admin", path: () => "/administration/support" },
  {
    name: "admin-site-content",
    as: "admin",
    path: () => "/administration/site-content",
  },
]

/**
 * Oeffnet die Einfuegeleiste am Block, auf dem die Textmarke steht.
 *
 * <p><strong>Ueber die Tastatur und nicht ueber den Schraegstrich.</strong>
 * Beide Wege zeigen dieselbe Liste aus zehn Blocktypen
 * ({@code blockInsert.INSERT_ENTRIES}); der Tastaturweg aendert aber nichts
 * am Beitrag. Der Schraegstrich waere ein Zeichen im Dokument, der Autosave
 * schriebe es nach 1200 ms weg, und ein Bilderlauf soll den Bestand nicht
 * anfassen. Dazu kam ein praktisches Problem: ein Klick in den leeren
 * Absatz hinter dem letzten Block (TrailingBlock, KAN-83) setzt die
 * Textmarke ans Ende des Absatzes davor, und dort ist der Schraegstrich
 * kein Zeilenanfang mehr, also kein Befehl ({@code startOfLine: true}).
 *
 * <p>Alt+F9 springt in die Blockbedienung, der erste Knopf dort ist
 * „Block einfuegen" (BlockKeyboardBar, KAN-36). Escape fuehrt zurueck.
 */
async function openInsertBar(page: Page): Promise<void> {
  const surface = page.locator(".ProseMirror")
  await expect(surface).toBeVisible()
  await surface.click()
  await page.keyboard.press("Alt+F9")
  await page.keyboard.press("Enter")

  /* Die Leiste ist eine Gruppe mit elf Knoepfen: Schliessen und die zehn
     Blocktypen. Ohne diese Zusicherung entstuende bei einer Aenderung der
     Bedienung stillschweigend ein Bild ohne Leiste. */
  const bar = page.locator('[role="group"]').filter({
    has: page.locator("button").nth(10),
  })
  await expect(bar).toHaveCount(1)
  await expect(bar).toBeVisible()

  /* Sie sitzt am Block der Textmarke, also mitten im Beitrag und oft
     unterhalb des Sichtfelds. */
  await bar.scrollIntoViewIfNeeded()
}

/**
 * Oeffnet das Menue "Status aendern" auf der Reviewseite.
 *
 * <p><strong>Innerhalb von {@code main} gesucht</strong>, nicht auf der
 * ganzen Seite: der erste Dropdown-Ausloeser des Dokuments ist das
 * Nutzermenue in der Kopfleiste, und genau das stand im ersten Durchgang
 * offen auf dem Bild. Die Kopfleiste liegt vor {@code main} (AppLayout),
 * die Einschraenkung trennt beide also sauber.
 */
async function openStatusMenu(page: Page): Promise<void> {
  const trigger = page.locator('main [data-slot="dropdown-menu-trigger"]')
  await expect(
    trigger,
    "Auf der Reviewseite ist der Status-Ausloeser nicht mehr eindeutig."
  ).toHaveCount(1)
  await trigger.click()
  await expect(page.locator('[role="menu"]')).toBeVisible()
}

async function closeMenu(page: Page): Promise<void> {
  await page.keyboard.press("Escape")
}

/**
 * Rechnet CSS-Pixel in Bildpunkte um.
 *
 * <p>Die Konfiguration nimmt bei doppelter Punktdichte auf; ein Ausschnitt
 * von 720 CSS-Pixeln Breite ergibt also eine Datei von 1440. Am {@code img}
 * steht davon nur das Verhaeltnis, aber es soll dem entsprechen, was die
 * Datei wirklich hat.
 */
function scaled(
  width: number | undefined,
  height: number | undefined
): { width: number; height: number } {
  const factor = 2
  return {
    width: Math.round((width ?? 1280) * factor),
    height: Math.round((height ?? 800) * factor),
  }
}

/**
 * Setzt die Sprache, sobald i18n im Fenster steht.
 *
 * <p>Ueber ein Init-Skript und nicht ueber einen Klick auf den
 * Sprachumschalter: der Editor fuehrt keine Kopfleiste (KAN-86), dort gaebe
 * es nichts zu klicken. Der Haken `window.__i18n` existiert nur im
 * Entwicklungs-Build (`src/i18n/index.ts`).
 *
 * <p>Gewartet wird in kurzen Schritten, weil das Init-Skript vor dem Modul
 * laeuft: die Instanz entsteht erst, wenn i18n geladen ist.
 */
async function forceLanguage(page: Page, language: string): Promise<void> {
  await page.addInitScript((lng: string) => {
    type Instance = { changeLanguage: (l: string) => Promise<unknown> }
    const apply = (): boolean => {
      const instance = (window as unknown as { __i18n?: Instance }).__i18n
      if (instance === undefined) {
        return false
      }
      void instance.changeLanguage(lng)
      return true
    }
    if (!apply()) {
      const timer = window.setInterval(() => {
        if (apply()) {
          window.clearInterval(timer)
        }
      }, 10)
      /* Notbremse: ohne den Haken liefe das Intervall bis zum Seitenwechsel
         weiter und faende nie etwas. */
      window.setTimeout(() => window.clearInterval(timer), 10_000)
    }
  }, language)
}

/** Steht die Oberflaeche wirklich auf der gewuenschten Sprache? */
async function expectLanguage(page: Page, language: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const instance = (
            window as unknown as {
              __i18n?: { resolvedLanguage?: string }
            }
          ).__i18n
          return instance?.resolvedLanguage ?? null
        }),
      {
        message:
          `Die Sprache blieb nicht auf ${language}. Laeuft der Lauf gegen ` +
          "den Entwicklungsserver? window.__i18n gibt es nur dort " +
          "(src/i18n/index.ts).",
      }
    )
    .toBe(language)
}

/**
 * Die Masse jedes Bildes, gesammelt waehrend des Laufs und am Ende als
 * {@code sizes.json} neben die Dateien geschrieben.
 *
 * <p>Die Hilfeseite setzt sie am {@code img} als Seitenverhaeltnis: Base UI
 * misst beim Oeffnen die Hoehe des Akkordeon-Panels, und ein noch ladendes
 * Bild ohne Masse zaehlt dabei null. Von Hand gepflegte Zahlen waeren nach
 * dem naechsten Lauf falsch, deshalb entstehen sie hier.
 */
const measured: Record<string, { width: number; height: number }> = {}

/**
 * Fingerabdruck je Bild, um zwei gleiche Aufnahmen zu erkennen.
 *
 * <p>`review-comments` war im ersten Durchgang byteweise dieselbe Datei wie
 * `review-detail`, weil ein `scrollIntoViewIfNeeded` auf ein bereits
 * sichtbares Element wirkungslos ist. Zwei Punkte der Hilfeseite zeigten
 * dasselbe Bild, und keine Pruefung sah es.
 */
const seen = new Map<string, string>()

test.describe(`Screenshots (${THEME}, ${LANGUAGE})`, () => {
  test.beforeAll(() => {
    mkdirSync(OUT_DIR, { recursive: true })
  })

  test.afterAll(() => {
    /* Nur schreiben, wenn der ganze Satz durchgelaufen ist: eine halbe
       Massliste waere schlimmer als keine, weil die fehlenden Eintraege
       still auf die Vorgabe zurueckfielen. */
    if (Object.keys(measured).length === SHOTS.length) {
      writeFileSync(
        join(OUT_DIR, "sizes.json"),
        JSON.stringify(measured, null, 2) + "\n"
      )
    }
  })

  for (const shot of SHOTS) {
    test(shot.name, async ({ page, request }) => {
      const fixtures = await fixturesFor(request)
      const session =
        shot.as === undefined ? null : await login(request, shot.as)

      await prepare(page, THEME, session)
      await forceLanguage(page, LANGUAGE)
      await page.goto(shot.path(fixtures))
      await settle(page)
      await expectLanguage(page, LANGUAGE)

      if (shot.act !== undefined) {
        await shot.act(page)
      }

      const options = {
        animations: "disabled",
        type: "jpeg",
        quality: QUALITY,
      } as const

      let buffer: Buffer
      let size: { width: number; height: number }
      if (shot.clip !== undefined) {
        const target = page.locator(shot.clip)
        await expect(
          target,
          `Der Ausschnitt "${shot.clip}" ist auf ${shot.name} nicht eindeutig.`
        ).toHaveCount(1)
        buffer = await target.screenshot(options)
        const box = await target.boundingBox()
        size = scaled(box?.width, box?.height)
      } else {
        if (shot.scrollTo !== undefined) {
          const anchor = page.locator(shot.scrollTo)
          await expect(
            anchor,
            `Der Anker "${shot.scrollTo}" ist auf ${shot.name} nicht eindeutig.`
          ).toHaveCount(1)
          await anchor.scrollIntoViewIfNeeded()
        }
        buffer = await page.screenshot(options)
        const viewport = page.viewportSize()
        size = scaled(viewport?.width, viewport?.height)
      }

      /* Zwei gleiche Dateien sind kein kleiner Schoenheitsfehler: sie kosten
         Platz und zeigen zwei verschiedenen Punkten dasselbe Bild. */
      const fingerprint = createHash("sha256").update(buffer).digest("hex")
      const twin = seen.get(fingerprint)
      expect(
        twin,
        `${shot.name} ist byteweise dasselbe Bild wie ${twin}. ` +
          "Wirkt der Ausschnitt oder das Rollen nicht?"
      ).toBeUndefined()
      seen.set(fingerprint, shot.name)

      writeFileSync(join(OUT_DIR, `${shot.name}.jpg`), buffer)
      measured[shot.name] = size

      if (shot.undo !== undefined) {
        await shot.undo(page)
      }
    })
  }
})
