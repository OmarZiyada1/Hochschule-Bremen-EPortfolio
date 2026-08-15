import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/tests/render"

import type { ProjectStatus } from "@/api/types"
import { StatusBadge } from "@/components/common/StatusBadge"

/*
 * Getestet wird die sichtbare Oberflaeche: der Enum-Wert laeuft unveraendert
 * durch den Code, sichtbar ist die deutsche Uebersetzung (Standardsprache).
 */
const expectedLabels: Record<ProjectStatus, string> = {
  DRAFT: "Entwurf",
  SUBMITTED: "Eingereicht",
  APPROVED: "Genehmigt",
  PUBLISHED: "Veröffentlicht",
  REVISION: "Überarbeitung",
}

describe("StatusBadge", () => {
  it.each(Object.entries(expectedLabels))(
    "zeigt %s als uebersetzte Beschriftung",
    (status, label) => {
      renderWithProviders(<StatusBadge status={status as ProjectStatus} />)
      expect(screen.getByText(label)).toBeVisible()
    }
  )
})
