import { test } from "@playwright/test"
import { appendFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"

import { settle } from "../e2e/support/page"
import { prepare } from "../e2e/support/session"

/**
 * Die Filterleiste der Projektbibliothek, genauer angesehen. Zwei Fragen
 * sind offen: tragen die Haken einen zugaenglichen Namen (der axe-Lauf sagt
 * ja, der Tabdurchgang zeigte namenlose Haltestellen), und was zeigt die
 * Oberflaeche, nachdem ein Filter gesetzt ist (Abschnitt 3, H1, H3, H6).
 */

const OUT = process.env.HE_OUT ?? "heuristik-out"
mkdirSync(join(OUT, "bilder"), { recursive: true })
const PROTOKOLL = join(OUT, "filter.md")
const notiz = (z: string) => appendFileSync(PROTOKOLL, z + "\n", "utf-8")

test("Filterleiste im Detail", async ({ page }) => {
  await prepare(page, "light", null)
  await page.goto("/projects")
  await settle(page)

  /* Wie ist ein Filterhaken tatsaechlich aufgebaut? */
  const aufbau = await page.evaluate(() => {
    const rollen = Array.from(document.querySelectorAll("[role='checkbox'],input[type='checkbox']"))
    return rollen.slice(0, 3).map((el) => {
      const labelledby = el.getAttribute("aria-labelledby")
      const benannt = labelledby
        ? labelledby
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
            .join(" ")
        : null
      const umgebendesLabel = el.closest("label")
      return {
        tag: el.tagName,
        rolle: el.getAttribute("role"),
        ariaChecked: el.getAttribute("aria-checked"),
        ariaLabel: el.getAttribute("aria-label"),
        ariaLabelledby: labelledby,
        nameAusLabelledby: benannt,
        textInhalt: (el.textContent ?? "").trim(),
        imLabel: umgebendesLabel ? umgebendesLabel.textContent?.trim() : null,
        tabindex: el.getAttribute("tabindex"),
        elternHTML: (el.parentElement?.outerHTML ?? "").slice(0, 400),
      }
    })
  })
  notiz("## Aufbau der Filterhaken")
  notiz("```")
  notiz(JSON.stringify(aufbau, null, 1))
  notiz("```")

  /* Der zugaengliche Name, wie ihn der Browser selbst berechnet. */
  const namen = await page
    .getByRole("checkbox")
    .evaluateAll((els) => els.map((e) => (e as HTMLElement).getAttribute("aria-labelledby")))
  notiz("aria-labelledby je Haken: " + JSON.stringify(namen))

  const zugaenglich: string[] = []
  const anzahl = await page.getByRole("checkbox").count()
  for (let i = 0; i < anzahl; i++) {
    /* Playwrights eigene Namensberechnung, dieselbe Quelle wie ein Screenreader. */
    const n = await page.getByRole("checkbox").nth(i).evaluate((el) => el.getAttribute("aria-labelledby"))
    zugaenglich.push(String(n))
  }
  notiz("Anzahl Haken: " + anzahl)

  /* Namen ueber die Rollenabfrage: findet Playwright sie ueber ihren Namen? */
  for (const name of ["Architektur, Bau und Umwelt", "Elektrotechnik und Informatik"]) {
    const treffer = await page.getByRole("checkbox", { name }).count()
    notiz(`Haken ueber den Namen "${name}" auffindbar: ${treffer > 0}`)
  }

  /* Jetzt setzen, per Klick auf die Beschriftung, wie es eine Person taete. */
  notiz("")
  notiz("## Nach dem Setzen eines Filters")
  const vorher = (await page.locator("body").innerText()).replace(/\s+/g, " ")
  notiz("Trefferzeile vorher: " + (vorher.match(/\d+ studentische Projekte gefunden/)?.[0] ?? "?"))

  await page.getByText("Elektrotechnik und Informatik", { exact: true }).first().click()
  await page.waitForTimeout(2000)
  await page.screenshot({ path: join(OUT, "bilder", "s1-filter-gesetzt.png"), fullPage: true })

  const nachher = (await page.locator("body").innerText()).replace(/\s+/g, " ")
  notiz("Trefferzeile nachher: " + (nachher.match(/\d+ studentische Projekte gefunden/)?.[0] ?? "?"))
  notiz("Adresse: " + page.url())
  notiz("Zustand des Hakens danach: " + JSON.stringify(
    await page.evaluate(() => {
      const el = document.querySelector("[role='checkbox'][aria-checked='true'],input[type='checkbox']:checked")
      return el === null ? "keiner gesetzt" : { tag: el.tagName, checked: el.getAttribute("aria-checked") ?? "input:checked" }
    })
  ))

  /* Die Kernfrage: steht die Einschraenkung auch ausserhalb der Seitenleiste? */
  const inhalt = await page.locator("main").innerText()
  const seitenleiste = await page.locator("aside, [class*='sidebar']").first().innerText().catch(() => "")
  const ohneLeiste = inhalt.replace(seitenleiste, "")
  notiz("Inhaltsbereich ohne Seitenleiste (Anfang): " + ohneLeiste.replace(/\s+/g, " ").slice(0, 400))

  for (const label of ["Filter zurücksetzen", "Zurücksetzen", "Alle Filter", "Filter leeren", "Auswahl aufheben", "entfernen"]) {
    notiz(`Steuerelement "${label}": ` + ((await page.getByText(label, { exact: false }).count()) > 0))
  }

  /* Und noch einen zweiten Filter dazu, um die Verengung zu sehen. */
  await page.getByRole("button", { name: "Semester" }).click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: join(OUT, "bilder", "s1-zweite-gruppe-offen.png"), fullPage: true })
  notiz("")
})
