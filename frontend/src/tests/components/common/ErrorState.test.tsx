import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ApiError, transportError } from "@/api/errors"
import { ErrorState } from "@/components/common/ErrorState"
import i18n from "@/i18n"
import { renderWithProviders } from "@/tests/render"

function apiError(errorCode: string, message = "Servertext"): ApiError {
  return new ApiError({
    timestamp: "2026-08-29T10:00:00Z",
    status: 409,
    errorCode: errorCode as ApiError["errorCode"],
    message,
    path: "/api/projects",
  })
}

describe("ErrorState", () => {
  it("zeigt den Text zum Fehlercode aus i18n", () => {
    renderWithProviders(<ErrorState error={apiError("RESOURCE_IN_USE")} />)

    expect(screen.getByText(i18n.t("apiError.RESOURCE_IN_USE"))).toBeVisible()
  })

  /*
   * Der Meldungstext des Servers ist Rueckfallebene und nicht Hauptquelle
   * (Contract 6.2): er existiert nur deutsch. Sichtbar wird er nur bei einem
   * Code, den die Uebersetzungsdateien noch nicht kennen, etwa nach einer
   * neuen Contract-Version.
   */
  it("faellt bei unbekanntem Code auf den Servertext zurueck", () => {
    renderWithProviders(
      <ErrorState
        error={apiError("KUENFTIGER_CODE", "Noch nicht uebersetzt")}
      />
    )

    expect(screen.getByText("Noch nicht uebersetzt")).toBeVisible()
  })

  it("zeigt bei einem Nicht-ApiError die allgemeine Meldung", () => {
    renderWithProviders(<ErrorState error={new Error("kaputt")} />)

    expect(screen.getByText(i18n.t("apiError.INTERNAL_ERROR"))).toBeVisible()
    /* Der rohe Fehlertext erscheint nie (Frontend-Regel 3). */
    expect(screen.queryByText("kaputt")).not.toBeInTheDocument()
  })

  it("behandelt einen Transportfehler wie INTERNAL_ERROR", () => {
    renderWithProviders(<ErrorState error={transportError("/api/projects")} />)

    expect(screen.getByText(i18n.t("apiError.INTERNAL_ERROR"))).toBeVisible()
  })

  /*
   * Die Primitive bringt role="alert" mit; genau darauf beruht, dass die
   * Meldung ohne eigene Live-Region bei einem Screenreader ankommt. Ein
   * Wechsel der Primitive, der das verliert, faellt hier auf.
   */
  it("meldet sich als alert, ohne eine eigene Ueberschrift zu setzen", () => {
    renderWithProviders(<ErrorState error={apiError("NO_PERMISSION")} />)

    expect(screen.getByRole("alert")).toBeVisible()
    expect(screen.queryByRole("heading")).not.toBeInTheDocument()
  })
})
