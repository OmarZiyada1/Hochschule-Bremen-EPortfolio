import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"

import type { PageResponse } from "@/api/page"
import type { SupportRequestResponse } from "@/api/types"
import { ADMIN_NAV } from "@/features/administration/adminNav"
import { AdministrationLayout } from "@/features/administration/AdministrationLayout"
import i18n from "@/i18n"
import { currentUserHandler } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

/**
 * Der Rahmen der Administrationsseite: die Spalte ab {@code lg}, die Zeile
 * mit der Schublade darunter, und der Zaehler der offenen Support-Anfragen
 * an beiden.
 *
 * <p>Die Zahl kommt aus derselben Abfrage wie der Kopf der Support-Seite
 * ({@code status=OPEN}, {@code size=1}, {@code totalElements}); geprueft wird
 * hier nicht die Abfrage, sondern was aus ihrer Antwort in der Leiste wird.
 *
 * <p><strong>Beide Anordnungen stehen im Test gleichzeitig im DOM.</strong>
 * Im Browser entscheidet die Fensterbreite, jsdom rechnet keine
 * Medienabfragen; die Abfragen sind deshalb ausdruecklich auf die eine oder
 * die andere eingegrenzt, statt auf „genau ein Treffer" zu bauen.
 */
function supportPage(totalElements: number) {
  const page: PageResponse<SupportRequestResponse> = {
    content: [],
    page: 0,
    size: 1,
    totalElements,
    totalPages: totalElements,
  }
  return http.get("*/api/admin/support", () => HttpResponse.json(page))
}

function renderLayout(open: number, route = "/administration") {
  signInAs("ADMIN")
  server.use(currentUserHandler({ role: "ADMIN" }), supportPage(open))
  renderWithProviders(<AdministrationLayout />, route)
}

/** Die Spalte ab lg. Solange die Schublade zu ist, gibt es nur diese. */
function column() {
  return screen.getByRole("navigation", {
    name: i18n.t("administration.nav.label"),
  })
}

/** Die Zeile im schmalen Fenster, ueber ihren Ausloeser gefunden. */
function bar() {
  const trigger = screen.getByRole("button", {
    name: i18n.t("administration.nav.open"),
  })
  const row = trigger.parentElement
  expect(row).not.toBeNull()
  return row as HTMLElement
}

describe("AdministrationLayout", () => {
  it("zeigt am Support die Zahl der offenen Anfragen", async () => {
    renderLayout(3)

    /* Auf die Zahl warten und nicht auf den Link: den gibt es sofort, die
       Zahl erst mit der Antwort. */
    await waitFor(() =>
      expect(within(column()).getByText("3")).toBeInTheDocument()
    )

    const link = within(column()).getByRole("link", { name: /Support/ })
    expect(within(link).getByText("3")).toBeVisible()

    /* Die nackte Ziffer ist aria-hidden; vorgelesen wird ein ganzer Satz,
       sonst stuende fuer Hilfsmittel eine 3 neben einem Wort (SC 1.3.1). */
    const spoken = within(link).getByText(
      i18n.t("administration.nav.openSupportCount", { count: 3 })
    )
    expect(spoken).toBeInTheDocument()
    /* Und er muss hoerbar sein: Text im DOM, den ein aria-hidden-Vorfahr
       verschluckt, findet getByText trotzdem (Befund aus KAN-29). */
    expect(spoken.closest("[aria-hidden]")).toBeNull()
    expect(within(link).getByText("3").closest("[aria-hidden]")).not.toBeNull()
  })

  it("laesst die Zahl weg, wenn nichts offen ist", async () => {
    renderLayout(0)

    /* Erst warten, bis die Antwort da ist: sonst bestuende der Test auch
       dann, wenn der Zaehler gar nicht gebaut wuerde. */
    await screen.findByRole("link", {
      name: i18n.t("administration.nav.users"),
    })

    expect(screen.queryByText("0")).toBeNull()
  })

  it("traegt an keinem anderen Eintrag einen Zaehler", async () => {
    renderLayout(3)

    await waitFor(() =>
      expect(within(column()).getByText("3")).toBeInTheDocument()
    )

    for (const key of ["dashboard", "projects", "top10", "users"]) {
      const link = within(column()).getByRole("link", {
        name: i18n.t(`administration.nav.${key}`),
      })
      expect(within(link).queryByText("3")).toBeNull()
    }
  })

  /*
   * Im schmalen Fenster steht an der Stelle der Spalte eine Zeile mit dem
   * Namen der aktuellen Seite; die Eintraege liegen in einer Schublade
   * dahinter. Bis zur Nacharbeit lief die Leiste dort waagerecht scrollbar,
   * und von acht Eintraegen waren drei zu sehen.
   */
  describe("schmales Fenster", () => {
    /*
     * Welche der beiden Anordnungen zu sehen ist, entscheidet allein CSS,
     * und die Klassen laufen durch tailwind-merge: „hidden" und „flex"
     * gehoeren derselben Gruppe an, „lg:flex" einer anderen. Faellt eine der
     * beiden beim Zusammenfuehren weg, ist die Spalte auf dem Schreibtisch
     * verschwunden oder die Zeile steht doppelt, und weder Typecheck noch
     * Lint noch ein anderer Test meldet es.
     */
    it("blendet Spalte und Zeile gegeneinander aus", () => {
      renderLayout(0)

      expect(column().className).toContain("hidden")
      expect(column().className).toContain("lg:flex")
      expect(column().className).not.toMatch(/(^| )flex( |$)/)
      expect(bar().className).toContain("lg:hidden")
    })

    it("nennt in der Zeile, wo man gerade ist", () => {
      renderLayout(0, "/administration/users")

      expect(
        within(bar()).getByText(i18n.t("administration.nav.users"))
      ).toBeVisible()
      expect(
        within(bar()).getByText(i18n.t("administration.label"))
      ).toBeVisible()
    })

    it("haelt den Eintrag auch auf einer Unterseite fest", () => {
      /* Das Protokoll liegt unter der Top-10-Verwaltung und gehoert zu ihr
         (isAdminNavActive vergleicht mit Praefix). */
      renderLayout(0, "/administration/top10/audit")

      expect(
        within(bar()).getByText(i18n.t("administration.nav.top10"))
      ).toBeVisible()
    })

    it("zeigt den Zaehler auch an der geschlossenen Zeile", async () => {
      renderLayout(3)

      await waitFor(() =>
        expect(within(bar()).getByText("3")).toBeInTheDocument()
      )
      /* Hinter der geschlossenen Schublade waere die Auskunft sonst genau
         dort weg, wo man am wenigsten nachsieht. */
      expect(
        within(bar()).getByText(
          i18n.t("administration.nav.openSupportCount", { count: 3 })
        )
      ).toBeInTheDocument()
    })

    it("oeffnet alle acht Eintraege in der Schublade", async () => {
      const user = userEvent.setup()
      renderLayout(0)

      await user.click(
        screen.getByRole("button", {
          name: i18n.t("administration.nav.open"),
        })
      )

      const drawer = await screen.findByRole("dialog")
      for (const entry of ADMIN_NAV) {
        expect(
          within(drawer).getByRole("link", { name: t(entry.labelKey) })
        ).toBeVisible()
      }
    })

    it("schliesst sich beim Klick auf einen Eintrag", async () => {
      const user = userEvent.setup()
      renderLayout(0)

      await user.click(
        screen.getByRole("button", {
          name: i18n.t("administration.nav.open"),
        })
      )
      const drawer = await screen.findByRole("dialog")

      /* Ein Link im SPA laedt die Seite nicht neu; ohne das Schliessen
         staende die Schublade ueber der neuen Ansicht. */
      await user.click(
        within(drawer).getByRole("link", {
          name: i18n.t("administration.nav.users"),
        })
      )

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    })
  })
})

/** Kurzform, damit die Schleife oben lesbar bleibt. */
function t(key: string): string {
  return i18n.t(key)
}
