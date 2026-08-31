import { renderHook, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TextPage } from "@/components/common/TextPage"
import i18n from "@/i18n"
import { inlineLinkClass } from "@/lib/inlineLink"
import { useTranslatedList } from "@/lib/useTranslatedList"
import { renderWithProviders } from "@/tests/render"

describe("TextPage", () => {
  it("setzt genau eine Ueberschrift der Ebene 1 und die Einleitung darunter", () => {
    renderWithProviders(
      <TextPage title="Titel" intro="Einleitung">
        <section>
          <h2>Abschnitt</h2>
        </section>
      </TextPage>
    )

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByRole("heading", { level: 1, name: "Titel" })).toBeVisible()
    expect(screen.getByText("Einleitung")).toBeVisible()
    expect(screen.getByRole("heading", { level: 2, name: "Abschnitt" })).toBeVisible()
  })

  /*
   * Der Grund, warum notes ein Feld ist und kein einzelner Absatz: die
   * Hilfeseite traegt zwei Hinweise im Kopf, die Barrierefreiheitserklaerung
   * einen. Ein einzelnes note haette die Hilfeseite gleich wieder aus dem
   * Baustein getrieben (KAN-95).
   */
  it("nimmt mehrere kleine Absaetze auf, in ihrer Reihenfolge", () => {
    renderWithProviders(
      <TextPage title="Titel" intro="Einleitung" notes={["Erster", "Zweiter"]}>
        <p>Inhalt</p>
      </TextPage>
    )

    const first = screen.getByText("Erster")
    const second = screen.getByText("Zweiter")
    expect(first).toBeVisible()
    expect(second).toBeVisible()
    /* DOCUMENT_POSITION_FOLLOWING: "Zweiter" steht hinter "Erster". */
    expect(first.compareDocumentPosition(second)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })

  it("kommt ohne notes aus: dann steht im Kopf allein die Einleitung", () => {
    const { container } = renderWithProviders(
      <TextPage title="Titel" intro="Einleitung">
        <p>Inhalt</p>
      </TextPage>
    )

    expect(screen.getByText("Inhalt")).toBeVisible()
    expect(container.querySelectorAll("header p")).toHaveLength(1)
  })
})

describe("useTranslatedList", () => {
  it("gibt die Punkte einer Aufzaehlung als Feld zurueck", () => {
    const { result } = renderHook(() => useTranslatedList())

    const items = result.current("accessibility.method.items")
    expect(items).toEqual(
      i18n.t("accessibility.method.items", { returnObjects: true })
    )
    expect(items.length).toBeGreaterThan(0)
  })

  /*
   * Der eigentliche Zweck des Helfers. Ohne defaultValue liefert i18next den
   * Schluessel selbst zurueck, und die Zusicherung auf string[] macht daraus
   * im Rendern "[object Object]" statt einer leeren Liste.
   */
  it("liefert eine leere Liste, wenn es den Schluessel nicht gibt", () => {
    const { result } = renderHook(() => useTranslatedList())

    expect(result.current("gibt.es.nicht")).toEqual([])
  })
})

describe("inlineLinkClass", () => {
  /*
   * Die Unterstreichung ist die Zusage: ein Link, der sich allein durch
   * seine Farbe vom Fliesstext abhebt, ist fuer alle verloren, die Farben
   * nicht unterscheiden koennen (SC 1.4.1).
   */
  it("streicht den Link unter und setzt einen eigenen Fokusradius", () => {
    expect(inlineLinkClass).toContain("underline")
    expect(inlineLinkClass).toContain("rounded-selection")
  })
})
