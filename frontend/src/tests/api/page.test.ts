import { describe, expect, it } from "vitest"

import { emptyPage, hasNextPage } from "@/api/page"

describe("PageResponse-Helfer", () => {
  it("erkennt eine Folgeseite anhand der 0-basierten Seitennummer (Contract 6.6)", () => {
    expect(hasNextPage({ page: 0, totalPages: 7 })).toBe(true)
    expect(hasNextPage({ page: 6, totalPages: 7 })).toBe(false)
    expect(hasNextPage({ page: 0, totalPages: 0 })).toBe(false)
  })

  it("liefert eine leere Seite als Ausgangswert", () => {
    const page = emptyPage<string>()
    expect(page.content).toEqual([])
    expect(page.totalElements).toBe(0)
  })
})
