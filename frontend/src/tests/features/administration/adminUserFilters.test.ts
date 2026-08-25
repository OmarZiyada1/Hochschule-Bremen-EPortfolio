import { describe, expect, it } from "vitest"

import {
  ADMIN_USER_ROLES,
  ADMIN_USER_STATUSES,
  ALL_ROLES,
  readAdminUserState,
  writeAdminUserState,
} from "@/features/administration/adminUserFilters"

/**
 * Der Ansichtszustand der Nutzerverwaltung (KAN-39): reine Funktionen, also
 * ohne Rendern geprueft (Skill frontend-modul, Abschnitt 3).
 */
describe("adminUserFilters", () => {
  it("fuehrt die drei Rollen und die drei Kontostatus vollstaendig", () => {
    expect(ADMIN_USER_ROLES).toEqual(["STUDENT", "EDITOR", "ADMIN"])
    /* REGISTRATION_PENDING laesst sich nicht setzen (400), ist als Filter
       aber zulaessig: der Bestand muss sichtbar sein (§2.9). */
    expect(ADMIN_USER_STATUSES).toEqual([
      "ACTIVE",
      "DEACTIVATED",
      "REGISTRATION_PENDING",
    ])
  })

  it("liest den Grundzustand ohne Parameter", () => {
    const state = readAdminUserState(new URLSearchParams())

    expect(state).toEqual({ q: "", role: ALL_ROLES, status: null, page: 1 })
  })

  it("verwirft unbekannte Werte in Rolle und Status", () => {
    /* Ein von Hand geschriebener Fantasiewert endete am Server als 400,
       obwohl ihn kein Bedienelement erzeugen kann. */
    const state = readAdminUserState(
      new URLSearchParams("role=TUTOR&status=GESPERRT&page=0")
    )

    expect(state.role).toBe(ALL_ROLES)
    expect(state.status).toBeNull()
    expect(state.page).toBe(1)
  })

  it("laesst den Grundzustand ohne Parameter in der Adresse", () => {
    const params = writeAdminUserState(
      new URLSearchParams("q=mira&role=ADMIN&status=ACTIVE&page=3"),
      { q: "", role: ALL_ROLES, status: null }
    )

    expect(params.toString()).toBe("")
  })

  it("setzt beim Filterwechsel auf Seite 1 zurueck", () => {
    const params = writeAdminUserState(new URLSearchParams("page=4"), {
      role: "EDITOR",
    })

    expect(params.get("page")).toBeNull()
    expect(params.get("role")).toBe("EDITOR")
  })

  it("haelt die Seite, wenn die Seite selbst gewechselt wird", () => {
    const params = writeAdminUserState(new URLSearchParams("q=mira"), {
      page: 2,
    })

    expect(params.get("page")).toBe("2")
    expect(params.get("q")).toBe("mira")
  })
})
