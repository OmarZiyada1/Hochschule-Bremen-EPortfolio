import { renderHook, screen } from "@testing-library/react"
import { HttpResponse, http } from "msw"
import type { ReactNode } from "react"
import { act } from "react"
import { useTranslation } from "react-i18next"
import { describe, expect, it } from "vitest"

import { AuthProvider, useAuth } from "@/api/auth/AuthContext"
import { apiErrorResponse } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"

const STORAGE_KEY = "eportfolio.session"

const loginResponse = {
  token: "jwt-token",
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  passwordChangeRequired: false,
  user: {
    id: "u1",
    email: "erika@example.org",
    firstName: "Erika",
    lastName: "Musterfrau",
    role: "STUDENT",
    status: "ACTIVE",
  },
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
)

/*
 * Sichtbarkeitsprobe fuer den Sitzungshinweis: die echte Anzeige gehoert
 * zur Login-Seite (KAN-31), hier wird belegt, dass der Kontext den Hinweis
 * fuehrt und eine Ansicht ihn zeigen kann, statt leer zu bleiben.
 */
function SessionNoticeProbe() {
  const { sessionNotice, isAuthenticated } = useAuth()
  const { t } = useTranslation()
  if (sessionNotice !== null) {
    return <p role="status">{t(`apiError.${sessionNotice}`)}</p>
  }
  return <p>{isAuthenticated ? "angemeldet" : "nicht angemeldet"}</p>
}

describe("AuthContext", () => {
  it("legt nach dem Login Token und Nutzer im Speicher und im localStorage ab", async () => {
    server.use(
      http.post("*/api/auth/login", () => HttpResponse.json(loginResponse))
    )
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.login("erika@example.org", "geheim-und-lang")
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user?.email).toBe("erika@example.org")
    expect(result.current.role).toBe("STUDENT")
    expect(result.current.expiresAt).toBe(loginResponse.expiresAt)
    expect(result.current.passwordChangeRequired).toBe(false)
    const stored = window.localStorage.getItem(STORAGE_KEY)
    expect(stored).toContain("jwt-token")
  })

  it("reicht einen fehlgeschlagenen Login als ApiError an das Formular durch", async () => {
    server.use(
      http.post("*/api/auth/login", () =>
        apiErrorResponse(401, "LOGIN_FAILED", "/api/auth/login")
      )
    )
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await expect(
        result.current.login("erika@example.org", "falsch-und-lang")
      ).rejects.toMatchObject({ errorCode: "LOGIN_FAILED" })
    })

    expect(result.current.isAuthenticated).toBe(false)
  })

  it("verwirft beim Logout das Token; mehr kann der Server bei einem stateless JWT nicht (Contract 6.5)", async () => {
    server.use(
      http.post("*/api/auth/login", () => HttpResponse.json(loginResponse)),
      http.post(
        "*/api/auth/logout",
        () => new HttpResponse(null, { status: 204 })
      )
    )
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await result.current.login("erika@example.org", "geheim-und-lang")
    })

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it("meldet auch dann lokal ab, wenn der Logout-Request scheitert", async () => {
    server.use(
      http.post("*/api/auth/login", () => HttpResponse.json(loginResponse)),
      http.post("*/api/auth/logout", () =>
        apiErrorResponse(500, "INTERNAL_ERROR", "/api/auth/logout")
      )
    )
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await result.current.login("erika@example.org", "geheim-und-lang")
    })

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it("stellt die Sitzung beim Start aus dem localStorage wieder her", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        token: "jwt-token",
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        user: loginResponse.user,
        passwordChangeRequired: false,
      })
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user?.firstName).toBe("Erika")
  })

  it("zeigt fuer ein abgelaufenes Token eine sichtbare Meldung statt einer leeren Seite", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        token: "jwt-token",
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
        user: loginResponse.user,
        passwordChangeRequired: false,
      })
    )

    renderWithProviders(<SessionNoticeProbe />)

    const notice = screen.getByRole("status")
    expect(notice).toBeVisible()
    expect(notice).toHaveTextContent(
      "Die Sitzung ist abgelaufen. Bitte melden Sie sich erneut an."
    )
  })
})
