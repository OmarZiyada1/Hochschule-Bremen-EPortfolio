import AxeBuilder from "@axe-core/playwright"
import { expect, type Page } from "@playwright/test"

/*
 * Der Ergebnistyp wird aus analyze() abgeleitet und nicht aus "axe-core"
 * importiert: das Paket haengt nur mittelbar an @axe-core/playwright und
 * steht damit nicht in package.json. Ein Import darauf waere eine
 * unerklaerte Abhaengigkeit (Frontend-Regel 9 sinngemaess).
 */
type Violation = Awaited<
  ReturnType<AxeBuilder["analyze"]>
>["violations"][number]

/*
 * Die Behauptungen, die dieser Lauf je Seite aufstellt (KAN-42, Umfang 1, 3,
 * 5 und 8). Sie stehen hier und nicht in der Spezifikation, damit jede Seite
 * dieselben bekommt: eine Seite, die eine davon nicht mitbringt, ist ein
 * Befund und keine Ausnahme.
 */

/**
 * Die Stufen, gegen die geprueft wird.
 *
 * <p>Eine hoehere Stufe schliesst die frueheren nicht ein, axe fuehrt sie als
 * getrennte Etiketten; alle fuenf werden deshalb genannt. {@code wcag21a}
 * traegt zwar nur eine einzige Regel, und die ist in axe als experimentell
 * abgeschaltet; das Etikett steht trotzdem hier, damit die auf
 * /accessibility veroeffentlichte Zusage „Stufen A und AA" woertlich
 * deckungsgleich mit dem Lauf ist.
 *
 * <p>Bewusst ohne {@code best-practice}: das sind Empfehlungen von Deque,
 * keine Erfolgskriterien, und ein Ticket, das WCAG 2.2 AA zusagt, soll nicht
 * an ihnen scheitern.
 */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]

/**
 * Benannte Ausnahmen: Verstoesse, die dieses Projekt kennt, bewusst nicht
 * behebt und offen ausweist.
 *
 * <p>Eine Ausnahme gilt immer nur fuer **eine Regel** in **einem Bereich**,
 * nie fuer eine ganze Seite und nie fuer eine ganze Regel. Ein
 * {@code disableRules("target-size")} waere bequem und falsch: es macht auch
 * jeden kuenftigen, ganz anderen Verstoss derselben Regel unsichtbar. Hier
 * faellt nur weg, was nachweislich in dem benannten Bereich liegt; alles
 * andere laesst den Lauf weiterhin rot werden.
 *
 * <p>Jede Zeile hier hat eine Entsprechung auf der Seite /accessibility.
 * Eine Ausnahme, die nur im Testcode steht, ist eine verschwiegene Luecke.
 */
const KNOWN_EXCEPTIONS: {
  rule: string
  /** Der Bereich, fuer den die Ausnahme gilt. */
  scope: string
  reason: string
}[] = [
  {
    rule: "target-size",
    scope: '[data-slot="avatar-group"]',
    reason:
      "Die Avatargruppe an Projektkacheln zeigt die Beteiligten " +
      "uebereinandergelegt (Entwurfsentscheidung KAN-80). Jedes verdeckte " +
      "Gesicht bietet dadurch im Ruhezustand 16 statt 24 Pixel Breite. Bei " +
      "Zeigerkontakt und bei Fokus faechert die Gruppe auf, mit Maus und " +
      "Tastatur ist die Flaeche also vor dem Klick ausreichend; auf " +
      "Tippbildschirmen gibt es kein Zeigen, dort bleibt der Verstoss. " +
      "Entschieden in der Klaerungsrunde zu KAN-42, ausgewiesen auf " +
      "/accessibility.",
  },
]

/**
 * Wartet, bis die Seite fertig ist: keine offenen Anfragen mehr und kein
 * Skeleton mehr im Bild. Ohne den zweiten Teil misst axe die Ladeflaechen
 * und nicht die Seite, und die sind erwartungsgemaess unauffaellig.
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle")
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0, {
    timeout: 15_000,
  })
}

/**
 * Streicht aus dem Ergebnis die Stellen, die unter eine benannte Ausnahme
 * fallen. Bleibt einem Verstoss danach keine Stelle mehr, entfaellt er ganz;
 * bleibt auch nur eine uebrig, laesst er den Lauf rot werden.
 *
 * <p>Zugeordnet wird ueber den echten Knoten im Dokument und nicht ueber
 * einen Textvergleich der Selektoren: axe schreibt seine Ziele so, wie es
 * sie gerade findet, und ein Vergleich auf Zeichenketten waere beim naechsten
 * Klassennamen still falsch.
 */
async function withoutKnownExceptions(
  page: Page,
  violations: Violation[]
): Promise<Violation[]> {
  const kept: Violation[] = []
  for (const violation of violations) {
    const exception = KNOWN_EXCEPTIONS.find(
      (entry) => entry.rule === violation.id
    )
    if (exception === undefined) {
      kept.push(violation)
      continue
    }
    const targets = violation.nodes.map((node) => node.target.join(" "))
    const inScope = await page.evaluate(
      ({ selectors, scope }) =>
        selectors.map((selector) => {
          const element = document.querySelector(selector)
          return element !== null && element.closest(scope) !== null
        }),
      { selectors: targets, scope: exception.scope }
    )
    const nodes = violation.nodes.filter((_, index) => !inScope[index])
    if (nodes.length > 0) {
      /*
       * Es gibt eine Ausnahme zu dieser Regel, aber diese Stelle faellt
       * nicht darunter. Die Begruendung wandert in die Meldung: wer den
       * Fehlschlag liest, soll nicht erst im Testcode nachsehen muessen,
       * warum dieselbe Regel anderswo durchgeht.
       */
      kept.push({
        ...violation,
        help: `${violation.help} (Ausnahme besteht nur fuer ${exception.scope}: ${exception.reason})`,
        nodes,
      })
    }
  }
  return kept
}

/**
 * Fuehrt den axe-Lauf aus und meldet Verstoesse lesbar.
 *
 * <p><strong>Der Inhalt fremder Einbettungen bleibt aussen vor</strong>, das
 * Einbettungselement selbst nicht. Jedes {@code iframe} dieser Anwendung
 * zeigt auf einen Anbieter der Allowlist aus Contract 2.5 (YouTube, Vimeo
 * und weitere); die Anwendung selbst erzeugt keines mit eigenem Inhalt.
 * Der Player von YouTube bringt eigene Verstoesse mit, im Lauf zu KAN-42
 * drei: {@code aria-allowed-attr} und {@code button-name} am
 * Kanal-Symbol, {@code aria-prohibited-attr} am Abspieler. Sie stehen in
 * fremdem Markup, das dieses Projekt weder aendern noch umgehen kann, und
 * ein roter Lauf, den niemand gruen bekommt, wird nach der zweiten Woche
 * ignoriert. Was uns gehoert, bleibt geprueft: das {@code iframe}-Element
 * mit seinem {@code title} und seiner Beschriftung liegt weiterhin im
 * Pruefbereich, {@code frame-title} greift also unveraendert.
 *
 * <p>Diese Ausnahme ist keine stille: sie steht so auch auf der Seite
 * /accessibility, damit niemand die Zusage fuer umfassender haelt, als sie
 * ist.
 */
export async function expectNoAxeViolations(
  page: Page,
  label: string
): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()

  /*
   * Aussortiert wird ueber die Zielangabe und nicht ueber exclude(): der
   * Playwright-Adapter faehrt jeden Rahmen einzeln an und setzt den Kontext
   * je Rahmen neu, eine Rahmenauswahl am AxeBuilder bleibt deshalb ohne
   * Wirkung (beide Schreibweisen ausprobiert, der Lauf blieb rot). axe
   * schreibt das Ziel eines Knotens dagegen als Kette: ein Eintrag fuer das
   * Dokument selbst, zwei fuer etwas in einem Rahmen. Genau daran ist der
   * fremde Inhalt zu erkennen, und das iframe-Element selbst bleibt mit
   * einem Eintrag im Pruefbereich.
   */
  const ownDocument = results.violations
    .map((violation) => ({
      ...violation,
      nodes: violation.nodes.filter((node) => node.target.length === 1),
    }))
    .filter((violation) => violation.nodes.length > 0)

  const remaining = await withoutKnownExceptions(page, ownDocument)

  const summary = remaining.map((violation) => ({
    regel: violation.id,
    schwere: violation.impact,
    kriterium: violation.tags
      .filter((tag) => tag.startsWith("wcag"))
      .join(", "),
    beschreibung: violation.help,
    stellen: violation.nodes.slice(0, 5).map((node) => node.target.join(" ")),
  }))

  expect(
    summary,
    `axe-Verstoesse auf ${label}:\n${JSON.stringify(summary, null, 2)}`
  ).toEqual([])
}

/**
 * Genau eine {@code h1} je Seite und keine uebersprungene Ebene
 * (SC 1.3.1, Contract §2.5).
 *
 * <p><strong>Warum nicht axe.</strong> Die Regel `heading-order` traegt in
 * axe-core die Etiketten `cat.semantics` und `best-practice`, und
 * `best-practice` steht bewusst nicht in {@link WCAG_TAGS}. Sie laeuft in
 * diesem Aufbau also gar nicht mit. Dass ueberhaupt eine Seitenueberschrift
 * da ist und nicht zwei, prueft sie ohnehin nie.
 *
 * <p><strong>Die ARIA-Ueberschrift zaehlt mit.</strong> Contract §2.5 bildet
 * einen {@code HEADING}-Block der Ebene 6 auf ein {@code div} mit
 * {@code role="heading"} und {@code aria-level="7"} ab, weil es kein
 * {@code h7} gibt (umgesetzt in
 * {@code features/project-content/headingRendering.ts}). Eine Abfrage nach
 * {@code h1} bis {@code h6} allein liesse genau den Sonderfall aus, den der
 * Contract eigens regelt: die Gliederung koennte im Editor und auf der
 * Detailseite von Ebene 1 auf Ebene 7 springen, und diese Pruefung meldete
 * „keine uebersprungene Ebene".
 */
export async function expectHeadingStructure(
  page: Page,
  label: string
): Promise<void> {
  const levels = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')
    )
      .filter((element) => {
        /*
         * Nur sichtbare Ueberschriften, aber sr-only zaehlt mit: die ist
         * fuer Screenreader da und damit genau der Fall, um den es geht.
         * Ausgeschlossen wird, was display:none traegt, etwa ein
         * geschlossenes Aufklappmenue.
         */
        const style = window.getComputedStyle(element)
        return style.display !== "none" && style.visibility !== "hidden"
      })
      .map((element) => {
        /*
         * aria-level gewinnt, wo es steht: ein Element kann beides tragen
         * (etwa ein h2 mit role="heading" aria-level="3"), und dann gilt
         * die ARIA-Angabe.
         */
        const ariaLevel = element.getAttribute("aria-level")
        const level =
          ariaLevel !== null
            ? Number(ariaLevel)
            : Number(element.tagName.slice(1))
        return {
          level,
          text: (element.textContent ?? "").trim().slice(0, 60),
        }
      })
      .filter((entry) => Number.isFinite(entry.level))
  )

  const firstLevels = levels.filter((entry) => entry.level === 1)
  expect(
    firstLevels.length,
    `${label}: erwartet genau eine h1, gefunden ${firstLevels.length}` +
      ` (${firstLevels.map((entry) => entry.text).join(" | ")})`
  ).toBe(1)

  const skips: string[] = []
  for (let index = 1; index < levels.length; index += 1) {
    const jump = levels[index].level - levels[index - 1].level
    if (jump > 1) {
      skips.push(
        `h${levels[index - 1].level} "${levels[index - 1].text}" -> ` +
          `h${levels[index].level} "${levels[index].text}"`
      )
    }
  }
  expect(skips, `${label}: uebersprungene Ueberschriftenebene`).toEqual([])
}

/**
 * Kein waagerechtes Scrollen der Seite auf 320 CSS-Pixeln Breite
 * (SC 1.4.10, Umfang 5). Breite Inhalte duerfen scrollen, aber in ihrem
 * eigenen Bereich; das Dokument selbst nie.
 *
 * <p>Zwei Pixel Toleranz, weil Chromium Layoutbreiten als Gleitkommazahl
 * fuehrt und ein aufgerundeter Rand sonst einen Fehlschlag ohne sichtbare
 * Ursache erzeugt.
 */
export async function expectNoHorizontalScroll(
  page: Page,
  label: string
): Promise<void> {
  await page.setViewportSize({ width: 320, height: 800 })
  await settle(page)

  const overflow = await page.evaluate(() => {
    const root = document.documentElement
    const limit = root.clientWidth + 2
    const offenders: string[] = []

    /**
     * Rollt dieses Element seinen Inhalt selbst weg? Dann ist ein
     * ueberstehendes Kind darin gewollt und schiebt die Seite nicht (SC
     * 1.4.10 erlaubt genau das).
     */
    const clips = (element: Element): boolean => {
      const overflowX = window.getComputedStyle(element).overflowX
      return (
        overflowX === "auto" || overflowX === "scroll" || overflowX === "hidden"
      )
    }

    /**
     * Wo die Suche nach einem beschneidenden Vorfahren beginnt.
     *
     * <p>Ein Rollbereich beschneidet nur, was in seinem Kasten liegt **und**
     * seinen Bezugsrahmen in ihm oder unter ihm hat. Ein
     * {@code position: absolute} (jedes {@code sr-only} ist eines) haengt am
     * naechsten positionierten Vorfahren, und liegt der ueber dem
     * Rollbereich, entkommt es der Beschneidung. Genau so wuchs die
     * Editor-Kopfzeile auf 757px, waehrend jedes sichtbare Element brav
     * innerhalb der Leiste lag (Befund zu KAN-42). Die Suche startet
     * deshalb am Bezugsrahmen und nicht am Elternknoten.
     */
    const chainStart = (element: Element): Element | null => {
      const position = window.getComputedStyle(element).position
      if (position === "absolute") {
        return (element as HTMLElement).offsetParent
      }
      /* Fixiertes schiebt die Seite nie; alles uebrige haengt am Elternknoten. */
      return position === "fixed" ? null : element.parentElement
    }

    if (root.scrollWidth > limit) {
      for (const element of Array.from(document.body.querySelectorAll("*"))) {
        const box = element.getBoundingClientRect()
        if (box.width === 0 || box.height === 0 || box.right <= limit) {
          continue
        }
        let clipped = false
        let ancestor = chainStart(element)
        while (ancestor !== null && ancestor !== document.body) {
          if (clips(ancestor)) {
            clipped = true
            break
          }
          ancestor = ancestor.parentElement
        }
        if (clipped) {
          continue
        }
        const style = window.getComputedStyle(element)
        const id = element.id === "" ? "" : `#${element.id}`
        const cls =
          element.className && typeof element.className === "string"
            ? `.${element.className.split(/\s+/).slice(0, 3).join(".")}`
            : ""
        offenders.push(
          `${element.tagName.toLowerCase()}${id}${cls} ` +
            `(${style.position}, rechts bei ${Math.round(box.right)}px)`
        )
      }
    }
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      offenders: offenders.slice(0, 8),
    }
  })

  expect(
    overflow.scrollWidth,
    `${label}: waagerechtes Scrollen auf 320px ` +
      `(${overflow.scrollWidth} statt ${overflow.clientWidth}); ` +
      `Verursacher: ${overflow.offenders.join(", ")}`
  ).toBeLessThanOrEqual(overflow.clientWidth + 2)

  await page.setViewportSize({ width: 1440, height: 900 })
}

/**
 * Der Sprunglink aus AppLayout: erstes fokussierbares Element der Seite,
 * sichtbar nur mit Fokus, Ziel {@code #content} (SC 2.4.1). Geprueft wird
 * an jeder Seite, die den Anwendungsrahmen traegt; Auth-Seiten, Editor und
 * die 404-Seite fuehren ihn bewusst nicht.
 */
export async function expectSkipLink(page: Page, label: string): Promise<void> {
  await page.keyboard.press("Tab")
  const focused = page.locator(":focus")
  await expect(
    focused,
    `${label}: erster Tabstopp ist nicht der Sprunglink`
  ).toHaveAttribute("href", "#content")
  await expect(
    focused,
    `${label}: Sprunglink wird bei Fokus nicht sichtbar`
  ).toBeInViewport()
  await expect(page.locator("main#content")).toHaveCount(1)
}
