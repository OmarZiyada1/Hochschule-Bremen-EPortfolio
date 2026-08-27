import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TruncatedLink, TruncatedText } from "@/components/common/TruncatedText"
import { renderWithProviders } from "@/tests/render"

const LONG = "Nachhaltige Mobilitaetskonzepte fuer die Innenstadt"

/** Die Klassen, aus denen die Klemmung besteht. */
const CLAMP = ["block", "w-fit", "max-w-[20ch]", "truncate"]

/**
 * Klemmung der Tabelleneintraege auf zwanzig Zeichen Breite (KAN-83).
 *
 * <p><strong>Was diese Tests nicht abdecken koennen.</strong> jsdom rechnet
 * kein Layout: Es gibt dort keine Schrift, keine Spaltenbreite und kein
 * {@code ch}, und {@code scrollWidth} wie {@code clientWidth} sind ueberall
 * null. Ob ein Eintrag tatsaechlich optisch abgeschnitten wird, ob das
 * Auslassungszeichen erscheint und ob der Mauszeigertext beim Zeigen kommt,
 * laesst sich hier also nicht pruefen, sondern nur im Browser. Geprueft wird
 * das, was im Dokument steht: dass der volle Text da ist, dass er zugleich der
 * zugaengliche Name ist, und dass die Klemmklassen am richtigen Element
 * haengen.
 */
describe("TruncatedText", () => {
  it("stellt den vollen Text in das Dokument und klemmt ihn per CSS", () => {
    renderWithProviders(<TruncatedText text={LONG} />)

    /* Der Kern der Aenderung: Der Text ist nicht mehr geschnitten, sondern
       nur noch schmaler dargestellt. Deshalb findet ihn getByText mit dem
       vollen Wert, und deshalb findet ihn auch die Browsersuche. */
    const entry = screen.getByText(LONG)
    expect(entry).toHaveClass(...CLAMP)
  })

  it("behandelt einen kurzen Text genauso", () => {
    renderWithProviders(<TruncatedText text="Campus-Garten" />)

    /* Nicht mehr die Zeichenzahl entscheidet, sondern die Darstellung: Das
       Markup ist fuer kurz und lang dasselbe, und ein kurzer Text fuellt den
       Deckel schlicht nicht aus. */
    expect(screen.getByText("Campus-Garten")).toHaveClass(...CLAMP)
  })

  it("versteckt nichts mehr und stellt nichts mehr doppelt hin", () => {
    const { container } = renderWithProviders(<TruncatedText text={LONG} />)

    /* Der sr-only-Zwilling und das aria-hidden am gekappten Teil sind
       ersatzlos entfallen: Sichtbarer Text und vorgelesener Text sind wieder
       ein und derselbe Knoten (SC 2.5.3). */
    expect(container.querySelector("[aria-hidden]")).toBeNull()
    expect(container.querySelector(".sr-only")).toBeNull()
    expect(screen.getAllByText(LONG)).toHaveLength(1)
  })

  it("setzt den Mauszeigertext nur, wenn wirklich etwas abgeschnitten ist", () => {
    renderWithProviders(<TruncatedText text={LONG} />)
    const entry = screen.getByText(LONG)

    /* Im Markup steht nie ein title; gemessen wird erst beim Hinzeigen. Ohne
       Layout meldet jsdom scrollWidth und clientWidth beide als null, nichts
       ist also abgeschnitten, und es bleibt beim fehlenden Attribut. Dass im
       Browser umgekehrt ein title entsteht, kann dieser Test nicht zeigen. */
    expect(entry).not.toHaveAttribute("title")
    fireEvent.pointerEnter(entry)
    expect(entry).not.toHaveAttribute("title")
  })

  it("ergibt nichts, wenn das Feld leer ist", () => {
    renderWithProviders(
      <p data-testid="cell">
        <TruncatedText text={null} />
        <TruncatedText text={undefined} />
        <TruncatedText text="   " />
      </p>
    )

    /* Die nullable Felder des Contracts (§3.3) laufen ohne
       Fallunterscheidung durch: leere Zelle statt „null". */
    expect(screen.getByTestId("cell")).toBeEmptyDOMElement()
  })
})

describe("TruncatedLink", () => {
  it("nennt den vollen Text als Namen und zeigt genau denselben Text", () => {
    renderWithProviders(<TruncatedLink text={LONG} to="/projects/1" />)

    /* SC 2.5.3 „Label in Name": Sichtbares Label und zugaenglicher Name
       muessen dieselbe Zeichenkette sein. Vorher war das Label die Kappung
       und der Name der volle Titel. */
    const link = screen.getByRole("link", { name: LONG })
    expect(link.textContent).toBe(LONG)
    expect(link).toHaveAttribute("href", "/projects/1")
    expect(link).not.toHaveAttribute("aria-label")
    expect(link).not.toHaveAttribute("title")
  })

  it("traegt die Klemmung am Anker selbst", () => {
    renderWithProviders(<TruncatedLink text={LONG} to="/projects/1" />)

    /* Am Anker und nicht an einer Huelle darum: Sonst zeichnete der
       Fokusrahmen um die volle Textbreite und liefe an der Klemmkante ins
       Leere. */
    expect(screen.getByRole("link", { name: LONG })).toHaveClass(...CLAMP)
  })

  it("reicht die eigenen Klassen durch", () => {
    renderWithProviders(
      <TruncatedLink text={LONG} to="/projects/1" className="font-semibold" />
    )

    const link = screen.getByRole("link", { name: LONG })
    expect(link).toHaveClass("font-semibold")
    expect(link).toHaveClass(...CLAMP)
  })
})
