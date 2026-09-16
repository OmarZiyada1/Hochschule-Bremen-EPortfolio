import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/tests/render"

import { CharacterCounter } from "@/components/common/CharacterCounter"

/* max=100 ergibt eine Ansageschwelle von 10 Zeichen (ein Zehntel, mindestens
   fuenf); angesagt wird darunter in Schritten von fuenf. */
const text = (length: number) => "a".repeat(length)

describe("CharacterCounter", () => {
  it("zeigt die genaue Restanzahl ohne quiet immer an", () => {
    renderWithProviders(<CharacterCounter value={text(5)} max={100} />)

    expect(screen.getByText("Noch 95 Zeichen")).toBeVisible()
  })

  it("haelt die Zahl mit quiet zurueck, bis es knapp wird", () => {
    /*
     * Eine Zahl, die von Anfang an dasteht und fast nie stimmt („noch 827
     * Zeichen"), ist eine Zeile Text je Feld, ohne dass jemand danach
     * gefragt haette. Sichtbar wird sie an derselben Schwelle, an der auch
     * die Ansage einsetzt.
     */
    const { unmount } = renderWithProviders(
      <CharacterCounter id="zaehler" value={text(5)} max={100} quiet />
    )

    /*
     * Zurueckgehalten heisst unsichtbar, nicht weg: das Element bleibt mit
     * seiner ID stehen, sonst zeigte das aria-describedby des Feldes
     * daneben ins Leere und die Hoechstlaenge waere fuer Hilfsmittel
     * nirgends zu erfahren (Befund des frontend-reviewers).
     */
    const quiet = document.getElementById("zaehler")
    expect(quiet).not.toBeNull()
    expect(quiet).toHaveTextContent("Noch 95 Zeichen")
    expect(quiet).toHaveClass("sr-only")
    unmount()

    renderWithProviders(
      <CharacterCounter id="zaehler" value={text(95)} max={100} quiet />
    )
    const near = document.getElementById("zaehler")
    expect(near).toHaveTextContent("Noch 5 Zeichen")
    expect(near).not.toHaveClass("sr-only")
  })

  it("schweigt fern der Grenze, statt jedes Zeichen anzusagen", () => {
    renderWithProviders(<CharacterCounter value={text(5)} max={100} />)

    /* Die Live-Region ist da, sagt aber nichts: sonst bekaeme der Screenreader
       eine Ansage je Tastendruck und uebertoente die eigene Eingabe. */
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
  })

  it("meldet die Restanzahl an der Schwelle", () => {
    renderWithProviders(<CharacterCounter value={text(90)} max={100} />)

    expect(screen.getByRole("status")).toHaveTextContent("Noch 10 Zeichen")
  })

  it("schweigt zwischen zwei Schritten", () => {
    renderWithProviders(<CharacterCounter value={text(93)} max={100} />)

    expect(screen.getByText("Noch 7 Zeichen")).toBeVisible()
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
  })

  it("meldet ueberzaehlige Zeichen sofort", () => {
    renderWithProviders(<CharacterCounter value={text(7)} max={5} />)

    /* Ueberschreitung ist ein Fehlerzustand und haengt an keiner Schwelle. */
    expect(screen.getByRole("status")).toHaveTextContent("2 Zeichen zu viel")
  })
})
