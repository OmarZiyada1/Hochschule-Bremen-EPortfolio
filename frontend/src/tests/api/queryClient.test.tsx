import { QueryClientProvider, useMutation } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import { HttpResponse, http } from "msw"
import type { ReactNode } from "react"
import { act } from "react"
import { describe, expect, it, vi } from "vitest"

import { endSession, getAuthState, startSession } from "@/api/auth/authStore"
import { setAuthNavigate } from "@/api/auth/redirect"
import { api } from "@/api/client"
import { isApiError } from "@/api/errors"
import { createQueryClient } from "@/api/queryClient"
import { apiErrorResponse } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"

function seedSession() {
  startSession({
    token: "test-token",
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    user: {
      id: "u1",
      email: "erika@example.org",
      role: "STUDENT",
      status: "ACTIVE",
    },
    passwordChangeRequired: false,
  })
}

/*
 * Die zentrale Reaktion aus Ticket KAN-30, Umfang 4: einmal im QueryClient,
 * nicht je Seite. Getestet wird ueber echte Requests durch den Client, weil
 * genau dieser Weg (fetch, Envelope, ApiError, QueryCache) in der Anwendung
 * laeuft.
 */
describe("zentrale Fehlerreaktion", () => {
  it("verwirft bei 401 TOKEN_EXPIRED das Token, hinterlaesst den sichtbaren Hinweis und leitet zum Login", async () => {
    const navigate = vi.fn()
    setAuthNavigate(navigate)
    seedSession()
    server.use(
      http.get("*/api/projects", () =>
        apiErrorResponse(401, "TOKEN_EXPIRED", "/api/projects")
      )
    )

    const queryClient = createQueryClient()
    await expect(
      queryClient.fetchQuery({
        queryKey: ["projects"],
        queryFn: () => api.get("/api/projects"),
      })
    ).rejects.toMatchObject({ errorCode: "TOKEN_EXPIRED" })

    expect(getAuthState().session).toBeNull()
    expect(getAuthState().sessionNotice).toBe("TOKEN_EXPIRED")
    expect(navigate).toHaveBeenCalledWith("/login")
  })

  it("zeigt 403 NO_PERMISSION der aufrufenden Stelle und leitet nicht um", async () => {
    const navigate = vi.fn()
    setAuthNavigate(navigate)
    seedSession()
    server.use(
      http.get("*/api/admin/dashboard", () =>
        apiErrorResponse(403, "NO_PERMISSION", "/api/admin/dashboard")
      )
    )

    const queryClient = createQueryClient()
    await expect(
      queryClient.fetchQuery({
        queryKey: ["adminDashboard"],
        queryFn: () => api.get("/api/admin/dashboard"),
      })
    ).rejects.toMatchObject({ errorCode: "NO_PERMISSION" })

    // Die Meldung gehoert auf die Seite (Fehlerzustand der Ansicht); die
    // Sitzung bleibt bestehen, es gibt keine Weiterleitung.
    expect(getAuthState().session).not.toBeNull()
    expect(navigate).not.toHaveBeenCalled()
  })

  it("leitet bei 403 PASSWORD_CHANGE_REQUIRED zur Passwortseite um und behaelt die Sitzung", async () => {
    const navigate = vi.fn()
    setAuthNavigate(navigate)
    seedSession()
    server.use(
      http.get("*/api/projects", () =>
        apiErrorResponse(403, "PASSWORD_CHANGE_REQUIRED", "/api/projects")
      )
    )

    const queryClient = createQueryClient()
    await expect(
      queryClient.fetchQuery({
        queryKey: ["projects"],
        queryFn: () => api.get("/api/projects"),
      })
    ).rejects.toMatchObject({ errorCode: "PASSWORD_CHANGE_REQUIRED" })

    expect(navigate).toHaveBeenCalledWith("/change-password")
    expect(getAuthState().session).not.toBeNull()
    expect(getAuthState().session?.passwordChangeRequired).toBe(true)
  })

  it("leert den Query-Cache, sobald die Sitzung endet", async () => {
    seedSession()
    server.use(
      http.get("*/api/projects", () => HttpResponse.json({ content: [] }))
    )

    const queryClient = createQueryClient()
    await queryClient.fetchQuery({
      queryKey: ["projects"],
      queryFn: () => api.get("/api/projects"),
    })
    expect(queryClient.getQueryData(["projects"])).toBeDefined()

    // Deckt jeden Ausloeser ab (zentrale 401-Reaktion, Ablauf-Timer,
    // Logout): sie alle beenden die Sitzung ueber den Store.
    endSession("TOKEN_EXPIRED")

    expect(queryClient.getQueryData(["projects"])).toBeUndefined()
  })

  it("leert den Query-Cache auch, sobald eine Sitzung beginnt", async () => {
    server.use(
      http.get("*/api/projects", () => HttpResponse.json({ content: [] }))
    )

    const queryClient = createQueryClient()
    await queryClient.fetchQuery({
      queryKey: ["projects"],
      queryFn: () => api.get("/api/projects"),
    })
    expect(queryClient.getQueryData(["projects"])).toBeDefined()

    // Der Server antwortet je Rolle verschieden (Contract 5); die anonyme
    // Antwort darf nach dem Login nicht unter demselben Key weiterleben.
    seedSession()

    expect(queryClient.getQueryData(["projects"])).toBeUndefined()
  })

  it("reicht 409 PROJECT_VERSION_CONFLICT durch und wiederholt nie automatisch", async () => {
    seedSession()
    let requests = 0
    server.use(
      http.put("*/api/projects/p1", () => {
        requests += 1
        return apiErrorResponse(
          409,
          "PROJECT_VERSION_CONFLICT",
          "/api/projects/p1"
        )
      })
    )

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={createQueryClient()}>
        {children}
      </QueryClientProvider>
    )
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: () =>
            api.put("/api/projects/p1", { title: "Neu", version: 3 }),
        }),
      { wrapper }
    )

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toSatisfy(
        (error: unknown) =>
          isApiError(error) && error.errorCode === "PROJECT_VERSION_CONFLICT"
      )
    })

    expect(requests).toBe(1)
  })
})
