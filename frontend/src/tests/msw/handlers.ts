import { HttpResponse } from "msw"

import type { ErrorCode } from "@/api/errors"

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
