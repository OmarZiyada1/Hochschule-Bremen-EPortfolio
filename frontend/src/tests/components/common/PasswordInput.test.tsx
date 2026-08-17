import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PasswordInput } from "@/components/common/PasswordInput"
import i18n from "@/i18n"
import { renderWithProviders } from "@/tests/render"

/**
 * Passwortfeld mit Sichtbarkeitsschalter (KAN-67): Umschalten der
 * Darstellung, wechselnder Name des Knopfes, Unabhaengigkeit mehrerer
 * Felder und die Zusicherung, dass der Knopf kein Formular absendet.
 */
describe("PasswordInput", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  function renderField(props: Record<string, unknown> = {}) {
    return renderWithProviders(
      <>
        <label htmlFor="pw">Passwort</label>
        <PasswordInput id="pw" {...props} />
      </>
    )
  }

  it("verbirgt die Eingabe und bietet sie zum Anzeigen an", () => {
    renderField()

    expect(screen.getByLabelText("Passwort")).toHaveAttribute(
      "type",
      "password"
    )
    expect(
      screen.getByRole("button", { name: "Passwort anzeigen" })
    ).toBeVisible()
  })

  it("zeigt die Eingabe im Klartext, behaelt den Wert und wechselt den Namen des Knopfes", async () => {
    const user = userEvent.setup()
    renderField()

    const input = screen.getByLabelText("Passwort")
    await user.type(input, "zwoelfzeichenlang")

    await user.click(screen.getByRole("button", { name: "Passwort anzeigen" }))
    expect(input).toHaveAttribute("type", "text")
    expect(input).toHaveValue("zwoelfzeichenlang")
    /* Der Zustand steht im Namen des Knopfes, nicht nur im Bild: sonst
       erfaehrt niemand per Screenreader, ob das Passwort offen liegt. */
    expect(
      screen.getByRole("button", { name: "Passwort verbergen" })
    ).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Passwort verbergen" }))
    expect(input).toHaveAttribute("type", "password")
    expect(input).toHaveValue("zwoelfzeichenlang")
  })

  it("sendet das Formular nicht ab", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    renderWithProviders(
      <form onSubmit={onSubmit}>
        <label htmlFor="pw">Passwort</label>
        <PasswordInput id="pw" />
      </form>
    )

    await user.click(screen.getByRole("button", { name: "Passwort anzeigen" }))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("schaltet je Feld fuer sich, damit die Bestaetigung ihren Zweck behaelt", async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <>
        <label htmlFor="pw">Passwort</label>
        <PasswordInput id="pw" />
        <label htmlFor="pw2">Passwort bestätigen</label>
        <PasswordInput id="pw2" />
      </>
    )

    const toggles = screen.getAllByRole("button", { name: "Passwort anzeigen" })
    await user.click(toggles[0])

    expect(screen.getByLabelText("Passwort")).toHaveAttribute("type", "text")
    expect(screen.getByLabelText("Passwort bestätigen")).toHaveAttribute(
      "type",
      "password"
    )
  })

  it("reicht Fehlerzustand, Hinweisbezug und autoComplete an das Eingabefeld durch", () => {
    renderField({
      "aria-invalid": true,
      "aria-describedby": "pw-hint",
      autoComplete: "new-password",
    })

    const input = screen.getByLabelText("Passwort")
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input).toHaveAttribute("aria-describedby", "pw-hint")
    expect(input).toHaveAttribute("autocomplete", "new-password")
  })

  it("uebersetzt den Namen des Knopfes", async () => {
    await i18n.changeLanguage("en")
    renderField()

    expect(screen.getByRole("button", { name: "Show password" })).toBeVisible()
  })
})
