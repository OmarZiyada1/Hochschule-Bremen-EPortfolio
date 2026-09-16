import { test } from "@playwright/test"
import { appendFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"

import { settle } from "../e2e/support/page"
import { discoverFixtures, login, prepare } from "../e2e/support/session"

/**
 * Die zentrale Handlung der Redaktion: entscheiden. Im Standbild der
 * Reviewansicht war keine Entscheidungsleiste zu sehen, nur eine
 * Statusmarke mit Aufklapppfeil. Hier wird nachgesehen, wo die Entscheidung
 * tatsaechlich liegt und wie weit der Weg dorthin ist (H6).
 *
 * <p>Ausserdem: traegt der Reaktionsknopf auf der Projektseite einen Namen,
 * oder ist seine Beschriftung nur die Zahl?
 */

const OUT = process.env.HE_OUT ?? "heuristik-out"
mkdirSync(join(OUT, "bilder"), { recursive: true })
const notiz = (z: string) => appendFileSync(join(OUT, "review.md"), z + "\n", "utf-8")

test("Entscheidungsweg der Redaktion", async ({ page, request }) => {
  const editor = await login(request, "editor")
  const fixtures = await discoverFixtures(request)
  await prepare(page, "light", editor)
  await page.goto(`/projects/${fixtures.reviewProjectId}/review`)
  await settle(page)

  notiz("## Reviewansicht im Ausgangszustand")
  const sichtbar = await page.getByRole("button").allTextContents()
  notiz("Knoepfe: " + JSON.stringify(sichtbar.map((k) => k.replace(/\s+/g, " ").trim()).filter(Boolean)))

  for (const wort of ["Genehmigen", "Freigeben", "Veröffentlichen", "Zurückweisen", "Überarbeitung", "Ablehnen", "Entscheiden"]) {
    notiz(`"${wort}" im Ausgangszustand sichtbar: ` + ((await page.getByText(wort, { exact: false }).count()) > 0))
  }

  /* Die Statusmarke traegt einen Aufklapppfeil. Was liegt dahinter? */
  const marke = page.getByRole("button", { name: /eingereicht|entwurf|prüfung/i }).first()
  if ((await marke.count()) > 0) {
    await marke.click()
    await page.waitForTimeout(900)
    await page.screenshot({ path: join(OUT, "bilder", "r1-status-aufgeklappt.png"), fullPage: true })
    const eintraege = await page.getByRole("menuitem").allTextContents()
    notiz("Eintraege hinter der Statusmarke: " + JSON.stringify(eintraege.map((e) => e.replace(/\s+/g, " ").trim())))
    const optionen = await page.getByRole("option").allTextContents()
    notiz("Optionen hinter der Statusmarke: " + JSON.stringify(optionen.map((e) => e.replace(/\s+/g, " ").trim())))
  } else {
    notiz("Keine anklickbare Statusmarke gefunden.")
  }
  notiz("")
})

test("Reaktionsknopf auf der Projektseite", async ({ page, request }) => {
  const student = await login(request, "student")
  const fixtures = await discoverFixtures(request)
  await prepare(page, "light", student)
  await page.goto(`/projects/${fixtures.publishedProjectId}`)
  await settle(page)

  notiz("## Reaktionsknopf")
  const knoepfe = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .filter((b) => {
        const r = b.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      })
      .map((b) => ({
        text: (b.textContent ?? "").replace(/\s+/g, " ").trim(),
        ariaLabel: b.getAttribute("aria-label"),
        title: b.getAttribute("title"),
        ariaLabelledby: b.getAttribute("aria-labelledby"),
      }))
  )
  notiz("```")
  notiz(JSON.stringify(knoepfe, null, 1))
  notiz("```")
  notiz("")
})
