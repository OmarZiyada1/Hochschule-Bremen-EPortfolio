import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { InfoHint } from "@/components/common/InfoHint"
import { renderWithProviders } from "@/tests/render"

const LABEL = "Was bedeutet der Stern?"
const TEXT = "Mit * markierte Angaben brauchen Sie erst zum Einreichen."

describe("InfoHint", () => {
  it("laesst sich mit der Tastatur oeffnen und schliessen und gibt den Fokus zurueck", async () => {
    /*
     * Der Grund, warum hier ein Popover steht und kein Tooltip auf
     * Ueberfahren: auf einem Telefon gibt es kein Ueberfahren, und ein
     * Hinweis, an den die Haelfte der Leute nicht herankommt, ist keiner.
     * Der Knopf muss dafuer mit der Tastatur genauso gehen wie mit der
     * Maus.
     */
    const user = userEvent.setup()
    renderWithProviders(<InfoHint label={LABEL} text={TEXT} />)

    const trigger = screen.getByRole("button", { name: LABEL })
    await user.tab()
    expect(trigger).toHaveFocus()

    await user.keyboard("{Enter}")
    expect(await screen.findByText(TEXT)).toBeVisible()

    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByText(TEXT)).toBeNull())
    /* Sonst faellt der Fokus auf body und die Person faengt am
       Seitenanfang wieder an. */
    expect(trigger).toHaveFocus()
  })

  it("benennt den Dialog, statt ihn namenlos zu lassen", async () => {
    /*
     * Base UI gibt dem Popup fest role="dialog" und benennt es sonst nur
     * ueber einen Popover.Title. Ohne Namen sagt ein Screenreader „Dialog"
     * und axe meldet aria-dialog-name als Verstoss (Befund des
     * frontend-reviewers).
     */
    const user = userEvent.setup()
    renderWithProviders(<InfoHint label={LABEL} text={TEXT} />)

    await user.click(screen.getByRole("button", { name: LABEL }))

    expect(await screen.findByRole("dialog", { name: LABEL })).toBeVisible()
  })

  it("haengt den Text zusaetzlich unsichtbar ans Feld, wenn eine ID gesetzt ist", () => {
    /*
     * Wo der Hinweis eine Anweisung zur Eingabe ist und nicht nur Beiwerk,
     * darf er nicht allein hinter einem Knopf liegen (SC 3.3.2). Der
     * Aufrufer verbindet die ID dann ueber aria-describedby mit dem Feld.
     */
    renderWithProviders(
      <InfoHint label={LABEL} text={TEXT} descriptionId="hinweis" />
    )

    const hidden = document.getElementById("hinweis")
    expect(hidden).not.toBeNull()
    expect(hidden).toHaveTextContent(TEXT)
    expect(hidden).toHaveClass("sr-only")
    /* Nicht unter aria-hidden: ein sr-only darunter besteht getByText
       anstandslos und wird trotzdem nie vorgelesen (Befund aus KAN-29). */
    expect(hidden?.closest("[aria-hidden='true']")).toBeNull()
  })

  it("zeigt den Text erst auf Verlangen", () => {
    /* Der ganze Zweck: der Satz bleibt erreichbar, steht aber nicht
       dauernd da. */
    renderWithProviders(<InfoHint label={LABEL} text={TEXT} />)

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: LABEL })).toBeVisible()
  })
})
