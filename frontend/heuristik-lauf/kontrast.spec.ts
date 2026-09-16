import { test } from "@playwright/test"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { settle } from "../e2e/support/page"
import { prepare } from "../e2e/support/session"

/**
 * Kontrast der Kartentitel, die auf dem Titelbild liegen.
 *
 * <p>Der axe-Lauf kann das nicht messen: er vergleicht die Textfarbe mit
 * der berechneten Hintergrundfarbe des Elements, und die ist bei einem
 * Bild als Hintergrund unbekannt. Genau diese Luecke schliesst eine
 * Sichtpruefung, und damit sie nicht bei "wirkt zu hell" bleibt, wird hier
 * gemessen: der Titel wird durchsichtig geschaltet, das Bild darunter
 * aufgenommen und spaeter Pixel fuer Pixel gegen die echte Textfarbe
 * gerechnet.
 */

const OUT = process.env.HE_OUT ?? "heuristik-out"
mkdirSync(join(OUT, "kontrast"), { recursive: true })

test("Kartentitel auf Titelbild", async ({ page }) => {
  await prepare(page, "light", null)
  await page.goto("/projects")
  await settle(page)
  await page.waitForTimeout(800)

  /* Die Titel liegen als Ueberschrift auf der Kachel. */
  const titel = page.locator("article h2, [data-slot='card'] h2")
  const anzahl = await titel.count()
  const befunde: unknown[] = []

  for (let i = 0; i < anzahl; i++) {
    const el = titel.nth(i)
    const text = (await el.innerText()).replace(/\s+/g, " ").trim()
    const stil = await el.evaluate((n) => {
      const s = window.getComputedStyle(n)
      return {
        farbe: s.color,
        schriftgroesse: s.fontSize,
        fettgrad: s.fontWeight,
        schatten: s.textShadow,
      }
    })
    const box = await el.boundingBox()
    if (box === null) continue

    /* Erst mit Text, dann ohne: die zweite Aufnahme ist der reine Grund. */
    await el.screenshot({ path: join(OUT, "kontrast", `titel-${i}-mit-text.png`) })
    await el.evaluate((n) => {
      ;(n as HTMLElement).style.color = "transparent"
      ;(n as HTMLElement).style.textShadow = "none"
    })
    await page.waitForTimeout(150)
    await el.screenshot({ path: join(OUT, "kontrast", `titel-${i}-grund.png`) })
    await el.evaluate((n) => {
      ;(n as HTMLElement).style.removeProperty("color")
      ;(n as HTMLElement).style.removeProperty("text-shadow")
    })

    befunde.push({ index: i, text, ...stil, box })
  }

  writeFileSync(
    join(OUT, "kontrast", "titel.json"),
    JSON.stringify(befunde, null, 1),
    "utf-8"
  )
})
