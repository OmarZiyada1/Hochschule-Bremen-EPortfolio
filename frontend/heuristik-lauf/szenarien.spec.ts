import { test, type Page } from "@playwright/test"
import { appendFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"

import { settle } from "../e2e/support/page"
import { discoverFixtures, login, prepare } from "../e2e/support/session"

/**
 * Die Zustaende, die ein Standbild nicht zeigt. Abschnitt 3 der Seite
 * „Tag 1 und 2" nennt fuer H1, H3 und H6 konkrete Prueffragen: sind aktive
 * Filter ohne Absuchen der Seitenleiste sichtbar, laesst sich eine zu enge
 * Einschraenkung zuruecknehmen, ist im Editor erkennbar, ob gespeichert
 * wurde. Diese Datei stellt genau diese Lagen her und haelt sie fest.
 */

const OUT = process.env.HE_OUT ?? "heuristik-out"
mkdirSync(join(OUT, "bilder"), { recursive: true })
const PROTOKOLL = join(OUT, "szenarien.md")

function notiz(zeile: string): void {
  appendFileSync(PROTOKOLL, zeile + "\n", "utf-8")
}

async function bild(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: join(OUT, "bilder", name + ".png"), fullPage: true })
}

/** Alles, was gerade als Meldung oder Statuszeile im Dokument steht. */
async function meldungen(page: Page): Promise<string[]> {
  return await page
    .locator("[role='alert'],[role='status'],[aria-live]")
    .allTextContents()
    .then((t) => t.map((x) => x.replace(/\s+/g, " ").trim()).filter((x) => x !== ""))
}

/** Sichtbarer Text der ganzen Seite, zusammengefaltet. */
async function seitentext(page: Page): Promise<string> {
  return (await page.locator("body").innerText()).replace(/\s+/g, " ")
}

test.describe("Szenarien", () => {
  test("S1 Filter setzen: aktive Auswahl und Rueckweg", async ({ page }) => {
    await prepare(page, "light", null)
    await page.goto("/projects")
    await settle(page)

    const vorher = await seitentext(page)
    notiz("## S1 Filter setzen (H1, H3, H6)")
    notiz("Trefferzeile vor dem Filtern: " + (vorher.match(/\d+ studentische Projekte gefunden/)?.[0] ?? "nicht gefunden"))

    /* Die erste Fakultaet anhaken. Die Gruppe ist im Ausgangszustand offen. */
    const erste = page.getByRole("checkbox").first()
    await erste.check()
    await page.waitForTimeout(1500)
    await bild(page, "s1-filter-gesetzt")

    const nachher = await seitentext(page)
    notiz("Trefferzeile nach dem Filtern: " + (nachher.match(/\d+ studentische Projekte gefunden/)?.[0] ?? "nicht gefunden"))
    notiz("Adresse: " + page.url())

    /*
     * Die Kernfrage aus Abschnitt 3: steht die aktive Einschraenkung auch
     * ueber der Trefferliste, oder nur als Haken in der Seitenleiste?
     */
    const obenBereich = await page
      .locator("main")
      .locator("xpath=.//*[self::div or self::section][1]")
      .first()
      .innerText()
      .catch(() => "")
    notiz("Bereich ueber der Liste: " + obenBereich.replace(/\s+/g, " ").slice(0, 300))

    for (const label of ["Filter zurücksetzen", "Zurücksetzen", "Alle Filter entfernen", "Filter leeren", "Auswahl aufheben"]) {
      const treffer = await page.getByText(label, { exact: false }).count()
      notiz(`Steuerelement "${label}": ${treffer > 0 ? "vorhanden" : "nicht vorhanden"}`)
    }
    /* Chips oder Marken, an denen eine einzelne Einschraenkung faellt. */
    const chips = await page.locator("[data-slot='badge'],[data-slot='chip']").allTextContents()
    notiz("Marken im Inhaltsbereich: " + JSON.stringify(chips.slice(0, 15)))
    notiz("")
  })

  test("S2 Filterkombination ohne Treffer", async ({ page }) => {
    await prepare(page, "light", null)
    await page.goto("/projects")
    await settle(page)
    notiz("## S2 Leerzustand nach Filtern (H1, H3, H9)")

    /* Suchbegriff, der sicher nichts trifft. */
    await page.getByRole("searchbox").fill("zzzqqq-gibt-es-nicht")
    await page.waitForTimeout(1800)
    await bild(page, "s2-keine-treffer")
    notiz("Meldungen: " + JSON.stringify(await meldungen(page)))
    const text = await seitentext(page)
    notiz("Leerzustandstext: " + (text.match(/keine Treffer[^.]*\./)?.[0] ?? "nicht gefunden"))
    notiz("")
  })

  test("S3 Editor: Speicheranzeige und Rueckgaengig", async ({ page, request }) => {
    const student = await login(request, "student")
    const fixtures = await discoverFixtures(request)
    await prepare(page, "light", student)
    await page.goto(`/projects/${fixtures.draftProjectId}/editor`)
    await settle(page)
    notiz("## S3 Editor (H1, H3)")

    const vorText = await seitentext(page)
    notiz("Statusanzeigen vor der Eingabe: " + JSON.stringify(await meldungen(page)))
    notiz("Enthaelt das Wort gespeichert: " + /gespeichert|Speichern|Speichert/i.test(vorText))

    /* In die Schreibflaeche tippen und beobachten, was die Kopfzeile meldet. */
    const flaeche = page.locator(".ProseMirror").first()
    await flaeche.click()
    await page.keyboard.type("Heuristische Evaluation, Durchgang 2, Probeeingabe.")
    await page.waitForTimeout(1200)
    await bild(page, "s3-editor-nach-eingabe")
    notiz("Meldungen direkt nach der Eingabe: " + JSON.stringify(await meldungen(page)))
    const nachEingabe = await seitentext(page)
    notiz("Kopfzeilentext nach Eingabe enthaelt gespeichert: " + /gespeichert/i.test(nachEingabe))

    /* Autosave abwarten. */
    await page.waitForTimeout(6000)
    await bild(page, "s3-editor-nach-autosave")
    notiz("Meldungen nach 6 s Wartezeit: " + JSON.stringify(await meldungen(page)))
    const nachWarten = await seitentext(page)
    const stelle = nachWarten.match(/.{0,60}gespeichert.{0,60}/i)
    notiz("Fundstelle gespeichert: " + (stelle?.[0] ?? "keine"))

    /* Rueckgaengig: ist der Knopf da, und ist er benutzbar? */
    const undo = page.getByRole("button", { name: /rückgängig|undo/i })
    const anzahl = await undo.count()
    notiz("Knopf Rueckgaengig vorhanden: " + (anzahl > 0))
    if (anzahl > 0) {
      notiz("Knopf Rueckgaengig benutzbar: " + (await undo.first().isEnabled()))
    }
    notiz("")
  })

  test("S4 Einreichen eines unvollstaendigen Projekts", async ({ page, request }) => {
    const student = await login(request, "student")
    const fixtures = await discoverFixtures(request)
    await prepare(page, "light", student)
    await page.goto(`/projects/${fixtures.draftProjectId}/editor`)
    await settle(page)
    notiz("## S4 Einreichen unvollstaendig (H5, H9)")

    const einreichen = page.getByRole("button", { name: /einreichen/i }).first()
    notiz("Knopf Einreichen benutzbar: " + (await einreichen.isEnabled().catch(() => "nicht gefunden")))
    await einreichen.click()
    await page.waitForTimeout(2500)
    await bild(page, "s4-einreichen-versuch")
    notiz("Meldungen: " + JSON.stringify(await meldungen(page)))
    const text = await seitentext(page)
    notiz("Dialog oder Hinweis: " + text.slice(0, 500))
    notiz("")
  })

  test("S5 Anmeldung mit falschem Passwort", async ({ page }) => {
    await prepare(page, "light", null)
    await page.goto("/login")
    await settle(page)
    notiz("## S5 Fehlerhafte Anmeldung (H9)")

    await page.getByLabel(/e-mail/i).first().fill("dev-studi@dev.invalid")
    await page.getByLabel(/passwort/i).first().fill("definitiv-falsch")
    await page.getByRole("button", { name: /anmelden/i }).first().click()
    await page.waitForTimeout(2500)
    await bild(page, "s5-login-fehler")
    notiz("Meldungen: " + JSON.stringify(await meldungen(page)))
    notiz("")
  })

  test("S6 Metadaten ohne Pflichtangaben speichern", async ({ page, request }) => {
    const student = await login(request, "student")
    const fixtures = await discoverFixtures(request)
    await prepare(page, "light", student)
    await page.goto(`/projects/${fixtures.draftProjectId}/metadata`)
    await settle(page)
    notiz("## S6 Metadaten speichern (H5, H9)")

    const speichern = page.getByRole("button", { name: /speichern/i }).first()
    await speichern.click()
    await page.waitForTimeout(2000)
    await bild(page, "s6-metadaten-speichern")
    notiz("Meldungen: " + JSON.stringify(await meldungen(page)))
    notiz("Adresse danach: " + new URL(page.url()).pathname)
    notiz("")
  })

  test("S7 Projektdetail: Export und Status", async ({ page, request }) => {
    const fixtures = await discoverFixtures(request)
    await prepare(page, "light", null)
    await page.goto(`/projects/${fixtures.publishedProjectId}`)
    await settle(page)
    notiz("## S7 Projektdetail, Export (H1)")

    const knoepfe = await page.getByRole("button").allTextContents()
    notiz("Knoepfe: " + JSON.stringify(knoepfe.map((k) => k.replace(/\s+/g, " ").trim()).filter(Boolean)))
    const pdf = page.getByRole("button", { name: /pdf|export|drucken/i })
    const da = await pdf.count()
    notiz("Exportknopf vorhanden: " + (da > 0))
    if (da > 0) {
      await pdf.first().click()
      await page.waitForTimeout(1200)
      await bild(page, "s7-export-laeuft")
      notiz("Meldungen nach dem Klick: " + JSON.stringify(await meldungen(page)))
    }
    notiz("")
  })

  test("S8 Eingereichtes Projekt: Rueckzug auffindbar", async ({ page, request }) => {
    const student = await login(request, "student")
    await prepare(page, "light", student)
    await page.goto("/my-portfolio")
    await settle(page)
    notiz("## S8 Rueckzug einer Einreichung (H3)")

    const text = await seitentext(page)
    notiz("Statuswoerter auf Mein Portfolio: " + JSON.stringify(
      ["Entwurf", "Eingereicht", "In Prüfung", "Überarbeitung", "Veröffentlicht", "Archiviert"].filter((s) => text.includes(s))
    ))
    for (const label of ["Zurückziehen", "Zurücknehmen", "Einreichung zurückziehen", "Widerrufen"]) {
      notiz(`Steuerelement "${label}" auf der Uebersicht: ` + ((await page.getByText(label, { exact: false }).count()) > 0))
    }
    await bild(page, "s8-mein-portfolio")
    notiz("")
  })

  test("S9 Tastaturweg zum ersten Filter", async ({ page }) => {
    await prepare(page, "light", null)
    await page.goto("/projects")
    await settle(page)
    notiz("## S9 Tastaturweg (H7, Durchgang 3)")

    /* Wie viele Tabstopps liegen zwischen Seitenanfang und erstem Filter? */
    let schritte = 0
    let beschreibung = ""
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab")
      schritte++
      const aktiv = await page.evaluate(() => {
        const el = document.activeElement
        if (el === null) return "keins"
        return (
          el.tagName +
          " " +
          (el.getAttribute("type") ?? "") +
          " " +
          ((el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40) ||
            el.getAttribute("aria-label") ||
            "")
        )
      })
      if (i < 20) beschreibung += `${schritte}. ${aktiv}\n`
      if (aktiv.includes("checkbox")) break
    }
    notiz("Tabstopps bis zum ersten Filterhaken: " + schritte)
    notiz("Reihenfolge:\n" + beschreibung)
    notiz("")
  })
})
