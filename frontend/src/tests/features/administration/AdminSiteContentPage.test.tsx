import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it } from "vitest"

import type { SiteContentEntryResponse } from "@/api/types"
import AdminSiteContentPage from "@/features/administration/AdminSiteContentPage"
import { SITE_CONTENT_FIELDS } from "@/features/administration/AdminSiteContentPage.schema"
import i18n from "@/i18n"
import { apiErrorResponse, currentUserHandler } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

/** Der gepflegte Einleitungstext des Kopfbereichs, in beiden Sprachen. */
const SUBTITLE: SiteContentEntryResponse = {
  key: "home.hero.subtitle",
  valueDe: "Gepflegter Einleitungstext.",
  valueEn: "Maintained intro text.",
}

function baseHandlers(entries: SiteContentEntryResponse[] = []) {
  return [
    currentUserHandler({ role: "ADMIN" }),
    http.get("*/api/site-content", () => HttpResponse.json({ entries })),
  ]
}

function renderPage() {
  renderWithProviders(<AdminSiteContentPage />, "/administration/site-content")
}

/** Die Felderzeile einer Stelle, ueber ihren sprechenden Namen gefunden. */
async function fieldSet(labelKey: string) {
  return await screen.findByRole("group", { name: i18n.t(labelKey) })
}

/**
 * Die Beschriftung eines Sprachfeldes, aus i18n und nicht als roher Text:
 * eine Umformulierung der beiden Schluessel braeche sonst acht Zusicherungen
 * ohne inhaltlichen Grund (Frontend-Regel 7).
 */
function languageLabel(code: "de" | "en") {
  return i18n.t(`administration.siteContent.language.${code}`)
}

/**
 * Die Pflege der Startseitentexte (Contract §2.16, §3.21, §5, §6.1):
 * fuenfzehn Stellen, je zwei Sprachen, ein Speichern-Knopf.
 */
describe("AdminSiteContentPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
    signInAs("ADMIN")
  })

  it("zeigt die fuenfzehn Stellen und die ausgelieferte Fassung als Vorschlag", async () => {
    server.use(...baseHandlers())

    renderPage()

    /* Alle fuenfzehn stehen da, auch die ungepflegten: die Antwort fuehrt
       nur gepflegte Stellen, ein fehlender Schluessel ist ein leeres Feld
       und keine fehlende Zeile (§6.1). */
    const hero = await fieldSet(
      "administration.siteContent.field.heroTitleLine1"
    )
    for (const field of SITE_CONTENT_FIELDS) {
      expect(
        screen.getByRole("group", { name: i18n.t(field.labelKey) })
      ).toBeInTheDocument()
    }
    /* Je Stelle zwei Felder, deutsch und englisch. */
    expect(screen.getAllByRole("textbox")).toHaveLength(
      SITE_CONTENT_FIELDS.length * 2
    )

    /* Der Vorschlag ist die mitgelieferte Fassung der jeweiligen Sprache. */
    expect(
      within(hero).getByRole("textbox", { name: languageLabel("de") })
    ).toHaveAttribute("placeholder", "Studentische Innovation")
    expect(
      within(hero).getByRole("textbox", { name: languageLabel("en") })
    ).toHaveAttribute("placeholder", "Student innovation,")

    /* Roh und nicht interpoliert: die Redaktion muss sehen, dass der
       Platzhalter in den Text gehoert, und nicht seine Wirkung. */
    const title = await fieldSet("administration.siteContent.field.top10Title")
    expect(
      within(title).getByRole("textbox", { name: languageLabel("de") })
    ).toHaveAttribute("placeholder", "Top 10 · {{year}}")
  })

  it("zeigt eine gepflegte Stelle als Wert und nicht als Vorschlag", async () => {
    server.use(...baseHandlers([SUBTITLE]))

    renderPage()

    const group = await fieldSet(
      "administration.siteContent.field.heroSubtitle"
    )
    expect(
      within(group).getByRole("textbox", { name: languageLabel("de") })
    ).toHaveValue("Gepflegter Einleitungstext.")
    expect(
      within(group).getByRole("textbox", { name: languageLabel("en") })
    ).toHaveValue("Maintained intro text.")
  })

  it("schickt genau einen PUT mit allen fuenfzehn Eintraegen", async () => {
    const bodies: { entries: SiteContentEntryResponse[] }[] = []
    server.use(
      ...baseHandlers([SUBTITLE]),
      http.put("*/api/admin/site-content", async ({ request }) => {
        const body = (await request.json()) as {
          entries: SiteContentEntryResponse[]
        }
        bodies.push(body)
        return HttpResponse.json({ entries: [SUBTITLE] })
      })
    )

    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole("button", {
        name: i18n.t("administration.siteContent.submit"),
      })
    )

    await waitFor(() => expect(bodies).toHaveLength(1))
    /* Immer alle Stellen und immer beide Sprachen: ein weggelassenes Feld
       hiesse nicht „bleibt wie es war", sondern dasselbe wie ein leeres. */
    expect(bodies[0].entries.map((entry) => entry.key)).toEqual(
      SITE_CONTENT_FIELDS.map((field) => field.key)
    )
    expect(
      bodies[0].entries.find((entry) => entry.key === "home.hero.subtitle")
    ).toEqual(SUBTITLE)
    /* Der Vorschlag im leeren Feld wird nie gespeichert, sonst waere aus
       dem Rueckfall unbemerkt eine Pflege geworden. */
    expect(
      bodies[0].entries.find((entry) => entry.key === "home.hero.titleLine1")
    ).toEqual({ key: "home.hero.titleLine1", valueDe: "", valueEn: "" })

    /* Der Erfolg steht sichtbar da und nicht nur als Ansage: an den Feldern
       aendert sich beim Speichern nichts, und ohne Meldung wuesste niemand,
       ob der Knopf etwas bewirkt hat (SC 4.1.3). */
    expect(await screen.findByRole("status")).toHaveTextContent(
      i18n.t("administration.siteContent.saved")
    )
  })

  it("schickt ein geleertes Feld als leeren Wert mit", async () => {
    const bodies: { entries: SiteContentEntryResponse[] }[] = []
    server.use(
      ...baseHandlers([SUBTITLE]),
      http.put("*/api/admin/site-content", async ({ request }) => {
        const body = (await request.json()) as {
          entries: SiteContentEntryResponse[]
        }
        bodies.push(body)
        return HttpResponse.json({ entries: [] })
      })
    )

    const user = userEvent.setup()
    renderPage()

    const group = await fieldSet(
      "administration.siteContent.field.heroSubtitle"
    )
    await user.clear(
      within(group).getByRole("textbox", { name: languageLabel("de") })
    )
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("administration.siteContent.submit"),
      })
    )

    /* Leer loescht: der Server entfernt die deutsche Zeile, und die Stelle
       faellt auf die Sprachdatei zurueck (§6.1). */
    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(
      bodies[0].entries.find((entry) => entry.key === "home.hero.subtitle")
    ).toEqual({
      key: "home.hero.subtitle",
      valueDe: "",
      valueEn: "Maintained intro text.",
    })

    /* Die Antwort ist der neue Gesamtstand: das Feld steht danach leer da
       und zeigt wieder seinen Vorschlag. */
    await waitFor(() =>
      expect(
        within(group).getByRole("textbox", { name: languageLabel("de") })
      ).toHaveValue("")
    )
  })

  it("haelt den fehlenden Pflichtplatzhalter vor dem Absenden auf", async () => {
    const bodies: unknown[] = []
    server.use(
      ...baseHandlers([
        {
          key: "home.top10.title",
          valueDe: "Bestes des Jahres {{year}}",
          valueEn: null,
        },
      ]),
      http.put("*/api/admin/site-content", async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ entries: [] })
      })
    )

    const user = userEvent.setup()
    renderPage()

    const group = await fieldSet("administration.siteContent.field.top10Title")
    const german = within(group).getByRole("textbox", {
      name: languageLabel("de"),
    })
    await user.clear(german)
    await user.type(german, "Bestes des Jahres")

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("administration.siteContent.submit"),
      })
    )

    /* Ohne {{year}} verschwindet die Jahreszahl wortlos aus der
       Ueberschrift; das faellt beim Tippen niemandem auf und deshalb hier. */
    expect(
      await within(group).findByText(
        i18n.t("validation.siteContent.placeholderMissing")
      )
    ).toBeInTheDocument()
    expect(bodies).toHaveLength(0)
  })

  it("zeigt ein 400 VALIDATION_FAILED des Servers am betroffenen Feld", async () => {
    server.use(
      ...baseHandlers([SUBTITLE]),
      http.put("*/api/admin/site-content", () =>
        apiErrorResponse(
          400,
          "VALIDATION_FAILED",
          "/api/admin/site-content",
          'entries[3].valueDe: Der Text zu "home.hero.subtitle" ist nicht zulaessig.'
        )
      )
    )

    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole("button", {
        name: i18n.t("administration.siteContent.submit"),
      })
    )

    /*
     * Der Server nennt das Feld mit Index in der Schreibweise der
     * Bean-Validation (§6.2); der vierte Eintrag ist der Einleitungstext.
     * Verbindlich bleibt er auch dann, wenn die Maske dieselbe Eingabe
     * gerade durchgelassen hat.
     */
    const group = await fieldSet(
      "administration.siteContent.field.heroSubtitle"
    )
    expect(
      await within(group).findByText(
        'Der Text zu "home.hero.subtitle" ist nicht zulaessig.'
      )
    ).toBeInTheDocument()
    expect(SITE_CONTENT_FIELDS[3].key).toBe("home.hero.subtitle")
  })

  it("macht eine Fehlerantwort der Texte aus dem 6.2-Envelope sichtbar", async () => {
    server.use(
      currentUserHandler({ role: "ADMIN" }),
      http.get("*/api/site-content", () =>
        apiErrorResponse(500, "INTERNAL_ERROR", "/api/site-content")
      )
    )

    renderPage()

    /*
     * Keine leere Flaeche: der Fehler wird benannt, und zwar ueber den
     * errorCode und nie ueber den Meldungstext des Servers
     * (Frontend-Regel 3). Das Formular entsteht dabei gar nicht erst, denn
     * es gibt keinen Stand, den es zeigen koennte.
     */
    expect(
      await screen.findByText(i18n.t("apiError.INTERNAL_ERROR"))
    ).toBeInTheDocument()
    expect(screen.queryAllByRole("textbox")).toHaveLength(0)
  })
})
