import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/tests/render"

import { Tag } from "@/components/common/Tag"

describe("Tag", () => {
  it("zeigt die Beschriftung aus den Stammdaten", () => {
    renderWithProviders(<Tag>Medieninformatik</Tag>)
    expect(screen.getByText("Medieninformatik")).toBeVisible()
  })
})
