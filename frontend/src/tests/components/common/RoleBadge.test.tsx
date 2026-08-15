import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/tests/render"

import { RoleBadge, type Role } from "@/components/common/RoleBadge"

const expectedLabels: Record<Role, string> = {
  STUDENT: "Studierende:r",
  EDITOR: "Redakteur:in",
  ADMIN: "Admin",
}

describe("RoleBadge", () => {
  it.each(Object.entries(expectedLabels))(
    "zeigt %s als uebersetzte Beschriftung",
    (role, label) => {
      renderWithProviders(<RoleBadge role={role as Role} />)
      expect(screen.getByText(label)).toBeVisible()
    }
  )
})
