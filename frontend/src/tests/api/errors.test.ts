import { describe, expect, it, vi } from "vitest"

import {
  ApiError,
  apiErrorFromBody,
  apiErrorMessageKey,
  applyValidationErrors,
  isApiError,
  transportError,
} from "@/api/errors"

const envelope = {
  timestamp: "2026-08-15T12:00:00Z",
  status: 404,
  errorCode: "PROJECT_NOT_FOUND",
  message: "Projekt mit ID 123 existiert nicht.",
  path: "/api/projects/123",
}

describe("apiErrorFromBody", () => {
  it("uebersetzt das Envelope aus Contract 6.2 in einen ApiError", () => {
    const error = apiErrorFromBody(envelope, 404, "/api/projects/123")
    expect(isApiError(error)).toBe(true)
    expect(error.timestamp).toBe(envelope.timestamp)
    expect(error.status).toBe(404)
    expect(error.errorCode).toBe("PROJECT_NOT_FOUND")
    expect(error.message).toBe(envelope.message)
    expect(error.path).toBe("/api/projects/123")
  })

  it("behandelt einen Body ohne Envelope-Felder als Transportfehler mit echtem Status", () => {
    const error = apiErrorFromBody(
      { error: "Bad Gateway" },
      502,
      "/api/projects"
    )
    expect(error.errorCode).toBe("INTERNAL_ERROR")
    expect(error.status).toBe(502)
    expect(error.path).toBe("/api/projects")
  })
})

describe("transportError", () => {
  it("traegt INTERNAL_ERROR und status 0 fuer 'keine Antwort erhalten'", () => {
    const error = transportError("/api/projects")
    expect(error.errorCode).toBe("INTERNAL_ERROR")
    expect(error.status).toBe(0)
  })
})

describe("apiErrorMessageKey", () => {
  it("bildet den errorCode unveraendert auf den i18n-Schluessel ab", () => {
    const error = apiErrorFromBody(envelope, 404, envelope.path)
    expect(apiErrorMessageKey(error)).toBe("apiError.PROJECT_NOT_FOUND")
  })
})

describe("applyValidationErrors", () => {
  const validationError = new ApiError({
    timestamp: "2026-08-15T12:00:00Z",
    status: 400,
    errorCode: "VALIDATION_FAILED",
    message:
      "email: darf nicht leer sein; password: muss mindestens 12 Zeichen haben",
    path: "/api/auth/login",
  })

  it("legt jeden Feldfehler ueber setError an das genannte Feld", () => {
    const setError = vi.fn()
    applyValidationErrors(validationError, ["email", "password"], setError)
    expect(setError).toHaveBeenCalledWith("email", {
      type: "server",
      message: "darf nicht leer sein",
    })
    expect(setError).toHaveBeenCalledWith("password", {
      type: "server",
      message: "muss mindestens 12 Zeichen haben",
    })
    expect(setError).toHaveBeenCalledTimes(2)
  })

  it("legt nicht zuordenbare Teile als Meldung an das Formular", () => {
    const setError = vi.fn()
    const error = new ApiError({
      ...validationError,
      message: "selectedRole: passt nicht zur abgeleiteten Rolle",
    })
    applyValidationErrors(error, ["email", "password"], setError)
    expect(setError).toHaveBeenCalledTimes(1)
    expect(setError).toHaveBeenCalledWith("root.server", {
      type: "server",
      message: "selectedRole: passt nicht zur abgeleiteten Rolle",
    })
  })
})
