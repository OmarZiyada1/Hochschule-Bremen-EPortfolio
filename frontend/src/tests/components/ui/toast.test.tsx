import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { toast } from "@/components/ui/toast"
import i18n from "@/i18n"
import { renderWithProviders } from "@/tests/render"

/**
 * Toast-Primitive samt globalem Toaster (KAN-105). Geprueft wird ueber das,
 * was eine Person erreicht: die beschriftete Region, der Toast darin und
 * sein Schliessen-Knopf.
 *
 * Der Toaster kommt nicht aus dem Test, sondern aus renderWithProviders,
 * genau wie er in main.tsx haengt. Ein Test mit eigenem Toaster belegte nur
 * die Primitive und nicht, dass die Anwendung sie auch einhaengt.
 */
describe("Toaster", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  afterEach(async () => {
    await i18n.changeLanguage("de")
  })

  /* Gerufen wie spaeter aus einer Seite: ueber den exportierten Manager. */
  function showToast(title: string) {
    act(() => {
      toast.add({ title, type: "success" })
    })
  }

  /*
   * Base UI nimmt den Schliessen-Knopf per aria-hidden aus dem
   * Accessibility-Baum, solange die Region zugeklappt ist. Mit der Tastatur
   * klappt F6 sie auf; genau so kommt eine Person ohne Maus an den Knopf.
   * Die Abfrage ueber die Rolle bleibt deshalb ohne hidden: true, sonst
   * faende der Test auch einen Knopf, den niemand erreicht.
   */
  async function expandRegion(user: ReturnType<typeof userEvent.setup>) {
    await user.keyboard("{F6}")
  }

  it("zeigt den Titel in der beschrifteten Region", async () => {
    renderWithProviders(<p>Seite</p>)
    showToast("Profil gespeichert")

    const region = screen.getByRole("region", { name: "Benachrichtigungen" })

    expect(
      await within(region).findByRole("dialog", { name: "Profil gespeichert" })
    ).toBeVisible()
  })

  it("schliesst den Toast ueber den Knopf mit deutschem Namen", async () => {
    const user = userEvent.setup()
    renderWithProviders(<p>Seite</p>)
    showToast("Profil gespeichert")

    const region = screen.getByRole("region", { name: "Benachrichtigungen" })
    await within(region).findByRole("dialog", { name: "Profil gespeichert" })
    await expandRegion(user)

    await user.click(
      await within(region).findByRole("button", { name: "Schließen" })
    )

    await waitFor(() =>
      expect(within(region).queryByRole("dialog")).not.toBeInTheDocument()
    )
  })

  it("beschriftet Region und Knopf auf Englisch englisch", async () => {
    await i18n.changeLanguage("en")
    const user = userEvent.setup()
    renderWithProviders(<p>Page</p>)
    showToast("Profile saved")

    const region = screen.getByRole("region", { name: "Notifications" })
    await within(region).findByRole("dialog", { name: "Profile saved" })
    await expandRegion(user)

    expect(
      await within(region).findByRole("button", { name: "Close" })
    ).toBeInTheDocument()
  })

  /*
   * Der Manager ist ein Modul-Singleton, die Toasts liegen aber im Provider.
   * Wird die Darstellung abgebaut, wie es das Aufraeumen nach jedem Test
   * tut, muss der Toast mit ihr verschwinden; sonst erbte der naechste Test
   * eine Meldung, die er nie ausgeloest hat.
   */
  it("laesst keinen Toast in die naechste Darstellung laufen", async () => {
    const first = renderWithProviders(<p>Seite</p>)
    showToast("Profil gespeichert")
    await screen.findByRole("dialog", { name: "Profil gespeichert" })

    first.unmount()
    renderWithProviders(<p>Seite</p>)

    const region = screen.getByRole("region", { name: "Benachrichtigungen" })
    expect(within(region).queryByRole("dialog")).not.toBeInTheDocument()
  })
})
