import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/*
 * Drei Dateien statt einer Komponente (KAN-100).
 *
 * Die Sperre gegen Suchmaschinen liegt nicht im React-Baum, sondern in
 * public/robots.txt, im Kopf von index.html und in der Kopfzeile des
 * Caddyfile. Alle drei sind damit fuer jeden anderen Test dieser Sammlung
 * unsichtbar: kein Rendern beruehrt sie, und ein versehentliches Entfernen
 * faellt erst auf, wenn die Klarnamen des Portals in einer Suchmaschine
 * stehen. Dann ist es zu spaet, denn ein geloeschtes Konto nimmt seinen
 * Eintrag dort nicht mit.
 *
 * <strong>Die drei haengen voneinander ab, und genau das pruefen diese
 * Faelle.</strong> Ein "Disallow: /" in robots.txt saehe nach der schaerferen
 * Massnahme aus, machte aber die beiden anderen unlesbar: wer nicht abrufen
 * darf, sieht weder das meta-Tag noch die Kopfzeile und kann eine von aussen
 * verlinkte Adresse trotzdem als blossen URL-Eintrag fuehren. Wer also eines
 * Tages "sicherheitshalber" ein Disallow ergaenzt, macht die Sperre
 * schwaecher und nicht staerker; dieser Test haelt ihn auf.
 *
 * Gelesen wird vom Dateisystem und nicht ueber einen Import: index.html ist
 * kein Modul, public/ geht an jedem Buendelschritt vorbei, und das Caddyfile
 * liegt ausserhalb des Frontends. Die Pfade haengen an import.meta.url und
 * nicht am Arbeitsverzeichnis, sonst bricht der Fall still, sobald jemand
 * vitest aus dem Wurzelverzeichnis startet.
 */

function readFromRepo(relative: string): string {
  return readFileSync(
    fileURLToPath(new URL(relative, import.meta.url)),
    "utf-8"
  )
}

describe("Sperre gegen Suchmaschinen", () => {
  /*
   * Der Fall steht bewusst zuerst: er ist der kontraintuitive. Die
   * Ticketfassung vor der Pruefung trug hier "Disallow: /" und hob sich damit
   * selbst auf.
   */
  it("erlaubt das Crawlen, damit die Anweisung ueberhaupt gelesen wird", () => {
    const robots = readFromRepo("../../public/robots.txt")

    expect(robots).toMatch(/^User-agent:\s*\*$/m)
    expect(robots).toMatch(/^Allow:\s*\/$/m)
    expect(robots).not.toMatch(/^Disallow:/m)
  })

  it("verbietet im Kopf jeder Seite das Indexieren", () => {
    const html = readFromRepo("../../index.html")

    const tag = html.match(/<meta\s+name="robots"[^>]*>/)
    expect(tag).not.toBeNull()
    const content = (tag as RegExpMatchArray)[0]
    expect(content).toContain("noindex")
    /* nofollow zusaetzlich, sonst legt ein Crawler die Adressen der
       Projekt- und Portfolioseiten an, auch ohne ihren Inhalt aufzunehmen. */
    expect(content).toContain("nofollow")
  })

  /*
   * Die Kopfzeile ist nicht die Wiederholung des meta-Tags, sondern deckt,
   * was jenes nie erreicht: die ueber GET /api/files/{id} ausgelieferten
   * Profilbilder und Dokumente. Ein Bild hat keinen Kopf, in den sich ein
   * meta-Tag schreiben liesse, und die Bildersuche ist genau der Weg, auf dem
   * ein Portraet auffindbar wird.
   */
  it("setzt X-Robots-Tag am Terminierer auf jede Antwort", () => {
    const caddyfile = readFromRepo("../../../Caddyfile")

    expect(caddyfile).toMatch(/X-Robots-Tag\s+"noindex, nofollow"/)
  })
})
