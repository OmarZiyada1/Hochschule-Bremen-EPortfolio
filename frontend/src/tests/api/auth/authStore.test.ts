import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getAuthState,
  restoreSession,
  startSession,
  type AuthSession,
} from "@/api/auth/authStore"
import { setAuthNavigate } from "@/api/auth/redirect"

const STORAGE_KEY = "eportfolio.session"

function sessionWithExpiry(expiresAt: string): AuthSession {
  return {
    token: "test-token",
    expiresAt,
    user: {
      id: "u1",
      email: "erika@example.org",
      role: "STUDENT",
      status: "ACTIVE",
    },
    passwordChangeRequired: false,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe("authStore", () => {
  it("beendet die Sitzung zum Ablaufzeitpunkt sichtbar, statt auf den ersten 401 zu warten", () => {
    vi.useFakeTimers()
    const navigate = vi.fn()
    setAuthNavigate(navigate)
    startSession(sessionWithExpiry(new Date(Date.now() + 1_000).toISOString()))
    expect(getAuthState().session).not.toBeNull()

    vi.advanceTimersByTime(1_500)

    expect(getAuthState().session).toBeNull()
    expect(getAuthState().sessionNotice).toBe("TOKEN_EXPIRED")
    expect(navigate).toHaveBeenCalledWith("/login")
  })

  it("stellt eine gueltige Sitzung aus dem localStorage wieder her", () => {
    const stored = sessionWithExpiry(
      new Date(Date.now() + 3_600_000).toISOString()
    )
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))

    restoreSession()

    expect(getAuthState().session?.token).toBe("test-token")
    expect(getAuthState().sessionNotice).toBeNull()
  })

  it("stellt eine abgelaufene Sitzung nicht wieder her und hinterlaesst den Hinweis", () => {
    const stored = sessionWithExpiry(new Date(Date.now() - 1_000).toISOString())
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))

    restoreSession()

    expect(getAuthState().session).toBeNull()
    expect(getAuthState().sessionNotice).toBe("TOKEN_EXPIRED")
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it("raeumt unlesbaren Speicher ab, ohne eine Sitzung anzulegen", () => {
    window.localStorage.setItem(STORAGE_KEY, "{kein json")

    restoreSession()

    expect(getAuthState().session).toBeNull()
    expect(getAuthState().sessionNotice).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
