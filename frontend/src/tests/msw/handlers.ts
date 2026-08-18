import { http, HttpResponse } from "msw"

import type { ErrorCode } from "@/api/errors"
import { emptyPage } from "@/api/page"
import type { OwnPortfolioResponse, UserResponse } from "@/api/types"

/**
 * Baut eine Fehlerantwort im Envelope aus Contract 6.2, damit Tests nicht
 * je Datei ein eigenes, womoeglich abweichendes Envelope zusammensetzen.
 * Die Feldnamen sind die des Servers; wer hier ein Feld umbenennt, testet
 * ein Backend, das es nicht gibt.
 */
export function apiErrorResponse(
  status: number,
  errorCode: ErrorCode,
  path: string,
  message = "Testmeldung."
) {
  return HttpResponse.json(
    {
      timestamp: "2026-08-15T12:00:00Z",
      status,
      errorCode,
      message,
      path,
    },
    { status }
  )
}

/**
 * GET /api/portfolio/me (KAN-34). Ohne Argument die Antwort eines Kontos
 * ohne Portfolio-Zeile: 200 mit leeren Feldern, kein 404 (§3.2.1).
 */
export function ownPortfolioHandler(body: OwnPortfolioResponse = {}) {
  return http.get("*/api/portfolio/me", () => HttpResponse.json(body))
}

/**
 * GET /api/auth/me mit den Daten, die {@code signInAs} in die Sitzung legt
 * (KAN-69). Seiten, die ihre Sitzung beim Betreten auffrischen, brauchen
 * den Handler auch dann, wenn sie sich fuer die Antwort nicht weiter
 * interessieren; sonst laeuft der Aufruf in {@code onUnhandledRequest}.
 * Ueberschreibungen fuer den Einzelfall gehen als Argument mit.
 */
export function currentUserHandler(overrides: Partial<UserResponse> = {}) {
  return http.get("*/api/auth/me", () =>
    HttpResponse.json({
      id: "00000000-0000-0000-0000-000000000001",
      email: "mira.beispiel@example.org",
      pendingEmail: null,
      hsbEmail: "mira.beispiel@stud.hs-bremen.de",
      firstName: "Mira",
      lastName: "Beispiel",
      role: "STUDENT",
      status: "ACTIVE",
      ...overrides,
    })
  )
}

/**
 * GET /api/projects mit leerer Seite im Format aus §6.6. Fuer Tests, die
 * eine Seite nur erreichen wollen und sich fuer die Liste nicht
 * interessieren.
 */
export function emptyProjectsHandler() {
  return http.get("*/api/projects", () => HttpResponse.json(emptyPage()))
}
