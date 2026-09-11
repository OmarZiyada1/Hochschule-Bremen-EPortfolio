import { screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import ImprintPage from "@/features/legal/ImprintPage"
import i18n from "@/i18n"
import { renderWithProviders } from "@/tests/render"

/*
 * Die vier Angaben des Betreibers kommen aus der Bauumgebung und nicht aus
 * i18n (KAN-100, siehe features/legal/operatorDetails.ts). Im Testlauf sind
 * sie ungesetzt, deshalb setzt jeder Fall sie selbst und raeumt danach auf:
 * ein stehengebliebener Wert liesse den Fall „Angabe fehlt" gruen werden,
 * ohne dass jemand die Ursache saehe.
 */
const OPERATOR = "Vorname Nachname"
const STREET = "Musterweg 1"
const CITY = "28199 Bremen"
const EMAIL = "kontakt@example.org"

function withOperatorDetails() {
  vi.stubEnv("VITE_IMPRINT_OPERATOR", OPERATOR)
  vi.stubEnv("VITE_IMPRINT_STREET", STREET)
  vi.stubEnv("VITE_IMPRINT_CITY", CITY)
  vi.stubEnv("VITE_IMPRINT_EMAIL", EMAIL)
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("ImprintPage", () => {
  it("traegt genau eine Seitenueberschrift und keine uebersprungene Ebene", () => {
    withOperatorDetails()
    renderWithProviders(<ImprintPage />, "/imprint")

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(
      screen.getByRole("heading", { level: 1, name: i18n.t("imprint.title") })
    ).toBeVisible()
    /* Fuenf Abschnitte auf Ebene 2, keine dritte Ebene. */
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(5)
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument()
  })

  it("nennt Betreiber, Anschrift und Postfach aus der Bauumgebung", () => {
    withOperatorDetails()
    renderWithProviders(<ImprintPage />, "/imprint")

    expect(screen.getByText(OPERATOR)).toBeVisible()
    expect(screen.getByText(STREET)).toBeVisible()
    expect(screen.getByText(CITY)).toBeVisible()
    expect(screen.getByRole("link", { name: EMAIL })).toHaveAttribute(
      "href",
      `mailto:${EMAIL}`
    )
    expect(
      screen.queryByText(i18n.t("imprint.operator.missing"))
    ).not.toBeInTheDocument()
  })

  /*
   * Der wichtigste Fall der Seite. Fehlt auch nur ein Wert, darf hier keine
   * halbe Anschrift stehen: ein Impressum mit Namen und ohne Ort sieht aus
   * wie ein vollstaendiges und ist eine falsche Auskunft. Frontend-Regel 10
   * verbietet ausserdem die erfundene Attrappe.
   */
  it("sagt bei fehlender Angabe, dass sie fehlt, statt eine zu erfinden", () => {
    vi.stubEnv("VITE_IMPRINT_OPERATOR", OPERATOR)
    vi.stubEnv("VITE_IMPRINT_STREET", STREET)
    vi.stubEnv("VITE_IMPRINT_CITY", CITY)
    /* Nur das Postfach fehlt. */
    vi.stubEnv("VITE_IMPRINT_EMAIL", "")
    renderWithProviders(<ImprintPage />, "/imprint")

    /* Eine Meldungsflaeche und kein Absatz: auf einem oeffentlichen Stand
       heisst dieser Satz "diesem Portal fehlt sein Impressum". ErrorState
       bringt role="alert" mit. */
    const notice = screen.getByRole("alert")
    expect(notice).toHaveTextContent(i18n.t("imprint.operator.missing"))
    expect(screen.queryByText(OPERATOR)).not.toBeInTheDocument()
    expect(screen.queryByText(STREET)).not.toBeInTheDocument()
  })

  /*
   * Der Grund, warum dieses Ticket vor dem Oeffentlichstellen fertig sein
   * muss: die Oberflaeche traegt Namen und Bildmarke der Hochschule, wird
   * aber privat betrieben. Faellt dieser Hinweis weg, steht diese
   * Klarstellung nirgends mehr in der Anwendung.
   */
  it("weist den Prototypcharakter aus und grenzt gegen die Hochschule ab", () => {
    withOperatorDetails()
    renderWithProviders(<ImprintPage />, "/imprint")

    expect(screen.getByText(i18n.t("imprint.prototypeNote"))).toBeVisible()

    const heading = screen.getByRole("heading", {
      level: 2,
      name: i18n.t("imprint.university.title"),
    })
    const section = heading.closest("section")
    expect(section).not.toBeNull()
    const items = i18n.t("imprint.university.items", {
      returnObjects: true,
    }) as string[]
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect(within(section as HTMLElement).getByText(item)).toBeVisible()
    }
  })

  /*
   * Die Flaticon Free License schreibt den Wortlaut vor. Deshalb steht er in
   * de.json und en.json gleich und wird nicht uebersetzt; NOTICE.md nennt
   * diese Seite als seinen Ort und dieselbe Zieladresse.
   *
   * lang="en" ist kein Zierat: der Wortlaut MUSS englisch bleiben, das
   * Dokument ist deutsch, und ohne die Angabe spricht ein Screenreader ihn
   * deutsch aus (SC 3.1.2). Das Zitat traegt es, nicht der Link, damit die
   * Angabe auch dann stimmt, wenn spaeter Text daneben tritt.
   */
  it("traegt die vorgeschriebene Namensnennung im Wortlaut und verlinkt sie", () => {
    withOperatorDetails()
    renderWithProviders(<ImprintPage />, "/imprint")

    const notice = "Clapping icons created by Smashicons - Flaticon"
    expect(i18n.t("imprint.attribution.notice")).toBe(notice)
    expect(i18n.getFixedT("en")("imprint.attribution.notice")).toBe(notice)

    const link = screen.getByRole("link", { name: notice })
    expect(link).toHaveAttribute(
      "href",
      "https://www.flaticon.com/free-icons/clapping"
    )
    expect(link.closest("blockquote")).toHaveAttribute("lang", "en")
  })

  it("verweist auf Kontaktformular, Datenschutz und Barrierefreiheit", () => {
    withOperatorDetails()
    renderWithProviders(<ImprintPage />, "/imprint")

    for (const [key, href] of [
      ["imprint.operator.contactLink", "/support"],
      ["imprint.related.privacy", "/privacy"],
      ["imprint.related.accessibility", "/accessibility"],
    ] as const) {
      expect(screen.getByRole("link", { name: i18n.t(key) })).toHaveAttribute(
        "href",
        href
      )
    }
  })
})
