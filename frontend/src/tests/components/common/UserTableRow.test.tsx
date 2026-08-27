import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Table, TableBody } from "@/components/ui/table"
import { renderWithProviders } from "@/tests/render"

import { UserTableRow } from "@/components/common/UserTableRow"

const person = { firstName: "Mira", lastName: "Beispiel" }

function renderRow(row: React.ReactNode) {
  /* Eine tr ausserhalb einer table ist ungueltiges HTML; die Zeile wird
     deshalb in ihrer echten Umgebung gerendert. */
  return renderWithProviders(
    <Table>
      <TableBody>{row}</TableBody>
    </Table>
  )
}

describe("UserTableRow", () => {
  it("zeigt Name, Adresse und Rolle", () => {
    renderRow(
      <UserTableRow
        person={person}
        email="mira.beispiel@stud.hs-bremen.de"
        role="STUDENT"
      />
    )

    expect(screen.getByText("Mira Beispiel")).toBeVisible()
    expect(screen.getByText("mira.beispiel@stud.hs-bremen.de")).toBeVisible()
    expect(screen.getByText("Studierende:r")).toBeVisible()
  })

  it("nimmt Aktionen als Platz entgegen, ohne selbst welche zu kennen", () => {
    renderRow(
      <UserTableRow
        person={person}
        email="mira.beispiel@stud.hs-bremen.de"
        role="ADMIN"
        actions={<button type="button">Bearbeiten</button>}
      />
    )

    expect(screen.getByRole("button", { name: "Bearbeiten" })).toBeVisible()
  })

  /*
   * KAN-83: Auch in der Nutzerzeile ist jeder Texteintrag auf zwanzig Zeichen
   * Breite geklemmt. Der volle Text bleibt dabei im Dokument, statt wie zuvor
   * geschnitten und daneben noch einmal versteckt zu werden.
   */
  it("klemmt Name und Adressen, ohne sie ununterscheidbar zu machen", () => {
    renderRow(
      <UserTableRow
        person={{ firstName: "Maximiliane", lastName: "Beispielhausen" }}
        userId="u-1"
        email="maximiliane.beispielhausen@stud.hs-bremen.de"
        hsbEmail="maximiliane.beispielhausen@hs-bremen.de"
        role="STUDENT"
      />
    )

    /* Der Name ist ein Link: Sichtbarer Text und zugaenglicher Name sind
       derselbe Knoten und dieselbe Zeichenkette (SC 2.5.3). */
    const link = screen.getByRole("link", {
      name: "Maximiliane Beispielhausen",
    })
    expect(link.textContent).toBe("Maximiliane Beispielhausen")
    expect(link).toHaveClass("max-w-[20ch]", "truncate")

    /* Beide Adressen beginnen gleich. Hart geschnitten ergaben sie zweimal
       denselben sichtbaren Text; geklemmt stehen sie beide voll im Dokument
       und sind ueber ihren echten Wert zu finden. */
    for (const address of [
      "maximiliane.beispielhausen@stud.hs-bremen.de",
      "maximiliane.beispielhausen@hs-bremen.de",
    ]) {
      const entry = screen.getByText(address)
      expect(entry).toHaveClass("max-w-[20ch]", "truncate")
      expect(entry).not.toHaveClass("sr-only")
    }
  })

  it("laesst die HSB-Adresse nicht mehr im Wort umbrechen", () => {
    renderRow(
      <UserTableRow
        person={person}
        email="mira@stud.hs-bremen.de"
        hsbEmail="mira.beispiel@hs-bremen.de"
        role="STUDENT"
      />
    )

    /* break-all war der Ersatz fuer eine Adresse, die die Spalte aufzog;
       mit der Klemmung gibt es die nicht mehr. */
    const cell = screen.getByText("mira.beispiel@hs-bremen.de").closest("td")
    expect(cell).not.toHaveClass("break-all")
  })

  it("liest die Initialen nicht zusaetzlich zum Namen vor", () => {
    renderRow(
      <UserTableRow
        person={person}
        email="mira.beispiel@stud.hs-bremen.de"
        role="EDITOR"
      />
    )

    /* Die Avatarflaeche steht direkt neben dem Namen. Traege sie einen
       eigenen Namen, hoerte man "MB Mira Beispiel". */
    expect(
      screen.getByText("MB").closest("[data-slot=avatar]")
    ).toHaveAttribute("aria-hidden", "true")
  })
})
