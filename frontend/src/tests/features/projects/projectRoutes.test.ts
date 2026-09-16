import { describe, expect, it } from "vitest"

import type { ProjectStatus } from "@/api/types"
import { projectHref } from "@/features/projects/projectRoutes"

const ID = "8f14e45f-ceea-467a-9c9e-1f1e3a3d4b5c"
const UNPUBLISHED: ProjectStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REVISION",
]

describe("projectHref", () => {
  it("fuehrt aus einer oeffentlichen Liste immer auf die oeffentliche Seite", () => {
    for (const status of [...UNPUBLISHED, "PUBLISHED" as const]) {
      expect(projectHref(ID, status, "public"), status).toBe(`/projects/${ID}`)
    }
  })

  it("fuehrt die eigene Kachel in den Editor, solange nicht veroeffentlicht", () => {
    /*
     * Der gemeldete Fall: bis dahin zielte jede Kachel auf die oeffentliche
     * Seite, und die traegt seit KAN-104 keinen Weg mehr in den Editor. Wer
     * ein eingereichtes Projekt oeffnete, sah eine Vorschau, in der sich
     * nichts tun liess, nicht einmal das Zurueckziehen.
     */
    for (const status of UNPUBLISHED) {
      expect(projectHref(ID, status, "own"), status).toBe(
        `/projects/${ID}/editor`
      )
    }
  })

  it("fuehrt die Zeile der Redaktion in die Reviewansicht, solange nicht veroeffentlicht", () => {
    for (const status of UNPUBLISHED) {
      expect(projectHref(ID, status, "review"), status).toBe(
        `/projects/${ID}/review`
      )
    }
  })

  it("fuehrt ein veroeffentlichtes Projekt aus jeder Liste auf die oeffentliche Seite", () => {
    /* Dort ist sie die richtige Ansicht, und der Editor haette nichts zu
       bearbeiten (§4.1). */
    for (const view of ["public", "own", "review"] as const) {
      expect(projectHref(ID, "PUBLISHED", view), view).toBe(`/projects/${ID}`)
    }
  })

  it("fuehrt bei unbekanntem Status auf die oeffentliche Seite", () => {
    /*
     * status ist im erzeugten Typ optional, weil springdoc kein Feld als
     * erforderlich markiert. Jemanden auf Verdacht in den Editor zu schicken
     * waere der teurere Irrtum.
     */
    for (const view of ["public", "own", "review"] as const) {
      expect(projectHref(ID, undefined, view), view).toBe(`/projects/${ID}`)
    }
  })
})
