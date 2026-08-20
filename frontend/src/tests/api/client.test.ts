import { HttpResponse, http } from "msw"
import { describe, expect, it } from "vitest"

import { startSession } from "@/api/auth/authStore"
import { api } from "@/api/client"
import { ApiError, isApiError } from "@/api/errors"
import { apiErrorResponse } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { user } from "@/tests/fixtures"

function seedSession(token = "test-token") {
  startSession({
    token,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    user: user({ id: "u1", email: "erika@example.org" }),
    passwordChangeRequired: false,
  })
}

describe("api client", () => {
  it("schickt das Token als Authorization: Bearer mit", async () => {
    let authorization: string | null = null
    server.use(
      http.get("*/api/auth/me", ({ request }) => {
        authorization = request.headers.get("Authorization")
        return HttpResponse.json({ id: "u1", email: "erika@example.org" })
      })
    )
    seedSession("test-token")
    await api.get("/api/auth/me")
    expect(authorization).toBe("Bearer test-token")
  })

  it("schickt ohne Sitzung keinen Authorization-Header", async () => {
    let authorization: string | null = "nicht gelesen"
    server.use(
      http.get("*/api/projects", ({ request }) => {
        authorization = request.headers.get("Authorization")
        return HttpResponse.json({ content: [] })
      })
    )
    await api.get("/api/projects")
    expect(authorization).toBeNull()
  })

  it("liefert bei 204 undefined statt eines Parse-Fehlers", async () => {
    server.use(
      http.post(
        "*/api/auth/logout",
        () => new HttpResponse(null, { status: 204 })
      )
    )
    await expect(api.post<void>("/api/auth/logout")).resolves.toBeUndefined()
  })

  it("wirft das Envelope aus Contract 6.2 als ApiError", async () => {
    server.use(
      http.get("*/api/projects/123", () =>
        apiErrorResponse(404, "PROJECT_NOT_FOUND", "/api/projects/123")
      )
    )
    const failure = api.get("/api/projects/123")
    await expect(failure).rejects.toBeInstanceOf(ApiError)
    await failure.catch((error: unknown) => {
      if (!isApiError(error)) {
        throw error
      }
      expect(error.errorCode).toBe("PROJECT_NOT_FOUND")
      expect(error.status).toBe(404)
    })
  })

  it("macht aus einer Fehlerseite ohne Envelope einen ApiError INTERNAL_ERROR", async () => {
    server.use(
      http.get(
        "*/api/projects",
        () => new HttpResponse("<html>Bad Gateway</html>", { status: 502 })
      )
    )
    await expect(api.get("/api/projects")).rejects.toMatchObject({
      name: "ApiError",
      errorCode: "INTERNAL_ERROR",
      status: 502,
    })
  })

  it("macht aus einem Netzwerkfehler einen ApiError INTERNAL_ERROR mit status 0", async () => {
    server.use(http.get("*/api/projects", () => HttpResponse.error()))
    await expect(api.get("/api/projects")).rejects.toMatchObject({
      name: "ApiError",
      errorCode: "INTERNAL_ERROR",
      status: 0,
    })
  })
})
