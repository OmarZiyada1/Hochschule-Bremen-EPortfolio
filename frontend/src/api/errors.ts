/**
 * Fehler-Envelope nach API-Contract 6.2: jede Fehlerantwort des Servers
 * traegt timestamp, status, errorCode, message und path. Dieses Modul
 * uebersetzt jede Fehlerantwort (und jeden Transportfehler) in genau einen
 * Typ, ApiError. Es gibt keinen Pfad, auf dem eine rohe Response oder ein
 * unknown in die Oberflaeche gelangt.
 *
 * Entschieden wird immer ueber errorCode, nie ueber den Meldungstext: der
 * Text ist Prosa, existiert nur deutsch und aendert sich (Contract 6.2).
 */

/*
 * Die Fehlercodes aus Contract 6.2 (v96), deckungsgleich mit
 * common/error/ErrorCodes.java im Backend. Als const-Tupel gefuehrt, damit
 * errorCode eine String-Union traegt: ein Tippfehler in einem Code faellt
 * beim Typecheck auf und nicht erst zur Laufzeit in einer Verzweigung, die
 * nie greift. Reihenfolge wie im Contract: Anfrageformat, Authentifizierung
 * und Autorisierung, Ressourcen, Serverfehler.
 */
export const ERROR_CODES = [
  "VALIDATION_FAILED",
  "LOGIN_FAILED",
  "NOT_AUTHENTICATED",
  "TOKEN_INVALID",
  "TOKEN_EXPIRED",
  "ACCOUNT_NOT_ACTIVE",
  "REGISTRATION_NOT_COMPLETED",
  "NO_PERMISSION",
  "PASSWORD_CHANGE_REQUIRED",
  "TOO_MANY_LOGIN_ATTEMPTS",
  "TOO_MANY_SUPPORT_REQUESTS",
  "VERIFICATION_CODE_INVALID",
  "BLOCK_TYPE_UNKNOWN",
  "BLOCK_CONTENT_INVALID",
  "EMBED_PROVIDER_NOT_ALLOWED",
  "FILE_TYPE_NOT_ALLOWED",
  "FILE_TOO_LARGE",
  "FILE_RANGE_NOT_SATISFIABLE",
  "PROJECT_INCOMPLETE",
  "PROJECT_NOT_FOUND",
  "RESOURCE_NOT_FOUND",
  "PROJECT_VERSION_CONFLICT",
  "PROJECT_LOCKED_BY_OTHER",
  "PROJECT_STATUS_NOT_EDITABLE",
  "PROJECT_STATUS_TRANSITION_INVALID",
  "CHANGE_REQUESTS_OPEN",
  "RESOURCE_IN_USE",
  "PROJECT_NOT_PUBLISHED",
  "NOMINATION_ALREADY_DECIDED",
  "SUPPORT_STATUS_TRANSITION_INVALID",
  "INTERNAL_ERROR",
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

/**
 * Der eine Fehlertyp des Clients. Die Feldnamen sind die des Servers
 * (Contract 6.2, docs/NAMENSSCHEMA.md Abschnitt 5); message kommt aus der
 * Error-Basisklasse und traegt den Meldungstext des Envelopes.
 */
export class ApiError extends Error {
  readonly timestamp: string
  readonly status: number
  readonly errorCode: ErrorCode
  readonly path: string

  constructor(envelope: {
    timestamp: string
    status: number
    errorCode: ErrorCode
    message: string
    path: string
  }) {
    super(envelope.message)
    this.name = "ApiError"
    this.timestamp = envelope.timestamp
    this.status = envelope.status
    this.errorCode = envelope.errorCode
    this.path = envelope.path
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/**
 * Transportfehler ohne Server-Envelope: Server nicht erreichbar, Verbindung
 * abgerissen, oder eine Antwort, die kein Envelope traegt (etwa die
 * HTML-Fehlerseite eines Proxys). Abgebildet auf INTERNAL_ERROR, damit die
 * Union deckungsgleich mit Contract 6.2 bleibt: die Anzeige fuer
 * INTERNAL_ERROR ist ohnehin generisch ("spaeter erneut versuchen") und
 * passt auch hier. status 0 steht fuer "keine Antwort erhalten".
 * Entschieden in der Klaerungsrunde zu KAN-30.
 */
export function transportError(path: string, status = 0): ApiError {
  return new ApiError({
    timestamp: new Date().toISOString(),
    status,
    errorCode: "INTERNAL_ERROR",
    message:
      "Der Server hat nicht oder nicht im erwarteten Format geantwortet.",
    path,
  })
}

/**
 * Uebersetzt den Body einer Fehlerantwort in einen ApiError. Traegt der
 * Body nicht alle fuenf Envelope-Felder, ist es keine Antwort unseres
 * Backends und wird als Transportfehler behandelt (mit dem echten Status).
 *
 * Der errorCode wird nicht gegen die Union geprueft: ein Code, den eine
 * kuenftige Contract-Version ergaenzt, laeuft unveraendert durch und wird
 * von der aufrufenden Stelle behandelt oder faellt dort in den
 * Standardzweig. Ihn auf INTERNAL_ERROR umzubiegen wuerde die Information
 * zerstoeren, ohne etwas sicherer zu machen.
 */
export function apiErrorFromBody(
  body: unknown,
  status: number,
  path: string
): ApiError {
  if (
    typeof body === "object" &&
    body !== null &&
    typeof (body as Record<string, unknown>).timestamp === "string" &&
    typeof (body as Record<string, unknown>).status === "number" &&
    typeof (body as Record<string, unknown>).errorCode === "string" &&
    typeof (body as Record<string, unknown>).message === "string" &&
    typeof (body as Record<string, unknown>).path === "string"
  ) {
    const envelope = body as {
      timestamp: string
      status: number
      errorCode: string
      message: string
      path: string
    }
    return new ApiError({
      ...envelope,
      errorCode: envelope.errorCode as ErrorCode,
    })
  }
  return transportError(path, status)
}

/**
 * Der i18n-Schluessel zu einem ApiError. Je Fehlercode gibt es genau eine
 * Uebersetzungsstelle (apiError.<CODE> in de.json und en.json), analog zu
 * project.status.<WERT>: der Code laeuft unveraendert durch, uebersetzt
 * wird nur die Anzeige. Der message des Servers ist Rueckfallebene fuer
 * Codes, die die i18n-Dateien (noch) nicht kennen, nicht die Hauptquelle:
 * er existiert nur deutsch.
 */
export function apiErrorMessageKey(error: ApiError): string {
  return `apiError.${error.errorCode}`
}

/**
 * Kompatibel zur setError-Funktion von react-hook-form, ohne das Paket zu
 * importieren: es kommt erst mit dem ersten Formular-Ticket ins Projekt
 * (Frontend-Regel 12).
 */
type SetFieldError = (
  name: string,
  error: { type: "server"; message: string }
) => void

/**
 * Ordnet ein 400 VALIDATION_FAILED den Formularfeldern zu. Der Server nennt
 * Feldfehler im Meldungsformat "feld: Text", mehrere durch "; " getrennt
 * (Contract 6.2, GlobalExceptionHandler). Teile, deren Feldname im Formular
 * existiert, landen ueber setError am Feld; alles andere landet unter
 * "root.server" und erscheint als Meldung am Formular.
 *
 * Die Feldliste kommt vom Formular selbst: ohne sie wuerde jeder Doppelpunkt
 * im Meldungstext als Feldname fehlgedeutet.
 */
export function applyValidationErrors(
  error: ApiError,
  fields: readonly string[],
  setError: SetFieldError
): void {
  const unassigned: string[] = []
  for (const part of error.message.split("; ")) {
    const separator = part.indexOf(": ")
    const field = separator > 0 ? part.slice(0, separator) : null
    const target =
      field === null
        ? null
        : fields.includes(field)
          ? field
          : /*
             * Bean Validation nennt verschachtelte Felder mit Pfad und
             * Index, etwa "members[0].projectRole". Kein Formular fuehrt
             * einen solchen Namen in seiner Feldliste, und ohne diesen
             * Rueckfall landete jeder Fehler an einer Liste als anonyme
             * Meldung am Formular. Zugeordnet wird dann das Wurzelsegment,
             * hier also "members": genauer geht es nicht, ohne dass das
             * Formular seine Zeilen durchnummeriert (Befund des
             * frontend-reviewers zu KAN-35).
             */
            (fields.find((known) => known === field.split(/[[.]/)[0]) ?? null)
    if (target !== null) {
      setError(target, { type: "server", message: part.slice(separator + 2) })
    } else {
      unassigned.push(part)
    }
  }
  if (unassigned.length > 0) {
    setError("root.server", { type: "server", message: unassigned.join("; ") })
  }
}
