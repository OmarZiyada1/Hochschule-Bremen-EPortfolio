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
